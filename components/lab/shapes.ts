/**
 * Formas 3D hechas de partículas (coordenadas normalizadas, y hacia arriba).
 * Cada función devuelve N puntos [x, y, z, x, y, z, …] dentro de ~[-1.2, 1.2].
 */
const R = Math.random;
const GOLD = Math.PI * (3 - Math.sqrt(5));

/**
 * Rosa: tres coronas de pétalos en forma de copa (bordes marcados y curvados hacia afuera),
 * capullo en espiral al centro, tallo y dos hojas.
 */
export function rose(n: number) {
  const out = new Float32Array(n * 3);
  const crowns = [
    { count: 5, r: 0.62, h: 0.62, rot: 0, w: 0.35 },
    { count: 4, r: 0.44, h: 0.74, rot: 0.6, w: 0.3 },
    { count: 3, r: 0.28, h: 0.84, rot: 1.25, w: 0.27 },
  ];
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number;
    const k = R();
    if (k < 0.72) {
      const C = crowns[k < 0.34 ? 0 : k < 0.56 ? 1 : 2];
      const p = Math.floor(R() * C.count), span = ((Math.PI * 2) / C.count) * 1.3;
      const u = R(), top = 0.82 + 0.18 * Math.sin(Math.PI * u); // borde superior redondeado
      const v = R() < 0.45 ? top * (0.97 + R() * 0.03) : R() * top; // 45 % en el borde (silueta)
      const th = C.rot + (p / C.count) * Math.PI * 2 + (u - 0.5) * span;
      const r = C.r * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, v * 0.95))) + Math.pow(v, 3) * C.w; // copa + borde curvado
      x = Math.cos(th) * r; z = Math.sin(th) * r; y = -0.2 + v * C.h;
    } else if (k < 0.82) {
      // Capullo en espiral (el centro de la rosa).
      const s = R(), th = s * Math.PI * 5, r = 0.03 + 0.2 * s;
      const rim = R() < 0.6;
      x = Math.cos(th) * r; z = Math.sin(th) * r; y = 0.62 - s * 0.12 - (rim ? 0 : R() * 0.3);
    } else if (k < 0.93) {
      // Tallo.
      const t = R(); y = -0.22 - t * 0.95; x = Math.sin(t * 2.4) * 0.06; z = (R() - 0.5) * 0.025;
    } else {
      // Dos hojas.
      const side = R() < 0.5 ? -1 : 1, t = R(), w = (R() * 2 - 1) * 0.13 * Math.sin(Math.PI * t);
      x = side * (0.06 + t * 0.42); y = -0.7 + t * 0.22 - t * t * 0.12 + w * 0.4; z = w;
    }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return out;
}

/** Flor de loto: tres coronas de pétalos (de abiertas a cerradas) + centro + hoja de agua. */
export function lotus(n: number) {
  const out = new Float32Array(n * 3);
  const layers = [
    { count: 9, len: 1.05, open: 1.25, rot: 0 },
    { count: 9, len: 0.85, open: 0.8, rot: Math.PI / 9 },
    { count: 7, len: 0.6, open: 0.35, rot: 0.2 },
  ];
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number;
    const k = R();
    if (k < 0.82) {
      const L = layers[k < 0.38 ? 0 : k < 0.64 ? 1 : 2];
      const p = Math.floor(R() * L.count), phi = L.rot + (p / L.count) * Math.PI * 2;
      const s = Math.pow(R(), 0.9), w = (R() * 2 - 1);
      const e = L.open; // inclinación desde la vertical
      const dx = Math.cos(phi) * Math.sin(e), dy = Math.cos(e), dz = Math.sin(phi) * Math.sin(e);
      const sx = -Math.sin(phi), sz = Math.cos(phi);
      const width = 0.3 * Math.sin(Math.PI * Math.pow(s, 0.75)) * L.len;
      x = dx * s * L.len + sx * w * width;
      y = dy * s * L.len + s * s * 0.18 + Math.abs(w) * width * 0.25; // pétalo cóncavo y punta hacia arriba
      z = dz * s * L.len + sz * w * width;
      y -= 0.25;
    } else if (k < 0.9) {
      // Centro (semillero).
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.16;
      x = Math.cos(a) * r; z = Math.sin(a) * r; y = -0.12 + (R() - 0.5) * 0.06;
    } else {
      // Hoja de agua (anillo plano).
      const a = R() * Math.PI * 2, r = 0.85 + R() * 0.2;
      x = Math.cos(a) * r; z = Math.sin(a) * r; y = -0.34 + (R() - 0.5) * 0.02;
    }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return out;
}

