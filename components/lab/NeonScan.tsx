"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker, HandLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import CodeTyper from "./CodeTyper";

/**
 * DevWilly Lab — escáner neón con la cámara.
 * - Cara: máscara low-poly neón (suavizada entre cuadros) + holograma 3D de ~2.000 partículas.
 * - Manos: cuenta los dedos (0–5), cada número con su color; chispas desde las puntas de los dedos.
 *   Mano abierta = el holograma estalla con física; puño = se vuelve a armar partícula por partícula.
 * - Al fondo, un editor escribe en vivo el código del efecto.
 * Todo corre en el dispositivo (MediaPipe en WebAssembly): el video no sale del navegador.
 */
const VER = "1.2.3";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`;
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

type RGB = [number, number, number];
/** Color por número de dedos (0 = puño … 5 = mano abierta). */
const PALETTE: RGB[] = [
  [255, 59, 62], // 0 puño: rojo
  [34, 211, 238], // 1: cian
  [163, 255, 18], // 2: lima
  [255, 194, 61], // 3: dorado
  [124, 92, 255], // 4: violeta
  [255, 61, 242], // 5: magenta
];
const IDLE: RGB = [255, 106, 19]; // sin mano: naranja DevWilly
const GESTURE = ["puño", "uno", "dos", "tres", "cuatro", "mano abierta"];

// Contorno de la cara (en orden) + rasgos: base de la máscara low-poly.
const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const FEATURES = [
  33, 160, 158, 133, 153, 144, 362, 385, 387, 263, 373, 380, // ojos
  70, 105, 107, 336, 334, 300, // cejas
  1, 4, 6, 197, 98, 327, 2, // nariz
  61, 40, 37, 0, 267, 270, 291, 321, 314, 17, 84, 91, // boca
  50, 280, 205, 425, 116, 345, 187, 411, 9, 151, // mejillas y frente
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
type Particle = { x: number; y: number; vx: number; vy: number; ox: number; oy: number; delay: number; a: number; b: number; t: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number };

export default function NeonScan() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [hud, setHud] = useState({ fps: 0, fingers: -1, scattered: false, face: false, color: rgba(IDLE) });
  const [hideHud, setHideHud] = useState(false);
  const stopRef = useRef<() => void>(() => {});
  const manualRef = useRef(false);

  useEffect(() => () => stopRef.current(), []);

  const start = async () => {
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
        det.face = await vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: FACE_MODEL, delegate }, runningMode: "VIDEO", numFaces: 1, minFaceDetectionConfidence: 0.4, minFacePresenceConfidence: 0.4, minTrackingConfidence: 0.4 });
        det.hands = await vision.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: HAND_MODEL, delegate }, runningMode: "VIDEO", numHands: 2 });
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
        if (e.key === " ") { e.preventDefault(); manualRef.current = !manualRef.current; }
        else if (e.key === "f" || e.key === "F") { if (document.fullscreenElement) document.exitFullscreen(); else wrapRef.current?.requestFullscreen?.(); }
        else if (e.key === "h" || e.key === "H") setHideHud((v) => !v);
      };
      addEventListener("resize", resize);
      addEventListener("keydown", onKey);
      const prevStop = stopRef.current;
      stopRef.current = () => { removeEventListener("resize", resize); removeEventListener("keydown", onKey); prevStop(); };

      // Video (cover + espejo) → pantalla.
      const map = (l: NormalizedLandmark): Pt => {
        const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
        const s = Math.max(W / vw, H / vh), ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
        return { x: W - (ox + l.x * vw * s), y: oy + l.y * vh * s };
      };

      // ---- Holograma: 478 puntos del rostro + puntos a lo largo de la malla (más densidad) ----
      const extra = slow ? 700 : 1700;
      const pts: Particle[] = [];
      for (let i = 0; i < 478; i++) pts.push({ x: 0, y: 0, vx: 0, vy: 0, ox: 0, oy: 0, delay: 0, a: i, b: i, t: 0 });
      for (let i = 0; i < extra; i++) {
        const e = tess[(Math.random() * tess.length) | 0];
        pts.push({ x: 0, y: 0, vx: 0, vy: 0, ox: 0, oy: 0, delay: 0, a: e.start, b: e.end, t: 0.2 + Math.random() * 0.6 });
      }
      // ---- Polvo del ambiente ----
      const dust = Array.from({ length: slow ? 70 : 160 }, () => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, s: Math.random() * Math.PI * 2 }));
      // ---- Chispas de los dedos ----
      const sparks: Spark[] = [];
      const MAX_SPARKS = slow ? 220 : 520;

      let tris: [number, number, number][] | null = null;
      let edges: [number, number][] = [];
      let bestSym = Infinity;
      let color: RGB = [...IDLE];
      let sprite = makeSprite(color), spriteAt = 0;
      const hist: number[] = [];
      let scattered = false, wasScattered = false, scanAt = -1e9, lockAt = 0, burstAt = -1e9;
      let rawFace: Pt[] | null = null, rawZ: number[] = [], smooth: Pt[] | null = null, faceSeen = 0;
      let handLm: NormalizedLandmark[][] = [];
      let handPts: Pt[][] = [];
      const prevTips = new Map<number, Pt>();
      let lastVT = -1, turn = 0, detCost = 0;
      let fpsT = performance.now(), fpsN = 0, fps = 0, hudT = 0, last = performance.now();
      let gx = 0, gy = 0, gInit = false;
      let fingersState = -1;

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

      const detect = (now: number) => {
        if (video.readyState < 2 || video.currentTime === lastVT) return;
        lastVT = video.currentTime;
        const t0 = performance.now();
        // Si detectar cuesta mucho, cara y manos se turnan (la animación sigue a 60 fps).
        const alternate = slow || detCost > 14;
        turn++;
        try {
          if (!alternate || turn % 2 === 0) {
            const fr = det.face!.detectForVideo(video, now);
            const lm = fr.faceLandmarks?.[0];
            if (lm) { rawFace = lm.map(map); rawZ = lm.map((l) => l.z ?? 0); faceSeen = now; }
            else if (now - faceSeen > 400) rawFace = null;
          }
          if (!alternate || turn % 2 === 1) {
            const hr = det.hands!.detectForVideo(video, now + 0.01);
            handLm = hr.landmarks ?? [];
            handPts = handLm.map((h) => h.map(map));
          }
        } catch { /* un cuadro fallido no detiene el escáner */ }
        detCost = detCost * 0.8 + (performance.now() - t0) * 0.2;
      };

      const loop = () => {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const f60 = dt * 60; // pasos normalizados a 60 fps (misma velocidad en cualquier equipo)
        detect(now);

        // ---- Dedos y estado (suavizado) ----
        const raw = handLm.length ? Math.max(...handLm.map(countFingers)) : -1;
        hist.push(raw); if (hist.length > 7) hist.shift();
        const freq = new Map<number, number>(); hist.forEach((v) => freq.set(v, (freq.get(v) ?? 0) + 1));
        fingersState = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
        scattered = manualRef.current || fingersState >= 4;
        if (!wasScattered && scattered) {
          burstAt = now;
          for (const p of pts) {
            const ang = Math.random() * Math.PI * 2, sp = 6 + Math.random() * 16;
            p.vx += Math.cos(ang) * sp; p.vy += Math.sin(ang) * sp - 3;
            p.ox = Math.cos(ang) * (140 + Math.random() * 420); p.oy = Math.sin(ang) * (110 + Math.random() * 300) - 40;
          }
        }
        if (wasScattered && !scattered) {
          lockAt = now; scanAt = now + 350;
          for (const p of pts) p.delay = Math.random() * 450; // se arman partícula por partícula
        }
        wasScattered = scattered;
        const target = fingersState < 0 ? IDLE : PALETTE[Math.min(5, fingersState)];
        const ck = 1 - Math.pow(1 - 0.12, f60);
        color = color.map((v, i) => v + (target[i] - v) * ck) as RGB;
        if (now - spriteAt > 90) { sprite = makeSprite(color); spriteAt = now; }

        // ---- Suavizado de la cara (filtro adaptativo: quieto = estable, rápido = sin retraso) ----
        if (rawFace) {
          if (!smooth) smooth = rawFace.map((p) => ({ ...p }));
          else {
            let sp = 0;
            for (let i = 0; i < 478; i += 40) sp += Math.hypot(rawFace[i].x - smooth[i].x, rawFace[i].y - smooth[i].y);
            sp /= 12;
            const al = 1 - Math.pow(1 - Math.min(0.85, 0.32 + sp * 0.035), f60);
            for (let i = 0; i < smooth.length; i++) { smooth[i].x += (rawFace[i].x - smooth[i].x) * al; smooth[i].y += (rawFace[i].y - smooth[i].y) * al; }
          }
        }

        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = "lighter";
        const t = now / 1000;

        // ---- Polvo del ambiente (sube despacio, con un leve vaivén) ----
        for (const d of dust) {
          d.y -= 0.00025 * d.z * f60;
          if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); }
          const x = d.x * W + Math.sin(t * 0.4 + d.s) * 12, y = d.y * H;
          const s = 2 + d.z * 5;
          ctx.globalAlpha = 0.12 + d.z * 0.18;
          ctx.drawImage(sprite, x - s, y - s, s * 2, s * 2);
        }
        ctx.globalAlpha = 1;

        const P = smooth;
        const faceAlpha = rawFace ? 1 : 0.3;
        if (P) {
          // Topología estable; se rehace solo con una vista más de frente.
          const sym = Math.abs(Math.log(Math.hypot(P[1].x - P[234].x, P[1].y - P[234].y) / Math.max(1, Math.hypot(P[1].x - P[454].x, P[1].y - P[454].y))));
          if (rawFace && (!tris || sym < bestSym - 0.12)) {
            bestSym = sym;
            const kp = KEY.map((i) => P[i]);
            const oval = OVAL.map((i) => P[i]);
            tris = delaunay(kp).filter(([a, b, c]) => inside({ x: (kp[a].x + kp[b].x + kp[c].x) / 3, y: (kp[a].y + kp[b].y + kp[c].y) / 3 }, oval));
            const set = new Set<string>();
            for (const [a, b, c] of tris) for (const [u, v] of [[a, b], [b, c], [c, a]]) set.add(u < v ? `${u},${v}` : `${v},${u}`);
            edges = [...set].map((k) => k.split(",").map(Number) as [number, number]);
          }

          // ---- Máscara low-poly: caras con un velo sutil + líneas neón ----
          ctx.globalAlpha = faceAlpha;
          if (tris) {
            ctx.fillStyle = rgba(color, 0.035);
            ctx.beginPath();
            for (const [a, b, c] of tris) { const A = P[KEY[a]], B = P[KEY[b]], C = P[KEY[c]]; ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.closePath(); }
            ctx.fill();
          }
          const path = new Path2D();
          for (const [a, b] of edges) { const A = P[KEY[a]], B = P[KEY[b]]; path.moveTo(A.x, A.y); path.lineTo(B.x, B.y); }
          neon(path, color, slow ? 1.3 : 1.5, slow ? 10 : 15);
          for (const i of KEY) { const p = P[i]; ctx.drawImage(sprite, p.x - 5, p.y - 5, 10, 10); }

          // Barrido de escaneo al volver a armarse.
          const sp = (now - scanAt) / 750;
          if (sp >= 0 && sp <= 1) {
            let top = Infinity, bot = -Infinity, l = Infinity, r = -Infinity;
            for (const i of OVAL) { const p = P[i]; top = Math.min(top, p.y); bot = Math.max(bot, p.y); l = Math.min(l, p.x); r = Math.max(r, p.x); }
            const y = top + (bot - top) * sp;
            const g = ctx.createLinearGradient(0, y - 26, 0, y + 2);
            g.addColorStop(0, rgba(color, 0)); g.addColorStop(1, rgba(color, 0.6 * (1 - sp)));
            ctx.fillStyle = g; ctx.fillRect(l - 24, y - 26, r - l + 48, 28);
          }
          ctx.globalAlpha = 1;

          // ---- Holograma 3D al costado ----
          let cx = 0, cy = 0, minX = Infinity, maxX = -Infinity;
          for (const i of OVAL) { cx += P[i].x; cy += P[i].y; minX = Math.min(minX, P[i].x); maxX = Math.max(maxX, P[i].x); }
          cx /= OVAL.length; cy /= OVAL.length;
          const fw = maxX - minX, scale = 1.25;
          let tx = cx - fw * 1.9;
          if (tx - fw * 0.8 < 0) tx = cx + fw * 1.9;
          if (tx + fw * 0.8 > W) tx = Math.max(fw * 0.8, Math.min(W - fw * 0.8, cx)); // pantalla angosta: detrás del rostro
          const ty = cy - fw * 0.15;
          if (!gInit) { gx = tx; gy = ty; gInit = true; }
          const gk = 1 - Math.pow(1 - 0.06, f60);
          gx += (tx - gx) * gk; gy += (ty - gy) * gk;
          const ang = Math.sin(t * 0.7) * 0.45, ca = Math.cos(ang), sa = Math.sin(ang), zs = fw * 2.2;
          const gxs = new Float32Array(478), gys = new Float32Array(478);
          for (let i = 0; i < 478; i++) {
            const dx = (P[i].x - cx) * scale, dz = -(rawZ[i] ?? 0) * zs;
            gxs[i] = gx + dx * ca + dz * sa; gys[i] = gy + (P[i].y - cy) * scale;
          }
          const sinceLock = now - lockAt;
          for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            const X0 = gxs[p.a] + (gxs[p.b] - gxs[p.a]) * p.t, Y0 = gys[p.a] + (gys[p.b] - gys[p.a]) * p.t;
            if (!p.x && !p.y) { p.x = X0; p.y = Y0; }
            if (scattered) {
              // Flotan en una corriente suave alrededor de su posición dispersa.
              const X = X0 + p.ox + Math.sin(t * 0.9 + i * 0.37) * 22, Y = Y0 + p.oy + Math.cos(t * 0.7 + i * 0.53) * 22;
              p.vx = (p.vx + (X - p.x) * 0.012 * f60) * Math.pow(0.9, f60);
              p.vy = (p.vy + (Y - p.y) * 0.012 * f60) * Math.pow(0.9, f60);
            } else if (sinceLock >= p.delay) {
              // Resorte: vuelve a su lugar con un rebote mínimo.
              p.vx = (p.vx + (X0 - p.x) * 0.14 * f60) * Math.pow(0.72, f60);
              p.vy = (p.vy + (Y0 - p.y) * 0.14 * f60) * Math.pow(0.72, f60);
            } else { p.vx *= 0.95; p.vy *= 0.95; }
            p.x += p.vx * f60 * 0.5; p.y += p.vy * f60 * 0.5;
          }
          // Malla tenue cuando está armado.
          if (!slow && !scattered && now - lockAt > 500) {
            ctx.strokeStyle = rgba(color, 0.07); ctx.lineWidth = 0.6;
            ctx.beginPath();
            for (const c of tess) { const A = pts[c.start], B = pts[c.end]; ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); }
            ctx.stroke();
          }
          const burst = Math.max(0, 1 - (now - burstAt) / 900);
          ctx.fillStyle = rgba(color, 0.62 + burst * 0.3);
          for (let i = 0; i < pts.length; i++) { const p = pts[i], s = i < 478 ? 1.9 : 1.3; ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s); }
          // Algunas partículas brillan más (destellos que recorren el holograma).
          for (let i = 0; i < pts.length; i += 23) {
            const tw = 0.5 + 0.5 * Math.sin(t * 3 + i);
            if (tw > 0.8) { const p = pts[i]; ctx.drawImage(sprite, p.x - 4, p.y - 4, 8, 8); }
          }
        }

        // ---- Manos: esqueleto neón + chispas desde las puntas ----
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

        // ---- FPS y panel ----
        fpsN++;
        if (now - fpsT >= 500) { fps = (fpsN * 1000) / (now - fpsT); fpsN = 0; fpsT = now; }
        if (now - hudT > 250) {
          hudT = now;
          setHud({ fps, fingers: fingersState, scattered, face: !!rawFace, color: rgba(color) });
        }
      };
      loop();
    }
  };

  const fingerText = hud.fingers < 0 ? "—" : String(hud.fingers);
  return (
    <div className="lab" ref={wrapRef} style={{ ["--lab-c" as string]: hud.color }}>
      <video ref={videoRef} className="lab-video" playsInline muted aria-hidden="true" />
      {phase === "running" && <CodeTyper />}
      <canvas ref={canvasRef} className="lab-canvas" aria-hidden="true" />

      <header className="lab-top">
        <Link href="/" className="lab-back">← DevWilly</Link>
        <span className="lab-brand">Lab · Neon Face Scan</span>
      </header>

      {phase === "running" && !hideHud && (
        <>
          <div className="lab-hud" aria-live="polite">
            <p><span>escáner</span> <b>{!hud.face ? "buscando rostro" : hud.scattered ? "disperso" : "fijado"}</b></p>
            <p><span>dedos</span> <b>{fingerText}</b></p>
            <p><span>gesto</span> <b>{hud.fingers < 0 ? "sin mano" : GESTURE[Math.min(5, hud.fingers)]}</b></p>
          </div>
          <div className="lab-fps">FPS: {hud.fps.toFixed(1)}</div>
          <div className="lab-keys">
            <span><kbd>espacio</kbd> dispersar</span>
            <span><kbd>f</kbd> pantalla completa</span>
            <span><kbd>h</kbd> ocultar panel</span>
          </div>
        </>
      )}

      {phase !== "running" && (
        <div className="lab-start">
          <p className="lab-kicker">DevWilly Lab</p>
          <h1>Neon Face Scan</h1>
          <p className="lab-lead">
            Activa tu cámara: una máscara neón sigue tu rostro y tus manos la controlan.
            Muestra de 0 a 5 dedos para cambiar el color; abre la mano para dispersar el holograma y ciérrala para volver a armarlo.
          </p>
          {phase === "error" && <p className="lab-error" role="alert">{error}</p>}
          <button type="button" className="lab-btn" onClick={start} disabled={phase === "loading"}>
            {phase === "loading" ? "Cargando escáner…" : phase === "error" ? "Intentar de nuevo" : "Activar cámara"}
          </button>
          <p className="lab-note">Todo se procesa en tu dispositivo. El video no se graba ni se envía a ningún lugar.</p>
          <ul className="lab-legend" aria-label="Colores por número de dedos">
            {PALETTE.map((c, i) => (
              <li key={i}><i style={{ background: rgba(c) }} />{i}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
