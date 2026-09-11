import { useState, useRef, useEffect } from 'react';
import { guardarSesion, cargarSesion } from './persistencia';

const pathTrianguloRedondeado = (p1, p2, p3, radio) => {
  const v = [p1, p2, p3];
  const s = [];
  for (let i = 0; i < 3; i++) {
    const c = v[i];
    const a = v[(i + 2) % 3];
    const b = v[(i + 1) % 3];
    const la = Math.hypot(a.x - c.x, a.y - c.y);
    const lb = Math.hypot(b.x - c.x, b.y - c.y);
    const k = Math.min(radio, la / 2, lb / 2);
    const ua = { x: (a.x - c.x) / (la || 1), y: (a.y - c.y) / (la || 1) };
    const ub = { x: (b.x - c.x) / (lb || 1), y: (b.y - c.y) / (lb || 1) };
    s.push({ in: { x: c.x + ua.x * k, y: c.y + ua.y * k }, ctrl: c, out: { x: c.x + ub.x * k, y: c.y + ub.y * k } });
  }
  let d = `M ${s[0].in.x} ${s[0].in.y}`;
  for (let i = 0; i < 3; i++) {
    d += ` Q ${s[i].ctrl.x} ${s[i].ctrl.y} ${s[i].out.x} ${s[i].out.y}`;
    const nx = s[(i + 1) % 3];
    d += ` L ${nx.in.x} ${nx.in.y}`;
  }
  return d + ' Z';
};

const puntoEnElipse = (el, dim, angGrados, factorE = 1) => {
  const erx = (el.rx ?? 0.08) * dim.w * factorE;
  const ery = (el.ry ?? 0.08) * dim.h * factorE;
  const rad = angGrados * Math.PI / 180;
  return { x: el.x * dim.w + Math.cos(rad) * erx, y: el.y * dim.h + Math.sin(rad) * ery };
};

const interseccionLineaElipse = (de, hacia, dim) => {
  const dx = (hacia.x - de.x) * dim.w, dy = (hacia.y - de.y) * dim.h;
  const arx = (de.rx ?? 0.08) * dim.w, ary = (de.ry ?? 0.08) * dim.h;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.001 || arx <= 0.001 || ary <= 0.001) return null;
  const t = 1 / Math.sqrt(Math.pow(dx / arx, 2) + Math.pow(dy / ary, 2));
  return { x: de.x * dim.w + dx * t, y: de.y * dim.h + dy * t };
};

function TratamientoApp({ videoInicial }) {
  const [archivo, setArchivo] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [archivoCortes, setArchivoCortes] = useState(null);
  const [videoUrlCortes, setVideoUrlCortes] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoja, setHoja] = useState('Cortes');
  const [progreso, setProgreso] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [capturas, setCapturas] = useState([]);
  const [capturaSeleccionada, setCapturaSeleccionada] = useState(null);
  const [capturaGuardada, setCapturaGuardada] = useState(null);
  const [capturaDuracion, setCapturaDuracion] = useState(null);
  const [fotoCompleta, setFotoCompleta] = useState(false);
  const [figuras, setFiguras] = useState([]);
  const [figuraSeleccionada, setFiguraSeleccionada] = useState(null);
  const [imgDim, setImgDim] = useState(null);
  const [clipActivo, setClipActivo] = useState(null);
  const [arrastrandoMarcaId, setArrastrandoMarcaId] = useState(null);
  const [arrastrePos, setArrastrePos] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [progresoExport, setProgresoExport] = useState(0);
  const [nombreVideo, setNombreVideo] = useState('');
  const [progresoVideo, setProgresoVideo] = useState(0);
  const [abrirCarpetaAlOK, setAbrirCarpetaAlOK] = useState(false);
  const [modoPolilinea, setModoPolilinea] = useState(false);
  const [puntosPolilinea, setPuntosPolilinea] = useState([]);
  const [cortes, setCortes] = useState([]);
  const [duracionCortes, setDuracionCortes] = useState({});
  const [nombreCortes, setNombreCortes] = useState({});
  const [selPeriodo, setSelPeriodo] = useState(null); // 'ct-ini' | 'ct-fin'
  const [cortesEditados, setCortesEditados] = useState({});
  const [fotoPorCorte, setFotoPorCorte] = useState({});
  const [generandoClip, setGenerandoClip] = useState(null);
  const [progresoClips, setProgresoClips] = useState({});
  const [filasMontaje, setFilasMontaje] = useState([]);
