/**
 * Formas 3D hechas de partículas (coordenadas normalizadas, y hacia arriba).
 * Cada función devuelve N puntos [x, y, z, x, y, z, …] dentro de ~[-1.2, 1.2].
 */
const R = Math.random;
const GOLD = Math.PI * (3 - Math.sqrt(5));

/** Corazón 3D relleno. */
export function heart(n: number) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = R() * Math.PI * 2, s = R() < 0.55 ? 1 : Math.sqrt(R()); // más puntos en el borde
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const x = (hx / 16) * s, y = (hy / 16) * s + 0.1;
    const depth = 0.3 * Math.sqrt(Math.max(0, 1 - s * s * 0.85));
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = (R() * 2 - 1) * depth;
  }
  return out;
}

/** Esfera unitaria (direcciones repartidas de forma pareja): base de la bola del puño. */
export function burst(n: number) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2, r = Math.sqrt(1 - y * y), th = i * GOLD;
    out[i * 3] = Math.cos(th) * r; out[i * 3 + 1] = y; out[i * 3 + 2] = Math.sin(th) * r;
  }
  // Mezcla el orden: así cualquier cantidad de partículas (calidad automática) cubre la esfera completa.
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    for (let k = 0; k < 3; k++) { const tmp = out[i * 3 + k]; out[i * 3 + k] = out[j * 3 + k]; out[j * 3 + k] = tmp; }
  }
  return out;
}
