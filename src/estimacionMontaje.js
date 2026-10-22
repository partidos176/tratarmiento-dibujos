// Estimación de cuánto dura de verdad el montaje, sin subir nada al servidor.
//
// Reproduce la aritmética de construirPlanMontaje() (TratamientoApp.jsx,
// fases 1 y 2):
//   fase 1: cada fila pasa a trozos (periodos de fuente partidos por las
//           animaciones caídas dentro, imágenes de 4 s, clips sueltos) y las
//           transiciones se anotan en la posición donde caen; después se
//           recortan los trozos que se pasan del final del vídeo base.
//   fase 2: cada fundido de d segundos resta d/2 a la línea de tiempo (se come
//           d/2 del final del trozo anterior y d del principio del siguiente,
//           y en su lugar se añade un tramo de transición de d).
//
// Lo que aquí no se puede medir (subidas fallidas, duración real de un clip
// suelto) se aproxima como en el plan: clip de vídeo suelto = 5 s.

const IMG_DUR = 4;
const TRANS_DUR = 2;
const TRANS_MIN = 0.3;
const CLIP_DESCONOCIDO = 5;

const longitudDe = (t) => (t.tipo === 'fuente' ? Number(t.fin) - Number(t.ini) : (t.tipo === 'imagen' ? Number(t.dur) : Number(t.hasta) - Number(t.desde)));

const acortarCola = (t, m) => {
  if (t.tipo === 'fuente') t.fin = Number(t.fin) - m;
  else if (t.tipo === 'imagen') t.dur = Number(t.dur) - m;
  else t.hasta = Number(t.hasta) - m;
};

const avanzarCabeza = (t, m) => {
  if (t.tipo === 'fuente') t.ini = Number(t.ini) + m;
  else if (t.tipo === 'imagen') t.dur = Number(t.dur) - m;
  else t.desde = Number(t.desde) + m;
};

// filas: las líneas seleccionadas de Montaje.
// opts.capturas: animaciones del proyecto ({ videoUrl, tiempo, duracionAnim }).
// opts.videoDur: duración del vídeo base (el mismo `duracion` con el que el
//                plan recorta contra el final del fichero).
// opts.baseDisponible: si hay vídeo base cargado (videoUrlCortes || videoUrl).
export const estimarDuracionMontaje = (filas, opts = {}) => {
  const { capturas = [], videoDur = 0, baseDisponible = true } = opts;
  const res = {
    segundos: 0, bruto: 0, periodos: 0, animaciones: 0, imagenes: 0, clips: 0,
    fundidos: 0, recorteFinal: 0, sinMetraje: [], motivo: null,
  };

  const validas = (filas || []).filter(l => l && (l.imagenUrl || l.videoUrl || (l.inicio != null && l.fin != null) || l.tipo === 'transicion'));
  if (!validas.length) { res.motivo = 'no hay líneas seleccionadas'; return res; }
  if (!baseDisponible && validas.some(l => l.inicio != null)) { res.motivo = 'no hay vídeo base cargado'; return res; }

  // Fase 1: filas -> trozos.
  const trozos = [];
  const transPorPos = new Map();
  for (const linea of validas) {
    if (linea.tipo === 'transicion') {
      // Posición donde cae la unión: entre el trozo anterior y el siguiente.
      transPorPos.set(trozos.length - 1, { dur: Math.max(TRANS_MIN, Number(linea.duracion) || TRANS_DUR) });
      continue;
    }
    const antes = trozos.length;
    if (linea.tipo === 'imagen' && linea.imagenUrl) {
      trozos.push({ tipo: 'imagen', dur: IMG_DUR, desde: 0, hasta: IMG_DUR });
      res.imagenes += IMG_DUR;
    } else if (linea.videoUrl) {
      trozos.push({ tipo: 'clip', desde: 0, hasta: CLIP_DESCONOCIDO });
      res.clips += CLIP_DESCONOCIDO;
    } else if (linea.inicio != null && linea.fin != null) {
      const ini = Math.max(0, Number(linea.inicio));
      const fin = Math.max(ini + 0.5, Number(linea.fin));
      res.periodos += Math.max(0, Number(linea.fin) - Number(linea.inicio));
      // Las animaciones caídas dentro del corte se añaden como clip aparte
      // encima del periodo: suman tiempo, no lo sustituyen.
      const anims = (capturas || [])
        .filter(c => c && c.videoUrl && c.tiempo != null && c.tiempo >= ini && c.tiempo <= fin)
        .map(c => ({ en: c.tiempo, dur: c.duracionAnim || IMG_DUR }))
        .sort((a, b) => a.en - b.en);
      let cursor = ini;
      for (const a of anims) {
        if (!(a.en >= cursor && a.en <= fin)) continue;
        if (a.en - cursor > 0.05) trozos.push({ tipo: 'fuente', ini: cursor, fin: a.en });
        trozos.push({ tipo: 'clip', desde: 0, hasta: a.dur });
        res.animaciones += a.dur;
        cursor = a.en;
      }
      if (fin - cursor > 0.05) trozos.push({ tipo: 'fuente', ini: cursor, fin });
    }
    if (trozos.length === antes) {
      res.sinMetraje.push(linea.concepto || (linea.inicio != null ? Math.round(linea.inicio) + ' s' : '#' + linea.id));
    }
  }
  if (!trozos.length) { res.motivo = 'ninguna línea con metraje'; return res; }

  const longitudAntesDeRecorte = () => trozos.reduce((a, t) => a + Math.max(0, longitudDe(t)), 0);
  const antesDelRecorte = longitudAntesDeRecorte();

  // Recorte contra el final del vídeo base (igual que el plan).
  if (Number.isFinite(videoDur) && videoDur > 0) {
    for (const t of trozos) {
      if (t.tipo !== 'fuente') continue;
      if (t.ini >= videoDur) { t.ini = videoDur; t.fin = videoDur; }
      else if (t.fin > videoDur) t.fin = videoDur;
    }
    for (let i = trozos.length - 1; i >= 0; i--) {
      if (trozos[i].tipo === 'fuente' && !(trozos[i].fin - trozos[i].ini > 0.05)) trozos.splice(i, 1);
    }
  }
  res.recorteFinal = Math.max(0, antesDelRecorte - longitudAntesDeRecorte());
  res.bruto = trozos.reduce((a, t) => a + Math.max(0, longitudDe(t)), 0);

  // Fase 2: fundidos.
  let durTotal = 0;
  for (let i = 0; i < trozos.length; i++) {
    const item = { ...trozos[i] };
    const bruto = transPorPos.get(i);
    let mitad = 0;
    if (i + 1 < trozos.length && bruto) {
      const sig = trozos[i + 1];
      const d = Math.min(bruto.dur, longitudDe(item), longitudDe(sig));
      if (d >= 0.2) {
        mitad = d / 2;
        trozos[i + 1] = { ...sig };
        const avance = Math.min(d, longitudDe(sig) - 0.1);
        if (avance > 0) avanzarCabeza(trozos[i + 1], avance);
      }
    }
    if (mitad > 0) acortarCola(item, mitad);
    if (longitudDe(item) > 0.05) durTotal += longitudDe(item);
    if (mitad > 0 && trozos[i + 1] && longitudDe(trozos[i + 1]) > 0.05) durTotal += mitad * 2;
  }

  res.segundos = durTotal;
  res.fundidos = Math.max(0, res.bruto - durTotal);
  return res;
};
