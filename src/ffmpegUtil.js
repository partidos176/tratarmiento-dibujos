import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

let ffmpegRef = null;
let loadingRef = null;

export const loadFFmpeg = async () => {
  if (ffmpegRef) return ffmpegRef;
  if (loadingRef) return loadingRef;

  loadingRef = (async () => {
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegRef = ffmpeg;
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
