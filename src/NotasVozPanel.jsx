import { useRef, useState } from 'react';

// Muestra las notas de voz importadas desde el export "base datos" (futbol).
// Cada nota: { numero, minuto, texto/nota, dataUrl/audio, tipo, ... }
export default function NotasVozPanel({ notas, onSeekMinuto }) {
  const items = Array.isArray(notas) ? notas : [];
  const [sonando, setSonando] = useState(null); // numero de nota sonando
  const refs = useRef({});

  if (!items.length) return null;

  const toggle = (n) => {
    const el = refs.current[n.numero];
    if (!el) return;
    if (sonando === n.numero) {
      el.pause();
      el.currentTime = 0;
      setSonando(null);
    } else {
      // parar cualquier otra
      Object.entries(refs.current).forEach(([k, r]) => {
        if (String(k) !== String(n.numero) && r) { try { r.pause(); r.currentTime = 0; } catch (_) {} }
      });
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1400px', background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '10px', padding: '0.75rem 1rem' }}>
      <div style={{ color: '#eab308', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
        {`Notas de voz — ${items.length} ${items.length === 1 ? 'nota' : 'notas'}`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {items.map((n) => {
          const texto = n.texto || n.nota || '';
          const audio = n.dataUrl || n.audio || null;
          const key = n.numero ?? n.id ?? Math.random();
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-secondary, #0f172a)', borderRadius: '8px', padding: '0.5rem 0.75rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', flex: '0 0 auto', borderRadius: '50%', background: '#eab308', color: '#0b1220', fontWeight: 900, fontSize: '0.8rem' }}>{n.numero ?? '—'}</span>
              {audio ? (
                <>
                  <button
                    type="button"
                    onClick={() => toggle(n)}
                    title={sonando === n.numero ? 'Parar nota de voz' : 'Oír nota de voz'}
                    style={{ background: sonando === n.numero ? '#ef4444' : '#22c55e', color: '#fff', border: 'none', borderRadius: '4px', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 900, fontSize: '0.8rem', lineHeight: '28px', padding: 0, flex: '0 0 auto' }}
                  >
                    {sonando === n.numero ? '■' : '▶'}
                  </button>
                  <audio
                    ref={(el) => { refs.current[n.numero] = el; }}
                    src={audio}
                    onPlay={() => setSonando(n.numero)}
                    onPause={() => setSonando((s) => (s === n.numero ? null : s))}
                    onEnded={() => setSonando((s) => (s === n.numero ? null : s))}
                    style={{ display: 'none' }}
                  />
                </>
              ) : null}
              <span
                onClick={() => onSeekMinuto && n.minuto && onSeekMinuto(n.minuto)}
                title={onSeekMinuto && n.minuto ? 'Ir al vídeo en este minuto' : ''}
                style={{ fontWeight: 800, fontSize: '0.85rem', color: '#38bdf8', minWidth: '54px', flex: '0 0 auto', cursor: onSeekMinuto && n.minuto ? 'pointer' : 'default', textDecoration: onSeekMinuto && n.minuto ? 'underline' : 'none', textUnderlineOffset: '2px' }}
              >
                {n.minuto ? `MIN ${n.minuto}` : '—'}
              </span>
              <span style={{ flex: 1, minWidth: '160px', color: texto ? '#e2e8f0' : '#64748b', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                {texto || '(sin texto)'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
