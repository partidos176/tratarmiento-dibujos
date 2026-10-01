import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

// Los cores de ffmpeg se sirven desde la propia app en vez de desde unpkg. Antes
// se bajaban 30 MB de un CDN en cada recarga de la pagina, y en las pruebas el
// multi-hilo fallaba al cargarlo desde ahi ('Failed to fetch', o se quedaba
// colgado). Los copia scripts/copiar-core-ffmpeg.mjs a public/ffmpeg/ antes de
// dev y de build, y Vite los sirve desde el mismo origen: sin CDN, sin espera de
// red y con el worker del multi-hilo en el mismo origen, que es lo que necesita
// con las cabeceras COOP/COEP.
const CORE_BASE = '/ffmpeg/';
const coreSTUrl = `${CORE_BASE}core-st.js`;
const wasmSTUrl = `${CORE_BASE}core-st.wasm`;
const coreMTUrl = `${CORE_BASE}core-mt.js`;
const wasmMTUrl = `${CORE_BASE}core-mt.wasm`;
const workerMTUrl = `${CORE_BASE}core-mt.worker.js`;

// Multi-hilo de ffmpeg: esta apagado a proposito. La pagina ya queda aislada
// entre origenes (COOP/COEP en vite.config.js y firebase.json), asi que
// SharedArrayBuffer esta disponible, pero probando el core-mt@0.12.6 servido
// desde el propio origen se queda COLGADO al cargar: no da error ni aviso en la
// consola y la promesa nunca resuelve. Si se deja puesto, la descarga se queda
// esperando y no termina nunca, que es peor que ir a un solo hilo.
//
// Por eso va detras de este interruptor y no se activa solo. Cuando se averigue
// por que no engancha, se cambia a true y se mide: con 4 nucleos deberia ir de
// 0,84x a algo entre 2x y 3x, que es lo unico que ataca de verdad el cuello de
// botella del reindexado.
const USAR_MULTIHILO = false;

let ffmpegRef = null;
let loadingRef = null;

export const loadFFmpeg = async () => {
  if (ffmpegRef) return ffmpegRef;
  if (loadingRef) return loadingRef;

  loadingRef = (async () => {
    const ffmpeg = new FFmpeg();
    // El core multi-hilo necesita SharedArrayBuffer, que el navegador solo
    // expone si la pagina esta aislada entre origenes (COOP + COEP). El reindexado
    // es la parte lenta de la descarga: a un solo hilo va a 0,84x tiempo real, y
    // con 4 nucleos el multi-hilo es la unica via para acelerarlo de verdad. Asi
    // que se intenta primero el multi-hilo y, si no se puede, se cae al de un
    // solo hilo como siempre, sin que la descarga falle.
    if (USAR_MULTIHILO && typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined') {
      try {
        await ffmpeg.load({
          coreURL: coreMTUrl,
          wasmURL: wasmMTUrl,
          workerURL: workerMTUrl,
          classWorkerURL: workerMTUrl,
        });
        ffmpegRef = ffmpeg;
        ffmpegRef.multihilo = true;
        return ffmpeg;
      } catch (e) {
        console.warn('No se pudo cargar el core multi-hilo de ffmpeg, se usa el de un hilo', e);
      }
    }
    await ffmpeg.load({ coreURL: coreSTUrl, wasmURL: wasmSTUrl });
    ffmpegRef = ffmpeg;
    ffmpegRef.multihilo = false;
    return ffmpeg;
  })();

  try {
    return await loadingRef;
  } catch (e) {
    loadingRef = null;
    throw e;
  }
};

export const trimVideo = async (videoBlob, startTime, endTime, ext = 'mp4') => {
  const ffmpeg = await loadFFmpeg();
  const inputName = `input.${ext === 'mp4' ? 'mp4' : 'webm'}`;
  const outputName = `output.${ext}`;
  await ffmpeg.writeFile(inputName, new Uint8Array(await fetchFile(videoBlob)));
  const duration = endTime - startTime;
  await ffmpeg.exec([
    '-ss', String(startTime),
    '-i', inputName,
    '-t', String(duration),
    '-c', 'copy',
    '-avoid_negative_ts', 'make_zero',
    outputName
  ]);
  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  return new Blob([data.buffer], { type: ext === 'mp4' ? 'video/mp4' : 'video/webm' });
};

export const framesToVideo = async (frames, fps = 30, ext = 'mp4') => {
  const ffmpeg = await loadFFmpeg();
  const inputPattern = 'frame_%05d.png';
  const outputName = `output.${ext}`;

  for (let i = 0; i < frames.length; i++) {
    const padded = String(i + 1).padStart(5, '0');
    const fileName = `frame_${padded}.png`;
    await ffmpeg.writeFile(fileName, new Uint8Array(await fetchFile(frames[i])));
  }

  await ffmpeg.exec([
    '-framerate', String(fps),
    '-i', inputPattern,
    '-c:v', ext === 'mp4' ? 'libx264' : 'libvpx-vp9',
    '-pix_fmt', 'yuv420p',
    '-b:v', '8M',
    outputName
  ]);

  const data = await ffmpeg.readFile(outputName);
  for (let i = 0; i < frames.length; i++) {
    const padded = String(i + 1).padStart(5, '0');
    try { await ffmpeg.deleteFile(`frame_${padded}.png`); } catch (_) {}
  }
  try { await ffmpeg.deleteFile(outputName); } catch (_) {}

  return new Blob([data.buffer], { type: ext === 'mp4' ? 'video/mp4' : 'video/webm' });
};

export const isFFmpegSupported = () => {
  try {
    return typeof WebAssembly !== 'undefined';
  } catch (_) {
    return false;
  }
};
