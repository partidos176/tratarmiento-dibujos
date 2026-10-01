// Copia los cores de ffmpeg.wasm desde node_modules a public/ffmpeg/.
//
// Por que: antes se descargaban de unpkg en cada recarga de la pagina, 30 MB por
// vez y con la pagina ya cargada. Servirlos desde el propio origen (lo que hace
// public/ en Vite) quita esa espera, quita la dependencia del CDN y, sobre todo,
// permite que funcione el core multi-hilo: necesita SharedArrayBuffer, que el
// navegador solo expone con las cabeceras COOP/COEP, y el worker del core
// multi-hilo se crea mucho mejor desde el mismo origen.
//
// Los ficheros no se guardan en git (son 62 MB de binarios): se regeneran con
// 'pnpm install' y este script, que se ejecuta antes de dev y de build.
import { mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const destino = join(raiz, 'public', 'ffmpeg');

// De donde sale cada fichero. El de un hilo y el multi-hilo se copian con
// nombres distintos para que convivan en public/ffmpeg/.
const ficheros = [
  ['node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js', 'core-st.js'],
  ['node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm', 'core-st.wasm'],
  ['node_modules/@ffmpeg/core-mt/dist/umd/ffmpeg-core.js', 'core-mt.js'],
  ['node_modules/@ffmpeg/core-mt/dist/umd/ffmpeg-core.wasm', 'core-mt.wasm'],
  ['node_modules/@ffmpeg/core-mt/dist/umd/ffmpeg-core.worker.js', 'core-mt.worker.js'],
];

mkdirSync(destino, { recursive: true });

let faltan = 0;
for (const [origen, nombre] of ficheros) {
  const ruta = join(raiz, origen);
  if (!existsSync(ruta)) {
    console.warn(`[core-ffmpeg] no existe ${origen}. Ejecuta 'pnpm install' antes.`);
    faltan++;
    continue;
  }
  const salida = join(destino, nombre);
  // No hace falta recopia si ya esta ahi con el mismo tamano.
  if (existsSync(salida) && statSync(salida).size === statSync(ruta).size) continue;
  copyFileSync(ruta, salida);
  console.log(`[core-ffmpeg] ${nombre} (${(statSync(salida).size / 1048576).toFixed(1)} MB)`);
}

if (faltan) {
  console.error('[core-ffmpeg] faltan ficheros del core de ffmpeg.');
  process.exit(1);
}
