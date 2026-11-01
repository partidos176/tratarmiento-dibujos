import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    try { console.error('ErrorBoundary:', error, info); } catch (_) {}
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Se ha producido un error</h1>
          <p style={{ maxWidth: '600px', marginBottom: '1.5rem', color: '#94a3b8' }}>La página no se ha quedado en blanco: los datos siguen guardados. Recarga para continuar.</p>
          <pre style={{ maxWidth: '90vw', overflow: 'auto', background: '#1e293b', padding: '1rem', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'left' }}>{String(this.state.error && (this.state.error.stack || this.state.error.message || this.state.error))}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: '1.5rem', background: '#16a34a', border: 'none', borderRadius: '8px', padding: '0.7rem 1.5rem', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>Recargar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);