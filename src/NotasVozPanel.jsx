import { useRef, useState } from 'react';

// Filas de notas con el mismo formato que los otros tipos de acción en CORTES.
// Cada nota: { numero, minuto, texto/nota, dataUrl/audio, tipo, ... }
export default function NotasVozPanel({ notas, onSeekMinuto, onAjustarMinuto, onBorrar, getMarcada, onClickNumero }) {
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
      Object.entries(refs.current).forEach(([k, r]) => {
        if (String(k) !== String(n.numero) && r) { try { r.pause(); r.currentTime = 0; } catch (_) {} }
      });
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
      {items.map((n) => {
        const texto = n.texto || n.nota || '';
        const audio = n.dataUrl || n.audio || null;
        const key = n.numero ?? n.id ?? Math.random();
        return (
          <div
            key={key}
            onClick={() => onSeekMinuto && n.minuto && onSeekMinuto(n.minuto)}
            title={onSeekMinuto && n.minuto ? 'Ir al vídeo en este minuto' : ''}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.45rem 0.6rem', cursor: onSeekMinuto && n.minuto ? 'pointer' : 'default', flexWrap: 'nowrap', overflowX: 'auto', maxWidth: '100%' }}
          >
            <span
              onClick={(e) => {
                if (!onClickNumero) return;
                e.stopPropagation();
                onClickNumero(n);
              }}
              title={getMarcada && getMarcada(n) ? 'Pulsar para quitar el círculo azul' : (onClickNumero ? 'Pulsar para marcar la nota y pasarla a Montaje' : '')}
              style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: onClickNumero ? 'pointer' : 'default', borderRadius: '50%', fontWeight: 900, fontSize: '0.75rem', background: (getMarcada && getMarcada(n)) ? '#38bdf8' : 'transparent', color: (getMarcada && getMarcada(n)) ? '#0f172a' : '#e2e8f0' }}
            >{n.numero ?? '—'}</span>
            <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              <span style={{ color: '#38bdf8', textDecoration: onSeekMinuto && n.minuto ? 'underline' : 'none', cursor: onSeekMinuto && n.minuto ? 'pointer' : 'default' }}>{n.minuto ? `MIN ${n.minuto}` : '—'}</span>
            </span>
            <input
              value={texto}
              readOnly
              onClick={(e) => e.stopPropagation()}
              placeholder="(sin texto)"
              title={texto || '(sin texto)'}
              style={{ flex: 1, minWidth: '110px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '0.3rem 0.5rem', color: '#e2e8f0', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif', outline: 'none' }}
            />
            {audio ? (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggle(n); }}
                  title={sonando === n.numero ? 'Parar nota de voz' : 'Oír nota de voz'}
                  style={{ background: sonando === n.numero ? '#dc2626' : '#16a34a', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 900, fontSize: '0.7rem', width: '22px', height: '22px', cursor: 'pointer', lineHeight: 1, flexShrink: 0, padding: 0 }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
              <button onClick={(e) => { e.stopPropagation(); if (onAjustarMinuto) onAjustarMinuto(n, -1); }} title="Retroceder 1s" style={{ background: '#f97316', color: '#fff', fontWeight: 900, fontSize: '0.7rem', border: 'none', borderRadius: '4px', width: '20px', height: '20px', cursor: 'pointer', lineHeight: 1 }}>-</button>
              <button onClick={(e) => { e.stopPropagation(); if (onAjustarMinuto) onAjustarMinuto(n, 1); }} title="Avanzar 1s" style={{ background: '#22c55e', color: '#fff', fontWeight: 900, fontSize: '0.7rem', border: 'none', borderRadius: '4px', width: '20px', height: '20px', cursor: 'pointer', lineHeight: 1 }}>+</button>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); if (onBorrar) onBorrar(n); }}
              title={`Eliminar nota${n.numero != null ? ' ' + n.numero : ''}`}
              style={{ background: '#dc2626', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 900, fontSize: '0.7rem', width: '22px', height: '22px', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
