import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { exec } from 'node:child_process';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'export-video',
      configureServer(server) {
        server.middlewares.use('/export-video', (req, res, next) => {
          if (req.method !== 'POST') return next();
          const chunks = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', () => {
            try {
              const buf = Buffer.concat(chunks);
              const dir = 'C:\\Users\\uSer\\Videos';
              fs.mkdirSync(dir, { recursive: true });
              const name = `video-final-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
              fs.writeFileSync(path.join(dir, name), buf);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, name }));
            } catch (e) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: String(e) }));
            }
          });
          req.on('error', () => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'request error' }));
          });
        });
        server.middlewares.use('/abrir-carpeta', (req, res, next) => {
          if (req.method !== 'GET' && req.method !== 'POST') return next();
          exec('explorer "C:\\Users\\uSer\\Videos"', () => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          });
        });
        server.middlewares.use('/iniciar-servidor', (req, res) => {
          const responder = (obj) => {
            try {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(obj));
            } catch (_) {}
          };
          const puertoAbierto = () => new Promise((ok) => {
            try {
              const q = http.get({ host: 'localhost', port: 3001, path: '/api/cortar', timeout: 2500 }, (r) => {
                r.resume();
                r.on('end', () => ok(true));
              });
              q.on('timeout', () => { try { q.destroy(); } catch (_) {} ok(false); });
              q.on('error', () => ok(false));
            } catch (_) { ok(false); }
          });
          (async () => {
            if (await puertoAbierto()) { responder({ ok: true, ya: true }); return; }
            exec('"C:\\Users\\uSer\\Documents\\Default Project\\futbol\\iniciar-servidor.bat"', () => {});
            await new Promise((r) => setTimeout(r, 5000));
            if (await puertoAbierto()) responder({ ok: true, ya: false });
            else responder({ ok: false, error: 'El servidor no responde en el puerto 3001' });
          })();
        });
      }
    }
  ],
  server: {
    port: 5173,
    host: true
  }
});