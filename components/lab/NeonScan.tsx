"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker, HandLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { burst, heart } from "./shapes";
import { labSfx, unlockAudio } from "@/components/motion/sfx";

/**
 * DevWilly Lab — escáner neón con la cámara.
 * Capas: video de fondo → editor de código → TÚ (recortado con segmentación de persona)
 * → máscara neón, holograma de partículas y chispas. Así el código queda detrás de la persona.
 * - Cara: máscara low-poly neón con filtro One Euro (estable quieta, sin retraso en movimiento).
 * - Manos: los dedos eligen qué forman las partículas al costado:
 *   0 rostro · 1 rosa · 2 flor de loto · 3 galaxia · 4 corazón · 5 explosión.
 * Todo corre en el dispositivo (MediaPipe en WebAssembly): el video no sale del navegador.
 */
const VER = "1.2.3";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`;
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

type RGB = [number, number, number];
/** Color por número de dedos (0 = puño … 5 = mano abierta). */
const PALETTE: RGB[] = [
  [255, 50, 60], // 0 puño: rojo
  [40, 210, 255], // 1 celeste
  [60, 255, 120], // 2 verde
  [255, 225, 40], // 3 amarillo
  [150, 90, 255], // 4 violeta
  [255, 50, 220], // 5 magenta
];
const IDLE: RGB = [255, 106, 19]; // sin mano: naranja DevWilly
/** Figuras: 0 rostro · 6 corazón (con las manos) · 8 bola de energía (puño; al abrir, estalla). */
const SHAPES: Record<number, string> = { 0: "rostro", 6: "corazón", 8: "bola de energía" };

/** Rota el tono de un color (matriz de hue-rotate de CSS): da variedad sin salir de la familia. */
function hueRotate(c: RGB, deg: number): RGB {
  const a = (deg * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a);
  const m = [
    0.213 + co * 0.787 - si * 0.213, 0.715 - co * 0.715 - si * 0.715, 0.072 - co * 0.072 + si * 0.928,
    0.213 - co * 0.213 + si * 0.143, 0.715 + co * 0.285 + si * 0.14, 0.072 - co * 0.072 - si * 0.283,
    0.213 - co * 0.213 - si * 0.787, 0.715 - co * 0.715 + si * 0.715, 0.072 + co * 0.928 + si * 0.072,
  ];
  const k = (v: number) => Math.max(0, Math.min(255, v));
  return [k(c[0] * m[0] + c[1] * m[1] + c[2] * m[2]), k(c[0] * m[3] + c[1] * m[4] + c[2] * m[5]), k(c[0] * m[6] + c[1] * m[7] + c[2] * m[8])];
}
const toWhite = (c: RGB, f: number): RGB => [c[0] + (255 - c[0]) * f, c[1] + (255 - c[1]) * f, c[2] + (255 - c[2]) * f];
const HEART_RED: RGB = [255, 22, 58];

// Contorno de la cara (en orden) + rasgos: base de la máscara low-poly.
const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const FEATURES = [
  33, 160, 158, 133, 153, 144, 362, 385, 387, 263, 373, 380, // ojos
  70, 105, 107, 336, 334, 300, 46, 276, // cejas
  1, 4, 6, 197, 98, 327, 2, 168, 129, 358, // nariz
  61, 40, 37, 0, 267, 270, 291, 321, 314, 17, 84, 91, // boca
  50, 280, 205, 425, 116, 345, 187, 411, 9, 151, 118, 347, 101, 330, 206, 426, 57, 287, 108, 337, 69, 299, // mejillas, frente y mandíbula
];
const KEY = Array.from(new Set([...OVAL, ...FEATURES]));

type Pt = { x: number; y: number };
/** Triangulación de Delaunay (Bowyer–Watson). */
function delaunay(pts: Pt[]): [number, number, number][] {
  const n = pts.length;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const d = Math.max(maxX - minX, maxY - minY) * 20, mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  const all = pts.concat([{ x: mx - d, y: my - d }, { x: mx, y: my + d }, { x: mx + d, y: my - d }]);
  type T = { a: number; b: number; c: number; cx: number; cy: number; r2: number };
  const mk = (a: number, b: number, c: number): T => {
    const A = all[a], B = all[b], C = all[c];
    const D = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    if (Math.abs(D) < 1e-12) return { a, b, c, cx: 0, cy: 0, r2: Infinity };
    const a2 = A.x * A.x + A.y * A.y, b2 = B.x * B.x + B.y * B.y, c2 = C.x * C.x + C.y * C.y;
    const cx = (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / D;
    const cy = (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / D;
    return { a, b, c, cx, cy, r2: (A.x - cx) ** 2 + (A.y - cy) ** 2 };
  };
  let tris: T[] = [mk(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const p = all[i];
    const bad: T[] = [], keep: T[] = [];
    for (const t of tris) ((p.x - t.cx) ** 2 + (p.y - t.cy) ** 2 < t.r2 ? bad : keep).push(t);
    const count = new Map<string, [number, number, number]>();
    for (const t of bad) for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
      const k = u < v ? `${u},${v}` : `${v},${u}`;
      const e = count.get(k);
      if (e) e[2]++; else count.set(k, [u, v, 1]);
    }
    tris = keep;
    count.forEach(([u, v, c]) => { if (c === 1) tris.push(mk(u, v, i)); });
  }
  return tris.filter((t) => t.a < n && t.b < n && t.c < n).map((t) => [t.a, t.b, t.c]);
}
function inside(p: Pt, poly: Pt[]) {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) r = !r;
  }
  return r;
}

/** Dedos levantados de una mano (21 puntos de MediaPipe). */
function countFingers(h: NormalizedLandmark[]) {
  const d = (a: number, b: number) => Math.hypot(h[a].x - h[b].x, h[a].y - h[b].y, (h[a].z - h[b].z) * 0.6);
  const size = d(0, 9) || 1e-6;
  // ¿El dedo está recto? (las falanges apuntan hacia el mismo lado)
  const straight = (m: number, p: number, t: number) => {
    const ax = h[p].x - h[m].x, ay = h[p].y - h[m].y, bx = h[t].x - h[p].x, by = h[t].y - h[p].y;
    return (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) + 1e-9);
  };
  let n = 0;
  // Pulgar: separado del índice y alejado de la palma (si está doblado sobre la palma, no cuenta).
  if (d(4, 5) / size > 0.5 && d(4, 17) > d(2, 17) * 1.12 && straight(2, 3, 4) > 0.4) n++;
  // Índice, medio, anular y meñique: punta lejos de la muñeca y dedo recto.
  for (const [m, p, t] of [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]]) {
    if (d(t, 0) > d(p, 0) * 1.08 && straight(m, p, t) > 0.5) n++;
  }
  return n;
}

/**
 * Corazón con las dos manos: puntas de los índices juntas arriba y pulgares juntos abajo.
 * Devuelve el centro y el tamaño (en pantalla) o null.
 */
function heartHands(hands: NormalizedLandmark[][], pts: Pt[][]) {
  if (hands.length < 2) return null;
  const [A, B] = hands, [PA, PB] = pts;
  const d = (p: NormalizedLandmark, q: NormalizedLandmark) => Math.hypot(p.x - q.x, p.y - q.y);
  const size = (d(A[0], A[9]) + d(B[0], B[9])) / 2;
  if (d(A[8], B[8]) > size * 0.6 || d(A[4], B[4]) > size * 0.6) return null;
  const idxY = (A[8].y + B[8].y) / 2, thY = (A[4].y + B[4].y) / 2;
  if (idxY > thY - size * 0.35) return null; // los índices deben quedar arriba
  const top = { x: (PA[8].x + PB[8].x) / 2, y: (PA[8].y + PB[8].y) / 2 };
  const bot = { x: (PA[4].x + PB[4].x) / 2, y: (PA[4].y + PB[4].y) / 2 };
  const h = Math.hypot(top.x - bot.x, top.y - bot.y);
  return { x: (top.x + bot.x) / 2, y: (top.y + bot.y) / 2 + h * 0.08, r: h * 0.62 };
}

/**
 * Filtro One Euro (Casiez et al.): suaviza mucho cuando el punto está quieto
 * y casi nada cuando se mueve rápido. Es el estándar de los filtros de realidad aumentada.
 */
class OneEuro {
  private x: Float32Array; private dx: Float32Array; private t = -1;
  constructor(size: number, private minCutoff = 1.4, private beta = 0.012, private dCutoff = 1.2) {
    this.x = new Float32Array(size); this.dx = new Float32Array(size);
  }
  private static a(cutoff: number, dt: number) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(v: Float32Array, tMs: number) {
    if (this.t < 0) { this.x.set(v); this.t = tMs; return this.x; }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000); this.t = tMs;
    const ad = OneEuro.a(this.dCutoff, dt);
    for (let i = 0; i < v.length; i++) {
      const d = (v[i] - this.x[i]) / dt;
      this.dx[i] += ad * (d - this.dx[i]);
      const a = OneEuro.a(this.minCutoff + this.beta * Math.abs(this.dx[i]), dt);
      this.x[i] += a * (v[i] - this.x[i]);
    }
    return this.x;
  }
  reset() { this.t = -1; }
}

const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/** Punto de luz pre-dibujado (mucho más rápido que shadowBlur por partícula). */
function makeSprite(c: RGB) {
  const s = document.createElement("canvas");
  s.width = s.height = 32;
  const g = s.getContext("2d")!;
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.18, rgba(c, 0.95));
  gr.addColorStop(0.5, rgba(c, 0.25));
  gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  return s;
}

type Phase = "idle" | "loading" | "running" | "error";
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number };

export default function NeonScan() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [hud, setHud] = useState({ fps: 0, fingers: -1, shape: 0, face: false, color: rgba(IDLE) });
  const [hideHud, setHideHud] = useState(false);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => () => stopRef.current(), []);

  const start = async () => {
    unlockAudio();
    setPhase("loading");
    setError("");
    let stream: MediaStream | null = null;
    const det: { face: FaceLandmarker | null; hands: HandLandmarker | null } = { face: null, hands: null };
    let raf = 0;
    let alive = true;
    const stop = () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      det.face?.close(); det.hands?.close();
    };
    stopRef.current = stop;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } }, audio: false });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const vision = await import("@mediapipe/tasks-vision");
      const files = await vision.FilesetResolver.forVisionTasks(WASM);
      const make = async (delegate: "GPU" | "CPU") => {
        det.face = await vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: FACE_MODEL, delegate }, runningMode: "VIDEO", numFaces: 1, minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
        det.hands = await vision.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: HAND_MODEL, delegate }, runningMode: "VIDEO", numHands: 2, minHandDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      };
      try { await make("GPU"); } catch { await make("CPU"); }
      if (!alive) return stop();
      setPhase("running");
      run(vision.FaceLandmarker.FACE_LANDMARKS_TESSELATION, vision.HandLandmarker.HAND_CONNECTIONS);
    } catch (e) {
      stop();
      const name = (e as { name?: string })?.name;
      setError(
        name === "NotAllowedError" ? "Permiso de cámara denegado. Actívalo en el candado de la barra de direcciones y vuelve a intentarlo."
          : name === "NotFoundError" ? "No se encontró ninguna cámara en este equipo."
          : name === "NotReadableError" ? "La cámara está siendo usada por otra aplicación. Ciérrala y vuelve a intentarlo."
          : "No se pudo iniciar el escáner. Revisa tu conexión y vuelve a intentarlo.",
      );
      setPhase("error");
    }

    function run(tess: { start: number; end: number }[], handConn: { start: number; end: number }[]) {
      const video = videoRef.current!, canvas = canvasRef.current!, ctx = canvas.getContext("2d")!;
      const slow = innerWidth < 700 || (navigator.hardwareConcurrency ?? 8) <= 4;
      const dpr = Math.min(devicePixelRatio || 1, slow ? 1.5 : 2);
      let W = 0, H = 0;
      const resize = () => {
        W = canvas.clientWidth; H = canvas.clientHeight;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "f" || e.key === "F") { if (document.fullscreenElement) document.exitFullscreen(); else wrapRef.current?.requestFullscreen?.(); }
        else if (e.key === "h" || e.key === "H") setHideHud((v) => !v);
      };
      addEventListener("resize", resize);
      addEventListener("keydown", onKey);
      const prevStop = stopRef.current;
      stopRef.current = () => { removeEventListener("resize", resize); removeEventListener("keydown", onKey); prevStop(); };

      // Geometría del video en pantalla (cover + espejo).
      const cover = () => {
        const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
        const s = Math.max(W / vw, H / vh);
        return { vw, vh, s, ox: (W - vw * s) / 2, oy: (H - vh * s) / 2 };
      };
      const map = (l: NormalizedLandmark): Pt => {
        const c = cover();
        return { x: W - (c.ox + l.x * c.vw * c.s), y: c.oy + l.y * c.vh * c.s };
      };

      // ---- Partículas ----
      const N = slow ? 4500 : 12000;
      const px = new Float32Array(N), py = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N), pz = new Float32Array(N);
      const delay = new Float32Array(N), phaseArr = new Float32Array(N);
      const ea = new Uint16Array(N), eb = new Uint16Array(N), et = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        if (i < 478) { ea[i] = eb[i] = i; et[i] = 0; }
        else { const e = tess[(Math.random() * tess.length) | 0]; ea[i] = e.start; eb[i] = e.end; et[i] = 0.2 + Math.random() * 0.6; }
        phaseArr[i] = Math.random();
      }
      const shapeData: Record<number, Float32Array> = { 6: heart(N), 8: burst(N) };
      let ringAt = -1e9, ringX = 0, ringY = 0, ringR = 60, ringC: RGB = [255, 255, 255];
      let beatAt = 0, lastCount = -2, boomAt = -1e9, boomX = 0, boomY = 0, boomR = 100;
      const heartHist: boolean[] = [];
      let heartAt: { x: number; y: number; r: number } | null = null;
      let shape = 0, shapeAt = 0, inited = false;

      // Campo de profundidad: capas lejanas (pequeñas, lentas) y cercanas (grandes, rápidas).
      // Calidad adaptable: NA = partículas activas (se ajusta según los FPS reales).
      let q = slow ? 0.7 : 1, NA = Math.floor(N * q);
      const dust = Array.from({ length: slow ? 220 : 560 }, () => ({ x: Math.random(), y: Math.random(), z: Math.pow(Math.random(), 1.6), s: Math.random() * Math.PI * 2, g: (Math.random() * 3) | 0 }));
      let parX = 0, parY = 0;
      const sparks: Spark[] = [];
      const MAX_SPARKS = slow ? 220 : 520;

      let tris: [number, number, number][] | null = null;
      let edges: [number, number][] = [];
      let bestSym = Infinity;
      let color: RGB = [...IDLE];
      let sprite = makeSprite(color), spriteAt = 0;
      let tints: RGB[] = [color, color, color];
      let sprites: HTMLCanvasElement[] = [sprite, sprite, sprite];
      const hist: number[] = [];
      const euro = new OneEuro(478 * 2);
      const rawBuf = new Float32Array(478 * 2);
      let target: Pt[] | null = null, disp: Pt[] | null = null, rawZ: number[] = [], faceSeen = -1e9;
      let handPts: Pt[][] = [], handLm: NormalizedLandmark[][] = [];
      const prevTips = new Map<number, Pt>();
      let lastVT = -1, turn = 0, detCost = 0, fingersState = -1;
      let fpsT = performance.now(), fpsN = 0, fps = 0, hudT = 0, last = performance.now();
      let ax = 0, ay = 0, aR = 120, aInit = false;

      const neon = (path: Path2D, c: RGB, width: number, glow: number) => {
        ctx.save();
        ctx.lineJoin = "round"; ctx.lineCap = "round";
        ctx.shadowColor = rgba(c); ctx.shadowBlur = glow;
        ctx.strokeStyle = rgba(c, 0.95); ctx.lineWidth = width;
        ctx.stroke(path);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = Math.max(0.5, width * 0.35);
        ctx.stroke(path);
        ctx.restore();
      };

      const runFace = (now: number) => {
        const fr = det.face!.detectForVideo(video, now);
        const lm = fr.faceLandmarks?.[0];
        if (lm) {
          for (let i = 0; i < 478; i++) { const p = map(lm[i]); rawBuf[i * 2] = p.x; rawBuf[i * 2 + 1] = p.y; }
          if (now - faceSeen > 500) euro.reset();
          const f = euro.filter(rawBuf, now);
          if (!target) target = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
          for (let i = 0; i < 478; i++) { target[i].x = f[i * 2]; target[i].y = f[i * 2 + 1]; }
          rawZ = lm.map((l) => l.z ?? 0);
          faceSeen = now;
        }
      };
      const runHands = (now: number) => {
        const hr = det.hands!.detectForVideo(video, now + 0.01);
        handLm = hr.landmarks ?? [];
        handPts = handLm.map((h) => h.map(map));
      };
      const detect = (now: number) => {
        if (video.readyState < 2 || video.currentTime === lastVT) return;
        lastVT = video.currentTime;
        const t0 = performance.now();
        turn++;
        // Equipo rápido: todo en cada cuadro. Lento: se turnan (la animación sigue a 60 fps).
        const rr = slow || detCost > 18;
        try {
          if (!rr || turn % 2 === 0) runFace(now);
          if (!rr || turn % 2 === 1) runHands(now);
        } catch { /* un cuadro fallido no detiene el escáner */ }
        detCost = detCost * 0.8 + (performance.now() - t0) * 0.2;
      };

      const loop = () => {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const f60 = dt * 60;
        const t = now / 1000;
        detect(now);
        const facePresent = now - faceSeen < 450;

        // ---- Dedos → forma y color ----
        const raw = handLm.length ? Math.max(...handLm.map(countFingers)) : -1;
        hist.push(raw); if (hist.length > 5) hist.shift();
        const freq = new Map<number, number>(); hist.forEach((v) => freq.set(v, (freq.get(v) ?? 0) + 1));
        fingersState = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
        // ¿Corazón con las manos? (estable durante varios cuadros)
        const hh = heartHands(handLm, handPts);
        heartHist.push(!!hh); if (heartHist.length > 6) heartHist.shift();
        if (hh) heartAt = hh;
        const heartOn = heartHist.filter(Boolean).length >= 4 && !!heartAt;
        const hand = handLm.length > 0;
        // Corazón (manos) > puño (bola de energía) > rostro. Al abrir el puño: estallido.
        const want = heartOn ? 6 : hand && fingersState === 0 ? 8 : 0;
        if (want !== shape) {
          const from = shape;
          shape = want; shapeAt = now;
          for (let i = 0; i < N; i++) delay[i] = Math.random() * 380; // se arman una por una
          if (shape === 8) {
            for (let i = 0; i < N; i++) delay[i] = Math.random() * 160; // todas corren al puño
            labSfx.implode();
          } else if (from === 8) {
            // Se abre la mano: las partículas estallan desde el puño, vuelan y luego vuelven a su lugar.
            for (let i = 0; i < N; i++) {
              const a = Math.random() * Math.PI * 2, sp = 16 + Math.random() * 34;
              vx[i] = Math.cos(a) * sp; vy[i] = Math.sin(a) * sp; delay[i] = 650 + Math.random() * 650;
            }
            boomAt = now; boomX = ax; boomY = ay; boomR = aR;
            labSfx.blast();
          }
          if (shape === 6) { labSfx.warm(); beatAt = now + 450; }
        }
        // Color: 1–5 dedos (rostro), y colores propios de cada figura.
        if (shape === 0 && hand && fingersState >= 1 && fingersState !== lastCount) {
          labSfx.blip(fingersState);
          // Anillo de luz del nuevo color desde la palma.
          const Q = handPts[0];
          if (Q) { ringAt = now; ringX = (Q[0].x + Q[9].x) / 2; ringY = (Q[0].y + Q[9].y) / 2; ringR = Math.hypot(Q[0].x - Q[9].x, Q[0].y - Q[9].y); ringC = PALETTE[Math.min(5, fingersState)]; }
        }
        lastCount = hand ? fingersState : -2;
        if (shape === 6 && now >= beatAt) { labSfx.heartbeat(); beatAt = now + 1208; }
        const tc = shape === 6 ? HEART_RED : !hand || fingersState < 0 ? IDLE : PALETTE[Math.min(5, fingersState)];
        const ck = 1 - Math.pow(1 - 0.12, f60);
        color = color.map((v, i) => v + (tc[i] - v) * ck) as RGB;
        if (now - spriteAt > 90) {
          const spread = shape === 6 ? 16 : 34;
          tints = [color, hueRotate(color, spread), toWhite(hueRotate(color, -spread), 0.18)];
          sprite = makeSprite(color); sprites = tints.map(makeSprite); spriteAt = now;
        }

        // ---- Interpolación de la cara entre detecciones (60 fps) ----
        if (target) {
          if (!disp) disp = target.map((p) => ({ ...p }));
          const al = 1 - Math.pow(1 - 0.55, f60);
          for (let i = 0; i < 478; i++) { disp[i].x += (target[i].x - disp[i].x) * al; disp[i].y += (target[i].y - disp[i].y) * al; }
        }

        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = "lighter";

        // ---- Polvo del ambiente ----
        for (let di = 0, dn = Math.floor(dust.length * (0.4 + 0.6 * q)); di < dn; di++) {
          const d = dust[di];
          d.y -= (0.00008 + 0.0004 * d.z) * f60;
          if (d.y < -0.05) { d.y = 1.05; d.x = Math.random(); }
          // Paralaje: al mover la cabeza, las capas cercanas se desplazan más que las lejanas.
          const x = d.x * W + Math.sin(t * 0.4 + d.s) * 12 - parX * 160 * d.z, y = d.y * H - parY * 90 * d.z;
          const s = 1.2 + d.z * d.z * 9;
          ctx.globalAlpha = 0.08 + d.z * 0.32;
          ctx.drawImage(sprites[d.g], x - s, y - s, s * 2, s * 2);
        }
        ctx.globalAlpha = 1;

        const P = disp;
        // Caja del rostro (para la máscara y para ubicar el holograma al costado).
        let fx0 = W * 0.4, fx1 = W * 0.6, fy0 = H * 0.3, fy1 = H * 0.6, fcx = W / 2, fcy = H * 0.45;
        if (P) {
          fx0 = Infinity; fx1 = -Infinity; fy0 = Infinity; fy1 = -Infinity; fcx = 0; fcy = 0;
          for (const i of OVAL) { const p = P[i]; fx0 = Math.min(fx0, p.x); fx1 = Math.max(fx1, p.x); fy0 = Math.min(fy0, p.y); fy1 = Math.max(fy1, p.y); fcx += p.x; fcy += p.y; }
          fcx /= OVAL.length; fcy /= OVAL.length;
          const pk = 1 - Math.pow(1 - 0.08, f60);
          parX += (fcx / Math.max(1, W) - 0.5 - parX) * pk; parY += (fcy / Math.max(1, H) - 0.45 - parY) * pk;

          const sym = Math.abs(Math.log(Math.hypot(P[1].x - P[234].x, P[1].y - P[234].y) / Math.max(1, Math.hypot(P[1].x - P[454].x, P[1].y - P[454].y))));
          if (facePresent && (!tris || sym < bestSym - 0.12)) {
            bestSym = sym;
            const kp = KEY.map((i) => P[i]);
            const oval = OVAL.map((i) => P[i]);
            tris = delaunay(kp).filter(([a, b, c]) => inside({ x: (kp[a].x + kp[b].x + kp[c].x) / 3, y: (kp[a].y + kp[b].y + kp[c].y) / 3 }, oval));
            const set = new Set<string>();
            for (const [a, b, c] of tris) for (const [u, v] of [[a, b], [b, c], [c, a]]) set.add(u < v ? `${u},${v}` : `${v},${u}`);
            edges = [...set].map((k) => k.split(",").map(Number) as [number, number]);
          }
          // ---- Máscara low-poly ----
          ctx.globalAlpha = facePresent ? 1 : Math.max(0, 1 - (now - faceSeen - 450) / 600);
          if (tris) {
            ctx.fillStyle = rgba(color, 0.035);
            ctx.beginPath();
            for (const [a, b, c] of tris) { const A = P[KEY[a]], B = P[KEY[b]], C = P[KEY[c]]; ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.closePath(); }
            ctx.fill();
          }
          const path = new Path2D();
          for (const [a, b] of edges) { const A = P[KEY[a]], B = P[KEY[b]]; path.moveTo(A.x, A.y); path.lineTo(B.x, B.y); }
          neon(path, color, slow ? 1.3 : 1.5, slow || q < 0.55 ? 9 : 15);
          for (const i of KEY) { const p = P[i]; ctx.drawImage(sprite, p.x - 4.5, p.y - 4.5, 9, 9); }
          ctx.globalAlpha = 1;
        }

        // ---- Lugar del holograma: el lado con más espacio, sin tocar la cara ----
        const fw = Math.max(60, fx1 - fx0), gap = fw * 0.35;
        const leftRoom = fx0 - gap, rightRoom = W - fx1 - gap;
        let tx: number, ty: number, tR: number;
        if (Math.max(leftRoom, rightRoom) > fw * 1.1) {
          const left = leftRoom > rightRoom, room = left ? leftRoom : rightRoom;
          tR = Math.min(room * 0.46, H * 0.3, fw * 1.6);
          tx = left ? fx0 - gap - tR * 1.05 : fx1 + gap + tR * 1.05;
          ty = Math.min(H - tR * 1.1, Math.max(tR * 1.1, fcy - fw * 0.1));
        } else {
          // Pantalla angosta (teléfono): arriba de la cabeza o, si no cabe, debajo del mentón.
          const up = fy0 - gap * 2, down = H - fy1 - gap * 2;
          if (up >= down) { tR = Math.min(up * 0.48, W * 0.36); ty = fy0 - gap * 2 - tR; }
          else { tR = Math.min(down * 0.48, W * 0.36); ty = fy1 + gap * 2 + tR; }
          tR = Math.max(40, tR); tx = W / 2;
        }
        if (shape === 6 && heartAt) { tx = heartAt.x; ty = heartAt.y - heartAt.r * 0.15; tR = Math.max(150, heartAt.r * 2.6); }
        if (shape === 8) {
          // Bola de energía dentro del puño (la mano con menos dedos).
          let worst = 9, wi = 0;
          handLm.forEach((h, i) => { const c = countFingers(h); if (c < worst) { worst = c; wi = i; } });
          const Q = handPts[wi];
          if (Q) {
            tx = (Q[0].x + Q[5].x + Q[9].x + Q[13].x + Q[17].x) / 5; ty = (Q[0].y + Q[5].y + Q[9].y + Q[13].y + Q[17].y) / 5;
            tR = Math.max(110, Math.hypot(Q[0].x - Q[9].x, Q[0].y - Q[9].y) * 1.55);
          }
        }
        if (!aInit) { ax = tx; ay = ty; aR = tR; aInit = true; }
        const gk = 1 - Math.pow(1 - (shape === 0 ? 0.05 : 0.3), f60);
        ax += (tx - ax) * gk; ay += (ty - ay) * gk; aR += (tR - aR) * gk;

        // ---- Objetivo de cada partícula según la forma ----
        const sinceShape = now - shapeAt;
        // Paralaje: al mover la cabeza, la figura gira como si la vieras desde otro ángulo.
        const yawOff = (fcx / Math.max(1, W) - 0.5) * 0.5, pitchOff = (fcy / Math.max(1, H) - 0.45) * 0.25;
        const still = shape === 6; // el corazón siempre de frente, sin girar
        const yaw = still ? 0 : (shape === 8 ? t * 1.8 : Math.sin(t * 0.5) * 0.4) + yawOff;
        const pitch = still ? 0 : 0.1 + pitchOff;
        const S = aR * 0.7;
        const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
        let gxs: Float32Array | null = null, gys: Float32Array | null = null, gzs: Float32Array | null = null;
        if (shape === 0 && P) {
          // Holograma del rostro: misma cara en 3D, girando suave.
          const sc = (aR * 1.55) / fw, ang = Math.sin(t * 0.7) * 0.45, ca = Math.cos(ang), sa = Math.sin(ang), zs = fw * 2.2;
          gxs = new Float32Array(478); gys = new Float32Array(478); gzs = new Float32Array(478);
          for (let i = 0; i < 478; i++) {
            const dx = (P[i].x - fcx) * sc, dz = -(rawZ[i] ?? 0) * zs * sc;
            gxs[i] = ax + dx * ca + dz * sa; gys[i] = ay + (P[i].y - fcy) * sc; gzs[i] = (-dx * sa + dz * ca) / Math.max(40, aR);
          }
        }
        const sd = shapeData[shape];
        const pulse = shape === 6 ? 1 + 0.07 * Math.pow(Math.max(0, Math.sin(t * 5.2)), 6) : 1;
        for (let i = 0; i < NA; i++) {
          let X: number, Y: number, Z = 0;
          if (shape === 0) {
            if (!gxs) {
              // Sin rostro a la vista: una nube esférica suave que gira mientras lo busca.
              const sp8 = shapeData[8], r0 = 0.85 * Math.cbrt(phaseArr[i]) * aR * 0.75, ang = t * 0.35;
              const x0 = sp8[i * 3] * r0, z0 = sp8[i * 3 + 2] * r0;
              X = ax + x0 * Math.cos(ang) + z0 * Math.sin(ang); Y = ay - sp8[i * 3 + 1] * r0; Z = (-x0 * Math.sin(ang) + z0 * Math.cos(ang)) / Math.max(40, aR);
            }
            else {
              const a = ea[i], b = eb[i], k = et[i];
              X = gxs[a] + (gxs[b] - gxs[a]) * k; Y = gys![a] + (gys![b] - gys![a]) * k; Z = gzs![a];
            }
          } else {
            let x = sd![i * 3], y = sd![i * 3 + 1], z = sd![i * 3 + 2];
            if (shape === 8) {
              // Bola compacta y viva dentro del puño.
              const rr = 0.95 * Math.cbrt(phaseArr[i]) * (1 + 0.06 * Math.sin(t * 11 + i));
              x *= rr; y *= rr; z *= rr;
            }
            x *= pulse; y *= pulse; z *= pulse * 1.15;
            const x2 = x * cyw + z * syw, z2 = -x * syw + z * cyw;
            const y2 = y * cp - z2 * sp, z3 = y * sp + z2 * cp;
            const per = 1 / Math.max(0.55, 1 + z3 * 0.32);
            X = ax + x2 * S * per; Y = ay - y2 * S * per; Z = z3;
          }
          pz[i] = Z;
          if (!inited) { px[i] = X; py[i] = Y; continue; }
          if (sinceShape >= delay[i]) {
            const k = shape === 8 ? 0.22 : 0.13, damp = Math.pow(shape === 8 ? 0.66 : 0.74, f60);
            vx[i] = (vx[i] + (X - px[i]) * k * f60) * damp;
            vy[i] = (vy[i] + (Y - py[i]) * k * f60) * damp;
          } else { vx[i] *= 0.96; vy[i] *= 0.96; }
          px[i] += vx[i] * f60 * 0.5; py[i] += vy[i] * f60 * 0.5;
        }
        inited = true;

        // Malla tenue del holograma del rostro.
        if (shape === 0 && !slow && sinceShape > 700 && P) {
          ctx.strokeStyle = rgba(color, 0.07); ctx.lineWidth = 0.6;
          ctx.beginPath();
          for (const c of tess) { ctx.moveTo(px[c.start], py[c.start]); ctx.lineTo(px[c.end], py[c.end]); }
          ctx.stroke();
        }
        // Profundidad en 3 planos: lejos (pequeño y tenue) → cerca (grande y brillante).
        const heartGlow = shape === 6 ? Math.min(1, sinceShape / 600) : 0;
        if (heartGlow > 0) {
          // Resplandor intenso detrás del corazón rojo.
          const s = aR * (2.4 + 0.25 * Math.sin(t * 5.2));
          ctx.globalAlpha = 0.85 * heartGlow; ctx.drawImage(sprite, ax - s, ay - s, s * 2, s * 2);
          ctx.globalAlpha = 0.6 * heartGlow; ctx.drawImage(sprite, ax - s * 0.55, ay - s * 0.55, s * 1.1, s * 1.1);
          ctx.globalAlpha = 1;
        }
        const planes: [number, number, number, number][] = [[0.3, 9, 1.1, 0.35], [-0.3, 0.3, 1.8, 0.72], [-9, -0.3, 2.8, 1]];
        // Figuras compactas (plasma, bola del puño): TODAS las partículas (más densas), con brillo
        // repartido para que el color se mantenga y no se "queme" en blanco.
        const compact = shape === 8;
        const dens = compact ? Math.min(1, Math.max(0.3, (aR * aR * 0.55) / N)) : 1;
        const vs = 1;
        for (const [lo, hi, size, al] of planes) {
          const s = (size + heartGlow * 0.6) * (compact ? 0.85 : 1);
          // Lo cercano se aclara (más luz), lo lejano conserva el color.
          const lift = lo < -1 ? 0.28 : lo < 0 ? 0.1 : 0;
          for (let g = 0; g < 3; g++) {
            ctx.fillStyle = rgba(toWhite(tints[g], lift), Math.min(1, (al + heartGlow * 0.2) * dens));
            for (let i = g; i < NA; i += 3 * vs) { const z = pz[i]; if (z >= lo && z < hi) ctx.fillRect(px[i] - s / 2, py[i] - s / 2, s, s); }
          }
        }
        // Destellos en cruz (como estrellas) en algunas partículas cercanas.
        ctx.globalAlpha = 0.85;
        for (let i = 0; i < NA; i += slow ? 97 : 53) {
          const tw = 0.5 + 0.5 * Math.sin(t * 2.6 + i * 0.37);
          if (pz[i] < 0 && tw > 0.86) {
            const L = 9 + (tw - 0.86) * 90, sp2 = sprites[i % 3];
            ctx.drawImage(sp2, px[i] - L, py[i] - 1.2, L * 2, 2.4);
            ctx.drawImage(sp2, px[i] - 1.2, py[i] - L, 2.4, L * 2);
          }
        }
        ctx.globalAlpha = 1;
        // Brillo: las partículas cercanas llevan un halo de luz (más en el corazón).
        const gstep = (slow ? 6 : 3) * (q < 0.6 ? 2 : 1);
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < NA; i += gstep * vs) { if (pz[i] < -0.05) { const s = 3.2 + (-pz[i]) * 2.5; ctx.drawImage(sprites[i % 3], px[i] - s, py[i] - s, s * 2, s * 2); } }
        ctx.globalAlpha = 1;
        const step = heartGlow > 0 ? 9 : 13;
        for (let i = 0; i < NA; i += step * vs) {
          if (pz[i] < 0.1 && (heartGlow > 0 || 0.5 + 0.5 * Math.sin(t * 3 + i) > 0.8)) {
            const s = heartGlow > 0 ? 6 + heartGlow * 3 : 6;
            ctx.drawImage(sprite, px[i] - s, py[i] - s, s * 2, s * 2);
          }
        }
        if (now - boomAt < 650) {
          // Destello del estallido al abrir la mano.
          const fl = 1 - (now - boomAt) / 650, s = boomR * (1 + (1 - fl) * 3.2);
          ctx.globalAlpha = fl * 0.9; ctx.drawImage(sprite, boomX - s, boomY - s, s * 2, s * 2);
          ctx.globalAlpha = fl * 0.6; ctx.drawImage(sprites[1], boomX - s * 0.5, boomY - s * 0.5, s, s); ctx.globalAlpha = 1;
        }
        if (shape === 8) {
          // Núcleo y halo de la bola de energía.
          const s = aR * (1.35 + 0.08 * Math.sin(t * 12));
          ctx.globalAlpha = Math.min(1, sinceShape / 400) * 0.95; ctx.drawImage(sprite, ax - s, ay - s, s * 2, s * 2); ctx.globalAlpha = 1;
        }
        // Anillo de confirmación del cambio de color.
        const rp = (now - ringAt) / 600;
        if (rp >= 0 && rp < 1) {
          const rr = ringR * (0.6 + rp * 1.8);
          ctx.globalAlpha = 1 - rp;
          neon(new Path2D(`M ${ringX + rr} ${ringY} A ${rr} ${rr} 0 1 0 ${ringX - rr} ${ringY} A ${rr} ${rr} 0 1 0 ${ringX + rr} ${ringY}`), ringC, 2.2, 18);
          ctx.globalAlpha = 1;
        }
        // ---- Manos: esqueleto neón + chispas ----
        handPts.forEach((Q, hi) => {
          const hp = new Path2D();
          for (const c of handConn) { hp.moveTo(Q[c.start].x, Q[c.start].y); hp.lineTo(Q[c.end].x, Q[c.end].y); }
          ctx.globalAlpha = 0.5;
          neon(hp, color, 1, slow ? 6 : 10);
          ctx.globalAlpha = 1;
          for (const tip of [4, 8, 12, 16, 20]) {
            const p = Q[tip], key = hi * 100 + tip, pv = prevTips.get(key);
            ctx.drawImage(sprite, p.x - 9, p.y - 9, 18, 18);
            const mv = pv ? Math.hypot(p.x - pv.x, p.y - pv.y) : 0;
            const n = Math.min(4, 1 + Math.floor(mv / 8));
            for (let k = 0; k < n && sparks.length < MAX_SPARKS; k++) {
              const a = Math.random() * Math.PI * 2, s = 0.4 + Math.random() * 1.6;
              sparks.push({ x: p.x, y: p.y, vx: Math.cos(a) * s + (pv ? (p.x - pv.x) * 0.06 : 0), vy: Math.sin(a) * s - 0.6 + (pv ? (p.y - pv.y) * 0.06 : 0), life: 0, max: 0.5 + Math.random() * 0.7, size: 3 + Math.random() * 5 });
            }
            prevTips.set(key, { ...p });
          }
        });
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.life += dt;
          if (s.life >= s.max) { sparks.splice(i, 1); continue; }
          s.vy += 0.025 * f60; s.vx *= Math.pow(0.97, f60); s.vy *= Math.pow(0.97, f60);
          s.x += s.vx * f60; s.y += s.vy * f60;
          const k = 1 - s.life / s.max, sz = s.size * (0.4 + k * 0.6);
          ctx.globalAlpha = k;
          ctx.drawImage(sprite, s.x - sz, s.y - sz, sz * 2, sz * 2);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";

        fpsN++;
        if (now - fpsT >= 500) {
          fps = (fpsN * 1000) / (now - fpsT); fpsN = 0; fpsT = now;
          // Calidad automática: si el equipo se traba, menos partículas y brillo; si sobra, vuelve a subir.
          if (fps < 47) q = Math.max(0.3, q * 0.82);
          else if (fps > 57 && q < 1) q = Math.min(1, q * 1.08);
          NA = Math.floor(N * q);
        }
        if (now - hudT > 250) {
          hudT = now;
          setHud({ fps, fingers: fingersState, shape, face: facePresent, color: rgba(color) });
        }
      };
      loop();
    }
  };

  return (
    <div className="lab" ref={wrapRef} style={{ ["--lab-c" as string]: hud.color }}>
      <video ref={videoRef} className="lab-video" playsInline muted aria-hidden="true" />
      <canvas ref={canvasRef} className="lab-canvas" aria-hidden="true" />

      {!hideHud && <Link href="/" className="lab-back" aria-label="Volver a DevWilly">←</Link>}
      <p className="sr-only" aria-live="polite">{phase === "running" ? `Figura: ${SHAPES[hud.shape] ?? ""}` : ""}</p>

      {phase !== "running" && (
        <div className="lab-start">
          <p className="lab-kicker">DevWilly Lab</p>
          <h1>Neon Face Scan</h1>
          <p className="lab-lead">Tu rostro en neón. Tus manos crean la magia.</p>
          {phase === "error" && <p className="lab-error" role="alert">{error}</p>}
          <button type="button" className="lab-btn" onClick={start} disabled={phase === "loading"}>
            {phase === "loading" ? "Cargando escáner…" : phase === "error" ? "Intentar de nuevo" : "Activar cámara"}
          </button>
          <p className="lab-note">Se procesa en tu dispositivo; el video no se graba ni se envía.</p>
        </div>
      )}
    </div>
  );
}
