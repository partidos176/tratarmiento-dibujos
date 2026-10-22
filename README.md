# 🎬 Tratamiento de Dibujos

Aplicación web para **tratamiento, corte, anotación y montaje de vídeo/dibujos tácticos**. Permite cargar vídeos, extraer capturas, dibujar figuras sobre frames y generar montajes finales.

Stack: **React 19 + Vite 8**, **FFmpeg.wasm**, **mediabunny**, **Firebase** e **IndexedDB**.

---

## ✨ Funcionalidades por hoja

### 1. `Base de datos`
- Tabla de archivos/registros (`DATOS` + `VIDEO`).
- Alta de registros y asociación de vídeos.
- Importación de montajes en JSON.
- Gestión de vídeos ocultos y biblioteca local.
- Persistencia de vídeos en IndexedDB.

### 2. `Cortes`
- Carga de vídeo para cortar.
- Marcado de cortes sobre el vídeo.
- Selección masiva de cortes (`SELEC. TODO`).
- Paso de cortes a la hoja `Montaje`.
- Recorte de clips con FFmpeg.wasm.

### 3. `Edición`
- Captura de frames del vídeo.
- Dibujo de figuras: triángulos redondeados, elipses, líneas, flechas y trazos.
- Selección, movimiento y borrado de figuras.
- Pantalla completa del editor.
- Exportación de captura anotada y salto a `Montaje`.
- Animaciones/preview de capturas.

### 4. `Montaje`
- Composición de filas/tramos de vídeo e imágenes.
- Fundidos y transiciones.
- Reproducción de preview.
- Exportación de vídeo final (vía rápida con FFmpeg en el servidor local, con
  informe de fases en formato `MM:SS`; si el servidor descarta algún fundido
  lo indica el informe).
- Indicador **Real** junto al botón *Limpiar*: duración estimada del vídeo
  final para las líneas seleccionadas (periodos + animaciones + imágenes
  dentro de cada corte, −d/2 por cada fundido y recorte al final del vídeo
  base); coincide con lo que informa la descarga.
- Guardado/carga de sesión.

---

## 🧩 Módulos internos

| Archivo | Función |
|---|---|
| `src/TratamientoApp.jsx` | Aplicación principal: estado, hojas, editor, cortes y montaje. |
| `src/persistencia.js` | IndexedDB (`tratamiento-dibujos`): stores `videos`, `imagenes`, `capturas`, `sesion`; guardar/cargar/limpiar sesión y vídeos. |
| `src/estimacionMontaje.js` | `estimarDuracionMontaje(filas, opts)`: duración real estimada del montaje (periodos + animaciones + imágenes − d/2 por fundido) sin tocar el servidor. Espejo de la aritmética de `construirPlanMontaje`. |
| `src/ffmpegUtil.js` | Carga FFmpeg.wasm, `trimVideo`, `framesToVideo`, `isFFmpegSupported`. |
| `src/mp4Demux.js` | Lector MP4 mínimo sin dependencias: enumera muestras de vídeo para `VideoDecoder`. |
| `src/firebase.js` | Configuración Firebase (RTDB + Auth). **Requiere rellenar las credenciales.** |
| `src/App.jsx` | Monta `TratamientoApp`. |

---

## 📁 Estructura

```
tratarmiento-dibujos/
├── src/
│   ├── TratamientoApp.jsx
│   ├── App.jsx
│   ├── main.jsx
│   ├── persistencia.js
│   ├── ffmpegUtil.js
│   ├── mp4Demux.js
│   ├── firebase.js
│   └── index.css
├── AGENTS.md
├── vite.config.js
└── package.json
```

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js **22.23.4 o superior**
- pnpm

### Instalación
```bash
pnpm install
```

> El proyecto usa **pnpm** (`pnpm-lock.yaml`). No uses `npm install` ni generes `package-lock.json`.

### Desarrollo
```bash
pnpm dev
```

Abrir `http://localhost:5173`.

### Build
```bash
pnpm build
```

### Deploy (Firebase Hosting)
```bash
pnpm deploy
```

> Antes de usar Firebase, rellena `src/firebase.js` con la configuración del proyecto.

---

## 📦 Stack principal

- **React 19** + **Vite 8**
- **Firebase** Realtime Database + Auth
- **FFmpeg.wasm** (`@ffmpeg/ffmpeg`, `@ffmpeg/util`)
- **mediabunny**
- **IndexedDB** para persistencia local
- **firebase-tools** para deploy

---

## 🔐 Seguridad y mantenimiento

- `engines.node` fijado a `>=22.23.4` (parche de vulnerabilidades críticas de Node.js y CA eMudhra).
- **Dependabot** semanal para dependencias npm gestionadas con pnpm (patch/minor) + auto-merge cuando CI pasa.
- **Auto-actualización de Node.js** semanal (workflow `node-auto-update.yml`): actualiza parches dentro de la misma major y hace commit directo a `main`.
- **Regla de código**: ningún componente nuevo debe superar las 500 líneas (ver `AGENTS.md`).
- Mantener este README actualizado con cualquier cambio relevante.
