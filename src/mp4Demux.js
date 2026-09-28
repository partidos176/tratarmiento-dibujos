// Lector de MP4 minimo, sin dependencias.
//
// Solo hace falta una cosa: enumerar las muestras del track de video (offset,
// tamano, marca de tiempo, si es clave) para poder pasarselas a un
// VideoDecoder. Se implementa aqui en vez de tirar de una libreria para poder
// probarlo en Node contra ficheros reales.
//
// Trabaja con rangos: no lee el fichero entero, solo la cabecera y el 'moov',
// que es donde estan las tablas. El resto se lee bajo demanda cuando el
// decodificador pide cada muestra.

// Decodificacion de los enteros de MP4, todos big-endian.
const u16 = (d, o) => (d[o] << 8) | d[o + 1];
const u32 = (d, o) => ((d[o] * 0x1000000) + (d[o + 1] << 16) + (d[o + 2] << 8) + d[o + 3]);
const i32 = (d, o) => {
  const v = u32(d, o);
  return v > 0x7fffffff ? v - 0x100000000 : v;
};
const u64 = (d, o) => u32(d, o) * 4294967296 + u32(d, o + 4);
const cc = (d, o) => String.fromCharCode(d[o], d[o + 1], d[o + 2], d[o + 3]);

const LIMITE_SEG = 400; // 400 muestras por bloque: indexOf en lugar de miles de includes

// Recorre las cajas de un rango. Las de tamaño 1 llevan un tamaño de 64 bits
// delante, que es justo lo que pasa en los ficheros de mas de 4 GB.
const recorrerCajas = (d, inicio, fin) => {
  const out = [];
  let o = inicio;
  while (o + 8 <= fin) {
    let size = u32(d, o);
    const type = cc(d, o + 4);
    let hdr = 8;
    if (size === 1) {
      if (o + 16 > fin) break;
      size = u64(d, o + 8);
      hdr = 16;
    } else if (size === 0) {
      size = fin - o;
    }
    if (size < hdr || o + size > fin) break;
    out.push({ type, inicio: o, fin: o + size, datos: o + hdr });
    o += size;
  }
  return out;
};

const primeraCaja = (d, inicio, fin, type) => recorrerCajas(d, inicio, fin).find(b => b.type === type) || null;

const leerTabla = (d, caja) => {
  // Todas las tablas de stbl son full box: version(1) + flags(3).
  const n = u32(d, caja.datos + 4);
  return { version: d[caja.datos], n, base: caja.datos + 8 };
};

