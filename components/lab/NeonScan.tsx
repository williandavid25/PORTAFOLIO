"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker, HandLandmarker, ImageSegmenter, NormalizedLandmark } from "@mediapipe/tasks-vision";
import CodeTyper from "./CodeTyper";
import { burst, galaxy, heart, lotus, planet, rose } from "./shapes";

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
const SEG_MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

type RGB = [number, number, number];
/** Color por número de dedos (0 = puño … 5 = mano abierta). */
const PALETTE: RGB[] = [
  [255, 59, 62], // 0 rojo
  [255, 77, 141], // 1 rosa
  [255, 194, 61], // 2 dorado (loto)
  [124, 92, 255], // 3 violeta (galaxia)
  [255, 61, 120], // 4 carmesí (corazón)
  [90, 170, 255], // 5 plasma (planeta en la palma)
];
const IDLE: RGB = [255, 106, 19]; // sin mano: naranja DevWilly
const SHAPES = ["rostro", "rosa", "flor de loto", "galaxia", "corazón", "planeta de plasma", "corazón", "explosión"];
const FIRE: RGB = [255, 140, 26];
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
  const dist = (a: number, b: number) => Math.hypot(h[a].x - h[b].x, h[a].y - h[b].y, (h[a].z - h[b].z) * 0.5);
  let n = 0;
  if (dist(4, 17) > dist(3, 17) * 1.08 && dist(4, 5) > dist(3, 5)) n++; // pulgar
  for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) if (dist(tip, 0) > dist(pip, 0) * 1.12) n++;
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
  const personRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [hud, setHud] = useState({ fps: 0, fingers: -1, shape: 0, face: false, color: rgba(IDLE) });
  const [hideHud, setHideHud] = useState(false);
  const [segOk, setSegOk] = useState(true);
  const stopRef = useRef<() => void>(() => {});
  const manualRef = useRef(0);

  useEffect(() => () => stopRef.current(), []);

  const start = async () => {
    setPhase("loading");
    setError("");
    let stream: MediaStream | null = null;
    const det: { face: FaceLandmarker | null; hands: HandLandmarker | null; seg: ImageSegmenter | null } = { face: null, hands: null, seg: null };
    let raf = 0;
    let alive = true;
    const stop = () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      det.face?.close(); det.hands?.close(); det.seg?.close();
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
        try {
          det.seg = await vision.ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: SEG_MODEL, delegate }, runningMode: "VIDEO", outputConfidenceMasks: true, outputCategoryMask: false });
        } catch { det.seg = null; }
      };
      try { await make("GPU"); } catch { await make("CPU"); }
      if (!alive) return stop();
      setSegOk(!!det.seg);
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
      const pcv = personRef.current!, pctx = pcv.getContext("2d")!;
      const slow = innerWidth < 700 || (navigator.hardwareConcurrency ?? 8) <= 4;
      const dpr = Math.min(devicePixelRatio || 1, slow ? 1.5 : 2);
      let W = 0, H = 0;
      const resize = () => {
        W = canvas.clientWidth; H = canvas.clientHeight;
        for (const c of [canvas, pcv]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === " ") { e.preventDefault(); manualRef.current = (manualRef.current + 1) % SHAPES.length; }
        else if (e.key === "f" || e.key === "F") { if (document.fullscreenElement) document.exitFullscreen(); else wrapRef.current?.requestFullscreen?.(); }
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

      // ---- Segmentación de persona (entrada y máscara pequeñas = rápido) ----
      const segIn = document.createElement("canvas"), segCtx = segIn.getContext("2d", { willReadFrequently: false })!;
      const maskCv = document.createElement("canvas"), maskCtx = maskCv.getContext("2d")!;
      let maskImg: ImageData | null = null, hasMask = false;

      // ---- Partículas ----
      const N = slow ? 1600 : 3400;
      const px = new Float32Array(N), py = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N), pz = new Float32Array(N);
      const delay = new Float32Array(N), phaseArr = new Float32Array(N);
      const ea = new Uint16Array(N), eb = new Uint16Array(N), et = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        if (i < 478) { ea[i] = eb[i] = i; et[i] = 0; }
        else { const e = tess[(Math.random() * tess.length) | 0]; ea[i] = e.start; eb[i] = e.end; et[i] = 0.2 + Math.random() * 0.6; }
        phaseArr[i] = Math.random();
      }
      const heartShape = heart(N);
      const shapeData: (Float32Array | null)[] = [null, rose(N), lotus(N), galaxy(N), heartShape, planet(N), heartShape, burst(N)];
      let planetSeen = -1e9, explodeUntil = 0, boom = { x: 0, y: 0, r: 100 };
      let arcs: Pt[][] = [], arcsAt = 0;
      const heartHist: boolean[] = [];
      let heartAt: { x: number; y: number; r: number } | null = null;
      let shape = 0, shapeAt = 0, inited = false;

      const dust = Array.from({ length: slow ? 70 : 150 }, () => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, s: Math.random() * Math.PI * 2 }));
      const sparks: Spark[] = [];
      const MAX_SPARKS = slow ? 220 : 520;

      let tris: [number, number, number][] | null = null;
      let edges: [number, number][] = [];
      let bestSym = Infinity;
      let color: RGB = [...IDLE];
      let sprite = makeSprite(color), spriteAt = 0;
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
      const runSeg = (now: number) => {
        if (!det.seg) return;
        const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
        const sw = 256, sh = Math.max(64, Math.round((256 * vh) / vw));
        if (segIn.width !== sw || segIn.height !== sh) { segIn.width = maskCv.width = sw; segIn.height = maskCv.height = sh; maskImg = maskCtx.createImageData(sw, sh); }
        segCtx.drawImage(video, 0, 0, sw, sh);
        det.seg.segmentForVideo(segIn, now + 0.02, (res) => {
          const m = res.confidenceMasks?.[0];
          if (!m || !maskImg) return;
          const a = m.getAsFloat32Array(), d = maskImg.data;
          for (let i = 0; i < a.length; i++) {
            const v = Math.min(1, Math.max(0, (a[i] - 0.3) / 0.45)); // borde nítido pero suave
            d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = (v * v * (3 - 2 * v) * 255) | 0;
          }
          maskCtx.putImageData(maskImg, 0, 0);
          hasMask = true;
        });
      };

      const detect = (now: number) => {
        if (video.readyState < 2 || video.currentTime === lastVT) return;
        lastVT = video.currentTime;
        const t0 = performance.now();
        turn++;
        // Equipo rápido: todo en cada cuadro. Lento: se turnan (la animación sigue a 60 fps).
        const rr = slow || detCost > 18;
        try {
          if (!rr || turn % 3 !== 2) runFace(now);
          if (!rr || turn % 3 === 2) runHands(now);
          if (!rr ? turn % 2 === 0 : turn % 3 === 1) runSeg(now);
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

        // ---- Persona recortada (encima del código) ----
        if (det.seg && hasMask) {
          const c = cover();
          pctx.clearRect(0, 0, W, H);
          pctx.save();
          pctx.translate(W, 0); pctx.scale(-1, 1);
          pctx.globalCompositeOperation = "source-over";
          pctx.drawImage(video, c.ox, c.oy, c.vw * c.s, c.vh * c.s);
          pctx.globalCompositeOperation = "destination-in";
          pctx.imageSmoothingEnabled = true;
          pctx.drawImage(maskCv, c.ox, c.oy, c.vw * c.s, c.vh * c.s);
          pctx.restore();
        }

        // ---- Dedos → forma y color ----
        const raw = handLm.length ? Math.max(...handLm.map(countFingers)) : -1;
        hist.push(raw); if (hist.length > 7) hist.shift();
        const freq = new Map<number, number>(); hist.forEach((v) => freq.set(v, (freq.get(v) ?? 0) + 1));
        fingersState = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
        // ¿Corazón con las manos? (estable durante varios cuadros)
        const hh = heartHands(handLm, handPts);
        heartHist.push(!!hh); if (heartHist.length > 6) heartHist.shift();
        if (hh) heartAt = hh;
        const heartOn = heartHist.filter(Boolean).length >= 4 && !!heartAt;
        let want = heartOn ? 6 : fingersState >= 0 ? Math.min(5, fingersState) : manualRef.current;
        // Planeta en la palma → al cerrar el puño, explota.
        if (shape === 5) planetSeen = now;
        if (want === 0 && now - planetSeen < 900 && now > explodeUntil) { explodeUntil = now + 1700; boom = { x: ax, y: ay, r: aR }; }
        if (now < explodeUntil && want !== 6) want = 7;
        if (want !== shape) {
          shape = want; shapeAt = now;
          for (let i = 0; i < N; i++) delay[i] = Math.random() * 420; // se arman una por una
          if (shape === 5) for (let i = 0; i < N; i++) delay[i] = (i / N) * 1400 + Math.random() * 120; // se forma de adentro hacia afuera
          if (shape === 7) for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 14; vx[i] += Math.cos(a) * s; vy[i] += Math.sin(a) * s; }
        }
        const tc = shape === 6 ? HEART_RED : shape === 7 ? FIRE : fingersState < 0 ? (shape === 0 ? IDLE : PALETTE[shape]) : PALETTE[Math.min(5, fingersState)];
        const ck = 1 - Math.pow(1 - 0.12, f60);
        color = color.map((v, i) => v + (tc[i] - v) * ck) as RGB;
        if (now - spriteAt > 90) { sprite = makeSprite(color); spriteAt = now; }

        // ---- Interpolación de la cara entre detecciones (60 fps) ----
        if (target) {
          if (!disp) disp = target.map((p) => ({ ...p }));
          const al = 1 - Math.pow(1 - 0.55, f60);
          for (let i = 0; i < 478; i++) { disp[i].x += (target[i].x - disp[i].x) * al; disp[i].y += (target[i].y - disp[i].y) * al; }
        }

        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = "lighter";

        // ---- Polvo del ambiente ----
        for (const d of dust) {
          d.y -= 0.00025 * d.z * f60;
          if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); }
          const x = d.x * W + Math.sin(t * 0.4 + d.s) * 12, y = d.y * H, s = 2 + d.z * 5;
          ctx.globalAlpha = 0.1 + d.z * 0.16;
          ctx.drawImage(sprite, x - s, y - s, s * 2, s * 2);
        }
        ctx.globalAlpha = 1;

        const P = disp;
        // Caja del rostro (para la máscara y para ubicar el holograma al costado).
        let fx0 = W * 0.4, fx1 = W * 0.6, fy0 = H * 0.3, fy1 = H * 0.6, fcx = W / 2, fcy = H * 0.45;
        if (P) {
          fx0 = Infinity; fx1 = -Infinity; fy0 = Infinity; fy1 = -Infinity; fcx = 0; fcy = 0;
          for (const i of OVAL) { const p = P[i]; fx0 = Math.min(fx0, p.x); fx1 = Math.max(fx1, p.x); fy0 = Math.min(fy0, p.y); fy1 = Math.max(fy1, p.y); fcx += p.x; fcy += p.y; }
          fcx /= OVAL.length; fcy /= OVAL.length;

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
          neon(path, color, slow ? 1.3 : 1.5, slow ? 10 : 15);
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
        if (shape === 6 && heartAt) { tx = heartAt.x; ty = heartAt.y; tR = Math.max(50, heartAt.r); }
        if (shape === 7) { tx = boom.x; ty = boom.y; tR = boom.r; }
        if (shape === 5) {
          // Sobre la palma abierta: la mano con más dedos levantados.
          let best = -1, bi = 0;
          handLm.forEach((h, i) => { const c = countFingers(h); if (c > best) { best = c; bi = i; } });
          const Q = handPts[bi];
          if (Q) {
            const cxp = (Q[0].x + Q[5].x + Q[9].x + Q[13].x + Q[17].x) / 5, cyp = (Q[0].y + Q[5].y + Q[9].y + Q[13].y + Q[17].y) / 5;
            const size = Math.hypot(Q[0].x - Q[9].x, Q[0].y - Q[9].y);
            tR = Math.max(36, size * 0.62); tx = cxp; ty = cyp - size * 0.55 - tR * 1.1;
          }
        }
        if (!aInit) { ax = tx; ay = ty; aR = tR; aInit = true; }
        const gk = 1 - Math.pow(1 - (shape === 6 || shape === 5 ? 0.25 : shape === 7 ? 1 : 0.05), f60);
        ax += (tx - ax) * gk; ay += (ty - ay) * gk; aR += (tR - aR) * gk;

        // ---- Objetivo de cada partícula según la forma ----
        const sinceShape = now - shapeAt;
        // Galaxia y planeta giran completos; las flores y el corazón se mecen de frente (con profundidad).
        const yaw = shape === 3 ? t * 0.22 : shape === 5 ? t * 0.6 : shape === 7 ? t * 0.3 : Math.sin(t * 0.55) * 0.6, pitch = shape === 5 ? 0.22 : shape === 1 ? 0.34 : 0.16;
        const S = aR * 0.8;
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
        const pulse = shape === 4 || shape === 6 ? 1 + 0.07 * Math.pow(Math.max(0, Math.sin(t * 5.2)), 6) : 1;
        for (let i = 0; i < N; i++) {
          let X: number, Y: number, Z = 0;
          if (shape === 0) {
            if (!gxs) { X = ax + Math.cos(i) * aR * 0.6; Y = ay + Math.sin(i * 1.7) * aR * 0.6; }
            else {
              const a = ea[i], b = eb[i], k = et[i];
              X = gxs[a] + (gxs[b] - gxs[a]) * k; Y = gys![a] + (gys![b] - gys![a]) * k; Z = gzs![a];
            }
          } else {
            let x = sd![i * 3], y = sd![i * 3 + 1], z = sd![i * 3 + 2];
            if (shape === 5 && i < N * 0.6) {
              // Superficie de plasma que vibra.
              const j = 1 + 0.035 * Math.sin(t * 9 + i * 1.3) * Math.sin(t * 3.1 + i * 0.7);
              x *= j; y *= j; z *= j;
            } else if (shape === 7) {
              // Explosión continua: cada partícula sale del centro y se apaga al alejarse.
              const r = Math.min(1.3, (sinceShape / 1000) * (0.7 + phaseArr[i] * 0.9)), rr = 0.1 + 2.2 * Math.pow(r, 0.6);
              x *= rr; z *= rr; y = y * rr - r * r * 0.35;
            }
            x *= pulse; y *= pulse; z *= pulse * 1.3;
            const x2 = x * cyw + z * syw, z2 = -x * syw + z * cyw;
            const y2 = y * cp - z2 * sp, z3 = y * sp + z2 * cp;
            const per = 1 / (1 + z3 * 0.42);
            X = ax + x2 * S * per; Y = ay - y2 * S * per; Z = z3;
          }
          pz[i] = Z;
          if (!inited) { px[i] = X; py[i] = Y; continue; }
          if (sinceShape >= delay[i]) {
            const k = shape === 7 ? 0.3 : 0.13, damp = Math.pow(shape === 7 ? 0.62 : 0.74, f60);
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
        const planes: [number, number, number, number][] = [[0.28, 9, 0.9, 0.2], [-0.28, 0.28, 1.4, 0.5], [-9, -0.28, 2.2, 0.95]];
        for (const [lo, hi, size, al] of planes) {
          ctx.fillStyle = rgba(color, Math.min(1, al + heartGlow * 0.2));
          const s = size + heartGlow * 0.6;
          for (let i = 0; i < N; i++) { const z = pz[i]; if (z >= lo && z < hi) ctx.fillRect(px[i] - s / 2, py[i] - s / 2, s, s); }
        }
        // Destellos solo en las partículas cercanas (y muchos más en el corazón).
        const step = heartGlow > 0 ? 5 : 23;
        for (let i = 0; i < N; i += step) {
          if (pz[i] < 0.1 && (heartGlow > 0 || 0.5 + 0.5 * Math.sin(t * 3 + i) > 0.8)) {
            const s = heartGlow > 0 ? 6 + heartGlow * 3 : 4;
            ctx.drawImage(sprite, px[i] - s, py[i] - s, s * 2, s * 2);
          }
        }
        if (shape === 7) {
          // Destello de la explosión.
          const fl = Math.max(0, 1 - sinceShape / 500), s = aR * (1 + (1 - fl) * 2.5);
          ctx.globalAlpha = fl; ctx.drawImage(sprite, ax - s, ay - s, s * 2, s * 2); ctx.globalAlpha = 1;
        }
        if (shape === 5) {
          // Núcleo de plasma + rayos eléctricos que saltan del planeta.
          const form = Math.min(1, sinceShape / 1400);
          const sr = S * 0.55, s = sr * (2.1 + 0.15 * Math.sin(t * 7));
          ctx.globalAlpha = 0.45 * form; ctx.drawImage(sprite, ax - s, ay - s, s * 2, s * 2); ctx.globalAlpha = 1;
          if (now - arcsAt > 70) {
            arcsAt = now;
            arcs = Array.from({ length: slow ? 2 : 3 }, () => {
              const a = Math.random() * Math.PI * 2, len = sr * (0.75 + Math.random() * 0.25), pts: Pt[] = [];
              for (let k = 0; k <= 6; k++) {
                const f = k / 6, j = k === 0 || k === 6 ? 0 : (Math.random() - 0.5) * sr * 0.22;
                pts.push({ x: ax + Math.cos(a) * len * f - Math.sin(a) * j, y: ay + Math.sin(a) * len * f + Math.cos(a) * j });
              }
              return pts;
            });
          }
          if (form > 0.6) {
            const ap = new Path2D();
            for (const pl of arcs) { ap.moveTo(pl[0].x, pl[0].y); for (const p of pl) ap.lineTo(p.x, p.y); }
            ctx.globalAlpha = 0.6 * form;
            neon(ap, [170, 215, 255], 0.9, slow ? 6 : 10);
            ctx.globalAlpha = 1;
          }
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
        if (now - fpsT >= 500) { fps = (fpsN * 1000) / (now - fpsT); fpsN = 0; fpsT = now; }
        if (now - hudT > 250) {
          hudT = now;
          setHud({ fps, fingers: fingersState, shape, face: facePresent, color: rgba(color) });
        }
      };
      loop();
    }
  };

  return (
    <div className={`lab${segOk ? "" : " noseg"}`} ref={wrapRef} style={{ ["--lab-c" as string]: hud.color }}>
      <video ref={videoRef} className="lab-video" playsInline muted aria-hidden="true" />
      {phase === "running" && <CodeTyper />}
      <canvas ref={personRef} className="lab-person" aria-hidden="true" />
      <canvas ref={canvasRef} className="lab-canvas" aria-hidden="true" />

      {!hideHud && <Link href="/" className="lab-back" aria-label="Volver a DevWilly">←</Link>}
      <p className="sr-only" aria-live="polite">{phase === "running" ? `Figura: ${hud.shape === 6 ? "corazón" : SHAPES[hud.shape]}` : ""}</p>

      {phase !== "running" && (
        <div className="lab-start">
          <p className="lab-kicker">DevWilly Lab</p>
          <h1>Neon Face Scan</h1>
          <p className="lab-lead">Tu rostro en neón. Tus manos crean las figuras.</p>
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
