"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker, HandLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

/**
 * DevWilly Lab — escáner neón con la cámara.
 * - Cara: máscara low-poly neón sobre el rostro + un holograma de puntos al costado.
 * - Manos: cuenta los dedos levantados; cada número tiene su color.
 *   Mano abierta (4–5 dedos) = el holograma se dispersa; puño = se vuelve a armar.
 * Todo se procesa en el dispositivo (MediaPipe en WebAssembly): el video no sale del navegador.
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
/** Triangulación de Delaunay (Bowyer–Watson). Se calcula una sola vez con la primera cara. */
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
  // Pulgar: la punta se aleja de la base del meñique más que su articulación.
  if (dist(4, 17) > dist(3, 17) * 1.08 && dist(4, 5) > dist(3, 5)) n++;
  // Índice, medio, anular, meñique: la punta está más lejos de la muñeca que la articulación media.
  for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) if (dist(tip, 0) > dist(pip, 0) * 1.12) n++;
  return n;
}

const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

type Phase = "idle" | "loading" | "running" | "error";

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
      // 1) Cámara frontal.
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      // 2) Detectores (GPU; si no hay, CPU).
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
      addEventListener("resize", resize);
      const prevStop = stopRef.current;
      stopRef.current = () => { removeEventListener("resize", resize); removeEventListener("keydown", onKey); prevStop(); };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === " ") { e.preventDefault(); manualRef.current = !manualRef.current; }
        else if (e.key === "f" || e.key === "F") { if (document.fullscreenElement) document.exitFullscreen(); else wrapRef.current?.requestFullscreen?.(); }
        else if (e.key === "h" || e.key === "H") setHideHud((v) => !v);
      };
      addEventListener("keydown", onKey);

      // Video (cover + espejo) → pantalla.
      const map = (l: NormalizedLandmark): Pt => {
        const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
        const s = Math.max(W / vw, H / vh), ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
        return { x: W - (ox + l.x * vw * s), y: oy + l.y * vh * s };
      };

      let tris: [number, number, number][] | null = null;
      let edges: [number, number][] = [];
      const ghost = Array.from({ length: 478 }, () => ({ x: 0, y: 0, ox: 0, oy: 0, init: false }));
      let color: RGB = [...IDLE];
      const hist: number[] = [];
      let scattered = false, wasScattered = false, scanAt = 0, lastLm: NormalizedLandmark[] | null = null;
      let faceLm: NormalizedLandmark[] | null = null, handLm: NormalizedLandmark[][] = [];
      let frame = 0, lastVT = -1, fpsT = performance.now(), fpsN = 0, fps = 0, hudT = 0;
      let gx = 0, gy = 0, gInit = false, bestSym = Infinity;

      const neon = (path: Path2D, c: RGB, width: number, glow: number) => {
        ctx.save();
        ctx.lineJoin = "round"; ctx.lineCap = "round";
        ctx.shadowColor = rgba(c); ctx.shadowBlur = glow;
        ctx.strokeStyle = rgba(c, 0.95); ctx.lineWidth = width;
        ctx.stroke(path);
        if (!slow) ctx.stroke(path);
        ctx.shadowBlur = glow * 0.35;
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = Math.max(0.5, width * 0.35);
        ctx.stroke(path);
        ctx.restore();
      };

      const loop = () => {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        const now = performance.now();
        // ---- Detección (solo cuando hay un cuadro nuevo de la cámara) ----
        if (video.readyState >= 2 && video.currentTime !== lastVT) {
          lastVT = video.currentTime;
          frame++;
          try {
            const fr = det.face!.detectForVideo(video, now);
            faceLm = fr.faceLandmarks?.[0] ?? null;
            if (!slow || frame % 2 === 0) {
              const hr = det.hands!.detectForVideo(video, now + 0.01);
              handLm = hr.landmarks ?? [];
            }
          } catch { /* un cuadro fallido no detiene el escáner */ }
        }
        // ---- Dedos y estado (suavizado con los últimos cuadros) ----
        const raw = handLm.length ? Math.max(...handLm.map(countFingers)) : -1;
        hist.push(raw); if (hist.length > 7) hist.shift();
        const freq = new Map<number, number>(); hist.forEach((v) => freq.set(v, (freq.get(v) ?? 0) + 1));
        const fingers = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
        scattered = manualRef.current || fingers >= 4;
        if (wasScattered && !scattered) scanAt = now; // se vuelve a armar: barrido de escaneo
        if (!wasScattered && scattered) ghost.forEach((g) => { const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 380; g.ox = Math.cos(a) * r; g.oy = Math.sin(a) * r - 60; });
        wasScattered = scattered;
        const target = fingers < 0 ? IDLE : PALETTE[Math.min(5, fingers)];
        color = color.map((v, i) => v + (target[i] - v) * 0.12) as RGB;

        // ---- Dibujo ----
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = "lighter";
        const lm = faceLm ?? lastLm;
        if (faceLm) lastLm = faceLm;
        if (lm) {
          const P = lm.map(map);
          // Topología fija (la máscara no "parpadea"). Se rehace solo si aparece una vista
          // más de frente que la usada, para que la malla quede simétrica.
          const sym = Math.abs(Math.log(Math.hypot(P[1].x - P[234].x, P[1].y - P[234].y) / Math.max(1, Math.hypot(P[1].x - P[454].x, P[1].y - P[454].y))));
          if (faceLm && (!tris || sym < bestSym - 0.12)) {
            bestSym = sym;
            const kp = KEY.map((i) => P[i]);
            const oval = OVAL.map((i) => P[i]);
            tris = delaunay(kp).filter(([a, b, c]) => inside({ x: (kp[a].x + kp[b].x + kp[c].x) / 3, y: (kp[a].y + kp[b].y + kp[c].y) / 3 }, oval));
            const set = new Set<string>();
            for (const [a, b, c] of tris) for (const [u, v] of [[a, b], [b, c], [c, a]]) set.add(u < v ? `${u},${v}` : `${v},${u}`);
            edges = [...set].map((k) => k.split(",").map(Number) as [number, number]);
          }
          const fade = faceLm ? 1 : 0.35;
          // Máscara low-poly neón.
          const path = new Path2D();
          for (const [a, b] of edges) { const A = P[KEY[a]], B = P[KEY[b]]; path.moveTo(A.x, A.y); path.lineTo(B.x, B.y); }
          ctx.globalAlpha = fade;
          neon(path, color, slow ? 1.4 : 1.6, slow ? 10 : 16);
          // Vértices brillantes.
          ctx.fillStyle = rgba(color, 0.9);
          for (const i of KEY) { const p = P[i]; ctx.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4); }
          // Barrido de escaneo al volver a armarse.
          const sp = (now - scanAt) / 700;
          if (sp >= 0 && sp <= 1) {
            let top = Infinity, bot = -Infinity, l = Infinity, r = -Infinity;
            for (const i of OVAL) { const p = P[i]; top = Math.min(top, p.y); bot = Math.max(bot, p.y); l = Math.min(l, p.x); r = Math.max(r, p.x); }
            const y = top + (bot - top) * sp;
            const g = ctx.createLinearGradient(0, y - 18, 0, y + 2);
            g.addColorStop(0, rgba(color, 0)); g.addColorStop(1, rgba(color, 0.55 * (1 - sp)));
            ctx.fillStyle = g; ctx.fillRect(l - 20, y - 18, r - l + 40, 20);
          }
          ctx.globalAlpha = 1;

          // ---- Holograma de puntos al costado ----
          let cx = 0, cy = 0, minX = Infinity, maxX = -Infinity;
          for (const i of OVAL) { cx += P[i].x; cy += P[i].y; minX = Math.min(minX, P[i].x); maxX = Math.max(maxX, P[i].x); }
          cx /= OVAL.length; cy /= OVAL.length;
          const fw = maxX - minX, scale = 1.25;
          let tx = cx - fw * 1.9;
          if (tx - fw * 0.8 < 0) tx = cx + fw * 1.9; // sin espacio a la izquierda: a la derecha
          const ty = cy - fw * 0.15;
          if (!gInit) { gx = tx; gy = ty; gInit = true; }
          gx += (tx - gx) * 0.06; gy += (ty - gy) * 0.06;
          const t = now / 1000, ang = Math.sin(t * 0.7) * 0.45, ca = Math.cos(ang), sa = Math.sin(ang);
          const zs = fw * 2.2;
          const G = P.map((p, i) => {
            const dx = (p.x - cx) * scale, dz = -(lm[i].z ?? 0) * zs;
            return { x: gx + dx * ca + dz * sa, y: gy + (p.y - cy) * scale };
          });
          const k = scattered ? 0.05 : 0.11;
          ghost.forEach((g, i) => {
            const T = G[i];
            const drift = scattered ? Math.sin(t * 1.3 + i) * 14 : 0;
            const X = T.x + (scattered ? g.ox + drift : 0), Y = T.y + (scattered ? g.oy + Math.cos(t * 1.1 + i * 0.7) * 14 : 0);
            if (!g.init) { g.x = X; g.y = Y; g.init = true; }
            g.x += (X - g.x) * k; g.y += (Y - g.y) * k;
          });
          // Malla tenue (solo armado y en equipos con margen).
          if (!slow && !scattered) {
            ctx.strokeStyle = rgba(color, 0.09); ctx.lineWidth = 0.6;
            ctx.beginPath();
            for (const c of tess) { const A = ghost[c.start], B = ghost[c.end]; ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); }
            ctx.stroke();
          }
          ctx.fillStyle = rgba(color, 0.75);
          for (const g of ghost) ctx.fillRect(g.x - 0.9, g.y - 0.9, 1.8, 1.8);
        }

        // ---- Manos: esqueleto tenue + puntas brillantes ----
        if (handLm.length) {
          for (const h of handLm) {
            const Q = h.map(map);
            const hp = new Path2D();
            for (const c of handConn) { hp.moveTo(Q[c.start].x, Q[c.start].y); hp.lineTo(Q[c.end].x, Q[c.end].y); }
            ctx.globalAlpha = 0.45;
            neon(hp, color, 1, slow ? 6 : 10);
            ctx.globalAlpha = 1;
            ctx.fillStyle = rgba(color, 1);
            for (const tip of [4, 8, 12, 16, 20]) { const p = Q[tip]; ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2); ctx.fill(); }
          }
        }
        ctx.globalCompositeOperation = "source-over";

        // ---- FPS y panel (actualizado 4 veces por segundo) ----
        fpsN++;
        if (now - fpsT >= 500) { fps = (fpsN * 1000) / (now - fpsT); fpsN = 0; fpsT = now; }
        if (now - hudT > 250) {
          hudT = now;
          setHud({ fps, fingers, scattered, face: !!faceLm, color: rgba(color) });
        }
      };
      loop();
    }
  };

  const fingerText = hud.fingers < 0 ? "—" : String(hud.fingers);
  return (
    <div className="lab" ref={wrapRef} style={{ ["--lab-c" as string]: hud.color }}>
      <video ref={videoRef} className="lab-video" playsInline muted aria-hidden="true" />
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
