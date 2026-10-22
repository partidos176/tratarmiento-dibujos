# Tratamiento de Dibujos

Aplicación web para **tratamiento y anotación de video/dibujos tácticos** con captura de frames, dibujo de figuras y persistencia local/Firebase.

## ✨ Funcionalidades
- **Sincronización**: sincronización de video.
- **Base de datos**: gestión de archivos/videos.
- **Cortes**: corte de clips de video.
- **Edición**: anotación y dibujo sobre frames.
- **Montaje**: composición de videos.

Desarrollada con **React 19 + Vite 8**, procesamiento de video con **FFmpeg.wasm** y **mediabunny**, y almacenamiento con **Firebase**.

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js (versión 22.23.4 o superior)
- pnpm

### Pasos
1. Instalar las dependencias del proyecto:
   ```bash
   pnpm install
   ```

2. Iniciar el servidor de desarrollo local:
   ```bash
   pnpm dev
   ```

3. Abrir en el navegador la dirección indicada (por defecto `http://localhost:5173`).

### Build
```bash
pnpm build
```

### Deploy
```bash
pnpm deploy
```

---

## 📦 Stack
- React 19
- Vite 8
- Firebase
- FFmpeg.wasm (`@ffmpeg/ffmpeg`, `@ffmpeg/util`)
- mediabunny
