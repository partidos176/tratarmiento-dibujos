import { useState, useRef, useEffect } from 'react';

function App() {
  const [archivo, setArchivo] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoja, setHoja] = useState('Presentación');
  const [progreso, setProgreso] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [capturas, setCapturas] = useState([]);
  const [capturaSeleccionada, setCapturaSeleccionada] = useState(null);
  const [capturaGuardada, setCapturaGuardada] = useState(null);
  const [figuras, setFiguras] = useState([]);
  const [figuraSeleccionada, setFiguraSeleccionada] = useState(null);
  const [imgDim, setImgDim] = useState(null);
  const [clipActivo, setClipActivo] = useState(null);
  const [arrastrandoMarcaId, setArrastrandoMarcaId] = useState(null);
  const [arrastrePos, setArrastrePos] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [abrirCarpetaAlOK, setAbrirCarpetaAlOK] = useState(false);
  const [modoPolilinea, setModoPolilinea] = useState(false);
  const [puntosPolilinea, setPuntosPolilinea] = useState([]);
  const [cortes, setCortes] = useState([]);
  const [modoCorte, setModoCorte] = useState(false);
  const [modoCirculoClick, setModoCirculoClick] = useState(false);
  const [modoFlechaClick, setModoFlechaClick] = useState(false);
  const elipsesSessionRef = useRef([]);
  const videoRef = useRef(null);
  const draggingRef = useRef(false);
  const clipRef = useRef(null);
  const clipTimerRef = useRef(null);
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
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const hojas = ['Presentación', 'Edición'];

  const colores = ['#38bdf8', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#facc15', '#ffffff'];

  const handleFile = (e) => {
    const f = e.target.files[0] || null;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setArchivo(f);
    setVideoUrl(f ? URL.createObjectURL(f) : '');
    setProgreso(0);
  };

  const formatoTiempo = (s, dec = 2) => {
    const frac = (s % 1).toFixed(dec).slice(1);
    return `${String(Math.floor(s)).padStart(2, '0')}${frac}`;
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

  const exportarVideo = async () => {
    const original = videoRef.current;
    if (!original || !duracion) return;
    setExportando(true);
    try {
      const w = original.videoWidth || 640;
      const h = original.videoHeight || 360;
      const clips = capturas.filter(c => c.videoUrl && c.insertarEn != null).sort((a, b) => a.insertarEn - b.insertarEn);

      const tempImgDim = { w, h };

      const buildFiguresSvg = () => {
        if (figuras.length === 0) return null;
        const parts = figuras.map(f => svgFigura(f, tempImgDim)).filter(Boolean);
        if (parts.length === 0) return null;
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`;
        const blob = new Blob([svgStr], { type: 'image/svg+xml' });
        return URL.createObjectURL(blob);
      };

      const svgUrl = buildFiguresSvg();
      let figuresImg = null;
      if (svgUrl) {
        figuresImg = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(svgUrl); resolve(img); };
          img.onerror = () => { URL.revokeObjectURL(svgUrl); resolve(null); };
          img.src = svgUrl;
        });
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(30);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3500000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

      const orig = document.createElement('video');
      orig.muted = true;
      orig.playsInline = true;
      orig.preload = 'auto';
      orig.src = videoUrl;

      await new Promise((res, rej) => { orig.onloadedmetadata = res; orig.onerror = rej; });

      const clipEls = clips.map(c => {
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        v.preload = 'auto';
        v.src = c.videoUrl;
        return { c, v };
      });
      await Promise.all(clipEls.map(({ v }) => new Promise((res) => { v.onloadedmetadata = res; v.onerror = res; })));

      let activeClip = null;
      let clipStartTime = 0;
      let clipIdx = 0;
      let raf = 0;
      let terminado = false;

      const drawFrame = () => {
        ctx.drawImage(orig, 0, 0, w, h);
        if (activeClip) {
          ctx.drawImage(activeClip, 0, 0, w, h);
        }
        if (figuresImg) {
          ctx.drawImage(figuresImg, 0, 0, w, h);
        }
      };

      const terminar = async (error) => {
        if (terminado) return;
        terminado = true;
        cancelAnimationFrame(raf);
        try { rec.stop(); } catch (e) { /* noop */ }
        setExportando(false);
        if (error) { setAviso('Error al exportar el video'); return; }
        await new Promise(res => { rec.onstop = res; });
        const blob = new Blob(chunks, { type: mime });
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
        const t = orig.currentTime;
        if (!activeClip && clipIdx < clipEls.length && t >= clipEls[clipIdx].c.insertarEn) {
          activeClip = clipEls[clipIdx].v;
          clipStartTime = t;
          activeClip.currentTime = 0;
          activeClip.play().catch(() => {});
        }
        if (activeClip && (t - clipStartTime) >= (clipEls[clipIdx].c.duracion || 4)) {
          activeClip.pause();
          activeClip = null;
          clipIdx++;
        }
        drawFrame();
        if (!terminado) raf = requestAnimationFrame(loop);
      };

      orig.addEventListener('ended', () => terminar(false));
      orig.addEventListener('error', () => terminar(true));

      rec.start(250);
      loop();
      await orig.play();
    } catch (e) {
      setExportando(false);
      setAviso('Error al exportar el video');
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
    setCapturas(prev => [...prev, { id: Date.now(), dataUrl: canvas.toDataURL('image/png'), tiempo: v.currentTime }]);
  };

  const anadirTriangulo = () => {
    const id = Date.now();
    setFiguras(prev => [...prev, { id, tipo: 'triangulo', x: 0.5, y: 0.5, ancho: 0.06, alto: 0.35, color: '#f97316', opacidad: 0.7, crecimiento: 0 }]);
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
      const e = 1 - Math.pow(1 - p, 2.5);
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
    setFiguras(prev => [...prev, { id, tipo: 'circulo', x: 0.5, y: 0.5, ancho: 0.2, alto: 0.2, color: '#38bdf8', opacidad: 0.5, crecimiento: 0 }]);
    setFiguraSeleccionada(id);
  };

  const anadirTexto = () => {
    const id = Date.now();
    setFiguras(prev => [...prev, { id, tipo: 'texto', x: 0.5, y: 0.5, fontSize: 0.06, color: '#ffffff', opacidad: 1, texto: 'Texto' }]);
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
    setFiguras(prev => [...prev, { id, tipo: 'flecha', x1, y1, x2: x1, y2: y1, cx: x1, cy: y1, color: '#38bdf8', opacidad: 1, grosor: 0.005, discontinuo: false, cabeza: 0 }]);
    setFiguraSeleccionada(id);
    if (flechaAnimRef.current) cancelAnimationFrame(flechaAnimRef.current);
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / 1000);
      const e = 1 - Math.pow(1 - p, 3);
      setFiguras(prev => prev.map(f => f.id === id ? { ...f, x2: x1 + (x2 - x1) * e, y2: y1 + (y2 - y1) * e, cx: x1 + (cx - x1) * e, cy: y1 + (cy - y1) * e, cabeza: e } : f));
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
    const d = (dim && dim.w != null) ? dim : imgDim;
    const pat = f.rayado
      ? `<defs><pattern id="rayado-${f.id}" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${f.color}" strokeWidth="2.5"/></pattern></defs>`
      : '';
    const fill = f.sinRelleno ? 'none' : (f.rayado ? `url(#rayado-${f.id})` : f.color);
    const op = f.opacidad ?? 0.5;
    const common = `fill="${fill}" fill-opacity="${f.sinRelleno ? 0 : op}" stroke="${f.color}" stroke-opacity="${op}" stroke-width="2"`;
    if (f.tipo === 'polilinea') {
      const pts = (f.puntos || []).map(p => `${p.x * d.w},${p.y * d.h}`);
      const grosor = (f.grosor || 0.006) * d.h;
      const radio = Math.max(5, grosor * 1.2);
      const pol = pts.length > 1 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round"/>` : '';
      const circs = pts.map((p, i) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="${radio}" fill="${f.color}" fill-opacity="${f.opacidad ?? 1}" stroke="#ffffff" stroke-width="1"/>`).join('');
      return `${pol}${circs}`;
    }
    if (f.tipo === 'circuito') {
      const elipses = f.elipses || [{x:f.x1??0.2,y:f.y1??0.5,rx:f.rx1??0.08,ry:f.ry1??0.08},{x:f.x2??0.8,y:f.y2??0.5,rx:f.rx2??0.08,ry:f.ry2??0.08}];
      const grosor = (f.grosor || 0.005) * d.h;
      let parts = '';
      for (let i = 0; i < elipses.length - 1; i++) {
        const a = elipses[i], b = elipses[i + 1];
        const ax = a.x * d.w, ay = a.y * d.h;
        const bx = b.x * d.w, by = b.y * d.h;
        const arx = (a.rx ?? 0.08) * d.w, ary = (a.ry ?? 0.08) * d.h;
        const brx = (b.rx ?? 0.08) * d.w, bry = (b.ry ?? 0.08) * d.h;
        const dx = bx - ax, dy = by - ay;
        if (dx !== 0 || dy !== 0) {
          const tA = 1 / Math.sqrt(Math.pow(dx / arx, 2) + Math.pow(dy / ary, 2));
          const tB = 1 / Math.sqrt(Math.pow(dx / brx, 2) + Math.pow(dy / bry, 2));
          const lx1 = ax + dx * tA, ly1 = ay + dy * tA;
          const lx2 = bx - dx * tB, ly2 = by - dy * tB;
          parts += `<line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${grosor}" stroke-linecap="round"/>`;
        }
      }
      elipses.forEach(e => {
        const ex = e.x * d.w, ey = e.y * d.h;
        const erx = (e.rx ?? 0.08) * d.w, ery = (e.ry ?? 0.08) * d.h;
        parts += `<ellipse cx="${ex}" cy="${ey}" rx="${erx}" ry="${ery}" fill="none" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${grosor}"/>`;
      });
      return parts;
    }
    if (f.tipo === 'flecha') {
      const x1 = f.x1 * d.w;
      const y1 = f.y1 * d.h;
      const x2 = f.x2 * d.w;
      const y2 = f.y2 * d.h;
      const cx = f.cx * d.w;
      const cy = f.cy * d.h;
      const grosor = (f.grosor || 0.005) * d.h;
      const ang = Math.atan2(y2 - cy, x2 - cx);
      const L = grosor * 6 * (f.cabeza ?? 1);
      const a = Math.PI / 6;
      const hx1 = x2 - L * Math.cos(ang - a);
      const hy1 = y2 - L * Math.sin(ang - a);
      const hx2 = x2 - L * Math.cos(ang + a);
      const hy2 = y2 - L * Math.sin(ang + a);
      const dash = f.discontinuo ? ` stroke-dasharray="${grosor * 3},${grosor * 2}"` : '';
      return `<path d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}" fill="none" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${grosor}" stroke-linecap="round"${dash}/><polygon points="${x2},${y2} ${hx1},${hy1} ${hx2},${hy2}" fill="${f.color}" fill-opacity="${f.opacidad ?? 1}"/>`;
    }
    if (f.tipo === 'linea') {
      return `<line x1="${f.x1 * d.w}" y1="${f.y1 * d.h}" x2="${f.x2 * d.w}" y2="${f.y2 * d.h}" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${(f.grosor || 0.005) * d.h}" stroke-linecap="round"/>`;
    }
    if (f.tipo === 'texto') {
      const x = f.x * d.w;
      const y = f.y * d.h;
      const tam = (f.fontSize || 0.06) * d.h;
      const txt = String(f.texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<text x="${x}" y="${y}" font-size="${tam}" fill="${f.color}" fill-opacity="${f.opacidad ?? 1}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif">${txt}</text>`;
    }
    if (f.tipo === 'triangulo') {
      const x = f.x * d.w;
      const y = f.y * d.h;
      const ancho = f.ancho * d.w;
      const alto = f.alto * d.h;
      const crecimiento = f.crecimiento ?? 1;
      const yBase = y + alto / 2;
      const pillarH = alto * crecimiento;
      const yTop = yBase - pillarH;
      const halfW = ancho / 2;
      const ellipseRy = alto * 0.06 * crecimiento;
      const gradientId = `pilar_${f.id}`;
      return `${pat}<defs><linearGradient id="${gradientId}" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="${f.color}" stop-opacity="${f.opacidad ?? 1}"/><stop offset="100%" stop-color="${f.color}" stop-opacity="${(f.opacidad ?? 1) * 0.35}"/></linearGradient></defs><ellipse cx="${x}" cy="${yBase}" rx="${halfW * 1.8}" ry="${ellipseRy}" fill="rgba(30,10,0,0.5)" /><rect x="${x - halfW}" y="${yTop}" width="${ancho}" height="${pillarH}" rx="${halfW * 0.3}" fill="url(#${gradientId})" />`;
    }
    const cx = f.x * d.w;
    const cy = f.y * d.h;
    const rx = f.ancho * d.w / 2;
    const ry = f.alto * d.h / 2;
    return `${pat}<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${common}/>`;
  };

  const generarVideo = (svgFn, w, h) => new Promise((resolve, reject) => {
    try {
      const totalFrames = 120;
      const frameDuration = 1000 / 30;
      const promises = [];
      for (let i = 0; i <= totalFrames; i++) {
        const t = Math.min(4000, i * 33);
        const svgStr = svgFn(t);
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        promises.push(new Promise((res) => {
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(url); res(img); };
          img.onerror = () => { URL.revokeObjectURL(url); res(null); };
          img.src = url;
        }));
      }
      Promise.all(promises).then((frames) => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        const stream = canvas.captureStream(30);
        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          resolve(URL.createObjectURL(new Blob(chunks, { type: mime })));
        };
        rec.onerror = reject;
        rec.start();
        let idx = 0;
        const drawNext = () => {
          if (idx < frames.length && frames[idx]) {
            ctx.drawImage(frames[idx], 0, 0, w, h);
          }
          idx++;
          if (idx < frames.length) {
            setTimeout(drawNext, frameDuration);
          } else {
            try { rec.stop(); } catch (e) { reject(e); }
          }
        };
        drawNext();
      }).catch(reject);
    } catch (e) {
      reject(e);
    }
  });

  const animarElipses = async () => {
    if (!capturaSeleccionada || !imgDim || figuras.length === 0) return;
    const circs = figuras.filter(f => f.tipo === 'circulo');
    const circuits = figuras.filter(f => f.tipo === 'circuito');
    const flechas = figuras.filter(f => f.tipo === 'flecha');
    if (circs.length === 0 && circuits.length === 0 && flechas.length === 0) return;
    setExportando(true);
    try {
      const w = imgDim.w;
      const h = imgDim.h;

      const bgImg = new Image();
      await new Promise((res, rej) => { bgImg.onload = res; bgImg.onerror = rej; bgImg.src = capturaSeleccionada.dataUrl; });

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      const totalFrames = 120;

      const drawFrame = (frameIdx) => {
        const t = Math.min(frameIdx / totalFrames, 1);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(bgImg, 0, 0, w, h);

        const groups = [];
        const individualCircs = circs.map(c => ({ x: c.x, y: c.y, color: c.color, opacidad: c.opacidad, ancho: c.ancho, alto: c.alto }));
        if (individualCircs.length > 0) groups.push(individualCircs);
        circuits.forEach(c => {
          const els = (c.elipses || []).map(el => ({ x: el.x, y: el.y, color: c.color, opacidad: c.opacidad, ancho: (el.rx || 0.03) * 2, alto: (el.ry || 0.02) * 2 }));
          if (els.length > 0) groups.push(els);
        });

        const totalGroups = groups.length;
        const framesPerGroup = totalGroups > 0 ? Math.floor(totalFrames / totalGroups) : totalFrames;

        groups.forEach((group, gi) => {
          const groupStart = (gi * framesPerGroup) / totalFrames;
          const groupEnd = ((gi + 1) * framesPerGroup) / totalFrames;
          const groupT = Math.max(0, Math.min(1, (t - groupStart) / (groupEnd - groupStart)));

          const appearT = Math.min(1, groupT * 2);
          const lineT = groupT > 0.5 ? (groupT - 0.5) * 2 : 0;

          group.forEach((c, ci) => {
            const perEll = group.length > 0 ? 1 / group.length : 1;
            const ellStart = ci * perEll;
            const ellEnd = (ci + 1) * perEll;
            let e = 0;
            if (appearT >= ellEnd) e = 1;
            else if (appearT > ellStart) e = (appearT - ellStart) / (ellEnd - ellStart);
            e = 1 - Math.pow(1 - e, 3);
            const cx = c.x * w;
            const cy = c.y * h;
            const rx = (c.ancho * w / 2) * e;
            const ry = (c.alto * h / 2) * e;
            ctx.beginPath();
            ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
            ctx.strokeStyle = c.color;
            ctx.globalAlpha = c.opacidad ?? 1;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = 1;
          });

          if (lineT > 0 && group.length >= 2) {
            ctx.strokeStyle = group[0].color;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            for (let j = 0; j < group.length - 1; j++) {
              const segEnd = Math.min(1, lineT * (group.length - 1) - j);
              if (segEnd <= 0) break;
              const a = group[j], b = group[j + 1];
              const ax = a.x * w, ay = a.y * h, arx = (a.ancho || 0.04) * w / 2, ary = (a.alto || 0.025) * h / 2;
              const bx = b.x * w, by = b.y * h, brx = (b.ancho || 0.04) * w / 2, bry = (b.alto || 0.025) * h / 2;
              const dx = bx - ax, dy = by - ay;
              if (dx !== 0 || dy !== 0) {
                const tA = 1 / Math.sqrt(Math.pow(dx / arx, 2) + Math.pow(dy / ary, 2));
                const tB = 1 / Math.sqrt(Math.pow(dx / brx, 2) + Math.pow(dy / bry, 2));
                const lx1 = ax + dx * tA, ly1 = ay + dy * tA;
                const lx2 = bx - dx * tB, ly2 = by - dy * tB;
                ctx.beginPath();
                ctx.moveTo(lx1, ly1);
                ctx.lineTo(lx1 + (lx2 - lx1) * Math.min(1, segEnd), ly1 + (ly2 - ly1) * Math.min(1, segEnd));
                ctx.stroke();
              }
            }
          }
        });

        flechas.forEach((f, fi) => {
          const fStart = (fi * framesPerGroup) / totalFrames;
          const fEnd = ((fi + 1) * framesPerGroup) / totalFrames;
          const fT = Math.max(0, Math.min(1, (t - fStart) / (fEnd - fStart)));
          const e = 1 - Math.pow(1 - Math.min(1, fT * 2), 3);
          const headE = fT > 0.5 ? Math.min(1, (fT - 0.5) * 2) : 0;
          const x1 = f.x1 * w, y1 = f.y1 * h;
          const x2 = f.x1 * w + (f.x2 - f.x1) * w * e;
          const y2 = f.y1 * h + (f.y2 - f.y1) * h * e;
          const grosor = (f.grosor || 0.005) * h;
          ctx.strokeStyle = f.color;
          ctx.globalAlpha = f.opacidad ?? 1;
          ctx.lineWidth = grosor;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          if (headE > 0) {
            const cx = f.x1 * w + (f.cx - f.x1) * w * headE;
            const cy = f.y1 * h + (f.cy - f.y1) * h * headE;
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.hypot(dx, dy);
            if (len > 0) {
              const ux = dx / len, uy = dy / len;
              const headLen = grosor * 3 * headE;
              const hx1 = x2 - ux * headLen - uy * headLen * 0.5;
              const hy1 = y2 - uy * headLen + ux * headLen * 0.5;
              const hx2 = x2 - ux * headLen + uy * headLen * 0.5;
              const hy2 = y2 - uy * headLen - ux * headLen * 0.5;
              ctx.fillStyle = f.color;
              ctx.beginPath();
              ctx.moveTo(x2, y2);
              ctx.lineTo(hx1, hy1);
              ctx.lineTo(cx, cy);
              ctx.lineTo(hx2, hy2);
              ctx.closePath();
              ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
        });
      };

      const frameImages = [];
      for (let i = 0; i <= totalFrames; i++) {
        drawFrame(i);
        frameImages.push(ctx.getImageData(0, 0, w, h));
      }

      ctx.clearRect(0, 0, w, h);

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
        a.download = `animacion_elipses.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setExportando(false);
      };

      rec.start();
      const frameMs = 1000 / 30;
      let idx = 0;
      const totalMs = frameImages.length * frameMs;
      const startRec = performance.now();

      const loop = () => {
        const now = performance.now();
        const elapsed = now - startRec;
        if (elapsed < totalMs) {
          const fi = Math.min(Math.floor(elapsed / frameMs), frameImages.length - 1);
          if (fi !== idx) {
            idx = fi;
            ctx.putImageData(frameImages[idx], 0, 0);
            videoTrack.requestFrame();
          }
          requestAnimationFrame(loop);
        } else {
          ctx.putImageData(frameImages[frameImages.length - 1], 0, 0);
          videoTrack.requestFrame();
          setTimeout(() => {
            ctx.putImageData(frameImages[frameImages.length - 1], 0, 0);
            videoTrack.requestFrame();
            setTimeout(() => {
              ctx.putImageData(frameImages[frameImages.length - 1], 0, 0);
              videoTrack.requestFrame();
              setTimeout(() => {
                try { rec.stop(); } catch (e) { setExportando(false); }
              }, 500);
            }, 500);
          }, 1000);
        }
      };
      requestAnimationFrame(loop);
      setTimeout(() => { try { if (rec.state === 'recording') rec.stop(); } catch (e) {} }, 20000);
    } catch (e) {
      setExportando(false);
      setAviso('Error al generar animación');
    }
  };

  const guardarCaptura = async () => {
    if (!capturaSeleccionada || !imgDim) return;
    try {
      const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${imgDim.w}" height="${imgDim.h}" viewBox="0 0 ${imgDim.w} ${imgDim.h}"><image href="${capturaSeleccionada.dataUrl}" width="${imgDim.w}" height="${imgDim.h}"/>${figuras.map(svgFigura).join('')}</svg>`;
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
      let videoUrl = null;
      try {
        const svgFn = (t) => {
          const e = t >= 1000 ? 1 : 1 - Math.pow(1 - Math.min(1, t / 1000), 3);
          const figAnim = figuras.map(f => {
            if (f.tipo === 'triangulo') return { ...f, crecimiento: e };
            if (f.tipo === 'circulo') return { ...f, ancho: f.ancho * e, alto: f.alto * e };
            if (f.tipo === 'linea') return { ...f, x2: f.x1 + (f.x2 - f.x1) * e, y2: f.y1 + (f.y2 - f.y1) * e };
            if (f.tipo === 'flecha') return { ...f, x2: f.x1 + (f.x2 - f.x1) * e, y2: f.y1 + (f.y2 - f.y1) * e, cx: f.x1 + (f.cx - f.x1) * e, cy: f.y1 + (f.cy - f.y1) * e, cabeza: e };
            if (f.tipo === 'circuito') {
              const elipses = (f.elipses || []).map((el) => {
                return { x: el.x, y: el.y, rx: (el.rx ?? 0.03) * e, ry: (el.ry ?? 0.02) * e };
              });
              return { ...f, elipses };
            }
            return f;
          });
          return `<svg xmlns="http://www.w3.org/2000/svg" width="${imgDim.w}" height="${imgDim.h}" viewBox="0 0 ${imgDim.w} ${imgDim.h}"><image href="${capturaSeleccionada.dataUrl}" width="${imgDim.w}" height="${imgDim.h}"/>${figAnim.map(svgFigura).join('')}</svg>`;
        };
        videoUrl = await generarVideo(svgFn, imgDim.w, imgDim.h);
      } catch (e) {
        console.error('Error al generar el video de la captura', e);
      }
      const nuevoId = Date.now() + Math.floor(Math.random() * 1000);
      setCapturas(prev => [...prev, { id: nuevoId, dataUrl: nueva, videoUrl, duracion: 4, figuras, tiempo: capturaSeleccionada.tiempo, insertarEn: capturaSeleccionada.tiempo }]);
      setCapturaGuardada({ id: nuevoId, dataUrl: nueva, videoUrl });
    } catch (e) {
      console.error('Error al guardar la captura', e);
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        const v = videoRef.current;
        if (v) { v.style.maxHeight = '60vh'; v.style.borderRadius = '12px'; v.style.border = '1px solid #334155'; }
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
                  setArchivo(null);
                  setVideoUrl('');
                  setProgreso(0);
                }}
                style={{ background: '#dc2626', border: 'none', borderRadius: '12px', padding: '0.8rem 1.2rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
              >
                ELIMINAR
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
                  src={videoUrl}
                  onClick={togglePlay}
                  onPlay={() => setReproduciendo(true)}
                  onPause={() => setReproduciendo(false)}
                  onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration || 0)}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    const d = v.duration || 0;
                    setDuracion(d);
                    const t = v.currentTime;
                    if (!clipActivo && t > prevTiempoRef.current) {
                      const cl = capturas.find(c => c.videoUrl && c.insertarEn != null && prevTiempoRef.current < c.insertarEn && t >= c.insertarEn);
                      if (cl) {
                        prevTiempoRef.current = cl.insertarEn + (cl.duracion || 4);
                        setClipActivo(cl);
                        setReproduciendo(true);
                        return;
                      }
                    }
                    prevTiempoRef.current = t;
                    setProgreso(d ? t / d : 0);
                  }}
                  onEnded={() => {
                    setClipActivo(null);
                    setReproduciendo(false);
                    setProgreso(1);
                    if (clipTimerRef.current) { clearTimeout(clipTimerRef.current); clipTimerRef.current = null; }
                  }}
                  style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '12px', background: '#000000', border: '1px solid #334155' }}
                />
                <button
                  onClick={() => {
                    const container = document.getElementById('video-container');
                    if (!container) return;
                    if (!document.fullscreenElement) {
                      container.requestFullscreen?.() || container.webkitRequestFullscreen?.();
                      setIsFullscreen(true);
                      const v = videoRef.current;
                      if (v) { v.style.maxHeight = '100vh'; v.style.borderRadius = '0'; v.style.border = 'none'; }
                    } else {
                      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
                      setIsFullscreen(false);
                      const v = videoRef.current;
                      if (v) { v.style.maxHeight = '60vh'; v.style.borderRadius = '12px'; v.style.border = '1px solid #334155'; }
                    }
                  }}
                  title="Pantalla completa"
                  style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#ffffff', fontSize: '0.85rem', zIndex: 3 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {isFullscreen ? (
                      <><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></>
                    ) : (
                      <><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>
                    )}
                  </svg>
                </button>
                {clipActivo && clipActivo.videoUrl && (
                  <video
                    ref={(el) => {
                      clipRef.current = el;
                      if (el) el.play().catch(() => {});
                    }}
                    src={clipActivo.videoUrl}
                    muted
                    autoPlay
                    playsInline
                    onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    onEnded={() => {
                      const v = videoRef.current;
                      if (v) v.play().catch(() => {});
                      setClipActivo(null);
                      setReproduciendo(true);
                    }}
                    title={`Clip 2s en ${formatoTiempo(clipActivo.insertarEn ?? 0)}`}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', borderRadius: '12px', background: '#000000', border: '2px solid #16a34a', zIndex: 2, cursor: 'pointer' }}
                  />
                )}
              </div>
              <div style={{ width: '80%' }}>
                <div
                  onClick={buscarEnTimeline}
                  onPointerDown={(e) => { draggingRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); buscarEnTimeline(e); }}
                  onPointerMove={(e) => { if (draggingRef.current) buscarEnTimeline(e); }}
                  onPointerUp={() => { draggingRef.current = false; }}
                  onPointerCancel={() => { draggingRef.current = false; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('text/plain');
                    if (!id || !duracion) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                    let nuevo = x * duracion;
                    if (cortes.length > 0) {
                      let minDist = Infinity;
                      let closest = nuevo;
                      for (const ct of cortes) {
                        const d = Math.abs(nuevo - ct);
                        if (d < minDist) { minDist = d; closest = ct; }
                      }
                      if (minDist < duracion * 0.05) nuevo = closest;
                    }
                    nuevo = Math.max(0, Math.min(duracion, nuevo));
                    setCapturas(prev => prev.map(c => c.id === Number(id) ? { ...c, insertarEn: nuevo } : c));
                    setAviso(`Clip colocado en ${formatoTiempo(nuevo)}`);
                  }}
                  style={{ position: 'relative', height: '14px', background: '#1e293b', border: '1px solid #334155', borderRadius: '7px', cursor: 'pointer', touchAction: 'none' }}
                >
                  {cortes.length > 0 && (() => {
                    const segColors = ['#1e3a5f', '#3b1f2b', '#1a3d2e', '#3d3a1a', '#2d1a4e', '#4a1a2d', '#1a3a4a', '#4a3a1a'];
                    const pts = [0, ...cortes.map(c => c / duracion), 1];
                    return pts.slice(0, -1).map((start, i) => {
                      const end = pts[i + 1];
                      return (
                        <div key={`seg-${i}`} style={{ position: 'absolute', top: 0, left: `${(start * 100).toFixed(2)}%`, height: '100%', width: `${((end - start) * 100).toFixed(2)}%`, background: segColors[i % segColors.length], borderRadius: i === 0 ? '7px 0 0 7px' : i === pts.length - 2 ? '0 7px 7px 0' : '0' }} />
                      );
                    });
                  })()}
                  <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.min(100, Math.max(0, ((tActual - inicioVentana) / span) * 100)).toFixed(2)}%`, background: 'rgba(56,189,248,0.3)', borderRadius: '7px', transition: 'width 0.1s linear', zIndex: 1 }} />
                  {cortes.map((ct, i) => {
                    const pos = ((ct - inicioVentana) / span) * 100;
                    return (
                      <div
                        key={`corte-${i}`}
                        onClick={(e) => { e.stopPropagation(); setCortes(prev => prev.filter((_, j) => j !== i)); setAviso(`Corte en ${formatoTiempo(ct)} eliminado`); }}
                        title={`Corte en ${formatoTiempo(ct)} (click para eliminar)`}
                        style={{ position: 'absolute', top: '-2px', left: `${Math.min(100, Math.max(0, pos)).toFixed(2)}%`, transform: 'translateX(-50%)', width: '3px', height: 'calc(100% + 4px)', background: '#ef4444', borderRadius: '2px', cursor: 'pointer', zIndex: 10 }}
                      />
                    );
                  })}
                  <div style={{ position: 'absolute', top: '50%', left: `${Math.min(100, Math.max(0, ((tActual - inicioVentana) / span) * 100)).toFixed(2)}%`, transform: 'translate(-50%, -50%)', width: '16px', height: '16px', background: '#ffffff', border: '2px solid #38bdf8', borderRadius: '50%', transition: 'left 0.1s linear', zIndex: 2 }} />
                </div>
                {cortes.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                    {(() => {
                      const segColors = ['#1e3a5f', '#3b1f2b', '#1a3d2e', '#3d3a1a', '#2d1a4e', '#4a1a2d'];
                      const pts = [0, ...cortes, duracion];
                      return pts.slice(0, -1).map((start, i) => {
                        const end = pts[i + 1];
                        const dur = end - start;
                        return (
                          <div key={`label-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: segColors[i % segColors.length], borderRadius: '6px', padding: '2px 8px', fontSize: '0.65rem', fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: '#e2e8f0', border: '1px solid #475569' }}>
                            <span style={{ color: '#94a3b8' }}>P{i + 1}</span>
                            <span>{formatoTiempo(start)} — {formatoTiempo(end)}</span>
                            <span style={{ color: '#94a3b8' }}>({formatoTiempo(dur)})</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', fontFamily: 'var(--font-mono, JetBrains Mono, monospace)', fontWeight: 700, fontSize: '0.75rem', color: '#94a3b8' }}>
                  <span>{formatoTiempo(videoRef.current ? videoRef.current.currentTime : 0)}</span>
                  <span>{formatoTiempo(totalDuracion)}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    onClick={togglePlay}
                    style={{ background: reproduciendo ? '#f59e0b' : '#16a34a', border: 'none', borderRadius: '12px', padding: '0.7rem 1.5rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.9rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
                  >
                    {reproduciendo ? 'PAUSA' : 'PLAY'}
                  </button>
                  <button
                    onClick={capturarImagen}
                    style={{ display: 'inline-flex', alignItems: 'center', background: '#8b5cf6', border: 'none', borderRadius: '12px', padding: '0.7rem 1.2rem', cursor: 'pointer' }}
                    title="Capturar imagen"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </button>
                </div>
                {capturas.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.5rem' }}>
                    {capturas.map((c, i) => (
                      <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ position: 'relative' }}>
                          {c.videoUrl ? (
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
                              src={c.dataUrl}
                              alt={`Captura ${i + 1}`}
                              onClick={() => {
                                setFiguras(c.figuras || []);
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
                              setAviso(`Video modificado colocado en ${formatoTiempo(c.tiempo)} (su punto original)`);
                              setAbrirCarpetaAlOK(true);
                            }}
                            title="Colocar el video en el punto de su captura original"
                            style={{ background: '#0f172a', border: '1px solid #16a34a', borderRadius: '8px', padding: '0.4rem 0.6rem', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.7rem', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer' }}
                          >
                            Colocar en su punto
                          </button>
                        )}
                        <span style={{ fontFamily: 'var(--font-mono, JetBrains Mono, monospace)', fontWeight: 700, fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center' }}>
                          {formatoTiempo(c.tiempo)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
          {capturaSeleccionada && (
            <div style={{ position: 'absolute', top: '1rem', right: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem', zIndex: 10 }}>
              <button
                onClick={() => { guardarCaptura(); setCapturaSeleccionada(null); setCapturaGuardada(null); setFiguras([]); setImgDim(null); setFiguraSeleccionada(null); }}
                style={{ background: '#dc2626', border: 'none', borderRadius: '12px', padding: '0.7rem 1.2rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
              >
                BORRAR
              </button>
              <button
                onClick={guardarCaptura}
                style={{ background: '#16a34a', border: 'none', borderRadius: '12px', padding: '0.7rem 1.2rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
              >
                GUARDAR
              </button>
              {figuras.some(f => f.tipo === 'circulo' || f.tipo === 'circuito' || f.tipo === 'flecha') && (
                <button
                  onClick={animarElipses}
                  disabled={exportando}
                  style={{ background: '#8b5cf6', border: 'none', borderRadius: '12px', padding: '0.7rem 1.2rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: exportando ? 'wait' : 'pointer', opacity: exportando ? 0.6 : 1 }}
                >
                  {exportando ? 'Generando...' : 'Animar'}
                </button>
              )}
              {figuraSeleccionada && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                  {figuras.find(f => f.id === figuraSeleccionada)?.tipo === 'texto' && (
                    <input
                      value={figuras.find(f => f.id === figuraSeleccionada)?.texto || ''}
                      onChange={(e) => actualizarFigura(figuraSeleccionada, { texto: e.target.value })}
                      placeholder="Escribe el texto"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '180px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.5rem 0.6rem', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: '#e2e8f0', outline: 'none' }}
                    />
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
                  {[ 'linea', 'flecha', 'polilinea', 'circuito'].includes(figuras.find(f => f.id === figuraSeleccionada)?.tipo) ? (
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
                    style={{ background: figuras.find(f => f.id === figuraSeleccionada)?.rayado ? '#0ea5e9' : '#334155', border: 'none', borderRadius: '12px', padding: '0.5rem 0.9rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.8rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
                  >
                    Rayas
                  </button>
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
              onClick={anadirLinea}
              title="Dibujar línea"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0ea5e9', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="20" x2="20" y2="4" />
              </svg>
            </button>
             <button
                onClick={(e) => {
                  e.stopPropagation();
                  setModoFlechaClick(prev => !prev);
                  if (modoCirculoClick) { setModoCirculoClick(false); elipsesSessionRef.current = []; }
                  setAviso('');
                }}
                title={modoFlechaClick ? 'Desactivar modo flecha' : 'Colocar flecha con click'}
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
                        const circuito = { id: Date.now(), tipo: 'circuito', elipses, color: '#38bdf8', opacidad: 1, grosor: 0.003 };
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
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => {
            if (modoFlechaClick) {
              const p = puntoImagen(e);
              if (p) {
                const id = Date.now();
                const x1 = Math.min(1, Math.max(0, p.x));
                const y1 = Math.min(1, Math.max(0, p.y));
                const x2 = Math.min(1, Math.max(0, p.x + 0.2));
                const y2 = Math.min(1, Math.max(0, p.y));
                const cx = (x1 + x2) / 2;
                const cy = (y1 + y2) / 2;
                setFiguras(prev => [...prev, { id, tipo: 'flecha', x1, y1, x2: x1, y2: y1, cx: x1, cy: y1, color: '#38bdf8', opacidad: 1, grosor: 0.005, discontinuo: false, cabeza: 0 }]);
                setFiguraSeleccionada(id);
                if (flechaAnimRef.current) cancelAnimationFrame(flechaAnimRef.current);
                const t0 = performance.now();
                const paso = (t) => {
                  const pp = Math.min(1, (t - t0) / 1000);
                  const e = 1 - Math.pow(1 - pp, 3);
                  setFiguras(prev => prev.map(f => f.id === id ? { ...f, x2: x1 + (x2 - x1) * e, y2: y1 + (y2 - y1) * e, cx: x1 + (cx - x1) * e, cy: y1 + (cy - y1) * e, cabeza: e } : f));
                  if (pp < 1) flechaAnimRef.current = requestAnimationFrame(paso);
                  else flechaAnimRef.current = null;
                };
                flechaAnimRef.current = requestAnimationFrame(paso);
              }
              return;
            }
            if (modoCirculoClick) {
              const p = puntoImagen(e);
              if (p) {
                const id = Date.now();
                setFiguras(prev => [...prev, { id, tipo: 'circulo', x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)), ancho: 0.04, alto: 0.025, color: '#38bdf8', opacidad: 0, crecimiento: 1, sinRelleno: true }]);
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }} onClick={() => setFiguraSeleccionada(null)}>
                  <img
                    src={capturaSeleccionada.dataUrl}
                    alt="Captura en edición"
                    onLoad={(e) => setImgDim({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                    style={{ display: 'block', maxWidth: '100%', maxHeight: '92vh', borderRadius: '12px', border: '1px solid #334155' }}
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
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                    >
                      <defs>
                        {figuras.filter(f => f.rayado).map(f => (
                          <pattern key={f.id} id={`rayado-${f.id}`} patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
                            <line x1="0" y1="0" x2="0" y2="5" stroke={f.color} strokeWidth="2.5" />
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
                          fill: f.rayado ? `url(#rayado-${f.id})` : f.color,
                          fillOpacity: f.opacidad ?? 0.5,
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
                          ? <rect {...shapeProps} x={x - ancho / 2} y={y - alto / 2} width={ancho} height={alto} rx={ancho * 0.15} />
                          : f.tipo === 'circulo'
                            ? <ellipse {...shapeProps} cx={x} cy={y} rx={ancho / 2} ry={alto / 2} />
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
                                          const ax = a.x * imgDim.w, ay = a.y * imgDim.h;
                                          const bx = b.x * imgDim.w, by = b.y * imgDim.h;
                                          const arx = (a.rx ?? 0.08) * imgDim.w, ary = (a.ry ?? 0.08) * imgDim.h;
                                          const brx = (b.rx ?? 0.08) * imgDim.w, bry = (b.ry ?? 0.08) * imgDim.h;
                                          const dx = bx - ax, dy = by - ay, dist = Math.hypot(dx, dy);
                                          if (dist <= 0) return null;
                                          const ux = dx / dist, uy = dy / dist;
                                          return (
                                            <line key={`l${i}`} x1={ax + ux * arx} y1={ay + uy * ary} x2={bx - ux * brx} y2={by - uy * bry} stroke={f.color} strokeOpacity={f.opacidad ?? 1} strokeWidth={grosorPx} strokeLinecap="round" />
                                          );
                                        })}
                                        {elipses.map((el, i) => (
                                          <ellipse key={i} cx={el.x * imgDim.w} cy={el.y * imgDim.h} rx={(el.rx ?? 0.08) * imgDim.w} ry={(el.ry ?? 0.08) * imgDim.h} fill="none" stroke={f.color} strokeOpacity={f.opacidad ?? 1} strokeWidth={grosorPx} />
                                        ))}
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
                                  style={{ pointerEvents: 'all', cursor: 'move', userSelect: 'none' }}
                                  onClick={shapeProps.onClick}
                                  onPointerDown={shapeProps.onPointerDown}
                                >
                                  {f.texto || ''}
                                </text>;
                        const tamTxt = (f.fontSize || 0.06) * imgDim.h;
                        const anchoTxt = Math.max(60, (f.texto || 'Texto').length * tamTxt * 0.6);
                        return (
                          <g key={f.id}>
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
)}
      {aviso && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(2,6,23,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1.4rem 1.8rem', maxWidth: '340px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#e2e8f0' }}>{aviso}</p>
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

export default App;