const construirSamples = (d, stbl, stsz, stz2, stsc, stco, co64, stts, ctts, stss) => {
  // 1) tamanos
  const sizes = [];
  if (stsz) {
    // Ojo: stsz NO lleva contador de entradas como las demas tablas. Tras la
    // cabecera de 4 bytes vienen sample_size y sample_count, y despues los
    // tamanos. Si sample_size es 0 (bitrate variable, lo normal) cada muestra
    // trae el suyo.
    const sampleSize = u32(d, stsz.datos + 4);
    const sampleCount = u32(d, stsz.datos + 8);
    if (sampleSize !== 0) {
      for (let i = 0; i < sampleCount; i++) sizes.push(sampleSize);
    } else {
      for (let i = 0; i < sampleCount; i++) sizes.push(u32(d, stsz.datos + 12 + i * 4));
    }
  } else if (stz2) {
    // stz2: version+flags(4), reserved(3)+field_size(1), sample_count(4), datos.
    const field = d[stz2.datos + 7] & 3;
    const total = u32(d, stz2.datos + 8);
    const datos = stz2.datos + 12;
    if (field === 4) {
      for (let i = 0; i < total; i++) sizes.push(d[datos + i]);
    } else if (field === 8) {
      for (let i = 0; i < total; i++) sizes.push(u16(d, datos + i * 2));
    } else if (field === 16) {
      for (let i = 0; i < total; i++) sizes.push(u32(d, datos + i * 4));
    } else {
      // 1 o 2 bits por muestra, empaquetados de 16 en 16.
      const bits = field === 1 ? 1 : 2;
      const porPalabra = 16 / bits;
      for (let i = 0; i < total; i++) {
        const palabra = datos + Math.floor(i / porPalabra) * 2;
        const within = i % porPalabra;
        const b = u16(d, palabra);
        sizes.push((b >> (16 - bits * (within + 1))) & ((1 << bits) - 1));
      }
    }
  }
  if (!sizes.length) return [];

  // 2) offsets de los chunks
  const chunkOffsets = [];
  if (stco) {
    const { n, base } = leerTabla(d, stco);
    for (let i = 0; i < n; i++) chunkOffsets.push(u32(d, base + i * 4));
  } else if (co64) {
    const { n, base } = leerTabla(d, co64);
    for (let i = 0; i < n; i++) chunkOffsets.push(u64(d, base + i * 8));
  }

  // 3) cuantas muestras hay en cada chunk
  const stscTab = [];
  if (stsc) {
    const { n, base } = leerTabla(d, stsc);
    for (let i = 0; i < n; i++) {
      stscTab.push({
        firstChunk: u32(d, base + i * 12),
        samplesPerChunk: u32(d, base + i * 12 + 4),
      });
    }
  }

  // 4) duraciones acumuladas, en unidades de la timescale del medio
  const deltas = [];
  if (stts) {
    const { n, base } = leerTabla(d, stts);
    for (let i = 0; i < n; i++) {
      const count = u32(d, base + i * 8);
      const delta = u32(d, base + i * 8 + 4);
      for (let k = 0; k < count && deltas.length < sizes.length; k++) deltas.push(delta);
    }
  }
  while (deltas.length < sizes.length) deltas.push(deltas[deltas.length - 1] || 0);

  // 5) desplazamiento de composicion (fotogramas B)
  const cOff = new Array(sizes.length).fill(0);
  if (ctts) {
    const v = d[ctts.datos];
    const { n, base } = leerTabla(d, ctts);
    let s = 0;
    for (let i = 0; i < n && s < sizes.length; i++) {
      const count = u32(d, base + i * 8);
      const off = v === 1 ? i32(d, base + i * 8 + 4) : u32(d, base + i * 8 + 4);
      for (let k = 0; k < count && s < sizes.length; k++, s++) cOff[s] = off;
    }
  }

  // 6) muestras clave
  let claves = null;
  if (stss) {
    const { n, base } = leerTabla(d, stss);
    claves = new Set();
    for (let i = 0; i < n; i++) claves.add(u32(d, base + i * 4) - 1);
  }

  // Offset absoluto de cada muestra: se recorre chunk a chunk.
  const samples = [];
  let s = 0;
  let pos = 0;
  let t = 0;
  let sc = 0;
  const buscarSC = (chunk) => {
    while (sc + 1 < stscTab.length && chunk >= stscTab[sc + 1].firstChunk) sc++;
    return stscTab.length ? stscTab[sc].samplesPerChunk : 1;
  };
  for (let c = 0; c < chunkOffsets.length && s < sizes.length; c++) {
    const porChunk = buscarSC(c + 1);
    let off = chunkOffsets[c];
    for (let k = 0; k < porChunk && s < sizes.length; k++, s++) {
      const size = sizes[s];
      samples.push({ offset: off, size, dts: t, cts: t + cOff[s], dur: deltas[s] || 0, clave: claves ? claves.has(s) : true });
      off += size;
      t += deltas[s] || 0;
    }
    pos++;
  }
  return samples;
};

const codecDesdeDesc = (formato, d, entradaDatos) => {
  // Las 78 bytes de cabecera de una entrada visual, despues de los 8 de la caja.
  const cab = entradaDatos + 8 + 78;
  const ancho = u16(d, entradaDatos + 8 + 24);
  const alto = u16(d, entradaDatos + 8 + 26);
  // El fin correcto es el de la propia entrada de muestra: pasarse hace que se
  // lean basura bytes de mas y no se encuentre la caja de configuracion.
  const finEntrada = u32(d, entradaDatos) + entradaDatos;
  const hijos = recorrerCajas(d, cab, finEntrada);
  const find = (t) => hijos.find(h => h.type === t) || null;

  if (formato === 'avc1' || formato === 'avc3') {
    const avcC = find('avcC');
    if (!avcC) return null;
    const b = avcC.datos;
    const hex = (n) => n.toString(16).padStart(2, '0');
    const codec = 'avc1.' + hex(d[b + 1]) + hex(d[b + 2]) + hex(d[b + 3]);
    return { codec, ancho, alto, desc: d.subarray(b, avcC.fin) };
  }
  if (formato === 'hvc1' || formato === 'hev1') {
    const hvcC = find('hvcC');
    if (!hvcC) return null;
    const b = hvcC.datos;
    return { codec: 'hvc1.1.6.L93.B0', ancho, alto, desc: d.subarray(b, hvcC.fin) };
  }
  if (formato === 'vp09' || formato === 'vp08') {
    const vpcC = find('vpcC');
    const hex = (n) => n.toString(16).padStart(2, '0');
    let codec = 'vp09.00.10.08';
    if (vpcC) {
      const b = vpcC.datos;
      codec = 'vp09.' + hex(d[b + 4]) + '.' + hex(d[b + 5]) + '.' + hex(d[b + 6] >> 4);
    }
    return { codec, ancho, alto, desc: null };
  }
  if (formato === 'av01') {
    const av1C = find('av1C');
    if (!av1C) return null;
    return { codec: 'av01.0.04M.08', ancho, alto, desc: d.subarray(av1C.datos, av1C.fin) };
  }
  if (formato === 'mp4v') {
    const esds = find('esds');
    if (!esds) return null;
    return { codec: 'mp4v.20.8', ancho, alto, desc: d.subarray(esds.datos, esds.fin) };
  }
  return null;
};

