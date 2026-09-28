// Comprobacion del lector de MP4 contra ficheros reales, en Node.
// No forma parte de la app: solo sirve para verificar que la demultiplexacion
// acierta antes de meterla en el navegador.
//
//   node tools/prueba-mp4demux.mjs "C:\ruta\a\video.mp4"

import { open } from 'node:fs/promises';
import { leerTrackVideo } from '../src/mp4Demux.js';

const ruta = process.argv[2];
if (!ruta) {
  console.error('Uso: node tools/prueba-mp4demux.mjs <fichero.mp4>');
  process.exit(2);
}

const manija = await open(ruta, 'r');
const info = await manija.stat();
const size = info.size;

const leerRango = async (inicio, fin) => {
  const largo = Math.max(0, Math.min(fin, size) - inicio);
  const buf = new Uint8Array(largo);
  if (largo) await manija.read(buf, 0, largo, inicio);
  return buf;
};

let fallo = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  OK   ' : '  FALLO ') + msg);
  if (!cond) fallo++;
};

console.log('\nFichero: ' + ruta);
console.log('Tamano:  ' + (size / 1048576).toFixed(1) + ' MB (' + size + ' bytes, ' + (size > 4294967295 ? 'mas de 4 GB' : 'menos de 4 GB') + ')');

const t0 = Date.now();
const track = await leerTrackVideo({ size, leerRango });
const ms = Date.now() - t0;

if (!track) {
  console.log('\n  FALLO no se ha podido leer el track de video');
  process.exit(1);
}

const primeras = track.samples.slice(0, 5);
const ultimas = track.samples.slice(-3);
let suma = 0;
for (const s of track.samples) suma += s.size;
const durS = (track.samples[track.samples.length - 1].timestamp + track.samples[track.samples.length - 1].duration) / 1e6;
const primeraDur = track.samples[0].duration;

console.log('  Lectura: ' + ms + ' ms');
console.log('\nTrack de video:');
console.log('  Codec:     ' + track.codec);
console.log('  Tamano:    ' + track.ancho + 'x' + track.alto);
console.log('  Timescale: ' + track.timescale);
console.log('  Config:    ' + (track.desc ? track.desc.length + ' bytes' : 'no necesita'));
console.log('  Muestras:  ' + track.samples.length);
console.log('  Duracion:  ' + durS.toFixed(2) + ' s');
console.log('  Tamano total de datos: ' + (suma / 1048576).toFixed(1) + ' MB');
console.log('  Primeros offsets: ' + primeras.map(s => s.offset).join(', '));
console.log('  Primeras marcas (ms): ' + primeras.map(s => Math.round(s.timestamp / 1000)).join(', '));
console.log('  Ultimas marcas (ms): ' + ultimas.map(s => Math.round(s.timestamp / 1000)).join(', '));
console.log('  Claves:    ' + track.samples.filter(s => s.clave).length);

console.log('\nComprobaciones:');
ok(track.samples.length > 0, 'hay muestras');
ok(track.ancho > 0 && track.alto > 0, 'la resolucion sale del stsd');
ok(track.codec && track.codec.length > 3, 'el codec se reconstruye: ' + track.codec);
ok(primeras[0].offset > 0 && primeras[0].size > 0, 'la primera muestra tiene offset y tamano validos');
ok(primeras[0].clave === true, 'la primera muestra es clave (tiene que empezar por un I)');
ok(primeras.every(s => s.offset > 0), 'ningun offset es 0 (o no se han leido los stco)');
ok(track.samples.every(s => s.offset > 0), 'todos los offsets son mayores que 0');
ok(track.samples.every(s => s.size > 0), 'todos los tamanos son mayores que 0');
const av = (cond, msg) => console.log('  AVISO ' + msg);
const mON = track.samples.every((s, i) => i === 0 || s.timestamp > track.samples[i - 1].timestamp);
av(Math.abs(primeraDur - 33333) < 20000, 'el primer frame dura ~1/30 s (' + primeraDur + ' us)');
av(mON, mON ? 'las marcas de tiempo van en orden (sin fotogramas B)' : 'el fichero tiene fotogramas B: las marcas llegan en orden de presentacion, no de decodificacion');
ok(durS > 1, 'la duracion total es sensata');
const distintos = new Set(track.samples.slice(0, 500).map(s => s.size)).size;
ok(distintos > 1, 'los tamanos de muestra varian (bitrate variable): ' + distintos + ' distintos en los 500 primeros');
const solapes = [];
for (let i = 0; i + 1 < Math.min(track.samples.length, 3000); i++) {
  if (track.samples[i + 1].offset < track.samples[i].offset + track.samples[i].size) solapes.push(i);
}
ok(solapes.length === 0, 'las muestras van seguidas sin solaparse (' + solapes.length + ' solapes)');

// Los offsets deben caer dentro del fichero.
const ultimo = track.samples[track.samples.length - 1];
ok(ultimo.offset + ultimo.size <= size, 'el ultimo offset + tamano no se pasa del final del fichero');

// Lectura real de la primera muestra para confirmar que hay bytes de verdad.
const cab = await leerRango(primeras[0].offset,Math.min(primeras[0].offset + 16, size));
ok(cab.length > 0 && cab.some(b => b !== 0), 'la primera muestra tiene datos no nulos');

console.log(fallo ? '\nRESULTADO: ' + fallo + ' comprobacion(es) fallida(s)\n' : '\nRESULTADO: todo correcto\n');
process.exit(fallo ? 1 : 0);
