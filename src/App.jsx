import { useState, useRef } from 'react';

function App() {
  const [archivo, setArchivo] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [hoja, setHoja] = useState('Presentación');
  const [progreso, setProgreso] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [capturas, setCapturas] = useState([]);
  const [capturaSeleccionada, setCapturaSeleccionada] = useState(null);
  const [figuras, setFiguras] = useState([]);
  const [imgDim, setImgDim] = useState(null);
  const videoRef = useRef(null);
  const draggingRef = useRef(false);

  const hojas = ['Presentación', 'Edición'];

  const handleFile = (e) => {
    const f = e.target.files[0] || null;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setArchivo(f);
    setVideoUrl(f ? URL.createObjectURL(f) : '');
    setProgreso(0);
  };

  const formatoTiempo = (s) => {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    const cs = Math.floor((s % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(cs).padStart(2, '0')}`;
  };

  const buscarEnTimeline = (e) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    video.currentTime = x * video.duration;
    setProgreso(x);
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
    setFiguras(prev => [...prev, { id: Date.now(), tipo: 'triangulo', x: 0.5, y: 0.5, tam: 0.15, color: '#38bdf8' }]);
  };

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
              <video
                ref={videoRef}
                muted
                src={videoUrl}
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  if (v.paused) v.play(); else v.pause();
                }}
                onPlay={() => setReproduciendo(true)}
                onPause={() => setReproduciendo(false)}
                onTimeUpdate={(e) => {
                  const d = e.currentTarget.duration;
                  setProgreso(d ? e.currentTarget.currentTime / d : 0);
                }}
                style={{ maxWidth: '80%', maxHeight: '60vh', borderRadius: '12px', background: '#000000', border: '1px solid #334155' }}
              />
              <div style={{ width: '80%' }}>
                <div
                  onClick={buscarEnTimeline}
                  onPointerDown={(e) => { draggingRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); buscarEnTimeline(e); }}
                  onPointerMove={(e) => { if (draggingRef.current) buscarEnTimeline(e); }}
                  onPointerUp={() => { draggingRef.current = false; }}
                  onPointerCancel={() => { draggingRef.current = false; }}
                  style={{ position: 'relative', height: '14px', background: '#1e293b', border: '1px solid #334155', borderRadius: '7px', cursor: 'pointer', touchAction: 'none' }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${(progreso * 100).toFixed(2)}%`, background: '#38bdf8', borderRadius: '7px', transition: 'width 0.1s linear' }} />
                  <div style={{ position: 'absolute', top: '50%', left: `${(progreso * 100).toFixed(2)}%`, transform: 'translate(-50%, -50%)', width: '16px', height: '16px', background: '#ffffff', border: '2px solid #38bdf8', borderRadius: '50%', transition: 'left 0.1s linear' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontFamily: 'var(--font-mono, JetBrains Mono, monospace)', fontWeight: 700, fontSize: '0.75rem', color: '#94a3b8' }}>
                  <span>{formatoTiempo(videoRef.current ? videoRef.current.currentTime : 0)}</span>
                  <span>{formatoTiempo(videoRef.current ? videoRef.current.duration || 0 : 0)}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    onClick={() => {
                      const v = videoRef.current;
                      if (!v) return;
                      if (v.paused) v.play(); else v.pause();
                    }}
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
                          <img
                            src={c.dataUrl}
                            alt={`Captura ${i + 1}`}
                            onClick={() => {
                              setCapturaSeleccionada(c);
                              setFiguras([]);
                              setImgDim(null);
                              setHoja('Edición');
                            }}
                            style={{ width: '160px', borderRadius: '8px', border: '1px solid #334155', cursor: 'pointer' }}
                          />
                          <button
                            onClick={() => setCapturas(prev => prev.filter(x => x.id !== c.id))}
                            title="Eliminar captura"
                            style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', background: '#dc2626', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 900, fontSize: '0.9rem', lineHeight: '22px', textAlign: 'center', cursor: 'pointer', padding: '0' }}
                          >
                            ×
                          </button>
                        </div>
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
            <button
              onClick={() => { setCapturaSeleccionada(null); setFiguras([]); setImgDim(null); }}
              style={{ position: 'absolute', top: '1rem', right: '1.5rem', background: '#dc2626', border: 'none', borderRadius: '12px', padding: '0.7rem 1.2rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', zIndex: 10 }}
            >
              BORRAR
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', borderRight: '1px solid #1e293b' }}>
            <button
              onClick={anadirTriangulo}
              title="Añadir triángulo"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0ea5e9', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round">
                <polygon points="12,3 22,20 2,20" />
              </svg>
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {capturaSeleccionada ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src={capturaSeleccionada.dataUrl}
                    alt="Captura en edición"
                    onLoad={(e) => setImgDim({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                    style={{ display: 'block', maxWidth: '100%', maxHeight: '92vh', borderRadius: '12px', border: '1px solid #334155' }}
                  />
                  {imgDim && (
                    <svg
                      viewBox={`0 0 ${imgDim.w} ${imgDim.h}`}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                    >
                      {figuras.map(f => {
                        if (f.tipo === 'triangulo') {
                          const s = f.tam * imgDim.w;
                          const x = f.x * imgDim.w;
                          const y = f.y * imgDim.h;
                          return (
                            <polygon
                              key={f.id}
                              points={`${x},${y - s / 2} ${x - s / 2},${y + s / 2} ${x + s / 2},${y + s / 2}`}
                              fill={f.color}
                              fillOpacity="0.5"
                              stroke="#ffffff"
                              strokeWidth="2"
                            />
                          );
                        }
                        return null;
                      })}
                    </svg>
                  )}
                </div>
                <span style={{ fontFamily: 'var(--font-mono, JetBrains Mono, monospace)', fontWeight: 700, fontSize: '0.8rem', color: '#94a3b8' }}>
                  Captura {formatoTiempo(capturaSeleccionada.tiempo)}
                </span>
              </div>
            ) : (
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#94a3b8' }}>Edición</span>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default App;