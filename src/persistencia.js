const DB_NAME = 'tratamiento-dibujos';
const DB_VERSION = 3;

const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('videos')) db.createObjectStore('videos');
    if (!db.objectStoreNames.contains('imagenes')) db.createObjectStore('imagenes');
    if (!db.objectStoreNames.contains('capturas')) db.createObjectStore('capturas');
    if (!db.objectStoreNames.contains('sesion')) db.createObjectStore('sesion');
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const dbPut = async (store, key, value) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const dbGet = async (store, key) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const dbDelete = async (store, key) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const dbGetAllKeys = async (store) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const fetchBlobToDataUrl = async (url) => {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('data:')) return url;
  if (!url.startsWith('blob:')) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
};

const blobUrlToIndexedDB = async (storeName, id, blobUrl) => {
  if (!blobUrl || typeof blobUrl !== 'string' || !blobUrl.startsWith('blob:')) return null;
  try {
    const res = await fetch(blobUrl);
    const blob = await res.blob();
    await dbPut(storeName, id, blob);
    return id;
  } catch { return null; }
};

export const guardarSesion = async (filasMontaje, capturas) => {
  try {
    const fm = [];
    for (let i = 0; i < filasMontaje.length; i++) {
      const f = filasMontaje[i];
      const row = { ...f };
      if (f.videoUrl && f.videoUrl.startsWith('blob:')) {
        const key = `fm_${Date.now()}_${i}`;
        await blobUrlToIndexedDB('videos', key, f.videoUrl);
        row.videoUrlKey = key;
        row.videoUrl = null;
      }
      if (f.imagenUrl && f.imagenUrl.startsWith('blob:')) {
        const key = `fmi_${Date.now()}_${i}`;
        await blobUrlToIndexedDB('imagenes', key, f.imagenUrl);
        row.imagenUrlKey = key;
        row.imagenUrl = null;
      }
      fm.push(row);
    }

    const caps = [];
    for (let i = 0; i < capturas.length; i++) {
      const c = capturas[i];
      const cap = { ...c };
      if (c.videoUrl && c.videoUrl.startsWith('blob:')) {
        const key = `cap_${Date.now()}_${i}`;
        await blobUrlToIndexedDB('capturas', key, c.videoUrl);
        cap.videoUrlKey = key;
        cap.videoUrl = null;
      }
      caps.push(cap);
    }

    // La sesión vive en IndexedDB (sin límite de ~5MB del localStorage).
    await dbPut('sesion', 'actual', JSON.stringify({ fm, caps }));
    // Copia de respaldo en localStorage (puede fallar por cuota: no rompe nada)
    try {
      localStorage.setItem('fm_sesion', JSON.stringify(fm));
      localStorage.setItem('cap_sesion', JSON.stringify(caps));
    } catch (_) {}
  } catch (e) {
    console.error('Error al guardar sesion', e);
  }
};

export const cargarSesion = async () => {
  try {
    let fm = [];
    let caps = [];
    let desdeIDB = false;
    try {
      const raw = await dbGet('sesion', 'actual');
      if (typeof raw === 'string' && raw) {
        const obj = JSON.parse(raw);
        fm = Array.isArray(obj.fm) ? obj.fm : [];
        caps = Array.isArray(obj.caps) ? obj.caps : [];
        desdeIDB = true;
      }
    } catch (_) {}
    if (!desdeIDB) {
      const fmRaw = localStorage.getItem('fm_sesion');
      const capRaw = localStorage.getItem('cap_sesion');
      fm = fmRaw ? JSON.parse(fmRaw) : [];
      caps = capRaw ? JSON.parse(capRaw) : [];
      if (fm.length || caps.length) {
        // Migración: la copia antigua de localStorage pasa a IndexedDB
        try { await dbPut('sesion', 'actual', JSON.stringify({ fm, caps })); } catch (_) {}
      }
    }

    for (const f of fm) {
      if (f.videoUrlKey) {
        const blob = await dbGet('videos', f.videoUrlKey);
        if (blob) f.videoUrl = URL.createObjectURL(blob);
        delete f.videoUrlKey;
      }
      if (f.imagenUrlKey) {
        const blob = await dbGet('imagenes', f.imagenUrlKey);
        if (blob) f.imagenUrl = URL.createObjectURL(blob);
        delete f.imagenUrlKey;
      }
    }

    for (const c of caps) {
      if (c.videoUrlKey) {
        const blob = await dbGet('capturas', c.videoUrlKey);
        if (blob) c.videoUrl = URL.createObjectURL(blob);
        delete c.videoUrlKey;
      }
    }

    return { filasMontaje: fm, capturas: caps };
  } catch (e) {
    console.error('Error al cargar sesion', e);
    return { filasMontaje: [], capturas: [] };
  }
};

export const limpiarSesion = () => {
  localStorage.removeItem('fm_sesion');
  localStorage.removeItem('cap_sesion');
  dbDelete('sesion', 'actual').catch(() => {});
};

export const guardarVideosBD = async (lista) => {
  try {
    const idx = [];
    for (const v of (lista || [])) {
      if (!v) continue;
      if (v.videoUrl && typeof v.videoUrl === 'string' && v.videoUrl.startsWith('blob:')) {
        const key = v.key || `bd_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
        await blobUrlToIndexedDB('videos', key, v.videoUrl);
        idx.push({ id: v.id, nombre: v.nombre || 'video', key });
      } else if (v.key) {
        idx.push({ id: v.id, nombre: v.nombre || 'video', key: v.key });
      }
    }
    localStorage.setItem('bd_videos', JSON.stringify(idx));
  } catch (e) {
    console.error('Error al guardar videos BD', e);
  }
};

export const cargarVideosBD = async () => {
  try {
    const idx = JSON.parse(localStorage.getItem('bd_videos') || '[]');
    const out = [];
    for (const e of (idx || [])) {
      if (!e || !e.key) continue;
      const blob = await dbGet('videos', e.key);
      if (blob) out.push({ id: e.id, nombre: e.nombre || 'video', key: e.key, videoUrl: URL.createObjectURL(blob) });
    }
    return out;
  } catch (e) {
    console.error('Error al cargar videos BD', e);
    return [];
  }
};