/** Galaxia espiral de tres brazos, inclinada. */
export function galaxy(n: number) {
  const out = new Float32Array(n * 3);
  const tilt = 1.05, ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number;
    if (R() < 0.18) {
      // Núcleo brillante.
      const a = R() * Math.PI * 2, b = Math.acos(R() * 2 - 1), r = Math.pow(R(), 2) * 0.22;
      x = r * Math.sin(b) * Math.cos(a); y = r * Math.cos(b) * 0.6; z = r * Math.sin(b) * Math.sin(a);
    } else {
      const arm = Math.floor(R() * 3), r = 0.12 + Math.pow(R(), 0.7) * 1.05;
      const th = arm * (Math.PI * 2 / 3) + r * 3.4 + (R() - 0.5) * 0.5 * (1.2 - r);
      x = r * Math.cos(th) + (R() - 0.5) * 0.06; z = r * Math.sin(th) + (R() - 0.5) * 0.06;
      y = (R() - 0.5) * 0.08 * (1.2 - r);
    }
    // Inclinación para verla en perspectiva.
    const y2 = y * ct - z * st, z2 = y * st + z * ct;
    out[i * 3] = x; out[i * 3 + 1] = y2; out[i * 3 + 2] = z2;
  }
  return out;
}

/** Corazón 3D relleno. */
export function heart(n: number) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = R() * Math.PI * 2, s = R() < 0.55 ? 1 : Math.sqrt(R()); // más puntos en el borde
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const x = (hx / 16) * s, y = (hy / 16) * s + 0.1;
    const depth = 0.5 * Math.sqrt(Math.max(0, 1 - s * s * 0.85));
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = (R() * 2 - 1) * depth;
  }
  return out;
}

/** Explosión: direcciones (esfera) + fase de cada partícula; el radio crece con el tiempo. */
export function burst(n: number) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2, r = Math.sqrt(1 - y * y), th = i * GOLD;
    out[i * 3] = Math.cos(th) * r; out[i * 3 + 1] = y; out[i * 3 + 2] = Math.sin(th) * r;
  }
  return out;
}

/**
 * Planeta de plasma: esfera (se forma primero), anillo inclinado y halo de plasma.
 * El orden de los puntos importa: así se arma de adentro hacia afuera.
 */
export function planet(n: number) {
  const out = new Float32Array(n * 3);
  const nS = Math.floor(n * 0.6), nR = Math.floor(n * 0.28);
  const tilt = 0.42, ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number;
    if (i < nS) {
      const yy = 1 - ((i + 0.5) / nS) * 2, r = Math.sqrt(1 - yy * yy), th = i * GOLD, k = 0.97 + R() * 0.05;
      x = Math.cos(th) * r * k; y = yy * k; z = Math.sin(th) * r * k;
    } else if (i < nS + nR) {
      const a = R() * Math.PI * 2, band = R();
      const rr = band < 0.55 ? 1.4 + R() * 0.25 : band < 0.85 ? 1.72 + R() * 0.18 : 1.95 + R() * 0.1;
      const x0 = Math.cos(a) * rr, z0 = Math.sin(a) * rr, y0 = (R() - 0.5) * 0.03;
      x = x0; y = y0 * ct - z0 * st; z = y0 * st + z0 * ct;
    } else {
      const yy = R() * 2 - 1, r = Math.sqrt(1 - yy * yy), th = R() * Math.PI * 2, k = 1.08 + Math.pow(R(), 2) * 0.35;
      x = Math.cos(th) * r * k; y = yy * k; z = Math.sin(th) * r * k;
    }
    out[i * 3] = x * 0.55; out[i * 3 + 1] = y * 0.55; out[i * 3 + 2] = z * 0.55;
  }
  return out;
}