const [previewMontaje, setPreviewMontaje] = useState(null);
const previewVideoRef = useRef(null);
const deseaPlayPreviewRef = useRef(false);
const [fasePreview, setFasePreview] = useState('base');
const prevTPreviewRef = useRef(null);
const retomarEnRef = useRef(null);
const animTimerRef = useRef(null);
const animActualRef = useRef(null);
const animMostradasRef = useRef(new Set());
const limpiarTimerAnim = () => { if (animTimerRef.current) { clearTimeout(animTimerRef.current); animTimerRef.current = null; } };
const [previewT, setPreviewT] = useState(null);
const [previewDur, setPreviewDur] = useState(0);
const [previewPlaying, setPreviewPlaying] = useState(false);
const [lineasSelMontaje, setLineasSelMontaje] = useState({});
const [lineaArrastre, setLineaArrastre] = useState(null);
  const [filaArrastrando, setFilaArrastrando] = useState(null);
  const [filaSeleccionada, setFilaSeleccionada] = useState(null);
  const [descargandoMontaje, setDescargandoMontaje] = useState(false);
  const [progresoDescarga, setProgresoDescarga] = useState(0);

  const datosCortes = () => ({
    cortes: [...cortes].sort((a, b) => a - b),
    duracionCortes: { ...duracionCortes },
    nombreCortes: { ...nombreCortes },
    cortesEditados: { ...cortesEditados },
    fotoPorCorte: { ...fotoPorCorte }
  });

  const normalizarFiguras = (lista) => {
    const arr = Array.isArray(lista) ? lista : [];
    const vistos = new Set();
    const base = Date.now();
    return arr
      .filter(f => f && typeof f === 'object' && typeof f.tipo === 'string')
      .map((f, i) => {
        let id = f.id;
        if (id == null || vistos.has(id)) id = base + i * 997 + Math.floor(Math.random() * 997);
        vistos.add(id);
        const c = f.crecimiento;
        return { ...f, id, crecimiento: (typeof c === 'number' && Number.isFinite(c)) ? c : 1 };
      });
  };
  const videoBlobADataUrl = (url) => new Promise((res) => {
    if (!url || typeof url !== 'string' || !url.startsWith('blob:')) { res(null); return; }
    fetch(url).then(r => r.blob()).then(b => {
      if (!b || b.size === 0) { res(null); return; }
      const fr = new FileReader();
      fr.onload = () => res(typeof fr.result === 'string' ? fr.result : null);
      fr.onerror = () => res(null);
      fr.readAsDataURL(b);
    }).catch(() => res(null));
  });
  const dataUrlAVideoBlobUrl = async (dataUrl) => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:video')) return null;
    try {
      const r = await fetch(dataUrl);
      const b = await r.blob();
      if (!b || b.size === 0) return null;
      return URL.createObjectURL(b);
    } catch (_) { return null; }
  };

  const aplicarCortes = async (data) => {
    if (!data || !Array.isArray(data.cortes)) throw new Error('Archivo no válido');
    const lista = data.cortes.filter((c) => Number.isFinite(Number(c))).map((c) => Number(c)).sort((a, b) => a - b);
    const objStr = (o) => (o && typeof o === 'object' ? { ...o } : {});
    setCortes(lista);
    setDuracionCortes(objStr(data.duracionCortes));
    setNombreCortes(objStr(data.nombreCortes));
    setCortesEditados(objStr(data.cortesEditados));
    setFotoPorCorte(objStr(data.fotoPorCorte));
    if (Array.isArray(data.fotos)) {
      const limpias = await Promise.all(
        data.fotos.filter(f => f && f.id != null && f.dataUrl).map(async (f) => {
          const videoUrl = await dataUrlAVideoBlobUrl(f.videoDataUrl);
          const { videoDataUrl: _, ...resto } = f;
          return { ...resto, videoUrl };
        })
      );
      const exentas = new Set([data?.edicion?.captura?.id, data?.capturaSeleccionadaId].filter(id => id != null));
      const esFantasma = (c) => c && (c.figuras == null || (Array.isArray(c.figuras) && c.figuras.length === 0)) && !c.videoUrl && c.insertarEn == null && !exentas.has(c.id);
      setCapturas(prev => {
        const copia = [...prev];
        limpias.forEach(limpia => {
          const ix = copia.findIndex(c => c.id === limpia.id);
          if (ix >= 0) copia[ix] = limpia; else copia.push(limpia);
        });
        return copia.filter(c => !esFantasma(c));
      });
    }
  };

  const exportarCortes = async () => {
    try {
      let capturaConImagen = null;
      if (capturaSeleccionada) {
        capturaConImagen = { ...capturaSeleccionada, videoUrl: null };
        capturaConImagen.imagenEditada = await componerImagenEditada(capturaConImagen.baseDataUrl || capturaConImagen.dataUrl, figuras);
      }
      const idsFotos = new Set(Object.values(fotoPorCorte || {}).flatMap(v => (Array.isArray(v) ? v : [v])).map(v => (v && typeof v === 'object' ? v.capturaId : v)).filter(v => v != null));
      const fotos = await Promise.all(
        (capturas || [])
          .filter(c => c && idsFotos.has(c.id) && c.dataUrl)
          .map(async (c) => ({ ...c, videoUrl: null, videoDataUrl: await videoBlobADataUrl(c.videoUrl) }))
      );
      if (capturaConImagen) {
        capturaConImagen.videoDataUrl = await videoBlobADataUrl(capturaSeleccionada.videoUrl);
        if (!fotos.some(f => f.id === capturaConImagen.id)) fotos.push(capturaConImagen);
      }
      const blob = new Blob([JSON.stringify({ app: 'tratamiento-dibujos-cortes', version: 3, guardado: new Date().toISOString(), ...datosCortes(), fotos, edicion: { figuras: [...figuras], capturaSeleccionadaId: capturaSeleccionada ? capturaSeleccionada.id : null, captura: capturaConImagen } }, null, 2)], { type: 'application/json' });
      const baseVideo = (archivoCortes && archivoCortes.name ? String(archivoCortes.name).replace(/\.[^.]+$/, '') : null) || (archivo && archivo.name ? String(archivo.name).replace(/\.[^.]+$/, '') : null) || 'cortes';
      const nombreArchivo = `${baseVideo}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (e) {
      console.error('Error al exportar los cortes', e);
      window.alert('No se pudieron exportar los cortes: ' + (e?.message || e));
    }
  };

  const importarCortes = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        await aplicarCortes(data);
        if (data.edicion) {
          const cap = data.edicion.captura;
          if (cap && cap.dataUrl) {
            const videoUrl = await dataUrlAVideoBlobUrl(cap.videoDataUrl);
            const { videoDataUrl: _, ...restoCap } = cap;
            const limpia = { ...restoCap, videoUrl };
            setCapturas(prev => prev.some(c => c.id === limpia.id) ? prev.map(c => c.id === limpia.id ? limpia : c) : [...prev, limpia]);
            setCapturaSeleccionada(limpia);
            setFiguras(normalizarFiguras(Array.isArray(data.edicion.figuras) ? data.edicion.figuras : limpia.figuras));
          } else if (Array.isArray(data.edicion.figuras)) {
            setFiguras(normalizarFiguras(data.edicion.figuras));
          }
          setFiguraSeleccionada(null);
          setImgDim(null);
        }
        setAviso('Cortes recuperados');
      } catch (e) {
        console.error('Error al importar los cortes', e);
        window.alert('No se pudieron importar los cortes: ' + (e?.message || e));
      }
    };
    reader.readAsText(file);
  };

    useEffect(() => {
    if (!capturaSeleccionada) return;
    const id = capturaSeleccionada.id;
    setCapturas(prev => {
      const ix = prev.findIndex(c => c.id === id);
      if (ix < 0) return prev;
      if (prev[ix].figuras === figuras) return prev;
      const copia = [...prev];
      copia[ix] = { ...copia[ix], figuras };
      return copia;
    });
  }, [figuras]);

  const SESION_KEY = 'sesion';
  const sesionListaRef = useRef(false);
  const estadoSesionRef = useRef(null);
  const idbAbrir = () => new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open('tratamiento-dibujos', 1);
      req.onupgradeneeded = () => { try { req.result.createObjectStore('kv'); } catch (_) {} };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
  const idbPoner = async (valor) => {
    const db = await idbAbrir();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(valor, SESION_KEY);
      tx.oncomplete = () => { try { db.close(); } catch (_) {} resolve(); };
      tx.onerror = () => reject(tx.error);
    });
  };
  const idbLeer = async () => {
    const db = await idbAbrir();
    const valor = await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const rq = tx.objectStore('kv').get(SESION_KEY);
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
    try { db.close(); } catch (_) {}
    return valor;
  };
  const VIDEO_PP_KEY = 'video-presentacion';
  const VIDEO_CORTES_KEY = 'video-cortes';
  const videoGuardadoRef = useRef({ ppal: null, cortes: null });
  const idbPonerKV = async (clave, valor) => {
    const db = await idbAbrir();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(valor, clave);
      tx.oncomplete = () => { try { db.close(); } catch (_) {} resolve(); };
      tx.onerror = () => reject(tx.error);
    });
  };
  const idbLeerKV = async (clave) => {
    const db = await idbAbrir();
    const valor = await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const rq = tx.objectStore('kv').get(clave);
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
    try { db.close(); } catch (_) {}
    return valor;
  };
  useEffect(() => {
    if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.startsWith('blob:')) return;
    if (videoGuardadoRef.current.ppal === videoUrl) return;
    videoGuardadoRef.current.ppal = videoUrl;
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch(videoUrl);
        const b = await r.blob();
        if (cancelado || !b || !b.size) return;
        await idbPonerKV(VIDEO_PP_KEY, { blob: b, nombre: (archivo && archivo.name) || 'video' });
      } catch (_) {}
    })();
    return () => { cancelado = true; };
  }, [videoUrl]);
  useEffect(() => {
    if (!videoUrlCortes || typeof videoUrlCortes !== 'string' || !videoUrlCortes.startsWith('blob:')) return;
    if (videoGuardadoRef.current.cortes === videoUrlCortes) return;
    videoGuardadoRef.current.cortes = videoUrlCortes;
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch(videoUrlCortes);
        const b = await r.blob();
        if (cancelado || !b || !b.size) return;
        await idbPonerKV(VIDEO_CORTES_KEY, { blob: b, nombre: (archivoCortes && archivoCortes.name) || 'video' });
      } catch (_) {}
    })();
    return () => { cancelado = true; };
  }, [videoUrlCortes]);
  const construirFotoSesion = () => ({
    v: 1,
    guardado: Date.now(),
    capturas: (capturas || []).filter(c => c && c.dataUrl).map(c => ({ ...c, videoUrl: null })),
    capturaSeleccionadaId: capturaSeleccionada ? capturaSeleccionada.id : null,
    figuras: [...figuras],
    ...datosCortes()
  });
  useEffect(() => {
    estadoSesionRef.current = construirFotoSesion();
  });
  useEffect(() => {
    if (!sesionListaRef.current) return;
    const t = setTimeout(() => {
      const foto = estadoSesionRef.current;
      if (foto) { try { idbPoner(foto).catch(() => {}); } catch (_) {} }
    }, 2000);
    return () => clearTimeout(t);
  }, [capturas, cortes, figuras, duracionCortes, nombreCortes, cortesEditados, fotoPorCorte, capturaSeleccionada]);
  useEffect(() => {
    const alOcultar = () => {
      if (document.visibilityState !== 'hidden') return;
      if (!sesionListaRef.current) return;
      const foto = estadoSesionRef.current;
      if (foto) { try { idbPoner(foto).catch(() => {}); } catch (_) {} }
    };
    document.addEventListener('visibilitychange', alOcultar);
    return () => document.removeEventListener('visibilitychange', alOcultar);
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const s = await idbLeer();
        if (s && Array.isArray(s.capturas) && s.capturas.length > 0) {
          setCapturas(s.capturas);
          try { await aplicarCortes(s); } catch (_) {}
          if (Array.isArray(s.figuras)) setFiguras(normalizarFiguras(s.figuras));
          const sel = (s.capturas || []).find(c => c.id === s.capturaSeleccionadaId) || null;
          setCapturaSeleccionada(sel);
          setCapturaGuardada(null);
          setImgDim(null);
          setFiguraSeleccionada(null);
          setAviso('Sesión anterior recuperada');
        }
        try {
          const vp = await idbLeerKV(VIDEO_PP_KEY);
          if (vp && vp.blob && vp.blob.size) {
            const url = URL.createObjectURL(vp.blob);
            videoGuardadoRef.current.ppal = url;
            setArchivo({ name: vp.nombre || 'video' });
            setVideoUrl(url);
            setProgreso(0);
          }
        } catch (_) {}
        try {
          const vc = await idbLeerKV(VIDEO_CORTES_KEY);
          if (vc && vc.blob && vc.blob.size) {
            const url = URL.createObjectURL(vc.blob);
            videoGuardadoRef.current.cortes = url;
            setArchivoCortes({ name: vc.nombre || 'video' });
            setVideoUrlCortes(url);
          }
        } catch (_) {}
      } catch (_) {}
      sesionListaRef.current = true;
    })();
  }, []);

  const generarClipCorte = (fileUrl, inicio, dur) => new Promise((resolve, reject) => {    try {
      const v = document.createElement('video');
      v.muted = true;
      v.preload = 'auto';
      v.src = fileUrl;
      const limpiar = () => { try { v.pause(); } catch (_) {} v.removeAttribute('src'); try { v.load(); } catch (_) {} };
      v.onerror = () => { limpiar(); reject(new Error('No se pudo leer el vídeo')); };
      v.onloadedmetadata = () => {
        const fin = Math.max(0, inicio) + Math.max(1, dur);
        v.currentTime = Math.min(Math.max(0, inicio), Math.max(0, (v.duration || fin) - 0.2));
      };
      v.onseeked = () => {
        try {
          const stream = v.captureStream ? v.captureStream() : v.mozCaptureStream();
          if (!stream) throw new Error('El navegador no permite capturar este vídeo');
          let mr;
          try {
            mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8000000 });
          } catch (_) {
            mr = new MediaRecorder(stream);
          }
          const partes = [];
          mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) partes.push(ev.data); };
          const fin = Math.max(0, inicio) + Math.max(1, dur);
          let terminado = false;
          const terminar = () => {
            if (terminado) return;
            terminado = true;
            try { v.removeEventListener('timeupdate', vigilar); } catch (_) {}
            try { if (mr.state !== 'inactive') mr.stop(); } catch (_) {}
            try { v.pause(); } catch (_) {}
          };
          const vigilar = () => { if (v.currentTime >= fin || v.ended) terminar(); };
          mr.onstop = () => { limpiar(); resolve(new Blob(partes, { type: 'video/webm' })); };
          v.addEventListener('timeupdate', vigilar);
          mr.start(500);
          v.play().catch((err) => { terminar(); limpiar(); reject(err); });
          setTimeout(() => { if (!terminado) { terminar(); } }, (Math.max(1, dur) + 10) * 1000);
        } catch (err) {
          limpiar();
          reject(err);
        }
      };
    } catch (err) {
      reject(err);
    }
  });
  const [modoCorte, setModoCorte] = useState(false);
  const [modoCirculoClick, setModoCirculoClick] = useState(false);
  const [modoFlechaClick, setModoFlechaClick] = useState(false);
  const flechaOrigenRef = useRef(null);
  const [modoLineaClick, setModoLineaClick] = useState(false);
  const lineaOrigenRef = useRef(null);
  const elipsesSessionRef = useRef([]);
  const cancelarVideoRef = useRef(false);
  const videoRef = useRef(null);
  const videoRefCortes = useRef(null);
  const corteCargadoRef = useRef(null);
  const clipOrigenRef = useRef(null);
  const draggingRef = useRef(false);
  const clipRef = useRef(null);
  const clipTimerRef = useRef(null);
  const clipResumeRef = useRef(null);
  const clipMainRef = useRef(null);
  const clipOverlayRef = useRef(null);
  const clipOverlayFadeRef = useRef(false);
  const [clipOverlayUrl, setClipOverlayUrl] = useState(null);
  const prevTiempoRef = useRef(0);
  const marcaMovidaRef = useRef(false);
  const circuloAnimRef = useRef(null);
  const lineaAnimRef = useRef(null);
  const flechaAnimRef = useRef(null);
  const triAnimRef = useRef(null);
  const triAnimStartRef = useRef(0);
  const triAnimPausedAtRef = useRef(0);
  const triAnimElapsedRef = useRef(0);
  const triAnimIdRef = useRef(null);
  const circuitoAnimRef = useRef(null);
  useEffect(() => () => {
    if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
  }, []);

  const editorRef = useRef(null);
  useEffect(() => {
    const onFs = () => {
      setFotoCompleta(!!(editorRef.current && document.fullscreenElement === editorRef.current));
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    setCapturaDuracion(null);
  }, [capturaGuardada]);

  useEffect(() => {
    if (!videoInicial) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(videoInicial);
    const file = videoInicial instanceof File ? videoInicial : new File([videoInicial], 'corte.mp4', { type: 'video/mp4' });
    setArchivo(file);
    setVideoUrl(url);
    setProgreso(0);
    setHoja('Presentación');
  }, [videoInicial]);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const imagenInputRef = useRef(null);

  const previewRestauradaRef = useRef(false);
  const capsListasRef = useRef(false);
  useEffect(() => {
    if (previewMontaje && !(previewMontaje.anims && previewMontaje.anims.length)) { try { localStorage.removeItem('preview_anim'); } catch (_) {} }
  }, [previewMontaje]);
  useEffect(() => {
    if (previewRestauradaRef.current) return;
    let meta = null;
    try { meta = JSON.parse(localStorage.getItem('preview_anim') || 'null'); } catch (_) {}
    if (!meta) return;
    if (!capsListasRef.current) return;
    const listaMeta = Array.isArray(meta.anims) && meta.anims.length
      ? meta.anims
      : (meta.capturaId != null ? [{ capturaId: meta.capturaId, en: meta.animEn, dur: meta.animDur }] : []);
    if (!listaMeta.length) return;
    const resueltas = [];
    for (const m of listaMeta) {
      if (m == null || m.capturaId == null) continue;
      const cap = (capturas || []).find(c => c && String(c.id) === String(m.capturaId) && c.videoUrl);
      if (cap) resueltas.push({ src: cap.videoUrl, en: m.en, dur: m.dur || cap.duracionAnim || 4, id: m.capturaId });
    }
    if (!resueltas.length) { try { localStorage.removeItem('preview_anim'); } catch (_) {} previewRestauradaRef.current = true; return; }
    resueltas.sort((a, b) => a.en - b.en);
    const esFallback = previewMontaje && !(previewMontaje.anims && previewMontaje.anims.length) && resueltas.some(a => previewMontaje.src === a.src);
    if (previewMontaje && !esFallback) { previewRestauradaRef.current = true; return; }
    const base = videoUrlCortes || videoUrl;
    if (!base) {
      if (!previewMontaje) {
        deseaPlayPreviewRef.current = false;
        setFasePreview('base');
        prevTPreviewRef.current = null;
        limpiarTimerAnim();
        animMostradasRef.current.clear(); animActualRef.current = null;
        setPreviewMontaje({ src: resueltas[0].src, inicio: 0, fin: Number.POSITIVE_INFINITY });
      }
      return;
    }
    deseaPlayPreviewRef.current = false;
    setFasePreview('base');
    prevTPreviewRef.current = null;
    limpiarTimerAnim();
    animMostradasRef.current.clear(); animActualRef.current = null;
    setPreviewMontaje({ src: base, inicio: meta.inicio, fin: meta.fin, anims: resueltas, concepto: meta.concepto || '' });
    previewRestauradaRef.current = true;
  }, [capturas, videoUrl, videoUrlCortes, previewMontaje]);

  useEffect(() => () => { if (animTimerRef.current) clearTimeout(animTimerRef.current); }, []);

  useEffect(() => {
    if (hoja !== 'Montaje') {
      deseaPlayPreviewRef.current = false;
      limpiarTimerAnim();
      if (previewVideoRef.current) { try { previewVideoRef.current.pause(); } catch (_) {} }
    }
  }, [hoja]);

  useEffect(() => {
    cargarSesion().then(({ filasMontaje: fm, capturas: caps }) => {
      if (fm.length > 0) setFilasMontaje(fm);
      if (caps.length > 0) setCapturas(caps);
      capsListasRef.current = true;
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => guardarSesion(filasMontaje, capturas), 1000);
    return () => clearTimeout(timer);
  }, [filasMontaje, capturas]);

  const hojas = ['Cortes', 'Presentación', 'Edición', 'Montaje'];

  const colores = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#84cc16', '#d946ef', '#92400e', '#000000', '#ffffff'];

  const handleFile = (e) => {
    const f = e.target.files[0] || null;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setArchivo(f);
    setVideoUrl(f ? URL.createObjectURL(f) : '');
    setProgreso(0);
    corteCargadoRef.current = null;
    clipOrigenRef.current = null;
    clipResumeRef.current = null;
    clipMainRef.current = null;
    if (clipTimerRef.current) { clearTimeout(clipTimerRef.current); clipTimerRef.current = null; }
    setClipActivo(null);
  };

  const formatoTiempo = (s) => {
    const total = Math.max(0, Math.floor(s || 0));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const fijarDuracion = (v) => {
    const d = v ? v.duration : 0;
    if (Number.isFinite(d) && d > 0) { setDuracion(d); return; }
    if (!v) { setDuracion(0); return; }
    const onDur = () => {
      try {
        const dd = v.duration;
        if (Number.isFinite(dd) && dd > 0) setDuracion(dd);
        v.currentTime = 0;
      } catch (_) {}
      v.removeEventListener('durationchange', onDur);
    };
    v.addEventListener('durationchange', onDur);
    try { v.currentTime = Number.MAX_SAFE_INTEGER; } catch (_) { setDuracion(0); }
  };

  const periodo = 0;
  const tActual = videoRef.current ? videoRef.current.currentTime : 0;
  const inicioVentana = 0;
  const finVentana = duracion;
  const span = duracion || 1;
  const dec = 2;

  const totalDuracion = duracion + capturas.filter(c => c.videoUrl && c.insertarEn != null).reduce((sum, c) => sum + (c.duracion || 4), 0);

  const togglePlay = () => {
    if (clipActivo) {
      const c = clipRef.current;
      const v = videoRef.current;
      if (!c) { setClipActivo(null); return; }
      if (c.paused) { c.play().catch(() => {}); if (v) v.play().catch(() => {}); }
      else { c.pause(); if (v) v.pause(); }
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  const buscarEnTimeline = (e) => {
    const video = videoRef.current;
    if (!video || !duracion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const t = x * duracion;
    if (modoCorte) {
      const existe = cortes.some(c => Math.abs(c - t) < 0.3);
      if (existe) return;
      setCortes(prev => [...prev, t].sort((a, b) => a - b));
      setAviso(`Corte en ${formatoTiempo(t)}`);
      return;
    }
    setClipActivo(null);
    if (clipTimerRef.current) { clearTimeout(clipTimerRef.current); clipTimerRef.current = null; }
    prevTiempoRef.current = t;
    video.currentTime = t;
    setProgreso(x);
  };

    const exportarVideo = async (nombre) => {
      const original = videoRef.current;
      if (!original || !duracion) return;
      setExportando(true);
      setProgresoExport(0);
      let orig = null;
      let clipEls = [];
      try {
      cancelarVideoRef.current = false;
      const w = original.videoWidth || 640;
      const h = original.videoHeight || 360;
      const clips = capturas.filter(c => c.videoUrl && c.insertarEn != null).sort((a, b) => a.insertarEn - b.insertarEn);

      const tempImgDim = { w, h };

      const capturasConFiguras = capturas.filter(c => c.figuras && c.figuras.length > 0 && c.tiempo != null && !c.videoUrl);

      const figureImgs = [];
      for (const cap of capturasConFiguras) {
        const parts = cap.figuras.map(f => svgFigura(f, tempImgDim)).filter(Boolean);
        if (parts.length === 0) continue;
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`;
        const blob = new Blob([svgStr], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = await new Promise((resolve) => {
          const i = new Image();
          i.onload = () => { URL.revokeObjectURL(url); resolve(i); };
          i.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
          i.src = url;
        });
        if (img) figureImgs.push({ time: cap.tiempo, img, duration: 3 });
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;z-index:99999;';
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(30);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3500000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

      orig = document.createElement('video');
      orig.muted = true;
      orig.playsInline = true;
      orig.preload = 'auto';
      orig.src = videoUrl;

      await new Promise((res, rej) => { orig.onloadedmetadata = res; orig.onerror = rej; });

      orig.style.position = 'fixed';
      orig.style.opacity = '0.01';
      orig.style.pointerEvents = 'none';
      orig.style.width = '1px';
      orig.style.height = '1px';
      orig.style.left = '0px';
      orig.style.top = '0px';
      document.body.appendChild(orig);

      clipEls = clips.map(c => {
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        v.preload = 'auto';
        v.src = c.videoUrl;
        v.style.position = 'fixed';
        v.style.opacity = '0.01';
        v.style.pointerEvents = 'none';
        v.style.width = '1px';
        v.style.height = '1px';
        v.style.left = '0px';
        v.style.top = '0px';
        document.body.appendChild(v);
        return { c, v };
      });
      await Promise.all(clipEls.map(({ v }) => new Promise((res) => { v.onloadedmetadata = res; v.onerror = res; })));

      let activeClip = null;
      let clipIdx = 0;
      let raf = 0;
      let terminado = false;

      const drawFrame = () => {
        try { ctx.drawImage(orig, 0, 0, w, h); } catch (e) { /* noop */ }
        const t = orig.currentTime;
        for (const fi of figureImgs) {
          if (t >= fi.time && t <= fi.time + fi.duration) {
            try { ctx.drawImage(fi.img, 0, 0, w, h); } catch (e) { /* noop */ }
          }
        }
        if (activeClip && activeClip.readyState >= 2) {
          try { ctx.drawImage(activeClip, 0, 0, w, h); } catch (e) { /* noop */ }
        }
      };

      const marcarCortesExportados = () => {
        const marcar = (lista) => {
          setCortesEditados(prev => {
            const copia = { ...prev };
            lista.forEach(t => {
              if (t == null) return;
              let mejor = null, mejorD = Infinity;
              cortes.forEach(ct => { const d = Math.abs(ct - t); if (d < mejorD) { mejorD = d; mejor = ct; } });
              if (mejor != null && mejorD <= 2) copia[String(mejor)] = true;
            });
            return copia;
          });
        };
        marcar((clips || []).map(cl => cl.tiempo));
        if (corteCargadoRef.current != null) marcar([corteCargadoRef.current]);
      };
      const terminar = async (error, cancelado = false) => {
        if (terminado) return;
        terminado = true;
        cancelarVideoRef.current = false;
        cancelAnimationFrame(raf);
        try { rec.stop(); } catch (e) { /* noop */ }
        try { document.body.removeChild(orig); } catch (e) { /* noop */ }
        try { document.body.removeChild(canvas); } catch (e) { /* noop */ }
        clipEls.forEach(({ v }) => { try { document.body.removeChild(v); } catch (e) { /* noop */ } });
        setExportando(false);
        if (cancelado) { setAviso('Exportación cancelada'); return; }
        if (error) { setAviso('Error al exportar el video'); return; }
        await new Promise(res => { rec.onstop = res; });
        const blob = new Blob(chunks, { type: mime });
        if (nombre) {
          const baseName = (String(nombre).replace(/\.[^.]+$/, '') || 'video');
          try {
            const ffmpeg = await loadFFmpeg();
            await ffmpeg.writeFile('input_export.webm', new Uint8Array(await blob.arrayBuffer()));
            await ffmpeg.exec(['-i', 'input_export.webm', '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-an', 'output_export.mp4']);
            const out = await ffmpeg.readFile('output_export.mp4');
            const mp4Blob = new Blob([out], { type: 'video/mp4' });
            const enlace = document.createElement('a');
            enlace.href = URL.createObjectURL(mp4Blob);
            enlace.download = baseName + '.mp4';
            document.body.appendChild(enlace);
            enlace.click();
            document.body.removeChild(enlace);
            setTimeout(() => URL.revokeObjectURL(enlace.href), 2000);
            setAviso('Vídeo generado y descargado');
            marcarCortesExportados();
          } catch (e) {
            const enlace = document.createElement('a');
            enlace.href = URL.createObjectURL(blob);
            enlace.download = baseName + '.webm';
            document.body.appendChild(enlace);
            enlace.click();
            document.body.removeChild(enlace);
            setTimeout(() => URL.revokeObjectURL(enlace.href), 2000);
            marcarCortesExportados();
          }
          return;
        }
        try {
          const resp = await fetch('/export-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: blob
          });
          const data = await resp.json();
          if (data.ok) {
            setAviso(`Video exportado a C:\\Users\\uSer\\Videos\\${data.name}`);
            setAbrirCarpetaAlOK(true);
          } else {
            setAviso(`Error al exportar: ${data.error || 'desconocido'}`);
          }
        } catch (e) {
          setAviso('Error al exportar: ' + String(e));
        }
      };

      const loop = () => {
        if (cancelarVideoRef.current) { terminar(false, true); return; }
        if (!activeClip && clipIdx < clipEls.length && orig.currentTime >= clipEls[clipIdx].c.insertarEn) {
          orig.pause();
          activeClip = clipEls[clipIdx].v;
          activeClip.currentTime = 0;
          activeClip.play().catch(() => {});
        }
        if (activeClip) {
          const cl = clipEls[clipIdx].c;
          if (activeClip.ended || activeClip.currentTime >= (cl.duracion || 4)) {
            activeClip.pause();
            activeClip = null;
            clipIdx++;
            orig.play().catch(() => {});
          }
        }
        drawFrame();
        if (duracion > 0) setProgresoExport(Math.min(99, Math.round((orig.currentTime / duracion) * 100)));
        if (!terminado) raf = requestAnimationFrame(loop);
      };

      orig.addEventListener('ended', () => terminar(false));
      orig.addEventListener('error', () => terminar(true));

      rec.start(250);
      loop();
      await orig.play();
    } catch (e) {
      console.error('Export error:', e);
      setExportando(false);
      try { if (orig) document.body.removeChild(orig); } catch (err) { /* noop */ }
      try { if (canvas && canvas.parentNode) document.body.removeChild(canvas); } catch (err) { /* noop */ }
      if (typeof clipEls !== 'undefined') clipEls.forEach(({ v }) => { try { document.body.removeChild(v); } catch (err) { /* noop */ } });
      setAviso('Error al exportar el video: ' + (e.message || String(e)));
    }
  };

  const generarVideoParaMontaje = async () => {
    const original = videoRef.current;
    if (!original || !duracion) return null;
    setExportando(true);
    setProgresoExport(0);
    let orig = null;
    let clipEls = [];
    try {
      cancelarVideoRef.current = false;
      const w = original.videoWidth || 640;
      const h = original.videoHeight || 360;
      const clips = capturas.filter(c => c.videoUrl && c.insertarEn != null).sort((a, b) => a.insertarEn - b.insertarEn);
      const tempImgDim = { w, h };
      const capturasConFiguras = capturas.filter(c => c.figuras && c.figuras.length > 0 && c.tiempo != null && !c.videoUrl);
      const figureImgs = [];
      for (const cap of capturasConFiguras) {
        const parts = cap.figuras.map(f => svgFigura(f, tempImgDim)).filter(Boolean);
        if (parts.length === 0) continue;
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`;
        const blob = new Blob([svgStr], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = await new Promise((resolve) => {
          const i = new Image();
          i.onload = () => { URL.revokeObjectURL(url); resolve(i); };
          i.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
          i.src = url;
        });
        if (img) figureImgs.push({ time: cap.tiempo, img, duration: 3 });
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;z-index:99999;';
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(30);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3500000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      orig = document.createElement('video');
      orig.muted = true; orig.playsInline = true; orig.preload = 'auto'; orig.src = videoUrl;
      await new Promise((res, rej) => { orig.onloadedmetadata = res; orig.onerror = rej; });
      orig.style.position = 'fixed'; orig.style.opacity = '0.01'; orig.style.pointerEvents = 'none';
      orig.style.width = '1px'; orig.style.height = '1px'; orig.style.left = '0px'; orig.style.top = '0px';
      document.body.appendChild(orig);
      clipEls = clips.map(c => {
        const v = document.createElement('video');
        v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = c.videoUrl;
        v.style.position = 'fixed'; v.style.opacity = '0.01'; v.style.pointerEvents = 'none';
        v.style.width = '1px'; v.style.height = '1px'; v.style.left = '0px'; v.style.top = '0px';
        document.body.appendChild(v);
        return { c, v };
      });
      await Promise.all(clipEls.map(({ v }) => new Promise((res) => { v.onloadedmetadata = res; v.onerror = res; })));
      let activeClip = null; let clipIdx = 0; let raf = 0; let terminado = false;
      const drawFrame = () => {
        try { ctx.drawImage(orig, 0, 0, w, h); } catch (e) { /* noop */ }
        const t = orig.currentTime;
        for (const fi of figureImgs) {
          if (t >= fi.time && t <= fi.time + fi.duration) {
            try { ctx.drawImage(fi.img, 0, 0, w, h); } catch (e) { /* noop */ }
          }
        }
        if (activeClip && activeClip.readyState >= 2) {
          try { ctx.drawImage(activeClip, 0, 0, w, h); } catch (e) { /* noop */ }
        }
      };
      const resultado = await new Promise((resolve) => {
        const terminar = async (error) => {
          if (terminado) return;
          terminado = true;
          cancelAnimationFrame(raf);
          try { rec.stop(); } catch (e) { /* noop */ }
          try { document.body.removeChild(orig); } catch (e) { /* noop */ }
          try { document.body.removeChild(canvas); } catch (e) { /* noop */ }
          clipEls.forEach(({ v }) => { try { document.body.removeChild(v); } catch (e) { /* noop */ } });
          setExportando(false);
          if (error) { resolve(null); return; }
          await new Promise(res => { rec.onstop = res; });
          const blob = new Blob(chunks, { type: mime });
          resolve(URL.createObjectURL(blob));
        };
        const loop = () => {
          if (cancelarVideoRef.current) { terminar(true); return; }
          if (!activeClip && clipIdx < clipEls.length && orig.currentTime >= clipEls[clipIdx].c.insertarEn) {
            orig.pause();
            activeClip = clipEls[clipIdx].v;
            activeClip.currentTime = 0;
            activeClip.play().catch(() => {});
          }
          if (activeClip) {
            const cl = clipEls[clipIdx].c;
            if (activeClip.ended || activeClip.currentTime >= (cl.duracion || 4)) {
              activeClip.pause(); activeClip = null; clipIdx++;
              orig.play().catch(() => {});
            }
          }
          drawFrame();
          if (duracion > 0) setProgresoExport(Math.min(99, Math.round((orig.currentTime / duracion) * 100)));
          if (!terminado) raf = requestAnimationFrame(loop);
        };
        orig.addEventListener('ended', () => terminar(false));
        orig.addEventListener('error', () => terminar(true));
        rec.start(250);
        loop();
        orig.play().catch(() => {});
      });
      return resultado;
    } catch (e) {
      console.error('Error al generar video para montaje', e);
      setExportando(false);
      try { if (orig) document.body.removeChild(orig); } catch (err) { /* noop */ }
      try { if (canvas && canvas.parentNode) document.body.removeChild(canvas); } catch (err) { /* noop */ }
      if (typeof clipEls !== 'undefined') clipEls.forEach(({ v }) => { try { document.body.removeChild(v); } catch (err) { /* noop */ } });
      return null;
    }
  };

  const capsEditadasDeLinea = (fila) => (capturas || []).filter(c => c && c.dataUrl && c.tiempo != null && fila.inicio != null && fila.fin != null && c.tiempo >= fila.inicio && c.tiempo <= fila.fin);

  const abrirPreviewLinea = (fila, tIr) => {
    const src = videoUrlCortes || videoUrl;
    if (!src) { setAviso('Carga primero un vídeo para previsualizar el fragmento'); return; }
    const anims = (capturas || [])
      .filter(c => c && c.videoUrl && c.tiempo != null && fila.inicio != null && fila.fin != null && c.tiempo >= fila.inicio && c.tiempo <= fila.fin)
      .map(c => ({ src: c.videoUrl, en: c.tiempo, dur: c.duracionAnim || 4, id: c.id }))
      .sort((a, b) => a.en - b.en);
    prevTPreviewRef.current = null;
    limpiarTimerAnim();
    animMostradasRef.current.clear(); animActualRef.current = null;
    deseaPlayPreviewRef.current = true;
    setFasePreview('base');
    setPreviewMontaje({ src, inicio: fila.inicio, fin: fila.fin, concepto: fila.concepto || '', anims });
    const destino = tIr ?? fila.inicio;
    requestAnimationFrame(() => { const v = previewVideoRef.current; if (v) { try { v.currentTime = Math.max(0, destino); v.play().catch(() => {}); } catch (_) {} } });
  };

  const descargarClipConAnimacion = async () => {
    const pv = previewMontaje;
    if (!pv) return false;
    const ini = Math.max(0, pv.inicio);
    const fin = Math.max(ini + 0.5, pv.fin);
    const anims = (pv.anims || []).filter(a => a && a.src && a.en > ini && a.en < fin).sort((a, b) => a.en - b.en);
    if (!anims.length) return false;
    setDescargandoMontaje(true);
    setProgresoDescarga(0);
    let canvas = null;
    let rec = null;
    const els = [];
    let totalDur = 0;
    let elapsedTotal = 0;
    try {
      const w = 1280;
      const h = 720;
      canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;z-index:99999;';
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      rec = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 3500000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const mkVid = async (src) => {
        const vid = document.createElement('video');
        vid.muted = true; vid.playsInline = true; vid.preload = 'auto'; vid.src = src;
        vid.style.cssText = 'position:fixed;opacity:0.01;pointerEvents:none;width:1px;height:1px;left:0;top:0;';
        document.body.appendChild(vid);
        els.push(vid);
        await new Promise((res) => { vid.onloadedmetadata = res; vid.onerror = res; });
        return vid;
      };
      const base = await mkVid(pv.src);
      let segs = [];
      let cursor = ini;
      for (const a of anims) {
        const dur = a.dur || 4;
        segs.push({ el: base, desde: cursor, hasta: a.en });
        const av = await mkVid(a.src);
        segs.push({ el: av, desde: 0, hasta: dur, esAnim: true });
        cursor = a.en;
        totalDur += (a.en - segs[segs.length - 2].desde) + dur;
      }
      segs.push({ el: base, desde: cursor, hasta: fin });
      totalDur += fin - cursor;
      segs = segs.filter(s => s.hasta > s.desde);
      await new Promise((resolve) => {
        let terminado = false;
        let currentSeg = 0;
        let segElapsed = 0;
        rec.onstop = () => {
          const blob = new Blob(chunks, { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${(pv.concepto || 'clip').replace(/[^\w\-áéíóúñ]+/gi, '_')}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          resolve();
        };
        const terminar = () => {
          if (terminado) return;
          terminado = true;
          try { rec.stop(); } catch (_) {}
          els.forEach(v => { try { v.pause(); } catch (_) {} try { document.body.removeChild(v); } catch (_) {} });
          try { document.body.removeChild(canvas); } catch (_) {}
        };
        rec.start(250);
        const loop = () => {
          if (terminado) return;
          if (currentSeg >= segs.length) { terminar(); return; }
          const seg = segs[currentSeg];
          segElapsed += 1 / 30;
          elapsedTotal += 1 / 30;
          if (segElapsed <= 1 / 30 + 0.001) {
            try { seg.el.currentTime = Math.max(0, Math.min(seg.desde, (seg.el.duration || seg.desde + 1) - 0.05)); } catch (_) {}
            seg.el.play().catch(() => {});
          }
          try { ctx.drawImage(seg.el, 0, 0, w, h); } catch (_) {}
          if (pv.concepto) {
            try {
              ctx.font = '800 32px Inter, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = 'rgba(0,0,0,0.65)';
              ctx.fillRect(0, 24, w, 52);
              ctx.fillStyle = '#facc15';
              ctx.fillText(pv.concepto, w / 2, 50);
            } catch (_) {}
          }
          const segDur = seg.hasta - seg.desde;
          const ended = seg.esAnim ? (segElapsed >= segDur) : (seg.el.currentTime >= seg.hasta || segElapsed >= segDur + 1);
          if (ended) { try { seg.el.pause(); } catch (_) {} currentSeg++; segElapsed = 0; }
          setProgresoDescarga(Math.min(99, Math.round((elapsedTotal / Math.max(0.1, totalDur)) * 100)));
          setTimeout(loop, 1000 / 30);
        };
        loop();
      });
    } catch (e) {
      console.error('Error al descargar clip con animación', e);
      setAviso('No se pudo descargar el clip: ' + ((e && e.message) || e));
      try { els.forEach(v => { try { document.body.removeChild(v); } catch (_) {} }); } catch (_) {}
      try { if (canvas && canvas.parentNode) document.body.removeChild(canvas); } catch (_) {}
    } finally {
      setDescargandoMontaje(false);
      setProgresoDescarga(0);
    }
    return true;
  };

  const descargarFragmentoLinea = async (linea) => {
    const baseSrc = videoUrlCortes || videoUrl;
    if (!baseSrc) { setAviso('Carga primero un vídeo para descargar el fragmento'); return false; }
    const ini = Math.max(0, linea.inicio);
    const fin = Math.max(ini + 0.5, linea.fin);
    setDescargandoMontaje(true);
    setProgresoDescarga(0);
    let canvas = null;
    let rec = null;
    let base = null;
    const totalDur = fin - ini;
    try {
      const w = 1280;
      const h = 720;
      canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;z-index:99999;';
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      rec = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 3500000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      base = document.createElement('video');
      base.muted = true; base.playsInline = true; base.preload = 'auto'; base.src = baseSrc;
      base.style.cssText = 'position:fixed;opacity:0.01;pointerEvents:none;width:1px;height:1px;left:0;top:0;';
      document.body.appendChild(base);
      await new Promise((res) => { base.onloadedmetadata = res; base.onerror = res; });
      await new Promise((resolve) => {
        let terminado = false;
        let elapsed = 0;
        rec.onstop = () => {
          const blob = new Blob(chunks, { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${(linea.concepto || 'clip').replace(/[^\w\-áéíóúñ]+/gi, '_')}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          resolve();
        };
        const terminar = () => {
          if (terminado) return;
          terminado = true;
          try { rec.stop(); } catch (_) {}
          try { base.pause(); } catch (_) {}
          try { document.body.removeChild(base); } catch (_) {}
          try { document.body.removeChild(canvas); } catch (_) {}
        };
        rec.start(250);
        try { base.currentTime = Math.max(0, Math.min(ini, (base.duration || ini + 1) - 0.05)); } catch (_) {}
        base.play().catch(() => {});
        const loop = () => {
          if (terminado) return;
          elapsed += 1 / 30;
          try { ctx.drawImage(base, 0, 0, w, h); } catch (_) {}
          if (linea.concepto) {
            try {
              ctx.font = '800 32px Inter, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = 'rgba(0,0,0,0.65)';
              ctx.fillRect(0, 24, w, 52);
              ctx.fillStyle = '#facc15';
              ctx.fillText(linea.concepto, w / 2, 50);
            } catch (_) {}
          }
          if (base.currentTime >= fin || elapsed >= totalDur + 1) { terminar(); return; }
          setProgresoDescarga(Math.min(99, Math.round((elapsed / Math.max(0.1, totalDur)) * 100)));
          setTimeout(loop, 1000 / 30);
        };
        loop();
      });
    } catch (e) {
      console.error('Error al descargar fragmento', e);
      setAviso('No se pudo descargar el fragmento: ' + ((e && e.message) || e));
      try { if (base) document.body.removeChild(base); } catch (_) {}
      try { if (canvas && canvas.parentNode) document.body.removeChild(canvas); } catch (_) {}
    } finally {
      setDescargandoMontaje(false);
      setProgresoDescarga(0);
    }
    return true;
  };

  const descargarMontaje = async () => {
    const items = filasMontaje;
    const mediaItems = items.filter(f => f.tipo !== 'transicion');
    if (mediaItems.length === 0) return;
    setDescargandoMontaje(true);
    setProgresoDescarga(0);
    let canvas = null;
    let ctx = null;
    let rec = null;
    const mediaEls = [];
    try {
      const w = 1280;
      const h = 720;
      canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;z-index:99999;';
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      rec = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 3500000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

      for (const item of mediaItems) {
        if (item.tipo === 'imagen' && item.imagenUrl) {
          const img = document.createElement('img');
          img.crossOrigin = 'anonymous';
          img.style.cssText = 'position:fixed;opacity:0.01;pointerEvents:none;width:1px;height:1px;left:0;top:0;';
          document.body.appendChild(img);
          await new Promise((res) => { img.onload = res; img.onerror = res; img.src = item.imagenUrl; });
          mediaEls.push({ el: img, tipo: 'imagen', duracion: 4 });
        } else if (item.videoUrl) {
          const vid = document.createElement('video');
          vid.muted = true; vid.playsInline = true; vid.preload = 'auto'; vid.src = item.videoUrl;
          vid.style.cssText = 'position:fixed;opacity:0.01;pointerEvents:none;width:1px;height:1px;left:0;top:0;';
          document.body.appendChild(vid);
          await new Promise((res) => { vid.onloadedmetadata = res; vid.onerror = res; });
          mediaEls.push({ el: vid, tipo: 'video', duracion: vid.duration || 5 });
        }
      }

      const segs = [];
      let mediaIdx = 0;
      for (let i = 0; i < items.length; i++) {
        if (items[i].tipo === 'transicion') {
          segs.push({ tipo: 'transicion', duracion: items[i].duracion || 2 });
        } else {
          if (mediaIdx < mediaEls.length) {
            segs.push({ tipo: mediaEls[mediaIdx].tipo, el: mediaEls[mediaIdx].el, duracion: mediaEls[mediaIdx].duracion });
            mediaIdx++;
          }
        }
      }

      const resultado = await new Promise((resolve) => {
        let terminado = false;
        let currentSeg = 0;
        let segElapsed = 0;
        let prevEl = null;
        let nextEl = null;
        let crossfadeElapsed = 0;
        const totalSegs = segs.length;
        const totalDur = segs.reduce((s, seg) => s + seg.duracion, 0);

        const terminar = (error) => {
          if (terminado) return;
          terminado = true;
          try { rec.stop(); } catch (_) {}
          mediaEls.forEach(m => { try { document.body.removeChild(m.el); } catch (_) {} });
          try { document.body.removeChild(canvas); } catch (_) {}
          setDescargandoMontaje(false);
          setProgresoDescarga(0);
          if (error) { resolve(null); return; }
          rec.onstop = () => {
            const blob = new Blob(chunks, { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'montaje.webm'; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            resolve(url);
          };
        };

        const loop = () => {
          if (terminado) return;
          if (currentSeg >= segs.length) { terminar(false); return; }
          const seg = segs[currentSeg];
          segElapsed += 1 / 30;

          if (seg.tipo === 'transicion') {
            crossfadeElapsed += 1 / 30;
            const t = Math.min(crossfadeElapsed / seg.duracion, 1);
            ctx.globalAlpha = 1;
            if (prevEl) {
              const ok = prevEl.tagName === 'IMG' ? prevEl.complete : prevEl.readyState >= 2;
              if (ok) {
                ctx.globalAlpha = 1 - t;
                try { ctx.drawImage(prevEl, 0, 0, w, h); } catch (_) {}
              }
            }
            if (nextEl) {
              const ok = nextEl.tagName === 'IMG' ? nextEl.complete : nextEl.readyState >= 2;
              if (ok) {
                ctx.globalAlpha = t;
                try { ctx.drawImage(nextEl, 0, 0, w, h); } catch (_) {}
              }
            }
            ctx.globalAlpha = 1;
            if (crossfadeElapsed >= seg.duracion) {
              if (prevEl) { try { prevEl.pause && prevEl.pause(); } catch (_) {} }
              prevEl = nextEl;
              if (prevEl) {
                if (prevEl.tagName === 'IMG') { /* images don't need play */ }
                else { prevEl.currentTime = 0; prevEl.play().catch(() => {}); }
              }
              nextEl = null;
              crossfadeElapsed = 0;
              currentSeg++;
            }
          } else {
            const el = seg.el;
            const esImagen = seg.tipo === 'imagen';
            if (segElapsed <= 1 / 30 + 0.001 && !esImagen) {
              el.currentTime = 0;
              el.play().catch(() => {});
            }
            try { ctx.globalAlpha = 1; ctx.drawImage(el, 0, 0, w, h); } catch (_) {}
            const ended = esImagen ? segElapsed >= seg.duracion : (el.ended || segElapsed >= seg.duracion);
            if (ended) {
              if (!esImagen) try { el.pause(); } catch (_) {}
              prevEl = el;
              currentSeg++;
              segElapsed = 0;
              if (currentSeg < segs.length && segs[currentSeg].tipo === 'transicion') {
                const nextIdx = currentSeg + 1;
                if (nextIdx < segs.length && segs[nextIdx].tipo !== 'transicion') {
                  nextEl = segs[nextIdx].el;
                  if (nextEl.tagName !== 'IMG') { nextEl.currentTime = 0; nextEl.play().catch(() => {}); }
                }
                crossfadeElapsed = 0;
              }
            }
          }

          const progress = totalSegs > 0 ? Math.min(99, Math.round(((currentSeg + segElapsed / (segs[currentSeg]?.duracion || 1)) / totalSegs) * 100)) : 0;
          setProgresoDescarga(progress);
          if (!terminado) requestAnimationFrame(loop);
        };

        rec.start(250);
        requestAnimationFrame(loop);
      });
      return resultado;
    } catch (e) {
      console.error('Error al descargar montaje', e);
      mediaEls.forEach(m => { try { document.body.removeChild(m.el); } catch (_) {} });
      try { if (canvas && canvas.parentNode) document.body.removeChild(canvas); } catch (_) {}
      setDescargandoMontaje(false);
      setProgresoDescarga(0);
      return null;
    }
  };

  const idDeFoto = (x) => (x && typeof x === 'object' ? x.capturaId : x);
  const listaFotosCorte = (ct) => {
    const f = fotoPorCorte[String(ct)];
    if (!f) return [];
    const arr = Array.isArray(f) ? f : [f];
    return arr.filter(x => x != null);
  };
  const asignarFotoACorte = (capturaId, dataUrl, figuras, tiempo, soloSiVacio = false, baseDataUrl = null) => {
    const tCap = (tiempo ?? 0) + (clipOrigenRef.current ?? 0);
    let mejor = null, mejorD = Infinity;
    cortes.forEach(ct => { const d = Math.abs(ct - tCap); if (d < mejorD) { mejorD = d; mejor = ct; } });
    if (mejor != null && mejorD <= 10) {
      const k = String(mejor);
      const foto = { capturaId, dataUrl, figuras: Array.isArray(figuras) ? [...figuras] : [], ...(baseDataUrl ? { baseDataUrl } : {}) };
      setFotoPorCorte(prev => {
        const actual = Array.isArray(prev[k]) ? prev[k] : (prev[k] ? [prev[k]] : []);
        if (soloSiVacio && actual.length > 0) return prev;
        return { ...prev, [k]: [...actual.filter(x => idDeFoto(x) !== capturaId), foto] };
      });
    }
  };

  const capturarImagen = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setReproduciendo(false);
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const nueva = { id: Date.now(), dataUrl: canvas.toDataURL('image/png'), tiempo: v.currentTime };
    setFiguras([]);
    setFiguraSeleccionada(null);
    setCapturaSeleccionada(nueva);
    setCapturaGuardada(null);
    setImgDim(null);
    setHoja('Edición');
  };

  const anadirTriangulo = () => {
    const id = Date.now();
    setFiguras(prev => [...prev, { id, tipo: 'triangulo', x: 0.5, y: 0.5, ancho: 0.06, alto: 0.35, color: '#f97316', opacidad: 0.7, crecimiento: 0.6 }]);
    setFiguraSeleccionada(id);
    if (triAnimRef.current) cancelAnimationFrame(triAnimRef.current);
    triAnimIdRef.current = id;
    triAnimElapsedRef.current = 0;
    triAnimStartRef.current = performance.now();
    const paso = (t) => {
      const v = videoRef.current;
      if (v && !v.paused) {
        triAnimElapsedRef.current += (t - triAnimStartRef.current);
      }
      triAnimStartRef.current = t;
      const p = Math.min(1, triAnimElapsedRef.current / 4000);
      const e = 0.6 + 0.4 * (1 - Math.pow(1 - p, 2.5));
      setFiguras(prev => prev.map(f => f.id === id ? { ...f, crecimiento: e } : f));
      if (p < 1) triAnimRef.current = requestAnimationFrame(paso);
      else triAnimRef.current = null;
    };
    triAnimRef.current = requestAnimationFrame(paso);
  };

  const actualizarFigura = (id, cambios) => {
    setFiguras(prev => prev.map(f => f.id === id ? { ...f, ...cambios } : f));
  };

  const anadirCircuito = () => {
    const id = Date.now();
    const final = [{ x: 0.2, y: 0.5 }, { x: 0.4, y: 0.5 }, { x: 0.6, y: 0.5 }, { x: 0.8, y: 0.5 }];
    const cx = 0.5, cy = 0.5;
    setFiguras(prev => [...prev, { id, tipo: 'circuito', elipses: final.map(() => ({ x: cx, y: cy, rx: 0, ry: 0 })), color: '#38bdf8', opacidad: 1, grosor: 0.005 }]);
    setFiguraSeleccionada(id);
    if (circuitoAnimRef.current) cancelAnimationFrame(circuitoAnimRef.current);
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / 1000);
      const e = 1 - Math.pow(1 - p, 3);
      setFiguras(prev => prev.map(f => {
        if (f.id !== id) return f;
        return { ...f, elipses: final.map((fin, i) => ({ x: cx + (fin.x - cx) * e, y: cy + (fin.y - cy) * e, rx: 0.08 * e, ry: 0.08 * e })) };
      }));
      if (p < 1) circuitoAnimRef.current = requestAnimationFrame(paso);
      else circuitoAnimRef.current = null;
    };
    circuitoAnimRef.current = requestAnimationFrame(paso);
  };

  const anadirCirculo = () => {
    const id = Date.now();
    setFiguras(prev => [...prev, { id, tipo: 'circulo', x: 0.5, y: 0.5, ancho: 0.2, alto: 0.2, color: '#38bdf8', opacidad: 0.5, crecimiento: 0, rot: 0 }]);
    setFiguraSeleccionada(id);
  };

  const anadirCirculoHueco = () => {
    const id = Date.now();
    setFiguras(prev => [...prev, { id, tipo: 'c', x: 0.5, y: 0.5, ancho: 0.1, alto: 0.1, color: '#38bdf8', opacidad: 1, grosor: 0.005, rot: 0, hueco: 90, crecimiento: 1 }]);
    setFiguraSeleccionada(id);
  };

  const anadirTexto = () => {
    const id = Date.now();
    setFiguras(prev => [...prev, { id, tipo: 'texto', x: 0.5, y: 0.5, fontSize: 0.06, color: '#ffffff', opacidad: 1, texto: 'Texto', negrita: false }]);
    setFiguraSeleccionada(id);
  };

  const anadirLinea = () => {
    const id = Date.now();
    const x1 = 0.3;
    const y1 = 0.5;
    const x2 = 0.7;
    const y2 = 0.5;
    setFiguras(prev => [...prev, { id, tipo: 'linea', x1, y1, x2: x1, y2: y1, color: '#38bdf8', opacidad: 1, grosor: 0.005 }]);
    setFiguraSeleccionada(id);
    if (lineaAnimRef.current) cancelAnimationFrame(lineaAnimRef.current);
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / 1000);
      const e = 1 - Math.pow(1 - p, 3);
      setFiguras(prev => prev.map(f => f.id === id ? { ...f, x2: x1 + (x2 - x1) * e, y2: y1 + (y2 - y1) * e } : f));
      if (p < 1) lineaAnimRef.current = requestAnimationFrame(paso);
      else lineaAnimRef.current = null;
    };
    lineaAnimRef.current = requestAnimationFrame(paso);
  };

  const anadirFlecha = () => {
    const id = Date.now();
    const x1 = 0.25;
    const y1 = 0.5;
    const x2 = 0.75;
    const y2 = 0.5;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    setFiguras(prev => [...prev, { id, tipo: 'flecha', x1, y1, x2, y2, cx, cy, color: '#38bdf8', opacidad: 1, grosor: 0.005, discontinuo: false, cabeza: 1, crecimiento: 0 }]);
    setFiguraSeleccionada(id);
    if (flechaAnimRef.current) cancelAnimationFrame(flechaAnimRef.current);
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / 1000);
      const e = 1 - Math.pow(1 - p, 3);
      setFiguras(prev => prev.map(f => f.id === id ? { ...f, crecimiento: e } : f));
      if (p < 1) flechaAnimRef.current = requestAnimationFrame(paso);
      else flechaAnimRef.current = null;
    };
    flechaAnimRef.current = requestAnimationFrame(paso);
  };

  const anadirPolilinea = () => {
    if (modoPolilinea) {
      if (puntosPolilinea.length >= 2) {
        const id = Date.now();
        setFiguras(prev => [...prev, { id, tipo: 'polilinea', puntos: puntosPolilinea, color: '#38bdf8', opacidad: 1, grosor: 0.006 }]);
        setFiguraSeleccionada(id);
      }
      setModoPolilinea(false);
      setPuntosPolilinea([]);
    } else {
      setModoPolilinea(true);
      setPuntosPolilinea([]);
      setFiguraSeleccionada(null);
    }
  };

  const puntoImagen = (e) => {
    const svg = svgRef.current;
    if (!svg || !imgDim) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x / imgDim.w, y: p.y / imgDim.h };
  };

  const svgFigura = (f, dim) => {
    const e = f.crecimiento ?? 1;
    if (e <= 0.001) return '';
    const d = (dim && dim.w != null) ? dim : imgDim;
    const pat = f.rayado
      ? `<defs><pattern id="rayado-${f.id}" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="${f.color}" strokeWidth="4"/></pattern></defs>`
      : '';
    const fill = f.sinRelleno ? 'none' : (f.rayado ? `url(#rayado-${f.id})` : f.color);
    const op = (f.opacidad ?? 0.5) * (f.tipo === 'texto' ? e : 1);
    const common = `fill="${fill}" fill-opacity="${f.sinRelleno ? 0 : op}" stroke="${f.color}" stroke-opacity="${op}" stroke-width="2"`;

    if (f.tipo === 'polilinea') {
      const pts = f.puntos || [];
      if (pts.length === 0) return '';
      const grosor = (f.grosor || 0.006) * d.h;
      const radio = Math.max(5, grosor * 1.2);
      if (pts.length === 1) {
        return `<circle cx="${pts[0].x * d.w}" cy="${pts[0].y * d.h}" r="${radio * e}" fill="${f.color}" fill-opacity="${f.opacidad ?? 1}" stroke="#ffffff" stroke-width="1"/>`;
      }
      const segLengths = [];
      let totalLen = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const segLen = Math.hypot((pts[i + 1].x - pts[i].x) * d.w, (pts[i + 1].y - pts[i].y) * d.h);
        segLengths.push(segLen);
        totalLen += segLen;
      }
      const targetLen = totalLen * e;
      let accum = 0;
      const activePts = [`${pts[0].x * d.w},${pts[0].y * d.h}`];
      const activeCircs = [`<circle cx="${pts[0].x * d.w}" cy="${pts[0].y * d.h}" r="${radio * Math.min(1, e * 3)}" fill="${f.color}" fill-opacity="${f.opacidad ?? 1}" stroke="#ffffff" stroke-width="1"/>`];
      for (let i = 0; i < segLengths.length; i++) {
        const seg = segLengths[i];
        if (accum + seg <= targetLen) {
          accum += seg;
          activePts.push(`${pts[i + 1].x * d.w},${pts[i + 1].y * d.h}`);
          activeCircs.push(`<circle cx="${pts[i + 1].x * d.w}" cy="${pts[i + 1].y * d.h}" r="${radio * Math.min(1, Math.max(0, (e - accum / (totalLen || 1)) * 3 + 1))}" fill="${f.color}" fill-opacity="${f.opacidad ?? 1}" stroke="#ffffff" stroke-width="1"/>`);
        } else {
          const rem = targetLen - accum;
          const frac = seg > 0 ? rem / seg : 0;
          const curX = (pts[i].x + (pts[i + 1].x - pts[i].x) * frac) * d.w;
          const curY = (pts[i].y + (pts[i + 1].y - pts[i].y) * frac) * d.h;
          activePts.push(`${curX},${curY}`);
          break;
        }
      }
      const pol = activePts.length > 1 ? `<polyline points="${activePts.join(' ')}" fill="none" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round"/>` : '';
      return `${pol}${activeCircs.join('')}`;
    }

    if (f.tipo === 'circuito') {
      const elipses = f.elipses || [{ x: f.x1 ?? 0.2, y: f.y1 ?? 0.5, rx: f.rx1 ?? 0.08, ry: f.ry1 ?? 0.08 }, { x: f.x2 ?? 0.8, y: f.y2 ?? 0.5, rx: f.rx2 ?? 0.08, ry: f.ry2 ?? 0.08 }];
      const grosor = (f.grosor || 0.005) * d.h;
      let parts = '';
      for (let i = 1; i < elipses.length; i++) {
        const a = elipses[i - 1], b = elipses[i];
        const tramo = (f.tramos || [])[i - 1] || {};
        const pa = tramo.angA != null ? puntoEnElipse(a, d, tramo.angA) : interseccionLineaElipse(a, b, d);
        const pb = tramo.angB != null ? puntoEnElipse(b, d, tramo.angB) : interseccionLineaElipse(b, a, d);
        if (!pa || !pb) continue;
        const lineEndX = pa.x + (pb.x - pa.x) * e;
        const lineEndY = pa.y + (pb.y - pa.y) * e;
        parts += `<line x1="${pa.x}" y1="${pa.y}" x2="${lineEndX}" y2="${lineEndY}" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${grosor}" stroke-linecap="round"/>`;
      }
      elipses.forEach(el => {
        const ex = el.x * d.w, ey = el.y * d.h;
        const erx = (el.rx ?? 0.08) * d.w * e, ery = (el.ry ?? 0.08) * d.h * e;
        const rot = el.rot ?? 270;
        const hueco = el.hueco ?? 110;
        if (erx > 0.001 && ery > 0.001) {
          const a1 = (rot + hueco / 2) * Math.PI / 180;
          const a2 = a1 + (360 - hueco) * Math.PI / 180;
          const x1 = ex + Math.cos(a1) * erx;
          const y1 = ey + Math.sin(a1) * ery;
          const x2 = ex + Math.cos(a2) * erx;
          const y2 = ey + Math.sin(a2) * ery;
          parts += `<path d="M ${x1} ${y1} A ${erx} ${ery} 0 ${360 - hueco > 180 ? 1 : 0} 1 ${x2} ${y2}" fill="none" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${grosor}" stroke-linecap="round"/>`;
        }
      });
      return parts;
    }

    if (f.tipo === 'flecha') {
      const grosor = (f.grosor || 0.005) * d.h;
      const x1 = f.x1 * d.w;
      const y1 = f.y1 * d.h;
      const x2 = f.x2 * d.w;
      const y2 = f.y2 * d.h;
      const cx = (f.cx ?? (f.x1 + f.x2) / 2) * d.w;
      const cy = (f.cy ?? (f.y1 + f.y2) / 2) * d.h;

      const qcx = (1 - e) * x1 + e * cx;
      const qcy = (1 - e) * y1 + e * cy;
      const q1x = (1 - e) * (1 - e) * x1 + 2 * (1 - e) * e * cx + e * e * x2;
      const q1y = (1 - e) * (1 - e) * y1 + 2 * (1 - e) * e * cy + e * e * y2;

      let tx = (1 - e) * (cx - x1) + e * (x2 - cx);
      let ty = (1 - e) * (cy - y1) + e * (y2 - cy);
      if (Math.hypot(tx, ty) < 1e-6) {
        tx = x2 - x1;
        ty = y2 - y1;
      }
      const ang = Math.atan2(ty, tx);
      const headScale = Math.min(1, e * 2);
      const L = grosor * 6 * headScale * (f.cabeza ?? 1);
      const a = Math.PI / 6;
      const hx1 = q1x - L * Math.cos(ang - a);
      const hy1 = q1y - L * Math.sin(ang - a);
      const hx2 = q1x - L * Math.cos(ang + a);
      const hy2 = q1y - L * Math.sin(ang + a);
      const dash = f.discontinuo ? ` stroke-dasharray="${grosor * 3},${grosor * 2}"` : '';
      const pathStr = `<path d="M ${x1} ${y1} Q ${qcx} ${qcy} ${q1x} ${q1y}" fill="none" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${grosor}" stroke-linecap="round"${dash}/>`;
      const polyStr = (headScale > 0.05 && L > 0.5) ? `<polygon points="${q1x},${q1y} ${hx1},${hy1} ${hx2},${hy2}" fill="${f.color}" fill-opacity="${f.opacidad ?? 1}"/>` : '';
      return `${pathStr}${polyStr}`;
    }

    if (f.tipo === 'linea') {
      const x1 = f.x1 * d.w, y1 = f.y1 * d.h;
      const x2 = f.x2 * d.w, y2 = f.y2 * d.h;
      const endX = x1 + (x2 - x1) * e;
      const endY = y1 + (y2 - y1) * e;
      return `<line x1="${x1}" y1="${y1}" x2="${endX}" y2="${endY}" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${(f.grosor || 0.005) * d.h}" stroke-linecap="round"/>`;
    }

    if (f.tipo === 'texto') {
      const x = f.x * d.w;
      const y = f.y * d.h;
      const tam = (f.fontSize || 0.06) * d.h;
      const txt = String(f.texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<text x="${x}" y="${y}" font-size="${tam}" fill="${f.color}" fill-opacity="${(f.opacidad ?? 1) * e}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="${f.negrita ? 800 : 400}">${txt}</text>`;
    }

    if (f.tipo === 'triangulo') {
      const x = f.x * d.w;
      const y = f.y * d.h;
      const ancho = f.ancho * d.w;
      const alto = f.alto * d.h;
      const apexY = y - alto / 2;
      const hh = alto * e;
      const hw = (ancho / 2) * e;
      const baseY = apexY + hh;
      const gradientId = `pilar_${f.id}`;
      const pd = pathTrianguloRedondeado({ x, y: apexY }, { x: x - hw, y: baseY }, { x: x + hw, y: baseY }, Math.min(ancho, alto) * 0.12 * e);
      return `${pat}<defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${f.color}" stop-opacity="${f.opacidad ?? 1}"/><stop offset="100%" stop-color="${f.color}" stop-opacity="${(f.opacidad ?? 1) * 0.35}"/></linearGradient></defs><path d="${pd}" fill="url(#${gradientId})" />`;
    }

    if (f.tipo === 'c') {
      const ex = f.x * d.w;
      const ey = f.y * d.h;
      const erx = (f.ancho / 2) * d.w * e;
      const ery = (f.alto / 2) * d.h * e;
      const hueco = f.hueco ?? 90;
      const rot = f.rot ?? 0;
      const a1 = (rot + hueco / 2) * Math.PI / 180;
      const a2 = a1 + (360 - hueco) * Math.PI / 180;
      const x1 = ex + Math.cos(a1) * erx;
      const y1 = ey + Math.sin(a1) * ery;
      const x2 = ex + Math.cos(a2) * erx;
      const y2 = ey + Math.sin(a2) * ery;
      const large = (360 - hueco) > 180 ? 1 : 0;
      const sw = (f.grosor ?? 0.005) * d.h;
      return `<path d="M ${x1} ${y1} A ${erx} ${ery} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${sw}" stroke-linecap="round"/>`;
    }

    const cx = f.x * d.w;
    const cy = f.y * d.h;
    const rx = (f.ancho * d.w / 2) * e;
    const ry = (f.alto * d.h / 2) * e;
    if (rx <= 0.001 || ry <= 0.001) return '';
    const rot = f.rot ? ` transform="rotate(${f.rot} ${cx} ${cy})"` : '';
    return `${pat}<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot} ${common}/>`;
  };

  const generarVideo = async (figurasFn, fondoDataUrl, w, h, onProgress) => {
    const cargarImg = (src) => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = src;
    });
    const fondo = await cargarImg(fondoDataUrl);
    const totalFrames = 120;
    const frameDuration = 1000 / 30;
    const cuadros = [];
    for (let i = 0; i <= totalFrames; i++) {
      const t = Math.min(4000, i * 33);
      const partes = figurasFn(t) || '';
      let imgCuadro = null;
      if (partes) {
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${partes}</svg>`;
        const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }));
        try { imgCuadro = await cargarImg(url); }
        catch (_) { imgCuadro = null; }
        finally { URL.revokeObjectURL(url); }
      }
      cuadros.push(imgCuadro);
      if (onProgress) onProgress(Math.round((i / totalFrames) * 50));
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(30);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    await new Promise((resRec, rejRec) => {
      rec.onstop = () => { try { stream.getTracks().forEach(t => t.stop()); } catch (_) {} resRec(); };
      rec.onerror = rejRec;
      rec.start();
      let idx = 0;
      const drawNext = () => {
        try { ctx.drawImage(fondo, 0, 0, w, h); } catch (_) {}
        if (idx < cuadros.length && cuadros[idx]) {
          try { ctx.drawImage(cuadros[idx], 0, 0, w, h); } catch (_) {}
        }
        idx++;
        if (onProgress) onProgress(50 + Math.round((idx / (totalFrames + 1)) * 45));
        if (idx <= totalFrames) {
          setTimeout(drawNext, frameDuration);
        } else {
          if (onProgress) onProgress(95);
          try { rec.stop(); } catch (e) { rejRec(e); }
        }
      };
      drawNext();
    });
    if (onProgress) onProgress(100);
    return { url: URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })), duracion: (totalFrames + 1) / 30 };
  };

  const animarElipses = async () => {
    if (!capturaSeleccionada || !imgDim || figuras.length === 0) return;
    setExportando(true);
    try {
      const w = imgDim.w;
      const h = imgDim.h;
      const totalFrames = 120;

      const frameImages = [];
      for (let i = 0; i <= totalFrames; i++) {
        const t = i / totalFrames;
        const p = Math.min(1, Math.max(0, (t * 4000 - 200) / 3600));
        const e = 1 - Math.pow(1 - p, 3);
        const figAnim = figuras.map(f => ({ ...f, crecimiento: e }));
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image href="${capturaSeleccionada.dataUrl}" width="${w}" height="${h}"/>${figAnim.map(f => svgFigura(f, { w, h })).join('')}</svg>`;
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = await new Promise((res, rej) => {
          const im = new Image();
          im.onload = () => { URL.revokeObjectURL(url); res(im); };
          im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('SVG load error')); };
          im.src = url;
        });
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        cx.drawImage(img, 0, 0, w, h);
        frameImages.push(cx.getImageData(0, 0, w, h));
      }

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(0);
      const videoTrack = stream.getVideoTracks()[0];
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5000000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `animacion.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setExportando(false);
      };

      rec.start();
      const frameMs = 1000 / 30;
      let frameIdx = 0;

      const iv = setInterval(() => {
        if (frameIdx < frameImages.length) {
          ctx.putImageData(frameImages[frameIdx], 0, 0);
          videoTrack.requestFrame();
          frameIdx++;
        } else if (frameIdx === frameImages.length) {
          frameIdx++;
          ctx.putImageData(frameImages[frameImages.length - 1], 0, 0);
          videoTrack.requestFrame();
        } else {
          clearInterval(iv);
          ctx.putImageData(frameImages[frameImages.length - 1], 0, 0);
          videoTrack.requestFrame();
          setTimeout(() => {
            try { rec.stop(); } catch (e) { setExportando(false); }
          }, 500);
        }
      }, frameMs);
      setTimeout(() => { try { if (rec.state === 'recording') rec.stop(); } catch (e) {} }, 15000);
    } catch (e) {
      setExportando(false);
    }
  };

  const guardarCaptura = async () => {
    if (!capturaSeleccionada || !imgDim || exportando) return;
    setExportando(true);
    setProgresoVideo(0);
    try {
      const fondoLimpio = capturaSeleccionada.baseDataUrl || capturaSeleccionada.dataUrl;
      const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${imgDim.w}" height="${imgDim.h}" viewBox="0 0 ${imgDim.w} ${imgDim.h}"><image href="${fondoLimpio}" width="${imgDim.w}" height="${imgDim.h}"/>${figuras.map(f => svgFigura(f, imgDim)).join('')}</svg>`;
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const canvas = document.createElement('canvas');
      canvas.width = imgDim.w;
      canvas.height = imgDim.h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const nueva = canvas.toDataURL('image/png');
      URL.revokeObjectURL(url);
      setProgresoVideo(10);
      let videoUrl = null;
      let duracionAnim = 4;
      try {
        const figurasFn = (t) => {
          const p = Math.min(1, Math.max(0, (t - 200) / 3600));
          const e = 1 - Math.pow(1 - p, 3);
          return figuras.map(f => ({ ...f, crecimiento: e })).map(f => svgFigura(f, imgDim)).join('');
        };
        const gv = await generarVideo(figurasFn, fondoLimpio, imgDim.w, imgDim.h, (p) => setProgresoVideo(p));
        videoUrl = gv.url;
        duracionAnim = gv.duracion || 4;
      } catch (e) {
        console.error('Error al generar el video de la captura', e);
        setAviso('No se pudo generar el vídeo de la animación. Se ha guardado la imagen.');
      }
      const nuevoId = Date.now() + Math.floor(Math.random() * 1000);
      const figurasCopia = normalizarFiguras(figuras);
      const nuevaEntrada = { id: nuevoId, dataUrl: nueva, baseDataUrl: fondoLimpio, videoUrl, duracion: 4, duracionAnim, figuras: figurasCopia, tiempo: capturaSeleccionada.tiempo, insertarEn: capturaSeleccionada.tiempo ?? 0 };
      setCapturas(prev => [...(prev || []), nuevaEntrada]);
      setCapturaGuardada({ id: nuevoId, dataUrl: nueva, videoUrl, duracion: 4, figuras: figurasCopia, tiempo: capturaSeleccionada.tiempo });
      setCapturaSeleccionada(nuevaEntrada);
      asignarFotoACorte(nuevoId, nueva, figurasCopia, capturaSeleccionada.tiempo, false, fondoLimpio);
      setPreviewMontaje(prev => {
        if (!prev || !prev.anims || !prev.anims.length || !videoUrl) return prev;
        const urlsRevo = new Set((capturas || []).filter(c => c && c.tiempo === capturaSeleccionada.tiempo && c.videoUrl).map(c => c.videoUrl));
        if (!prev.anims.some(a => urlsRevo.has(a.src))) return prev;
        const nuevas = prev.anims.map(a => urlsRevo.has(a.src) ? { ...a, src: videoUrl, id: nuevoId, dur: duracionAnim } : a);
        try { const m = JSON.parse(localStorage.getItem('preview_anim') || 'null'); if (m) localStorage.setItem('preview_anim', JSON.stringify({ ...m, anims: nuevas.map(a => ({ capturaId: a.id, en: a.en, dur: a.dur })) })); } catch (_) {}
        return { ...prev, anims: nuevas };
      });
      return { id: nuevoId, videoUrl, tiempo: capturaSeleccionada.tiempo, duracionAnim };
    } catch (e) {
      console.error('Error al guardar la captura', e);
    } finally {
      setExportando(false);
      setProgresoVideo(0);
    }
  };

  const componerImagenEditada = (dataUrl, figs) => new Promise((resolve) => {
    try {
      if (!dataUrl) { resolve(null); return; }
      const lista = Array.isArray(figs) ? figs : [];
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth || 0, h = img.naturalHeight || 0;
          if (!w || !h) { resolve(dataUrl); return; }
          const dim = { w, h };
          const partes = lista.map((f) => svgFigura(f, dim)).filter(Boolean);
          if (partes.length === 0) { resolve(dataUrl); return; }
          const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image href="${dataUrl}" width="${w}" height="${h}"/>${partes.join('')}</svg>`;
          const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const im2 = new Image();
          im2.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = w; canvas.height = h;
              canvas.getContext('2d').drawImage(im2, 0, 0);
              URL.revokeObjectURL(url);
              resolve(canvas.toDataURL('image/png'));
            } catch (e) { URL.revokeObjectURL(url); resolve(dataUrl); }
          };
          im2.onerror = () => { URL.revokeObjectURL(url); resolve(dataUrl); };
          im2.src = url;
        } catch (e) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    } catch (e) { resolve(null); }
  });

  useEffect(() => {
    const onFsChange = () => {
      const v = videoRef.current;
      if (v && document.fullscreenElement === v) {
        document.exitFullscreen();
        const container = document.getElementById('video-container');
        if (container) container.requestFullscreen();
        return;
      }
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        if (v) { v.style.maxHeight = '60vh'; v.style.borderRadius = '12px'; v.style.border = '1px solid #334155'; }
      } else {
        setIsFullscreen(true);
        if (v) { v.style.maxHeight = '100vh'; v.style.borderRadius = '0'; v.style.border = 'none'; }
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Del') && figuraSeleccionada) {
        setFiguras(prev => prev.filter(f => f.id !== figuraSeleccionada));
        setFiguraSeleccionada(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [figuraSeleccionada]);

  return (
    <main style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ display: 'flex', gap: '0.5rem', padding: '1.5rem 2rem 0', borderBottom: '1px solid #1e293b' }}>
        {hojas.map(h => (
          <button
            key={h}
            onClick={() => setHoja(h)}
            style={{
              background: hoja === h ? '#1e293b' : 'transparent',
              border: '1px solid #334155',
              borderBottom: hoja === h ? '2px solid #38bdf8' : '1px solid #334155',
              borderRadius: '10px 10px 0 0',
              padding: '0.6rem 1.5rem',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 800,
              fontSize: '0.95rem',
              color: hoja === h ? '#ffffff' : '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer'
            }}
          >
            {h}
          </button>
        ))}
      </div>
      {hoja === 'Presentación' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1.5rem', padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '0.8rem 1.5rem', cursor: 'pointer' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#e2e8f0' }}>ARCHIVO:</span>
              <input
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={handleFile}
              />
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#38bdf8', maxWidth: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {archivo ? archivo.name : '-'}
              </span>
            </label>
            {archivo && (
              <button
                onClick={() => {
                  if (videoUrl) URL.revokeObjectURL(videoUrl);
                  if (clipTimerRef.current) { clearTimeout(clipTimerRef.current); clipTimerRef.current = null; }
                  clipMainRef.current = null;
                  clipResumeRef.current = null;
                  setClipActivo(null);
                  prevTiempoRef.current = 0;
                  corteCargadoRef.current = null;
                  clipOrigenRef.current = null;
                  setArchivo(null);
                  setVideoUrl('');
                  setProgreso(0);
                  setReproduciendo(false);
                }}
                style={{ background: '#dc2626', border: 'none', borderRadius: '12px', padding: '0.8rem 1.2rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
              >
                Eliminar
              </button>
            )}
          </div>
          {videoUrl && (
            <>
              <div id="video-container" style={{ position: 'relative', maxWidth: '75%' }}>
                <video
                  ref={videoRef}
                  muted
                  controls
                  controlsList="nofullscreen"
                  src={videoUrl}
                  onClick={togglePlay}
                  onPlay={() => setReproduciendo(true)}
                  onPause={() => setReproduciendo(false)}
                  onLoadedMetadata={(e) => {
                    fijarDuracion(e.currentTarget);
                    const r = clipResumeRef.current;
                    if (r) {
                      clipResumeRef.current = null;
                      try { e.currentTarget.currentTime = r.t; } catch (_) {}
                      e.currentTarget.play().catch(() => {});
                    }
                  }}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    const d = v.duration || 0;
                    setDuracion(d);
                    const t = v.currentTime;
                    if (clipMainRef.current || clipResumeRef.current) { setProgreso(d ? t / d : 0); return; }
                    if (t > prevTiempoRef.current) {
                      const cl = capturas.find(c => c.videoUrl && c.insertarEn != null && prevTiempoRef.current < c.insertarEn && t >= c.insertarEn);
                      if (cl) {
                        const hasta = cl.insertarEn + (cl.duracion || 4);
                        prevTiempoRef.current = hasta;
                        clipMainRef.current = { t: cl.insertarEn, hasta, src: videoUrl };
                        setClipActivo(cl);
                        setReproduciendo(true);
                        
                        // Pausar video principal y guardarlo en el punto de insercion
                        v.pause();
                        v.currentTime = cl.insertarEn;
                        
                        // Crossfade: fade out main, fade in overlay
                        v.style.opacity = '0';
                        setClipOverlayUrl(cl.videoUrl);
                        clipOverlayFadeRef.current = true;
                        
                        setTimeout(() => {
                          const overlay = clipOverlayRef.current;
                          if (overlay) {
                            overlay.style.opacity = '1';
                            overlay.play().catch(() => {});
                          }
                        }, 50);
                        
                        return;
                      }
                    }
                    prevTiempoRef.current = t;
                    setProgreso(d ? t / d : 0);
                  }}
                  onEnded={(e) => {
                    const v = e.currentTarget;
                    if (clipTimerRef.current) { clearTimeout(clipTimerRef.current); clipTimerRef.current = null; }
                    if (clipMainRef.current || clipActivo) {
                      const r = clipMainRef.current;
                      const overlay = clipOverlayRef.current;
                      
                      if (r) {
                        prevTiempoRef.current = r.hasta;
                        clipMainRef.current = null;
                        setClipActivo(null);
                        
                        // Crossfade
                        if (overlay) overlay.style.opacity = '0';
                        clipOverlayFadeRef.current = false;
                        
                        setTimeout(() => {
                          v.style.opacity = '1';
                          setClipOverlayUrl(null);
                          v.play().catch(() => {});
                          setReproduciendo(true);
                        }, 300);
                      } else {
                        if (overlay) overlay.style.opacity = '0';
                        clipOverlayFadeRef.current = false;
                        v.style.opacity = '1';
                        setClipActivo(null);
                        setClipOverlayUrl(null);
                        setReproduciendo(false);
                        setProgreso(1);
                      }
                      return;
                    }
                    setReproduciendo(false);
                    setProgreso(1);
                    if (clipTimerRef.current) { clearTimeout(clipTimerRef.current); clipTimerRef.current = null; }
                  }}
                  onError={(e) => {
                    const v = e.currentTarget;
                    if (clipTimerRef.current) { clearTimeout(clipTimerRef.current); clipTimerRef.current = null; }
                    if (clipMainRef.current || clipActivo) {
                      const r = clipMainRef.current;
                      const overlay = clipOverlayRef.current;
                      
                      if (r) {
                        prevTiempoRef.current = r.hasta;
                        clipMainRef.current = null;
                        setClipActivo(null);
                        
                        if (overlay) overlay.style.opacity = '0';
                        clipOverlayFadeRef.current = false;
                        
                        setTimeout(() => {
                          v.style.opacity = '1';
                          setClipOverlayUrl(null);
                          v.play().catch(() => {});
                          setReproduciendo(true);
                        }, 300);
                      } else {
                        if (overlay) overlay.style.opacity = '0';
                        clipOverlayFadeRef.current = false;
                        v.style.opacity = '1';
                        setClipActivo(null);
                        setClipOverlayUrl(null);
                      }
                    }
                  }}
                  style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '12px', background: '#000000', border: '1px solid #334155', transition: 'opacity 0.3s ease' }}
                />
                {clipOverlayUrl && (
                  <video
                    ref={clipOverlayRef}
                    muted
                    playsInline
                    src={clipOverlayUrl}
                    onPlay={() => setReproduciendo(true)}
                    onPause={() => setReproduciendo(false)}
                    onEnded={() => {
                      const vv = videoRef.current;
                      const overlay = clipOverlayRef.current;
                      const r = clipMainRef.current;
                      if (!r || !vv) return;
                      
                      // Preparar retorno
                      prevTiempoRef.current = r.hasta;
                      clipMainRef.current = null;
                      setClipActivo(null);
                      
                      // Crossfade: overlay fade out, main fade in
                      if (overlay) overlay.style.opacity = '0';
                      clipOverlayFadeRef.current = false;
                      
                      // Esperar a que termine la transicion CSS del overlay
                      setTimeout(() => {
                        vv.style.opacity = '1';
                        setClipOverlayUrl(null);
                        // El video principal ya esta pausado en la posicion correcta
                        vv.play().catch(() => {});
                        setReproduciendo(true);
                      }, 300);
                    }}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '12px', background: '#000000', opacity: clipOverlayFadeRef.current ? 1 : 0, transition: 'opacity 0.3s ease', pointerEvents: 'none' }}
                  />
                )}
                <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 3 }}>
                {exportando && (
                  <button
                    onClick={() => { cancelarVideoRef.current = true; }}
                    title="Cancelar exportación"
                    style={{ background: 'rgba(220,38,38,0.9)', border: 'none', borderRadius: '8px', padding: '0.3rem 0.6rem', cursor: 'pointer', color: '#ffffff', fontSize: '0.8rem', fontWeight: 800 }}
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={() => {
                    const container = document.getElementById('video-container');
                    if (!container) return;
                    if (!document.fullscreenElement) {
                      container.requestFullscreen?.() || container.webkitRequestFullscreen?.();
                    } else {
                      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
                    }
                  }}
                  title="Pantalla completa"
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#ffffff', fontSize: '0.85rem' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {isFullscreen ? (
                      <><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></>
                    ) : (
                      <><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>
                    )}
                  </svg>
                </button>
                </div>

              </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center' }}>
                  <button
                    onClick={togglePlay}
                    style={{ background: reproduciendo ? '#f59e0b' : '#16a34a', border: 'none', borderRadius: '12px', padding: '0.7rem 1.5rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.9rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', flexShrink: 0 }}
                  >
                    {reproduciendo ? 'PAUSA' : 'PLAY'}
                  </button>
                  <button
                    onClick={capturarImagen}
                    style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, background: '#8b5cf6', border: 'none', borderRadius: '12px', padding: '0.7rem 1.2rem', cursor: 'pointer' }}
                    title="Capturar imagen"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1 2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </button>
                  <input
                    value={nombreVideo}
                    onChange={(e) => setNombreVideo(e.target.value)}
                    placeholder="Nombre del vídeo"
                    title="Nombre del vídeo que se genera"
                    style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '0.7rem 1rem', color: '#e2e8f0', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif', outline: 'none', maxWidth: '200px', minWidth: 0, flex: '1 1 auto' }}
                  />
                  <button
                    onClick={() => {
                      const name = nombreVideo.trim() || (archivo ? archivo.name.replace(/\.[^.]+$/, '') : 'video');
                      exportarVideo(name);
                    }}
                    title="Descargar vídeo"
                    style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, background: '#16a34a', border: 'none', borderRadius: '12px', padding: '0.7rem 1.2rem', cursor: 'pointer' }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                  {exportando && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, minWidth: '140px' }}>
                      <div style={{ flex: 1, height: '8px', background: 'var(--bg-secondary, #1e293b)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${progresoExport}%`, height: '100%', background: '#22c55e', borderRadius: '4px' }} />
                      </div>
                      <span style={{ color: '#22c55e', fontWeight: 800, fontSize: '0.8rem', fontFamily: 'var(--font-mono, monospace)' }}>{progresoExport}%</span>
                    </div>
                  )}
                </div>

                {capturas.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.5rem' }}>
                    {capturas.map((c, i) => (
                      <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ position: 'relative' }}>
                          {(c.videoUrl && c.insertarEn == null) ? (
                            <video
                              src={c.videoUrl}
                              muted
                              controls
                              playsInline
                              preload="metadata"
                              draggable
                              onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(c.id)); e.dataTransfer.effectAllowed = 'move'; }}
                              onClick={(e) => e.stopPropagation()}
                              title="Clip 2s (arrástralo a la línea de tiempo)"
                              style={{ width: '160px', borderRadius: '8px', border: '1px solid #16a34a', background: '#000000', cursor: 'grab' }}
                            />
                          ) : (
                            <img
                              src={c.imagenEditada || c.dataUrl}
                              alt={`Captura ${i + 1}`}
                              onClick={() => {
                                setFiguras(normalizarFiguras(c.figuras));
                                setFiguraSeleccionada(null);
                                setCapturaSeleccionada(c);
                                setCapturaGuardada(null);
                                setImgDim(null);
                                setHoja('Edición');
                              }}
                              style={{ width: '160px', borderRadius: '8px', border: '1px solid #334155', cursor: 'pointer' }}
                            />
                          )}
                          <button
                            onClick={() => setCapturas(prev => prev.filter(x => x.id !== c.id))}
                            title="Eliminar captura"
                            style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', background: '#dc2626', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 900, fontSize: '0.9rem', lineHeight: '22px', textAlign: 'center', cursor: 'pointer', padding: '0' }}
                          >
                            ×
                          </button>
                        </div>
                        {c.videoUrl && (
                          <button
                            onClick={() => {
                              setCapturas(prev => prev.map(x => x.id === c.id ? { ...x, insertarEn: c.tiempo } : x));
                            }}
                            title={c.insertarEn != null ? 'Ya insertado en su punto' : 'Insertar video en el punto de su captura original'}
                            style={{ background: c.insertarEn != null ? '#16a34a' : '#0f172a', border: `1px solid #16a34a`, borderRadius: '8px', padding: '0.4rem 0.6rem', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.7rem', color: c.insertarEn != null ? '#ffffff' : '#16a34a', textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer' }}
                          >
                            {c.insertarEn != null ? 'Insertado' : 'Insertar'}
                          </button>
                        )}
                        {(() => {
                          const cortesAsignados = cortes.filter(ct => listaFotosCorte(ct).some(x => idDeFoto(x) === c.id));
                          return cortesAsignados.length > 0 ? (
                            <span style={{ fontFamily: 'var(--font-mono, JetBrains Mono, monospace)', fontWeight: 700, fontSize: '0.65rem', color: '#38bdf8', textAlign: 'center' }}>
                              {cortesAsignados.map(ct => formatoTiempo(ct)).join(', ')}
                            </span>
                          ) : null;
                        })()}
                        <span style={{ fontFamily: 'var(--font-mono, JetBrains Mono, monospace)', fontWeight: 700, fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center' }}>
                          {c.nombre ? `${c.nombre} · ` : ''}{formatoTiempo(c.tiempo)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </>
          )}
        </div>
      ) : hoja === 'Cortes' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1rem', padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '0.8rem 1.5rem', cursor: 'pointer' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#e2e8f0' }}>ARCHIVO:</span>
              <input
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0];
                  if (!file) return;
                  if (videoUrlCortes) URL.revokeObjectURL(videoUrlCortes);
                  setArchivoCortes(file);
                  setVideoUrlCortes(URL.createObjectURL(file));
                }}
              />
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#38bdf8', maxWidth: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {archivoCortes ? archivoCortes.name : '-'}
              </span>
            </label>
            {archivoCortes && (
              <button
                onClick={() => {
                  if (videoUrlCortes) URL.revokeObjectURL(videoUrlCortes);
                  setArchivoCortes(null);
                  setVideoUrlCortes('');
                  corteCargadoRef.current = null;
                }}
                style={{ background: '#dc2626', border: 'none', borderRadius: '12px', padding: '0.8rem 1.2rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
              >
                ELIMINAR
              </button>
            )}
          </div>
          {videoUrlCortes && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch', width: '100%', maxWidth: '1080px' }}>
            <video
              ref={videoRefCortes}
              src={videoUrlCortes}
              muted
              controls
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => fijarDuracion(e.currentTarget)}
              style={{ flex: 1, minWidth: 0, borderRadius: '12px', background: '#000000', border: '1px solid #334155' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button
                onClick={() => {
                  const v = videoRefCortes.current;
                  if (!v) return;
                  const t = v.currentTime || 0;
                  const existe = cortes.some(c => Math.abs(c - t) < 0.3);
                  if (existe) return;
                  setCortes(prev => [...prev, t].sort((a, b) => a - b));
                }}
              style={{ background: '#ef4444', border: 'none', borderRadius: '12px', padding: '0.7rem 1.5rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', flexShrink: 0 }}
            >
              Corte
            </button>
            </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.95rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cortes ({cortes.length})
            </span>
            <button
              onClick={exportarCortes}
              title="Guardar cortes en archivo"
              style={{ background: '#0ea5e9', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.75rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
            >
              Exportar
            </button>
            <label
              title="Recuperar cortes desde archivo"
              style={{ background: '#f97316', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.75rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
            >
              Importar
              <input
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={(e) => { importarCortes(e.target.files && e.target.files[0]); e.target.value = ''; }}
              />
            </label>
          </div>
          {cortes.length === 0 ? (
            <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem' }}>
              Sin cortes. Márcalos en Presentación activando el modo corte y pinchando en la línea de tiempo.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: '800px' }}>
              {(() => {
                const ord = [...cortes].sort((a, b) => b - a);
                return ord.map((ct, i) => (
                <div key={`corte-${i}`} onClick={() => { setSelPeriodo(`${ct}-ini`); if (videoRefCortes.current) videoRefCortes.current.currentTime = Math.max(0, ct); }} title="Ir a este punto del vídeo" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.5rem 0.8rem', cursor: 'pointer', flexWrap: 'nowrap', overflowX: 'auto', maxWidth: '100%' }}>
                  <span style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 900, fontSize: '0.8rem', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ord.length - i}</span>
                  <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'var(--font-mono, monospace)' }}>
                    P{ord.length - i}: <span onClick={(e) => { e.stopPropagation(); setSelPeriodo(`${ct}-ini`); if (videoRefCortes.current) videoRefCortes.current.currentTime = Math.max(0, ct); }} title="Ir al inicio del periodo" style={{ cursor: 'pointer', color: selPeriodo === `${ct}-ini` ? '#ef4444' : '#ffffff', textDecoration: selPeriodo === `${ct}-ini` ? 'underline' : 'none' }}>{formatoTiempo(ct)}</span> — <span onClick={(e) => { e.stopPropagation(); const fin = ct + (duracionCortes[String(ct)] ?? 15); setSelPeriodo(`${ct}-fin`); if (videoRefCortes.current) videoRefCortes.current.currentTime = Math.max(0, fin); }} title="Ir al final del periodo" style={{ cursor: 'pointer', color: selPeriodo === `${ct}-fin` ? '#ef4444' : '#ffffff', textDecoration: selPeriodo === `${ct}-fin` ? 'underline' : 'none' }}>{formatoTiempo(ct + (duracionCortes[String(ct)] ?? 15))}</span>
                  </span>
                  <input
                    value={nombreCortes[String(ct)] ?? ''}
                    onChange={(e) => { const v = e.target.value; setNombreCortes(prev => ({ ...prev, [String(ct)]: v })); }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Nombre"
                    style={{ flex: 1, minWidth: '100px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '0.3rem 0.6rem', color: '#e2e8f0', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <button onClick={(e) => { e.stopPropagation(); const k = String(ct); const dur = duracionCortes[k] ?? 15; if (selPeriodo === `${k}-fin`) { const nd = Math.max(1, dur - 1); setDuracionCortes(prev => ({ ...prev, [k]: nd })); if (videoRefCortes.current) videoRefCortes.current.currentTime = Math.max(0, ct + nd); return; } const nuevo = Math.max(0, ct - 1); if (nuevo === ct || cortes.includes(nuevo)) return; const nk = String(nuevo); const nd = (ct + dur) - nuevo; setCortes(prev => prev.map((x) => x === ct ? nuevo : x)); setSelPeriodo(`${nuevo}-ini`); setDuracionCortes(prev => { const c = { ...prev }; delete c[k]; c[nk] = nd; return c; }); setNombreCortes(prev => { const c = { ...prev }; if (k in c) { c[nk] = c[k]; delete c[k]; } return c; }); setCortesEditados(prev => { const c = { ...prev }; if (k in c) { c[nk] = c[k]; delete c[k]; } return c; }); setFotoPorCorte(prev => { const c = { ...prev }; if (k in c) { c[nk] = c[k]; delete c[k]; } return c; }); if (videoRefCortes.current) videoRefCortes.current.currentTime = Math.max(0, nuevo); }} title="Retroceder el inicio del corte 1s (fin fijo)" style={{ background: '#f97316', color: '#fff', fontWeight: 900, fontSize: '0.8rem', border: 'none', borderRadius: '6px', width: '24px', height: '24px', cursor: 'pointer', lineHeight: 1 }}>-</button>
                    <span style={{ color: '#22c55e', fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, fontSize: '0.75rem', minWidth: '44px', textAlign: 'center' }}>{duracionCortes[String(ct)] ?? 15}s</span>
                    <button onClick={(e) => { e.stopPropagation(); const k = String(ct); const dur = duracionCortes[k] ?? 15; if (selPeriodo === `${k}-fin`) { const nd = dur + 1; setDuracionCortes(prev => ({ ...prev, [k]: nd })); if (videoRefCortes.current) videoRefCortes.current.currentTime = Math.max(0, ct + nd); return; } const nuevo = ct + 1; const nd = (ct + dur) - nuevo; if (nd < 1 || cortes.includes(nuevo)) return; const nk = String(nuevo); setCortes(prev => prev.map((x) => x === ct ? nuevo : x)); setSelPeriodo(`${nuevo}-ini`); setDuracionCortes(prev => { const c = { ...prev }; delete c[k]; c[nk] = nd; return c; }); setNombreCortes(prev => { const c = { ...prev }; if (k in c) { c[nk] = c[k]; delete c[k]; } return c; }); setCortesEditados(prev => { const c = { ...prev }; if (k in c) { c[nk] = c[k]; delete c[k]; } return c; }); setFotoPorCorte(prev => { const c = { ...prev }; if (k in c) { c[nk] = c[k]; delete c[k]; } return c; }); if (videoRefCortes.current) videoRefCortes.current.currentTime = Math.max(0, nuevo); }} title="Avanzar el inicio del corte 1s (fin fijo)" style={{ background: '#22c55e', color: '#fff', fontWeight: 900, fontSize: '0.8rem', border: 'none', borderRadius: '6px', width: '24px', height: '24px', cursor: 'pointer', lineHeight: 1 }}>+</button>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      const dur = duracionCortes[String(ct)] ?? 15;
                      const nombre = (nombreCortes[String(ct)] || '').trim() || `P${ord.length - i}`;
                      setFilasMontaje(prev => [...prev, { id: Date.now(), videoUrl: null, concepto: nombre, inicio: Math.max(0, ct), fin: Math.max(0, ct) + dur, duracion: dur }]);
                      setHoja('Montaje');
                    }} title="Enviar la línea a Montaje (sin clip)" style={{ background: '#0ea5e9', color: '#fff', fontWeight: 800, fontSize: '0.65rem', border: 'none', borderRadius: '6px', padding: '0.3rem 0.6rem', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Montaje</button>
                  </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); const k = String(ct); setCortes(prev => prev.filter((x) => x !== ct)); setDuracionCortes(prev => { const c = { ...prev }; delete c[k]; return c; }); setNombreCortes(prev => { const c = { ...prev }; delete c[k]; return c; }); setCortesEditados(prev => { const c = { ...prev }; delete c[k]; return c; }); setFotoPorCorte(prev => { const c = { ...prev }; delete c[k]; return c; }); }}
                      title={`Eliminar corte en ${formatoTiempo(ct)}`}
                      style={{ background: '#dc2626', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 900, fontSize: '0.8rem', width: '24px', height: '24px', cursor: 'pointer', lineHeight: 1 }}
                    >
                      ×
                    </button>
                </div>
                ));
              })()}
            </div>
          )}
        </div>
      ) : hoja === 'Edición' ? (
        <div ref={editorRef} style={{ flex: 1, position: 'relative', display: 'flex' }}>
          {capturaSeleccionada && (
            <div style={{ position: 'absolute', top: '1rem', right: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem', zIndex: 10 }}>
              <button
                onClick={() => {
                  const el = editorRef.current;
                  if (!el) return;
                  if (!document.fullscreenElement) {
                    el.requestFullscreen?.() || el.webkitRequestFullscreen?.();
                  } else {
                    document.exitFullscreen?.() || document.webkitExitFullscreen?.();
                  }
                }}
                title="Pantalla completa"
                style={{ background: '#facc15', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer', color: '#ffffff', fontSize: '0.85rem', zIndex: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {fotoCompleta ? (
                    <><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></>
                  ) : (
                    <><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>
                  )}
                </svg>
              </button>
              <button
                onClick={async () => {
                  const r = await guardarCaptura();
                  if (!r || !r.videoUrl) return;
                  const base = videoUrlCortes || videoUrl;
                  const t = Math.max(0, r.tiempo ?? 0);
                  deseaPlayPreviewRef.current = true;
                  setFasePreview('base');
                  prevTPreviewRef.current = null;
                  limpiarTimerAnim();
                  animMostradasRef.current.clear(); animActualRef.current = null;
                  if (base) {
                    const linea = filasMontaje.find(f => f.inicio != null && f.fin != null && t >= f.inicio && t <= f.fin);
                    const ini = linea ? linea.inicio : t;
                    const fin = linea ? linea.fin : t + 4;
                    const conceptoLinea = (linea && linea.concepto) || '';
                    const previas = (capturas || [])
                      .filter(c => c && c.videoUrl && c.tiempo != null && c.tiempo >= ini && c.tiempo <= fin)
                      .map(c => ({ src: c.videoUrl, en: c.tiempo, dur: c.duracionAnim || 4, id: c.id }));
                    if (!previas.some(a => String(a.id) === String(r.id))) previas.push({ src: r.videoUrl, en: t, dur: r.duracionAnim || 4, id: r.id });
                    previas.sort((a, b) => a.en - b.en);
                    setPreviewMontaje({ src: base, inicio: ini, fin, anims: previas, concepto: conceptoLinea });
                    try { localStorage.setItem('preview_anim', JSON.stringify({ inicio: ini, fin, concepto: conceptoLinea, anims: previas.map(a => ({ capturaId: a.id, en: a.en, dur: a.dur })) })); } catch (_) {}
                  } else {
                    setPreviewMontaje({ src: r.videoUrl, inicio: 0, fin: Number.POSITIVE_INFINITY });
                  }
                  setHoja('Montaje');
                }}
                disabled={exportando}
                style={{ background: '#16a34a', border: 'none', borderRadius: '12px', padding: '0.7rem 1.2rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: exportando ? 'wait' : 'pointer', opacity: exportando ? 0.6 : 1 }}
              >
                {exportando ? `${progresoVideo}%` : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>}
              </button>
              <button
                onClick={() => { guardarCaptura(); setCapturaSeleccionada(null); setCapturaGuardada(null); setFiguras([]); setImgDim(null); setFiguraSeleccionada(null); }}
                style={{ background: '#dc2626', border: 'none', borderRadius: '12px', padding: '0.7rem 1rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: '4rem' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              {figuraSeleccionada && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                  {figuras.find(f => f.id === figuraSeleccionada)?.tipo === 'texto' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                      <input
                        value={figuras.find(f => f.id === figuraSeleccionada)?.texto || ''}
                        onChange={(e) => actualizarFigura(figuraSeleccionada, { texto: e.target.value })}
                        placeholder="Escribe el texto"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '180px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.5rem 0.6rem', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: '#e2e8f0', outline: 'none' }}
                      />
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => actualizarFigura(figuraSeleccionada, { negrita: !figuras.find(f => f.id === figuraSeleccionada)?.negrita })}
                          title="Negrita"
                          style={{ background: figuras.find(f => f.id === figuraSeleccionada)?.negrita ? '#0ea5e9' : '#334155', border: 'none', borderRadius: '8px', padding: '0.4rem 0.7rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.8rem', color: '#ffffff', cursor: 'pointer' }}
                        >
                          B
                        </button>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}>
                          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tamaño</span>
                          <input
                            type="range"
                            min="2"
                            max="20"
                            value={Math.round((figuras.find(f => f.id === figuraSeleccionada)?.fontSize ?? 0.06) * 100)}
                            onChange={(e) => actualizarFigura(figuraSeleccionada, { fontSize: Number(e.target.value) / 100 })}
                            title="Tamaño de la fuente"
                            style={{ width: '110px', cursor: 'pointer' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', background: '#1e293b', padding: '0.6rem', borderRadius: '12px', border: '1px solid #334155' }}>
                    {colores.map(c => (
                      <button
                        key={c}
                        onClick={() => actualizarFigura(figuraSeleccionada, { color: c })}
                        title={c}
                        style={{ width: '22px', height: '22px', background: c, borderRadius: '6px', border: figuras.find(f => f.id === figuraSeleccionada)?.color === c ? '2px solid #ffffff' : '2px solid transparent', cursor: 'pointer', padding: 0 }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem', marginTop: '0.8rem' }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Opacidad
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={figuraSeleccionada ? Math.round((figuras.find(f => f.id === figuraSeleccionada)?.opacidad ?? 0.5) * 100) : 50}
                      onChange={(e) => { if (figuraSeleccionada) actualizarFigura(figuraSeleccionada, { opacidad: Number(e.target.value) / 100 }); }}
                      disabled={!figuraSeleccionada}
                      title="Opacidad"
                      style={{ width: '120px', cursor: 'pointer' }}
                    />
                  </div>
                  {[ 'linea', 'flecha', 'polilinea', 'circuito', 'c'].includes(figuras.find(f => f.id === figuraSeleccionada)?.tipo) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Grosor
                      </span>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={Math.round((figuras.find(f => f.id === figuraSeleccionada)?.grosor ?? 0.005) * (imgDim?.h || 500))}
                        onChange={(e) => actualizarFigura(figuraSeleccionada, { grosor: Number(e.target.value) / (imgDim?.h || 500) })}
                        title="Grosor de la línea"
                        style={{ width: '120px', cursor: 'pointer' }}
                      />
                    </div>
                  ) : null}
                  {figuras.find(f => f.id === figuraSeleccionada)?.tipo === 'c' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Rotar
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={Math.round(figuras.find(f => f.id === figuraSeleccionada)?.rot ?? 0)}
                        onChange={(e) => actualizarFigura(figuraSeleccionada, { rot: Number(e.target.value) })}
                        title="Rotación de la C"
                        style={{ width: '120px', cursor: 'pointer' }}
                      />
                    </div>
                  )}
                  {figuras.find(f => f.id === figuraSeleccionada)?.tipo === 'flecha' && (
                    <button
                      onClick={() => actualizarFigura(figuraSeleccionada, { discontinuo: !figuras.find(f => f.id === figuraSeleccionada)?.discontinuo })}
                      title="Continuidad de la flecha"
                      style={{ background: figuras.find(f => f.id === figuraSeleccionada)?.discontinuo ? '#0ea5e9' : '#334155', border: 'none', borderRadius: '12px', padding: '0.5rem 0.9rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.8rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
                    >
                      {figuras.find(f => f.id === figuraSeleccionada)?.discontinuo ? 'Continua' : 'Discontinua'}
                    </button>
                  )}
                  {!['texto', 'linea', 'flecha', 'polilinea', 'circuito'].includes(figuras.find(f => f.id === figuraSeleccionada)?.tipo) && (
                  <button
                    onClick={() => actualizarFigura(figuraSeleccionada, { rayado: !figuras.find(f => f.id === figuraSeleccionada)?.rayado })}
                    title="Rayas en diagonal"
                    style={{ background: figuras.find(f => f.id === figuraSeleccionada)?.rayado ? '#0ea5e9' : '#334155', border: 'none', borderRadius: '12px', padding: '0.5rem 0.9rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.8rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', marginTop: '0.8rem' }}
                  >
                    Rayas
                  </button>
                  )}
                  {figuras.find(f => f.id === figuraSeleccionada)?.tipo === 'circulo' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem', marginTop: '0.8rem' }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Rotar
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={Math.round(figuras.find(f => f.id === figuraSeleccionada)?.rot ?? 0)}
                        onChange={(e) => actualizarFigura(figuraSeleccionada, { rot: Number(e.target.value) })}
                        title="Rotación del círculo"
                        style={{ width: '120px', cursor: 'pointer' }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderRight: '1px solid #1e293b' }}>
            <button
              onClick={anadirTriangulo}
              title="Añadir triángulo"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0ea5e9', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round">
                <polygon points="12,3 22,20 2,20" />
              </svg>
            </button>
            <button
              onClick={anadirCirculo}
              title="Añadir círculo"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0ea5e9', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9" />
              </svg>
            </button>
            <button
              onClick={anadirCirculoHueco}
              title="Añadir C"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0ea5e9', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
                <path d="M 18 5 A 9 9 0 1 0 18 19" />
              </svg>
            </button>
            <button
              onClick={anadirTexto}
              title="Añadir texto"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0ea5e9', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5">
                <polyline points="4,7 4,4 20,4 20,7" />
                <line x1="9" y1="20" x2="15" y2="20" />
                <line x1="12" y1="4" x2="12" y2="20" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (modoCirculoClick) { setModoCirculoClick(false); elipsesSessionRef.current = []; }
                lineaOrigenRef.current = null;
                setModoLineaClick(prev => !prev);
              }}
              title={modoLineaClick ? 'Cancelar línea' : 'Añadir línea con clicks'}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: modoLineaClick ? '#16a34a' : '#0ea5e9', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="20" x2="20" y2="4" />
              </svg>
            </button>
             <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (modoCirculoClick) { setModoCirculoClick(false); elipsesSessionRef.current = []; }
                  flechaOrigenRef.current = null;
                  setModoFlechaClick(prev => !prev);
                }}
                title={modoFlechaClick ? 'Cancelar flecha' : 'Añadir flecha con clicks'}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: modoFlechaClick ? '#16a34a' : '#0ea5e9', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer' }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="20" x2="19" y2="5" />
                  <polyline points="11,5 19,5 19,13" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (modoCirculoClick) {
                    const pts = elipsesSessionRef.current;
                    if (pts.length >= 2) {
                      setFiguras(prev => {
                        const sessionCircles = prev.filter(f => f.tipo === 'circulo' && f.sinRelleno && pts.some(p => Math.abs(f.x - p.x) < 0.02 && Math.abs(f.y - p.y) < 0.02));
                        const sessionIds = sessionCircles.map(f => f.id);
                        const elipses = pts.map((p, i) => {
                          const original = sessionCircles[i] || {};
                          return { x: p.x, y: p.y, rx: (original.ancho || 0.04) / 2, ry: (original.alto || 0.025) / 2 };
                        });
                        const id = Date.now();
                        const circuito = { id, tipo: 'circuito', elipses, color: '#38bdf8', opacidad: 1, grosor: 0.003, crecimiento: 0 };
                        if (circuitoAnimRef.current) cancelAnimationFrame(circuitoAnimRef.current);
                        const t0 = performance.now();
                        const paso = (t) => {
                          const pp = Math.min(1, (t - t0) / 1000);
                          const e = 1 - Math.pow(1 - pp, 3);
                          setFiguras(curr => curr.map(f => f.id === id ? { ...f, crecimiento: e } : f));
                          if (pp < 1) circuitoAnimRef.current = requestAnimationFrame(paso);
                          else circuitoAnimRef.current = null;
                        };
                        circuitoAnimRef.current = requestAnimationFrame(paso);
                        return [...prev.filter(f => !sessionIds.includes(f.id)), circuito];
                      });
                    } else if (pts.length === 1) {
                      setFiguras(prev => prev.filter(f => !(f.tipo === 'circulo' && f.sinRelleno && pts.some(p => Math.abs(f.x - p.x) < 0.02 && Math.abs(f.y - p.y) < 0.02))));
                    }
                    elipsesSessionRef.current = [];
                    setAviso('');
                  } else {
                    elipsesSessionRef.current = [];
                    setAviso('');
                  }
                  setModoCirculoClick(prev => !prev);
                }}
               title={modoCirculoClick ? 'Desactivar y unir elipses' : 'Colocar elipses con click'}
               style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: modoCirculoClick ? '#16a34a' : '#0ea5e9', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer' }}
             >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
                <line x1="8" y1="12" x2="16" y2="12" />
                <circle cx="8" cy="12" r="4.5" />
                <circle cx="16" cy="12" r="4.5" />
              </svg>
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => {
            if (modoFlechaClick) {
              const p = puntoImagen(e);
              if (p) {
                if (!flechaOrigenRef.current) {
                  flechaOrigenRef.current = { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) };
                } else {
                  const x1 = flechaOrigenRef.current.x;
                  const y1 = flechaOrigenRef.current.y;
                  const x2 = Math.min(1, Math.max(0, p.x));
                  const y2 = Math.min(1, Math.max(0, p.y));
                  const cx = (x1 + x2) / 2;
                  const cy = (y1 + y2) / 2;
                  const id = Date.now();
                  setFiguras(prev => [...prev, { id, tipo: 'flecha', x1, y1, x2, y2, cx, cy, color: '#38bdf8', opacidad: 1, grosor: 0.005, discontinuo: false, cabeza: 1, crecimiento: 0 }]);
                  setFiguraSeleccionada(id);
                  flechaOrigenRef.current = null;
                  setModoFlechaClick(false);
                  if (flechaAnimRef.current) cancelAnimationFrame(flechaAnimRef.current);
                  const t0 = performance.now();
                  const paso = (t) => {
                    const pp = Math.min(1, (t - t0) / 1000);
                    const e = 1 - Math.pow(1 - pp, 3);
                    setFiguras(prev => prev.map(f => f.id === id ? { ...f, crecimiento: e } : f));
                    if (pp < 1) flechaAnimRef.current = requestAnimationFrame(paso);
                    else flechaAnimRef.current = null;
                  };
                  flechaAnimRef.current = requestAnimationFrame(paso);
                }
              }
              return;
            }
            if (modoLineaClick) {
              const p = puntoImagen(e);
              if (p) {
                if (!lineaOrigenRef.current) {
                  lineaOrigenRef.current = { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) };
                } else {
                  const x1 = lineaOrigenRef.current.x;
                  const y1 = lineaOrigenRef.current.y;
                  const x2 = Math.min(1, Math.max(0, p.x));
                  const y2 = Math.min(1, Math.max(0, p.y));
                  const id = Date.now();
                  setFiguras(prev => [...prev, { id, tipo: 'linea', x1, y1, x2: x1, y2: y1, color: '#38bdf8', opacidad: 1, grosor: 0.005 }]);
                  setFiguras(prev => prev.map(f => f.id === id ? { ...f, x2, y2 } : f));
                  setFiguraSeleccionada(id);
                  lineaOrigenRef.current = null;
                  setModoLineaClick(false);
                }
              }
              return;
            }
            if (modoCirculoClick) {
              const p = puntoImagen(e);
              if (p) {
                const id = Date.now();
                setFiguras(prev => [...prev, { id, tipo: 'circulo', x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)), ancho: 0.04, alto: 0.025, color: '#38bdf8', opacidad: 0, crecimiento: 1, sinRelleno: true, rot: 0 }]);
                setFiguraSeleccionada(id);
                elipsesSessionRef.current.push({ x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) });
              }
              return;
            }
            if (modoPolilinea) {
              const p = puntoImagen(e);
              if (p) setPuntosPolilinea(prev => [...prev, { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) }]);
            } else {
              setFiguraSeleccionada(null);
            }
          }}>
            {capturaSeleccionada ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', ...(fotoCompleta ? { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' } : {}) }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', ...(fotoCompleta ? { width: '100%', height: '100%' } : {}) }}>
                  <div style={{ position: 'relative', display: 'inline-block', ...(fotoCompleta ? { width: '100%', height: '100%' } : {}) }} onClick={() => setFiguraSeleccionada(null)}>
                  <img
                    src={capturaSeleccionada.baseDataUrl || capturaSeleccionada.dataUrl}
                    alt="Captura en edición"
                    onLoad={(e) => setImgDim({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                    style={{ display: 'block', pointerEvents: 'none', ...(fotoCompleta ? { width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' } : { maxWidth: '100%', maxHeight: '80vh' }), borderRadius: '12px', border: '1px solid #334155' }}
                  />
                  {imgDim && (
                    <svg
                      ref={svgRef}
                      viewBox={`0 0 ${imgDim.w} ${imgDim.h}`}
                      onPointerMove={(e) => {
                        const d = dragRef.current;
                        if (!d) return;
                        const p = puntoImagen(e);
                        if (!p) return;
                        if (d.tipo === 'mover') {
                          if (d.tipoFig === 'polilinea') {
                            const dx = p.x - d.px;
                            const dy = p.y - d.py;
                            actualizarFigura(d.id, { puntos: (d.puntos || []).map(pt => ({ x: pt.x + dx, y: pt.y + dy })) });
                          } else if (d.tipoFig === 'linea' || d.tipoFig === 'flecha') {
                            const dx = p.x - d.px;
                            const dy = p.y - d.py;
                            const up = { x1: d.x1 + dx, y1: d.y1 + dy, x2: d.x2 + dx, y2: d.y2 + dy };
                            if (d.cx != null) { up.cx = d.cx + dx; up.cy = d.cy + dy; }
                            actualizarFigura(d.id, up);
                          } else if (d.tipoFig === 'circuito') {
                            const dx = p.x - d.px;
                            const dy = p.y - d.py;
                            const elipses = (d.elipses || []).map(el => ({ ...el, x: el.x + dx, y: el.y + dy }));
                            actualizarFigura(d.id, { elipses });
                          } else {
                            actualizarFigura(d.id, { x: d.ox + (p.x - d.px), y: d.oy + (p.y - d.py) });
                          }
                        } else if (d.tipo === 'polilineaPunto') {
                          actualizarFigura(d.id, { puntos: (d.puntos || []).map((pt, i) => i === d.indice ? { x: p.x, y: p.y } : pt) });
                        } else if (d.tipo === 'circuitoPunto') {
                          const elipses = (figuras.find(f => f.id === d.id)?.elipses || []).map((el, i) => i === d.indice ? { ...el, x: p.x, y: p.y } : el);
                          actualizarFigura(d.id, { elipses });
                        } else if (d.tipo === 'circuitoRadioX') {
                          const elipses = (figuras.find(f => f.id === d.id)?.elipses || []).map((el, i) => i === d.indice ? { ...el, rx: Math.max(0.01, Math.abs(p.x - el.x)) } : el);
                          actualizarFigura(d.id, { elipses });
                        } else if (d.tipo === 'circuitoRadioY') {
                          const elipses = (figuras.find(f => f.id === d.id)?.elipses || []).map((el, i) => i === d.indice ? { ...el, ry: Math.max(0.01, Math.abs(p.y - el.y)) } : el);
                          actualizarFigura(d.id, { elipses });
                        } else if (d.tipo === 'circuitoRot') {
                          const elipses = (figuras.find(f => f.id === d.id)?.elipses || []).map((el, i) => {
                            if (i !== d.indice) return el;
                            const ang = Math.atan2((p.y - el.y) * imgDim.h, (p.x - el.x) * imgDim.w) * 180 / Math.PI;
                            return { ...el, rot: ((ang - (el.hueco ?? 110) / 2) % 360 + 360) % 360 };
                          });
                          actualizarFigura(d.id, { elipses });
                        } else if (d.tipo === 'circuitoHueco') {
                          const elipses = (figuras.find(f => f.id === d.id)?.elipses || []).map((el, i) => {
                            if (i !== d.indice) return el;
                            const ang = (Math.atan2((p.y - el.y) * imgDim.h, (p.x - el.x) * imgDim.w) * 180 / Math.PI + 360) % 360;
                            let dif = ((ang - (el.rot ?? 270)) % 360 + 360) % 360;
                            if (dif > 180) dif -= 360;
                            return { ...el, hueco: Math.max(8, Math.min(340, Math.abs(dif) * 2)) };
                          });
                          actualizarFigura(d.id, { elipses });
                        } else if (d.tipo === 'circuitoTramoA' || d.tipo === 'circuitoTramoB') {
                          const fig = figuras.find(f => f.id === d.id);
                          const a = fig?.elipses?.[d.indice];
                          const b = fig?.elipses?.[d.indice + 1];
                          if (fig && a && b) {
                            const ref = d.tipo === 'circuitoTramoA' ? a : b;
                            const ang = (Math.atan2((p.y - ref.y) * imgDim.h, (p.x - ref.x) * imgDim.w) * 180 / Math.PI + 360) % 360;
                            const tramos = [...(fig.tramos || [])];
                            while (tramos.length < fig.elipses.length - 1) tramos.push({});
                            tramos[d.indice] = { ...(tramos[d.indice] || {}), [d.tipo === 'circuitoTramoA' ? 'angA' : 'angB']: ang };
                            actualizarFigura(d.id, { tramos });
                          }
                        } else if (d.tipo === 'lineaPunto') {
                          if (d.cual === 'p1') {
                            actualizarFigura(d.id, { x1: p.x, y1: p.y, cx: d.cx + (p.x - d.px), cy: d.cy + (p.y - d.py) });
                          } else {
                            actualizarFigura(d.id, { x2: p.x, y2: p.y, cx: d.cx + (p.x - d.px), cy: d.cy + (p.y - d.py) });
                          }
                        } else if (d.tipo === 'flechaCurva') {
                          actualizarFigura(d.id, { cx: p.x, cy: p.y });
                        } else if (d.tipo === 'resize') {
                          if (d.tipoFig === 'texto') {
                            actualizarFigura(d.id, { fontSize: Math.max(0.01, d.tamInicial + (p.y - d.py) * 2) });
                          } else {
                            actualizarFigura(d.id, { ancho: Math.max(0.02, Math.abs(p.x - d.fx) * 2), alto: Math.max(0.02, Math.abs(p.y - d.fy) * 2) });
                          }
                        }
                      }}
                      onPointerUp={() => { dragRef.current = null; }}
                      onPointerCancel={() => { dragRef.current = null; }}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                    >
                      <defs>
                        {figuras.filter(f => f.rayado).map(f => (
                          <pattern key={f.id} id={`rayado-${f.id}`} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
                            <line x1="0" y1="0" x2="0" y2="7" stroke={f.color} strokeWidth="4" />
                          </pattern>
                        ))}
                      </defs>
                      {figuras.map(f => {
                        const x = f.x * imgDim.w;
                        const y = f.y * imgDim.h;
                        const ancho = f.ancho * imgDim.w;
                        const alto = f.alto * imgDim.h;
                        const sel = figuraSeleccionada === f.id;
                        const shapeProps = {
                          fill: f.sinRelleno ? 'none' : (f.rayado ? `url(#rayado-${f.id})` : f.color),
                          fillOpacity: f.sinRelleno ? 0 : (f.opacidad ?? 0.5),
                          stroke: f.color,
                          strokeWidth: sel ? 3 : 2,
                          style: { pointerEvents: 'all', cursor: 'move' },
                          onClick: (e) => { e.stopPropagation(); setFiguraSeleccionada(f.id); },
                          onPointerDown: (e) => {
                            if (circuloAnimRef.current) { cancelAnimationFrame(circuloAnimRef.current); circuloAnimRef.current = null; }
                            if (lineaAnimRef.current) { cancelAnimationFrame(lineaAnimRef.current); lineaAnimRef.current = null; }
                            if (flechaAnimRef.current) { cancelAnimationFrame(flechaAnimRef.current); flechaAnimRef.current = null; if (f.tipo === 'flecha') actualizarFigura(f.id, { cabeza: 1 }); }
                            if (triAnimRef.current) { cancelAnimationFrame(triAnimRef.current); triAnimRef.current = null; if (f.tipo === 'triangulo') actualizarFigura(f.id, { crecimiento: 1 }); }
                            if (circuitoAnimRef.current) { cancelAnimationFrame(circuitoAnimRef.current); circuitoAnimRef.current = null; }
                            setFiguraSeleccionada(f.id);
                            const p = puntoImagen(e);
                            if (!p) return;
                            dragRef.current = { tipo: 'mover', id: f.id, ox: f.x, oy: f.y, px: p.x, py: p.y, tipoFig: f.tipo, x1: f.x1, y1: f.y1, x2: f.x2, y2: f.y2, cx: f.cx, cy: f.cy, puntos: f.puntos, elipses: f.elipses };
                            e.currentTarget.setPointerCapture(e.pointerId);
                          },
                        };
 const shape = f.tipo === 'triangulo'
                          ? (() => {
                              const eTri = f.crecimiento ?? 1;
                              const apexYTri = y - alto / 2;
                              const hhTri = alto * eTri;
                              const hwTri = (ancho / 2) * eTri;
                              const baseYTri = apexYTri + hhTri;
                              const dTri = pathTrianguloRedondeado({ x, y: apexYTri }, { x: x - hwTri, y: baseYTri }, { x: x + hwTri, y: baseYTri }, Math.min(ancho, alto) * 0.12 * eTri);
                              return <path {...shapeProps} d={dTri} />;
                            })()
                           : f.tipo === 'circulo'
                             ? <ellipse {...shapeProps} cx={x} cy={y} rx={ancho / 2} ry={alto / 2} transform={f.rot ? `rotate(${f.rot} ${x} ${y})` : undefined} />
                           : f.tipo === 'c'
                             ? (() => {
                                 const eC = f.crecimiento ?? 1;
                                 const exC = x;
                                 const eyC = y;
                                 const erxC = (ancho / 2) * eC;
                                 const eryC = (alto / 2) * eC;
                                 const huecoC = f.hueco ?? 90;
                                 const rotC = f.rot ?? 0;
                                 const a1C = (rotC + huecoC / 2) * Math.PI / 180;
                                 const a2C = a1C + (360 - huecoC) * Math.PI / 180;
                                 const x1C = exC + Math.cos(a1C) * erxC;
                                 const y1C = eyC + Math.sin(a1C) * eryC;
                                 const x2C = exC + Math.cos(a2C) * erxC;
                                 const y2C = eyC + Math.sin(a2C) * eryC;
                                 const largeC = (360 - huecoC) > 180 ? 1 : 0;
                                 const swC = (f.grosor ?? 0.005) * imgDim.h;
                                 const dC = `M ${x1C} ${y1C} A ${erxC} ${eryC} 0 ${largeC} 1 ${x2C} ${y2C}`;
                                 return <path {...shapeProps} d={dC} fill="none" stroke={f.color} strokeOpacity={f.opacidad ?? 1} strokeWidth={swC} strokeLinecap="round" />;
                               })()
                            : f.tipo === 'linea'
                              ? <line
                                  x1={f.x1 * imgDim.w}
                                  y1={f.y1 * imgDim.h}
                                  x2={f.x2 * imgDim.w}
                                  y2={f.y2 * imgDim.h}
                                  stroke={f.color}
                                  strokeOpacity={f.opacidad ?? 1}
                                  strokeWidth={(f.grosor || 0.005) * imgDim.h}
                                  strokeLinecap="round"
                                  style={{ pointerEvents: 'all', cursor: 'move' }}
                                  onClick={shapeProps.onClick}
                                  onPointerDown={shapeProps.onPointerDown}
                                />
                              : f.tipo === 'flecha'
                                ? (() => {
                                    const px1 = f.x1 * imgDim.w;
                                    const py1 = f.y1 * imgDim.h;
                                    const px2 = f.x2 * imgDim.w;
                                    const py2 = f.y2 * imgDim.h;
                                    const pcx = f.cx * imgDim.w;
                                    const pcy = f.cy * imgDim.h;
                                    const grosorPx = (f.grosor || 0.005) * imgDim.h;
                                    const ang = Math.atan2(py2 - pcy, px2 - pcx);
                                    const L = grosorPx * 6 * (f.cabeza ?? 1);
                                    const a = Math.PI / 6;
                                    const hx1 = px2 - L * Math.cos(ang - a);
                                    const hy1 = py2 - L * Math.sin(ang - a);
                                    const hx2 = px2 - L * Math.cos(ang + a);
                                    const hy2 = py2 - L * Math.sin(ang + a);
                                    return (
                                      <g style={{ pointerEvents: 'all', cursor: 'move' }} onClick={shapeProps.onClick} onPointerDown={shapeProps.onPointerDown}>
                                        <path
                                          d={`M ${px1} ${py1} Q ${pcx} ${pcy} ${px2} ${py2}`}
                                          fill="none"
                                          stroke={f.color}
                                          strokeOpacity={f.opacidad ?? 1}
                                          strokeWidth={grosorPx}
                                          strokeLinecap="round"
                                          strokeDasharray={f.discontinuo ? `${grosorPx * 3}, ${grosorPx * 2}` : undefined}
                                        />
                                        <polygon points={`${px2},${py2} ${hx1},${hy1} ${hx2},${hy2}`} fill={f.color} fillOpacity={f.opacidad ?? 1} />
                                      </g>
                                    );
                                  })()
: f.tipo === 'circuito'
                                ? (() => {
                                    const elipses = f.elipses || [{x:f.x1??0.2,y:f.y1??0.5,rx:f.rx1??0.08,ry:f.ry1??0.08},{x:f.x2??0.8,y:f.y2??0.5,rx:f.rx2??0.08,ry:f.ry2??0.08}];
                                    const grosorPx = (f.grosor || 0.005) * imgDim.h;
                                    return (
                                      <g style={{ pointerEvents: 'all', cursor: 'move' }} onClick={shapeProps.onClick} onPointerDown={shapeProps.onPointerDown}>
                                        {elipses.map((el, i) => {
                                          if (i === 0) return null;
                                          const a = elipses[i - 1], b = el;
                                          const tramo = (f.tramos || [])[i - 1] || {};
                                          const pa = tramo.angA != null ? puntoEnElipse(a, imgDim, tramo.angA) : interseccionLineaElipse(a, b, imgDim);
                                          const pb = tramo.angB != null ? puntoEnElipse(b, imgDim, tramo.angB) : interseccionLineaElipse(b, a, imgDim);
                                          if (!pa || !pb) return null;
                                          return <line key={`l${i}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={f.color} strokeOpacity={f.opacidad ?? 1} strokeWidth={grosorPx} strokeLinecap="round" />;
                                        })}
                                        {elipses.map((el, i) => {
                                          const erx = (el.rx ?? 0.08) * imgDim.w;
                                          const ery = (el.ry ?? 0.08) * imgDim.h;
                                          if (erx <= 0 || ery <= 0) return null;
                                          const rot = el.rot ?? 270;
                                          const hueco = el.hueco ?? 110;
                                          const a1 = (rot + hueco / 2) * Math.PI / 180;
                                          const a2 = a1 + (360 - hueco) * Math.PI / 180;
                                          const ax = el.x * imgDim.w + Math.cos(a1) * erx;
                                          const ay = el.y * imgDim.h + Math.sin(a1) * ery;
                                          const bx = el.x * imgDim.w + Math.cos(a2) * erx;
                                          const by = el.y * imgDim.h + Math.sin(a2) * ery;
                                          return <path key={i} d={`M ${ax} ${ay} A ${erx} ${ery} 0 ${360 - hueco > 180 ? 1 : 0} 1 ${bx} ${by}`} fill="none" stroke={f.color} strokeOpacity={f.opacidad ?? 1} strokeWidth={grosorPx} strokeLinecap="round" />;
                                        })}
                                      </g>
                                    );
                                  })()
                              : f.tipo === 'polilinea'
                                ? (() => {
                                    const pts = f.puntos || [];
                                    const grosorPx = (f.grosor || 0.006) * imgDim.h;
                                    const radio = Math.max(5, grosorPx * 1.2);
                                    return (
                                      <g style={{ pointerEvents: 'all', cursor: 'move' }} onClick={shapeProps.onClick} onPointerDown={shapeProps.onPointerDown}>
                                        {pts.length > 1 && (
                                          <polyline
                                            points={pts.map(p => `${p.x * imgDim.w},${p.y * imgDim.h}`).join(' ')}
                                            fill="none"
                                            stroke={f.color}
                                            strokeOpacity={f.opacidad ?? 1}
                                            strokeWidth={grosorPx}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        )}
                                        {pts.map((p, i) => (
                                          <circle key={i} cx={p.x * imgDim.w} cy={p.y * imgDim.h} r={radio} fill={f.color} fillOpacity={f.opacidad ?? 1} stroke="#ffffff" strokeWidth={sel ? 2 : 1} />
                                        ))}
                                      </g>
                                    );
                                  })()
                                : <text
                                  x={x}
                                  y={y}
                                  fontSize={(f.fontSize || 0.06) * imgDim.h}
                                  fill={f.color}
                                  fillOpacity={f.opacidad ?? 1}
                                  stroke={sel ? '#0ea5e9' : 'none'}
                                  strokeWidth={sel ? 1 : 0}
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                  fontWeight={f.negrita ? 800 : 400}
                                  style={{ pointerEvents: 'all', cursor: 'move', userSelect: 'none' }}
                                  onClick={shapeProps.onClick}
                                  onPointerDown={shapeProps.onPointerDown}
                                >
                                  {f.texto || ''}
                                </text>;
                        const tamTxt = (f.fontSize || 0.06) * imgDim.h;
                        const anchoTxt = Math.max(60, (f.texto || 'Texto').length * tamTxt * 0.6);
                        return (
                          <g key={f.id} onClick={(e) => { e.stopPropagation(); setFiguraSeleccionada(f.id); }}>
                            {shape}
                            {sel && (f.tipo === 'linea' || f.tipo === 'flecha' ? (
                              <>
                                <circle
                                  cx={f.x1 * imgDim.w}
                                  cy={f.y1 * imgDim.h}
                                  r={8}
                                  fill="#ffffff"
                                  stroke="#0ea5e9"
                                  strokeWidth="2"
                                  style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
                                  onClick={(e) => e.stopPropagation()}
                                  onPointerDown={(e) => {
                                    setFiguraSeleccionada(f.id);
                                    if (lineaAnimRef.current) { cancelAnimationFrame(lineaAnimRef.current); lineaAnimRef.current = null; }
                                    if (flechaAnimRef.current) { cancelAnimationFrame(flechaAnimRef.current); flechaAnimRef.current = null; actualizarFigura(f.id, { cabeza: 1 }); }
                                    const p = puntoImagen(e);
                                    if (!p) return;
                                    dragRef.current = { tipo: 'lineaPunto', id: f.id, cual: 'p1', cx: f.cx, cy: f.cy, px: p.x, py: p.y };
                                    e.currentTarget.setPointerCapture(e.pointerId);
                                  }}
                                />
                                <circle
                                  cx={f.x2 * imgDim.w}
                                  cy={f.y2 * imgDim.h}
                                  r={8}
                                  fill="#ffffff"
                                  stroke="#0ea5e9"
                                  strokeWidth="2"
                                  style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
                                  onClick={(e) => e.stopPropagation()}
                                  onPointerDown={(e) => {
                                    setFiguraSeleccionada(f.id);
                                    if (lineaAnimRef.current) { cancelAnimationFrame(lineaAnimRef.current); lineaAnimRef.current = null; }
                                    if (flechaAnimRef.current) { cancelAnimationFrame(flechaAnimRef.current); flechaAnimRef.current = null; actualizarFigura(f.id, { cabeza: 1 }); }
                                    const p = puntoImagen(e);
                                    if (!p) return;
                                    dragRef.current = { tipo: 'lineaPunto', id: f.id, cual: 'p2', cx: f.cx, cy: f.cy, px: p.x, py: p.y };
                                    e.currentTarget.setPointerCapture(e.pointerId);
                                  }}
                                />
                                {f.tipo === 'flecha' && (
                                  <circle
                                    cx={f.cx * imgDim.w}
                                    cy={f.cy * imgDim.h}
                                    r={8}
                                    fill="#facc15"
                                    stroke="#0ea5e9"
                                    strokeWidth="2"
                                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                                    title="Arrastra para curvar la flecha"
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => {
                                      setFiguraSeleccionada(f.id);
                                      if (flechaAnimRef.current) { cancelAnimationFrame(flechaAnimRef.current); flechaAnimRef.current = null; actualizarFigura(f.id, { cabeza: 1 }); }
                                      const p = puntoImagen(e);
                                      if (!p) return;
                                      dragRef.current = { tipo: 'flechaCurva', id: f.id };
                                      e.currentTarget.setPointerCapture(e.pointerId);
                                    }}
                                  />
                                )}
                              </>
                            ) : f.tipo === 'polilinea' ? (
                              <>
                                {(f.puntos || []).map((p, i) => (
                                  <circle
                                    key={i}
                                    cx={p.x * imgDim.w}
                                    cy={p.y * imgDim.h}
                                    r={8}
                                    fill="#ffffff"
                                    stroke="#0ea5e9"
                                    strokeWidth="2"
                                    style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => {
                                      setFiguraSeleccionada(f.id);
                                      const pp = puntoImagen(e);
                                      if (!pp) return;
                                      dragRef.current = { tipo: 'polilineaPunto', id: f.id, indice: i, puntos: f.puntos };
                                      e.currentTarget.setPointerCapture(e.pointerId);
                                    }}
                                  />
                                ))}
                              </>
                            ) : f.tipo === 'circuito' ? (
                              <>
                                {(f.elipses || []).map((el, i) => (
                                  <g key={i}>
                                    <circle
                                      cx={el.x * imgDim.w}
                                      cy={el.y * imgDim.h}
                                      r={7}
                                      fill="#ffffff"
                                      stroke="#0ea5e9"
                                      strokeWidth="2"
                                      style={{ pointerEvents: 'all', cursor: 'move' }}
                                      title={`Mover aro ${i + 1}`}
                                      onClick={(e) => e.stopPropagation()}
                                      onPointerDown={(e) => {
                                        setFiguraSeleccionada(f.id);
                                        if (circuitoAnimRef.current) { cancelAnimationFrame(circuitoAnimRef.current); circuitoAnimRef.current = null; }
                                        const p = puntoImagen(e);
                                        if (!p) return;
                                        dragRef.current = { tipo: 'circuitoPunto', id: f.id, indice: i };
                                        e.currentTarget.setPointerCapture(e.pointerId);
                                      }}
                                    />
                                    <circle
                                      cx={(el.x + (el.rx ?? 0.08)) * imgDim.w}
                                      cy={el.y * imgDim.h}
                                      r={6}
                                      fill="#facc15"
                                      stroke="#0ea5e9"
                                      strokeWidth="2"
                                      style={{ pointerEvents: 'all', cursor: 'ew-resize' }}
                                      title={`Ancho aro ${i + 1}`}
                                      onClick={(e) => e.stopPropagation()}
                                      onPointerDown={(e) => {
                                        setFiguraSeleccionada(f.id);
                                        if (circuitoAnimRef.current) { cancelAnimationFrame(circuitoAnimRef.current); circuitoAnimRef.current = null; }
                                        const p = puntoImagen(e);
                                        if (!p) return;
                                        dragRef.current = { tipo: 'circuitoRadioX', id: f.id, indice: i };
                                        e.currentTarget.setPointerCapture(e.pointerId);
                                      }}
                                    />
                                     <circle
                                       cx={el.x * imgDim.w}
                                       cy={(el.y + (el.ry ?? 0.08)) * imgDim.h}
                                       r={6}
                                       fill="#fb923c"
                                       stroke="#0ea5e9"
                                       strokeWidth="2"
                                       style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
                                       title={`Alto aro ${i + 1}`}
                                       onClick={(e) => e.stopPropagation()}
                                       onPointerDown={(e) => {
                                         setFiguraSeleccionada(f.id);
                                         if (circuitoAnimRef.current) { cancelAnimationFrame(circuitoAnimRef.current); circuitoAnimRef.current = null; }
                                         const p = puntoImagen(e);
                                         if (!p) return;
                                         dragRef.current = { tipo: 'circuitoRadioY', id: f.id, indice: i };
                                         e.currentTarget.setPointerCapture(e.pointerId);
                                       }}
                                     />
                                     <circle
                                       cx={(el.x + Math.cos(((el.rot ?? 270) + (el.hueco ?? 110) / 2) * Math.PI / 180) * (el.rx ?? 0.08)) * imgDim.w}
                                       cy={(el.y + Math.sin(((el.rot ?? 270) + (el.hueco ?? 110) / 2) * Math.PI / 180) * (el.ry ?? 0.08)) * imgDim.h}
                                       r={6}
                                       fill="#f472b6"
                                       stroke="#0ea5e9"
                                       strokeWidth="2"
                                       style={{ pointerEvents: 'all', cursor: 'grab' }}
                                       title={`Girar aro ${i + 1}`}
                                       onClick={(e) => e.stopPropagation()}
                                       onPointerDown={(e) => {
                                         setFiguraSeleccionada(f.id);
                                         if (circuitoAnimRef.current) { cancelAnimationFrame(circuitoAnimRef.current); circuitoAnimRef.current = null; }
                                         const p = puntoImagen(e);
                                         if (!p) return;
                                         dragRef.current = { tipo: 'circuitoRot', id: f.id, indice: i };
                                         e.currentTarget.setPointerCapture(e.pointerId);
                                       }}
                                     />
                                     <circle
                                       cx={(el.x + Math.cos((el.rot ?? 270) * Math.PI / 180) * (el.rx ?? 0.08) * 1.35) * imgDim.w}
                                       cy={(el.y + Math.sin((el.rot ?? 270) * Math.PI / 180) * (el.ry ?? 0.08) * 1.35) * imgDim.h}
                                       r={6}
                                       fill="#a3e635"
                                       stroke="#0ea5e9"
                                       strokeWidth="2"
                                       style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                                       title={`Hueco aro ${i + 1}`}
                                       onClick={(e) => e.stopPropagation()}
                                       onPointerDown={(e) => {
                                         setFiguraSeleccionada(f.id);
                                         if (circuitoAnimRef.current) { cancelAnimationFrame(circuitoAnimRef.current); circuitoAnimRef.current = null; }
                                         const p = puntoImagen(e);
                                         if (!p) return;
                                         dragRef.current = { tipo: 'circuitoHueco', id: f.id, indice: i };
                                         e.currentTarget.setPointerCapture(e.pointerId);
                                       }}
                                     />
                                     {i < (f.elipses || []).length - 1 && (() => {
                                       const b = f.elipses[i + 1];
                                       const tramo = (f.tramos || [])[i] || {};
                                       const pa = tramo.angA != null ? puntoEnElipse(el, imgDim, tramo.angA) : interseccionLineaElipse(el, b, imgDim);
                                       const pb = tramo.angB != null ? puntoEnElipse(b, imgDim, tramo.angB) : interseccionLineaElipse(b, el, imgDim);
                                       if (!pa || !pb) return null;
                                       return (
                                         <>
                                           <circle
                                             cx={pa.x}
                                             cy={pa.y}
                                             r={5}
                                             fill="#2dd4bf"
                                             stroke="#0ea5e9"
                                             strokeWidth="2"
                                             style={{ pointerEvents: 'all', cursor: 'move' }}
                                             title={`Salida del tramo ${i + 1} hacia el aro ${i + 2} (doble clic: automático)`}
                                             onClick={(e) => e.stopPropagation()}
                                             onDoubleClick={(e) => { e.stopPropagation(); actualizarFigura(f.id, { tramos: (figuras.find(ff => ff.id === f.id)?.tramos || []).map((t, j) => j === i ? { ...t, angA: undefined } : t) }); }}
                                             onPointerDown={(e) => {
                                               setFiguraSeleccionada(f.id);
                                               if (circuitoAnimRef.current) { cancelAnimationFrame(circuitoAnimRef.current); circuitoAnimRef.current = null; }
                                               const p = puntoImagen(e);
                                               if (!p) return;
                                               dragRef.current = { tipo: 'circuitoTramoA', id: f.id, indice: i };
                                               e.currentTarget.setPointerCapture(e.pointerId);
                                             }}
                                           />
                                           <circle
                                             cx={pb.x}
                                             cy={pb.y}
                                             r={5}
                                             fill="#818cf8"
                                             stroke="#0ea5e9"
                                             strokeWidth="2"
                                             style={{ pointerEvents: 'all', cursor: 'move' }}
                                             title={`Entrada del tramo ${i + 1} en el aro ${i + 2} (doble clic: automático)`}
                                             onClick={(e) => e.stopPropagation()}
                                             onDoubleClick={(e) => { e.stopPropagation(); actualizarFigura(f.id, { tramos: (figuras.find(ff => ff.id === f.id)?.tramos || []).map((t, j) => j === i ? { ...t, angB: undefined } : t) }); }}
                                             onPointerDown={(e) => {
                                               setFiguraSeleccionada(f.id);
                                               if (circuitoAnimRef.current) { cancelAnimationFrame(circuitoAnimRef.current); circuitoAnimRef.current = null; }
                                               const p = puntoImagen(e);
                                               if (!p) return;
                                               dragRef.current = { tipo: 'circuitoTramoB', id: f.id, indice: i };
                                               e.currentTarget.setPointerCapture(e.pointerId);
                                             }}
                                           />
                                         </>
                                       );
                                     })()}
                                   </g>
                                 ))}
                              </>
                            ) : (
                              <circle
                                cx={f.tipo === 'texto' ? x + anchoTxt / 2 : x + ancho / 2}
                                cy={f.tipo === 'texto' ? y + tamTxt / 2 : y + alto / 2}
                                r={Math.max(8, (f.tipo === 'texto' ? anchoTxt : ancho) * 0.06)}
                                fill="#ffffff"
                                stroke="#0ea5e9"
                                strokeWidth="2"
                                style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => {
                                  if (circuloAnimRef.current) { cancelAnimationFrame(circuloAnimRef.current); circuloAnimRef.current = null; }
                                  if (triAnimRef.current) { cancelAnimationFrame(triAnimRef.current); triAnimRef.current = null; if (f.tipo === 'triangulo') actualizarFigura(f.id, { crecimiento: 1 }); }
                                  setFiguraSeleccionada(f.id);
                                  const p = puntoImagen(e);
                                  if (!p) return;
                                  dragRef.current = { tipo: 'resize', id: f.id, fx: f.x, fy: f.y, tipoFig: f.tipo, tamInicial: f.fontSize || 0.06, py: p.y };
                                  e.currentTarget.setPointerCapture(e.pointerId);
                                }}
                              />
                            ))}
                          </g>
                        );
                      })}
                      {modoPolilinea && puntosPolilinea.length > 0 && (
                        <g style={{ pointerEvents: 'none' }}>
                          {puntosPolilinea.length > 1 && (
                            <polyline points={puntosPolilinea.map(p => `${p.x * imgDim.w},${p.y * imgDim.h}`).join(' ')} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,3" />
                          )}
                          {puntosPolilinea.map((p, i) => (
                            <circle key={i} cx={p.x * imgDim.w} cy={p.y * imgDim.h} r="6" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
                          ))}
                        </g>
                      )}
                    </svg>
                  )}
                </div>
                {capturaGuardada && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      {capturaGuardada.videoUrl ? (
                        <video
                          src={capturaGuardada.videoUrl}
                          muted
                          controls
                          playsInline
                          onLoadedMetadata={(e) => setCapturaDuracion(e.currentTarget.duration || 0)}
                          onClick={(e) => {
                            const v = e.currentTarget;
                            if (v.paused) v.play(); else v.pause();
                          }}
                          style={{ width: '320px', borderRadius: '8px', border: '2px solid #16a34a', background: '#000000', cursor: 'pointer' }}
                        />
                      ) : (
                        <img
                          src={capturaGuardada.dataUrl}
                          alt="Captura guardada"
                          style={{ width: '160px', borderRadius: '8px', border: '2px solid #16a34a' }}
                        />
                      )}
                      <button
                        onClick={() => {
                          setCapturas(prev => prev.filter(x => x.id !== capturaGuardada.id));
                          setCapturaGuardada(null);
                        }}
                        title="Borrar el video modificado"
                        style={{ position: 'absolute', top: '4px', right: '4px', width: '24px', height: '24px', background: '#dc2626', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 900, fontSize: '1rem', lineHeight: '24px', textAlign: 'center', cursor: 'pointer', padding: '0' }}
                      >
                        ×
                      </button>
                    </div>
                    {capturaDuracion != null && (
                      <span style={{ fontFamily: 'var(--font-mono, JetBrains Mono, monospace)', fontWeight: 700, fontSize: '0.75rem', color: '#94a3b8' }}>
                        Duración: {formatoTiempo(capturaDuracion)}
                      </span>
                    )}
                  </div>
                )}
                <span style={{ fontFamily: 'var(--font-mono, JetBrains Mono, monospace)', fontWeight: 700, fontSize: '0.8rem', color: '#94a3b8' }}>
                    Captura {formatoTiempo(capturaSeleccionada.tiempo)}
                  </span>
                </div>
              </div>
            ) : (
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#94a3b8' }}>Edición</span>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1.5rem', padding: '2rem' }}>
          <div style={{ width: '100%', maxWidth: '900px', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <input
              ref={imagenInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUrl = reader.result;
                  setFilasMontaje(prev => {
                    const nueva = { id: Date.now(), tipo: 'imagen', imagenUrl: dataUrl, videoUrl: null, concepto: '' };
                    if (filaSeleccionada != null) {
                      const copy = [...prev];
                      copy.splice(filaSeleccionada, 0, nueva);
                      return copy;
                    }
                    return [...prev, nueva];
                  });
                };
                reader.readAsDataURL(file);
                e.target.value = '';
              }}
            />
            <button onClick={() => imagenInputRef.current?.click()} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.5rem 1rem', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.8rem', color: '#e2e8f0', cursor: 'pointer' }}>Imagen</button>
            <button
              onClick={() => {
                setFilasMontaje(prev => {
                  if (prev.length < 2) return prev;
                  const resultado = [];
                  for (let i = 0; i < prev.length; i++) {
                    resultado.push(prev[i]);
                    const esUltimo = i === prev.length - 1;
                    if (!esUltimo && prev[i].tipo !== 'transicion' && prev[i + 1].tipo !== 'transicion') {
                      resultado.push({ id: Date.now() + i, tipo: 'transicion', videoUrl: null, imagenUrl: null, concepto: 'Crossfade 2s', duracion: 2 });
                    }
                  }
                  return resultado;
                });
              }}
              style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.5rem 1rem', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.8rem', color: '#e2e8f0', cursor: 'pointer' }}
            >Transiciones</button>
            <button
              onClick={async () => {
                const selId = Object.keys(lineasSelMontaje).find(k => lineasSelMontaje[k]);
                const linea = selId ? filasMontaje.find(f => String(f.id) === String(selId)) : null;
                if (!linea || linea.inicio == null || linea.fin == null) { setAviso('Marca el cuadrado de la fila para descargar'); return; }
                const pv = previewMontaje;
                if (pv && pv.anims && pv.anims.length && pv.inicio === linea.inicio && pv.fin === linea.fin) {
                  const ok = await descargarClipConAnimacion();
                  if (ok) return;
                }
                if (linea.videoUrl) {
                  try {
                    const r = await fetch(linea.videoUrl);
                    const b = await r.blob();
                    const url = URL.createObjectURL(b);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${(linea.concepto || 'clip').replace(/[^\w\-áéíóúñ]+/gi, '_')}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                    return;
                  } catch (e) {
                    console.error('Error al descargar vídeo de la línea', e);
                  }
                }
                await descargarFragmentoLinea(linea);
              }}
              disabled={descargandoMontaje}
              style={{ background: descargandoMontaje ? '#166534' : '#16a34a', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.8rem', color: '#ffffff', cursor: descargandoMontaje ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {descargandoMontaje && <span style={{ fontFamily: 'monospace' }}>{progresoDescarga}%</span>}
              Descargar
            </button>
            {descargandoMontaje && (
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ flex: 1, height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progresoDescarga}%`, height: '100%', background: '#22c55e', borderRadius: '3px', transition: 'width 0.3s' }} />
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '1600px', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {filasMontaje.length === 0 ? (
              <span style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>Sin líneas. Envíalas desde Cortes con el botón Montaje.</span>
            ) : filasMontaje.map((fila, i) => (
              <div key={fila.id} draggable
                onDragStart={() => setLineaArrastre(i)}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={() => {
                  if (lineaArrastre === null || lineaArrastre === i) { setLineaArrastre(null); return; }
                  const idMovida = filasMontaje[lineaArrastre] ? filasMontaje[lineaArrastre].id : null;
                  setFilasMontaje(prev => {
                    const copy = [...prev];
                    const [moved] = copy.splice(lineaArrastre, 1);
                    copy.splice(i, 0, moved);
                    return copy;
                  });
                  if (idMovida != null) setLineasSelMontaje(prev => { const c = { ...prev }; delete c[idMovida]; return c; });
                  setLineaArrastre(null);
                }}
                onDragEnd={() => setLineaArrastre(null)}
                title="Arrastra para mover la fila (clic para seleccionar)"
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: lineasSelMontaje[fila.id] ? 'rgba(56,189,248,0.25)' : '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.5rem 10rem 0.5rem 0.8rem', flexWrap: 'nowrap', overflowX: 'auto', maxWidth: '100%', width: 'fit-content', cursor: 'grab', opacity: lineaArrastre === i ? 0.5 : 1 }}>
                <span style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 900, fontSize: '0.8rem', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <div
                  onClick={(e) => { e.stopPropagation(); setLineasSelMontaje(prev => ({ ...prev, [fila.id]: !prev[fila.id] })); }}
                  title="Seleccionar línea"
                  style={{ width: '18px', height: '18px', borderRadius: '4px', border: '1px solid #64748b', background: lineasSelMontaje[fila.id] ? '#22c55e' : 'transparent', cursor: 'pointer', flexShrink: 0 }}
                />
                {(() => {
                  const listaEd = capsEditadasDeLinea(fila);
                  if (listaEd.length === 0) return null;
                  return (
                    <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                      {listaEd.map((capEd) => (
                        <div key={capEd.id} style={{ position: 'relative', flexShrink: 0 }}>
                          <img src={capEd.dataUrl} alt="Imagen editada" title="Abrir en Edición"
                            onClick={() => { setCapturaSeleccionada(capEd); setFiguras(normalizarFiguras(capEd.figuras)); setFiguraSeleccionada(null); setCapturaGuardada(null); setImgDim(null); setHoja('Edición'); }}
                            style={{ width: '80px', borderRadius: '4px', border: '1px solid #38bdf8', cursor: 'pointer', display: 'block' }} />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCapturas(prev => {
                                const t = prev.find(c => c.id === capEd.id);
                                if (t && t.videoUrl) return prev.map(c => c.id === capEd.id ? { ...c, dataUrl: null, baseDataUrl: null, imagenEditada: null } : c);
                                return prev.filter(c => c.id !== capEd.id);
                              });
                            }}
                            title="Borrar foto"
                            style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', background: '#dc2626', border: 'none', borderRadius: '5px', color: '#ffffff', fontWeight: 900, fontSize: '0.7rem', lineHeight: '18px', textAlign: 'center', cursor: 'pointer', padding: '0' }}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {fila.inicio != null && fila.fin != null && (
                  <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'nowrap' }}>P{i + 1}: <span onClick={() => abrirPreviewLinea(fila, fila.inicio)} title="Ir al inicio" style={{ cursor: 'pointer' }}>{formatoTiempo(fila.inicio)}</span> — <span onClick={() => abrirPreviewLinea(fila, fila.fin)} title="Ir al final" style={{ cursor: 'pointer' }}>{formatoTiempo(fila.fin)}</span></span>
                )}
                <input
                  value={fila.concepto || ''}
                  onChange={(e) => { setFilasMontaje(prev => prev.map((f) => f.id === fila.id ? { ...f, concepto: e.target.value } : f)); }}
                  placeholder="Escribe nombre o concepto..."
                  style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '0.3rem 0.6rem', color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 800, fontFamily: 'Inter, sans-serif', outline: 'none', width: '220px' }}
                />
                {fila.tipo === 'imagen' && fila.imagenUrl ? (
                  <img src={fila.imagenUrl} alt={`Imagen ${i + 1}`} style={{ width: '80px', borderRadius: '4px', border: '1px solid #334155', flexShrink: 0 }} />
                ) : fila.videoUrl ? (
                  <video src={fila.videoUrl} muted controls playsInline style={{ width: '200px', borderRadius: '6px', background: '#000000', flexShrink: 0 }} />
                ) : null}
                {fila.duracion != null && (
                  <span style={{ color: '#22c55e', fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, fontSize: '0.75rem', minWidth: '44px', textAlign: 'center', flexShrink: 0 }}>{fila.duracion}s</span>
                )}
                {fila.inicio != null && fila.fin != null && (
                  <button
                    onClick={() => {
                      prevTPreviewRef.current = null;
                      limpiarTimerAnim();
                      animMostradasRef.current.clear(); animActualRef.current = null;
                      if (fila.videoUrl) {
                        deseaPlayPreviewRef.current = true;
                        setFasePreview('base');
                        setPreviewMontaje({ src: fila.videoUrl, inicio: 0, fin: Number.POSITIVE_INFINITY, concepto: fila.concepto || '', anims: [] });
                        requestAnimationFrame(() => { const v = previewVideoRef.current; if (v) { try { v.currentTime = 0; v.play().catch(() => {}); } catch (_) {} } });
                        return;
                      }
                      const src = videoUrlCortes || videoUrl;
                      if (!src) { setAviso('Carga primero un vídeo para previsualizar el fragmento'); return; }
                      abrirPreviewLinea(fila);
                    }}
                    title="Ver fragmento entre inicio y fin"
                    style={{ background: '#16a34a', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 900, fontSize: '0.8rem', width: '28px', height: '24px', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
                  >▶</button>
                )}
                <button
                  onClick={() => {
                    const v = previewVideoRef.current;
                    if (!v || !v.videoWidth) { setAviso('Abre primero el fragmento con el botón play'); return; }
                    const c = document.createElement('canvas');
                    c.width = v.videoWidth;
                    c.height = v.videoHeight;
                    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
                    const nueva = { id: Date.now(), dataUrl: c.toDataURL('image/png'), tiempo: v.currentTime };
                    setFiguras([]);
                    setFiguraSeleccionada(null);
                    setCapturaSeleccionada(nueva);
                    setCapturaGuardada(null);
                    setImgDim(null);
                    setHoja('Edición');
                  }}
                  title="Enviar instantánea a Edición"
                  style={{ background: '#0ea5e9', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 900, fontSize: '0.8rem', width: '28px', height: '24px', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
                >📷</button>
                <button
                  onClick={() => {
                    if (fila.videoUrl && fila.videoUrl.startsWith('blob:')) { try { URL.revokeObjectURL(fila.videoUrl); } catch (_) {} }
                    setFilasMontaje(prev => prev.filter((f) => f.id !== fila.id));
                  }}
                  title="Eliminar línea"
                  style={{ background: '#dc2626', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 900, fontSize: '0.8rem', width: '24px', height: '24px', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
                >×</button>
              </div>
            ))}
          </div>
          {previewMontaje && (
            <div style={{ flex: '1 1 auto', background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1rem', position: 'sticky', top: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.6rem', minHeight: '26px' }}>
                  {fasePreview === 'anim' && (
                  <span style={{ background: '#8b5cf6', color: '#ffffff', fontWeight: 800, fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Animación</span>
                )}
                <button onClick={() => { try { localStorage.removeItem('preview_anim'); } catch (_) {} limpiarTimerAnim(); setPreviewMontaje(null); }} title="Cerrar" style={{ background: '#dc2626', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 900, fontSize: '0.8rem', width: '26px', height: '26px', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ position: 'relative' }}>
              <video
                ref={previewVideoRef}
                src={fasePreview === 'anim' && animActualRef.current ? animActualRef.current.src : previewMontaje.src}
                controls
                playsInline
                style={{ width: '100%', borderRadius: '8px', background: '#000000', display: 'block' }}
                onLoadedMetadata={(e) => { const v = e.currentTarget; const anim = (fasePreview === 'anim' && animActualRef.current) ? animActualRef.current : null; const seekTo = retomarEnRef.current ?? (anim ? 0 : Math.max(0, previewMontaje.inicio)); retomarEnRef.current = null; try { v.currentTime = seekTo; } catch (_) {} setPreviewT(seekTo); setPreviewDur(v.duration || 0); if (deseaPlayPreviewRef.current) { deseaPlayPreviewRef.current = false; v.play().catch(() => {}); } }}
                onTimeUpdate={(e) => { const v = e.currentTarget; setPreviewT(v.currentTime); if (fasePreview === 'anim') { const aa = animActualRef.current; prevTPreviewRef.current = ((aa && aa.en) ?? 0) + 0.1; return; } const prev = prevTPreviewRef.current ?? v.currentTime; prevTPreviewRef.current = v.currentTime; const cand = (previewMontaje.anims || []).find(a => a && a.src && !animMostradasRef.current.has(String(a.id ?? a.src)) && prev <= a.en && v.currentTime >= a.en); if (cand) { animMostradasRef.current.add(String(cand.id ?? cand.src)); animActualRef.current = cand; deseaPlayPreviewRef.current = true; setFasePreview('anim'); if (!animTimerRef.current) { const ms = Math.max(1500, ((cand.dur || 4) * 1000) + 800); animTimerRef.current = setTimeout(() => { animTimerRef.current = null; const a2 = animActualRef.current; retomarEnRef.current = ((a2 && a2.en) ?? 0) + 0.1; deseaPlayPreviewRef.current = true; setFasePreview('base'); }, ms); } return; } if (v.currentTime >= previewMontaje.fin) v.pause(); }}
                onEnded={() => { const a = animActualRef.current; if (fasePreview === 'anim' && a) { limpiarTimerAnim(); retomarEnRef.current = (a.en ?? 0) + 0.1; deseaPlayPreviewRef.current = true; setFasePreview('base'); } }}
                onPlay={() => setPreviewPlaying(true)}
                onPause={() => setPreviewPlaying(false)}
              />
              {!!previewMontaje.concepto && (
                <div style={{ position: 'absolute', top: '0.6rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ background: 'rgba(0,0,0,0.65)', color: '#ffffff', fontWeight: 800, fontSize: '1rem', fontFamily: 'Inter, sans-serif', padding: '0.25rem 0.9rem', borderRadius: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90%' }}>{previewMontaje.concepto}</span>
                </div>
              )}
              </div>
            </div>
          )}
          </div>
        </div>
      )}
      {aviso && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(2,6,23,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1.4rem 1.8rem', maxWidth: '340px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#e2e8f0' }}>{aviso}</p>
            {exportando && (
              <button
                onClick={() => { cancelarVideoRef.current = true; }}
                style={{ marginTop: '1rem', marginRight: '0.6rem', background: '#dc2626', border: 'none', borderRadius: '8px', padding: '0.5rem 1.6rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            )}
            <button
              onClick={() => {
                if (abrirCarpetaAlOK) {
                  setAbrirCarpetaAlOK(false);
                  try { fetch('/abrir-carpeta'); } catch (e) { /* noop */ }
                }
                setAviso(null);
              }}
              style={{ marginTop: '1rem', background: '#16a34a', border: 'none', borderRadius: '8px', padding: '0.5rem 2rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default TratamientoApp;
