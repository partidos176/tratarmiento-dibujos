// Trazado paso a paso del lector de MP4, para ver donde se corta.
import { open } from 'node:fs/promises';

const ruta = process.argv[2];
const manija = await open(ruta, 'r');
const size = (await manija.stat()).size;
const leerRango = async (a, b) => {
  const largo = Math.max(0, Math.min(b, size) - a);
  const buf = new Uint8Array(largo);
  if (largo) await manija.read(buf, 0, largo, a);
  return buf;
};

const u32 = (d, o) => ((d[o] * 0x1000000) + (d[o + 1] << 16) + (d[o + 2] << 8) + d[o + 3]);
const u64 = (d, o) => u32(d, o) * 4294967296 + u32(d, o + 4);
const cc = (d, o) => String.fromCharCode(d[o], d[o + 1], d[o + 2], d[o + 3]);

const recorrer = (d, ini, fin) => {
  const out = [];
  let o = ini;
  while (o + 8 <= fin) {
    let sz = u32(d, o);
    const type = cc(d, o + 4);
    let hdr = 8;
    if (sz === 1) { sz = u64(d, o + 8); hdr = 16; }
    else if (sz === 0) { sz = fin - o; }
    if (sz < hdr || o + sz > fin) { out.push({ type, roto: true, en: o, sz }); break; }
    out.push({ type, inicio: o, fin: o + sz, datos: o + hdr });
    o += sz;
  }
  return out;
};

console.log('tamano ' + size);
let off = 0;
let cajas = [];
while (off + 8 <= size) {
  const cab = await leerRango(off, Math.min(off + 16, size));
  let sz = u32(cab, 0);
  const type = cc(cab, 4);
  let hdr = 8;
  if (sz === 1) { sz = u64(cab, 8); hdr = 16; }
  else if (sz === 0) { sz = size - off; }
  console.log('  nivel superior: ' + type + ' en ' + off + ' tamano ' + sz + ' (' + (sz / 1048576).toFixed(1) + ' MB)');
  cajas.push({ type, inicio: off, fin: off + sz });
  if (sz <= 0) break;
  off += sz;
}

const moov = cajas.find(c => c.type === 'moov');
if (!moov) { console.log('NO HAY moov'); process.exit(1); }
console.log('\nmoov en ' + moov.inicio + '-' + moov.fin);

const d = await leerRango(moov.inicio, moov.fin);
const moovC = recorrer(d, 0, d.length).find(b => b.type === 'moov');
console.log('  caja moov leida: ' + JSON.stringify(moovC));

for (const nivel of recorrer(d, moovC.datos, moovC.fin)) {
  console.log('  hijo: ' + nivel.type);
  if (nivel.type !== 'trak') continue;
  const mdia = recorrer(d, nivel.datos, nivel.fin).find(b => b.type === 'mdia');
  console.log('    mdia: ' + (mdia ? 'si' : 'NO'));
  if (!mdia) continue;
  const hijos = recorrer(d, mdia.datos, mdia.fin);
  console.log('    hijos de mdia: ' + hijos.map(h => h.type).join(', '));
  const hdlr = hijos.find(b => b.type === 'hdlr');
  if (hdlr) console.log('    hdlr tipo: "' + cc(d, hdlr.datos + 8) + '"');
  const mdhd = hijos.find(b => b.type === 'mdhd');
  if (mdhd) console.log('    mdhd version: ' + d[mdhd.datos] + ' timescale: ' + (d[mdhd.datos] === 1 ? u32(d, mdhd.datos + 20) : u32(d, mdhd.datos + 12)));
  const minf = hijos.find(b => b.type === 'minf');
  if (!minf) continue;
  const stbl = recorrer(d, minf.datos, minf.fin).find(b => b.type === 'stbl');
  console.log('    stbl: ' + (stbl ? 'si' : 'NO'));
  if (!stbl) continue;
  const stblCajas = recorrer(d, stbl.datos, stbl.fin);
  console.log('    tablas: ' + stblCajas.map(b => b.type).join(', '));
  const get = (t) => stblCajas.find(b => b.type === t);
  const stsz = get('stsz'), stz2 = get('stz2'), stsc = get('stsc'), stco = get('stco'), co64 = get('co64'), stts = get('stts'), stss = get('stss');
  if (stsz) {
    const b = stsz.datos + 8;
    console.log('    stsz sample_size=' + u32(d, b) + ' sample_count=' + u32(d, b + 4));
  }
  if (stz2) { const b = stz2.datos + 8; console.log('    stz2 campo=' + (d[b] & 3) + ' sample_count=' + u32(d, b + 4)); }
  if (stco) { const b = stco.datos + 8; console.log('    stco entradas=' + u32(d, stco.datos + 4) + ' primeros=' + u32(d, b) + ',' + u32(d, b + 4)); }
  if (co64) { const b = co64.datos + 8; console.log('    co64 entradas=' + u32(d, co64.datos + 4) + ' primeros=' + u64(d, b) + ',' + u64(d, b + 8)); }
  if (stsc) {
    const b = stsc.datos + 8, n = u32(d, stsc.datos + 4);
    const partes = [];
    for (let i = 0; i < Math.min(n, 6); i++) partes.push('c' + u32(d, b + i * 12) + 'x' + u32(d, b + i * 12 + 4));
    console.log('    stsc entradas=' + n + ' ' + partes.join(' '));
  }
  if (stts) {
    const b = stts.datos + 8, n = u32(d, stts.datos + 4);
    const partes = [];
    for (let i = 0; i < Math.min(n, 4); i++) partes.push(u32(d, b + i * 8) + 'x' + u32(d, b + i * 8 + 4));
    console.log('    stts entradas=' + n + ' ' + partes.join(' '));
  }
  if (stss) console.log('    stss entradas=' + u32(d, stss.datos + 4));
  const stsd = stblCajas.find(b => b.type === 'stsd');
  if (!stsd) continue;
  const base = stsd.datos + 8;
  const n = u32(d, base);
  console.log('    stsd entradas: ' + n);
  const entradas = recorrer(d, base, stbl.fin);
  const e = entradas[0];
  console.log('    entrada: ' + JSON.stringify(e));
  if (e) {
    console.log('    formato: ' + e.type);
    console.log('    ancho/alto: ' + u32(d, e.inicio + 8) + '? ' + ((d[e.inicio + 8 + 24] << 8) | d[e.inicio + 8 + 25]) + 'x' + ((d[e.inicio + 8 + 26] << 8) | d[e.inicio + 8 + 27]));
    const hijosE = recorrer(d, e.inicio + 8 + 78, e.fin);
    console.log('    subcajas: ' + (hijosE.map(h => h.type).join(', ') || '(ninguna)'));
  }
}
await manija.close();
