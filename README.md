# 🎬 Tratamiento de Dibujos

Aplicación web para **tratamiento, corte, anotación y montaje de vídeo/dibujos tácticos**. Permite cargar vídeos, extraer capturas, dibujar figuras sobre frames y generar montajes finales.

Stack: **React 19 + Vite 8**, **FFmpeg.wasm**, **mediabunny**, **Firebase** e **IndexedDB**.

---

## ✨ Funcionalidades por hoja

### 1. `Base de datos`
- Tabla de archivos/registros (`DATOS` + `VIDEO`).
- Alta de registros y asociación de vídeos.
- Importación de montajes en JSON (incluye notas de voz del export «base datos» de `futbol`: texto y audio), con el mismo formato que las acciones: disponibles solo en el desplegable `NOTAS` de `Cortes`. Clic en el número → marca en azul e inserta la nota en `Montaje` (como otras acciones); minuto clicable → va al reproductor y reproduce; `-`/`+` ajustan el tiempo; `×` elimina; ▶/■ reproduce el audio.
- Gestión de vídeos ocultos y biblioteca local.
- Botón «Limpiar base de datos» (con confirmación) para borrar registros, vídeos y notas de la hoja.
- Persistencia de vídeos en IndexedDB.

### 2. `Cortes`
- Carga de vídeo para cortar.
- Marcado de cortes sobre el vídeo.
- Recorte de clips con FFmpeg.wasm.

### 3. `Edición`
- Captura de frames del vídeo.
- Dibujo de figuras: triángulos redondeados, cuadrados, elipses, líneas, flechas, cilindros y trazos.
- En el círculo/ellipse y en el cuadrado se puede ajustar el grosor del borde y ponerlo en discontinuo (igual que flechas).
- El círculo/ellipse se puede girar: al insertarlo/seleccionarlo aparece un tirador rosa «Girar círculo» sobre la figura que se arrastra para rotarla, además del deslizador *Rotar* en el panel de propiedades (la rotación se conserva en la exportación y en el vídeo).
- Selección, movimiento y borrado de figuras.
- Menú contextual (botón derecho) sobre una figura con opciones: copiar, borrar, agrandar y cambiar color.
- Pantalla completa del editor.
- Exportación de captura anotada y salto a `Montaje`.
- Animaciones/preview de capturas.

### 4. `Montaje`
- Composición de filas/tramos de vídeo e imágenes.
- `Limpiar` (con confirmación): borra todos los datos locales (base de datos, vídeos, cortes, montaje, capturas, notas y sesión) y recarga la app.
- Fundidos y transiciones.
- Reproducción de preview.
- El botón *Imagen* de la hoja Montaje acepta también archivos de vídeo
  (además de imágenes), insertándolos como clips sueltos.
- Exportación de vídeo final (vía rápida con FFmpeg en el servidor local, con
  informe de fases en formato `MM:SS`; si el servidor descarta algún fundido
  lo indica el informe).
- Indicador **Real** junto al botón *Limpiar*: duración estimada del vídeo
  final para las líneas seleccionadas (periodos + animaciones + imágenes
  + duración exacta de los vídeos insertados como clips, −d/2 por cada
  fundido y recorte al final del vídeo base); coincide con lo que informa
  la descarga.
- Guardado/carga de sesión.
- Botón `Exportar` (JSON, formato v3): las imágenes/base64 repetidos se guardan **una sola vez** en `__datos` y el resto del archivo usa tokens (al importar se reconstruyen). Un partido que antes generaba ~135 MB ahora genera ~53 MB, evitando que la página se quede en blanco por falta de memoria al descargar. Los exports antiguos (sin `__datos`) siguen importándose igual. En Chrome/Edge se escribe directamente en el archivo elegido (File System Access API); en otros navegadores se usa la descarga clásica.
- Los vídeos de hasta 20 MB se incrustan como `videoDataUrl` para que el archivo sea portable; los vídeos más grandes **no se incrustan**: se guardan en IndexedDB y el JSON guarda solo `videoBlobKey` con nombre/tamaño. Al importar ese JSON en el **mismo navegador** el vídeo se recupera automáticamente; en otro navegador avisa y hay que volver a cargarlo. Los clips/animaciones pequeños siguen viajando dentro del JSON.

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

### Auto-actualización local (lunes / arranque)

El proyecto incluye un script que ejecuta `git pull`, `pnpm install` y `pnpm run build`,
y envía una notificación de Windows con el resultado:

- Script: `scripts/auto-update.ps1` (también `scripts/auto-update.bat`).
- Log: `%LOCALAPPDATA%\\tratarmiento-dibujos\\auto-update.log`.

Para automatizarlo (lunes a las 09:00 y al iniciar sesión):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\\register-task.ps1
```

Para desactivarlo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\\unregister-task.ps1
```

Ejecución manual:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\\auto-update.ps1
```

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

- `engines.node` y `.nvmrc` los actualiza el workflow `update-node.yml` a la última LTS de Node.js (03:00 UTC diario).
- **Dependabot** diario: npm a las 04:30 y GitHub Actions a las 05:30 (hora de Madrid), agrupado en `todas` y con `target-branch: main`. Las actualizaciones *major* se gestionan manualmente.
- **CI** (`ci.yml`): instala con pnpm y comprueba el build; el auto-merge de Dependabot espera a que CI pase antes de fusionar.
- **Regla de código**: ningún componente nuevo debe superar las 500 líneas (ver `AGENTS.md`).
- Mantener este README actualizado con cualquier cambio relevante.

### Cambios importantes

- **2026-11-18**: calcada la configuración de `Noticias`: Dependabot diario y escalonado (también para GitHub Actions), CI con pnpm, auto-merge tras CI y `update-node.yml` + `scripts/update-node-version.mjs` para actualizar Node.js a la última LTS con commit directo a `main`.