/**
 * Lee el track de video de un MP4.
 * @param {{size:number, leerRango:(inicio:number,fin:number)=>Promise<Uint8Array>}} fuente
 * @returns {Promise<{codec:string,ancho:number,alto:number,desc:Uint8Array|null,timescale:number,samples:Array}|null>}
 */
export const leerTrackVideo = async (fuente) => {
  const { size, leerRango } = fuente;

  // Se recorre la lista de cajas de nivel superior leyendo solo cabeceras.
  let off = 0;
  let moov = null;
  let ftyp = null;
  while (off + 8 <= size) {
    const cab = await leerRango(off, Math.min(off + 16, size));
    if (cab.length < 8) break;
    const d = cab;
    let sz = u32(d, 0);
    const type = cc(d, 4);
    let hdr = 8;
    if (sz === 1) { sz = u64(d, 8); hdr = 16; }
    else if (sz === 0) { sz = size - off; }
    if (sz < hdr) break;
    if (type === 'moov') moov = { inicio: off, fin: off + sz };
    if (type === 'ftyp') ftyp = { inicio: off, fin: off + sz };
    if (type === 'mdat') {
      // Nos basta con el 'moov': el 'mdat' solo tiene los datos.
    }
    off += sz;
  }
  if (!moov) return null;

  const moovBytes = await leerRango(moov.inicio, moov.fin);
  const d = moovBytes;
  const moovCaja = recorrerCajas(d, 0, moovBytes.length).find(b => b.type === 'moov');
  if (!moovCaja) return null;

  for (const trak of recorrerCajas(d, moovCaja.datos, moovCaja.fin).filter(b => b.type === 'trak')) {
    const mdia = primeraCaja(d, trak.datos, trak.fin, 'mdia');
    if (!mdia) continue;
    const hdlr = primeraCaja(d, mdia.datos, mdia.fin, 'hdlr');
    if (!hdlr) continue;
    if (cc(d, hdlr.datos + 8) !== 'vide') continue;

    const mdhd = primeraCaja(d, mdia.datos, mdia.fin, 'mdhd');
    if (!mdhd) continue;
    const mv = d[mdhd.datos];
    const timescale = mv === 1 ? u32(d, mdhd.datos + 20) : u32(d, mdhd.datos + 12);

    const minf = primeraCaja(d, mdia.datos, mdia.fin, 'minf');
    if (!minf) continue;
    const stbl = primeraCaja(d, minf.datos, minf.fin, 'stbl');
    if (!stbl) continue;

    const find = (t) => primeraCaja(d, stbl.datos, stbl.fin, t);
    const stsd = find('stsd');
    if (!stsd) continue;
    const { base: sdBase } = leerTabla(d, stsd);
    const nEntradas = u32(d, sdBase);
    if (!nEntradas) continue;
    const entrada = recorrerCajas(d, sdBase, stbl.fin)[0];
    if (!entrada) continue;
    const desc = codecDesdeDesc(entrada.type, d, entrada.inicio);
    if (!desc) continue;

    const samples = construirSamples(
      d, stbl,
      find('stsz'), find('stz2'), find('stsc'), find('stco'), find('co64'),
      find('stts'), find('ctts'), find('stss')
    );
    if (!samples.length) continue;

    const toUs = timescale > 0 ? 1e6 / timescale : 0;
    return {
      codec: desc.codec,
      ancho: desc.ancho,
      alto: desc.alto,
      desc: desc.desc,
      timescale,
      samples: samples.map(s => ({
        offset: s.offset,
        size: s.size,
        timestamp: Math.round(s.cts * toUs),
        duration: Math.round(s.dur * toUs),
        clave: s.clave,
      })),
    };
  }
  return null;
};

export { LIMITE_SEG };
