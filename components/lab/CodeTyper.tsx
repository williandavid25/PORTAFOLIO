"use client";

import { useEffect, useRef } from "react";

/**
 * Editor de fondo: escribe en vivo (letra por letra, con resaltado de sintaxis y cursor)
 * el código del propio efecto, como en un video de "making of". Va detrás del lienzo,
 * así las partículas pasan por encima. Al terminar, vuelve a empezar.
 */
const CODE = `// neon-face-scan.ts — DevWilly Lab
import { FaceLandmarker, HandLandmarker } from "@mediapipe/tasks-vision";

const PALETTE = ["#ff3b3e", "#22d3ee", "#a3ff12", "#ffc23d", "#7c5cff", "#ff3df2"];

/* ----------------------------------------------------------
 * Contar dedos: punta más lejos de la muñeca = dedo arriba
 * -------------------------------------------------------- */
function countFingers(hand) {
  let up = 0;
  if (dist(hand[4], hand[17]) > dist(hand[3], hand[17]) * 1.08) up++;
  for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) {
    if (dist(hand[tip], hand[0]) > dist(hand[pip], hand[0]) * 1.12) up++;
  }
  return up;
}

/* ----------------------------------------------------------
 * Máscara low-poly: Delaunay sobre puntos clave del rostro
 * -------------------------------------------------------- */
function drawWireframe(ctx, face, color) {
  const path = new Path2D();
  for (const [a, b] of edges) {
    path.moveTo(face[a].x, face[a].y);
    path.lineTo(face[b].x, face[b].y);
  }
  neonPath(ctx, path, color, 1.5, 15);
}

function neonPath(ctx, path, color, width, glow) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = width * 0.35;
  ctx.stroke(path);
  ctx.restore();
}

/* ----------------------------------------------------------
 * Holograma: 2.000 partículas con física de resorte
 * -------------------------------------------------------- */
function updateParticles(points, target, scattered, dt) {
  for (const p of points) {
    const k = scattered ? 0.012 : 0.14;
    p.vx = (p.vx + (target(p).x - p.x) * k) * 0.72;
    p.vy = (p.vy + (target(p).y - p.y) * k) * 0.72;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

async function loop(now) {
  const face = faceLandmarker.detectForVideo(video, now);
  const hands = handLandmarker.detectForVideo(video, now);
  const fingers = Math.max(0, ...hands.landmarks.map(countFingers));
  const color = PALETTE[fingers];
  const scattered = fingers >= 4; // mano abierta = dispersar

  drawWireframe(ctx, smooth(face), color);
  updateParticles(hologram, ghostTarget, scattered, 1);
  requestAnimationFrame(loop);
}
`;

const KW = /\b(const|let|var|function|return|if|else|for|of|in|new|import|from|export|await|async|while|true|false)\b/;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Resaltado simple al estilo de VS Code (oscuro). */
function highlight(line: string) {
  const ci = line.search(/\/\/|\/\*|^\s*\*/);
  const code = ci >= 0 ? line.slice(0, ci) : line;
  const comment = ci >= 0 ? line.slice(ci) : "";
  const re = /("[^"]*"?|'[^']*'?|`[^`]*`?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z_$\d"'`]+)/g;
  let out = "", m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m[1]) out += `<i class="s">${esc(m[1])}</i>`;
    else if (m[2]) out += `<i class="n">${m[2]}</i>`;
    else if (m[3]) out += KW.test(m[3]) ? `<i class="k">${m[3]}</i>` : `<i class="f">${m[3]}</i>`;
    else if (m[4]) out += KW.test(m[4]) ? `<i class="k">${m[4]}</i>` : /^[A-Z]/.test(m[4]) ? `<i class="t">${m[4]}</i>` : `<i class="v">${m[4]}</i>`;
    else if (m[5]) out += m[5];
    else if (m[6]) out += `<i class="p">${esc(m[6])}</i>`;
  }
  if (comment) out += `<i class="c">${esc(comment)}</i>`;
  return out;
}

export default function CodeTyper() {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const lines = CODE.split("\n");
    let li = 0, ci = 0, timer = 0, cur: HTMLDivElement | null = null;
    const MAX = 60; // líneas que se conservan (las viejas suben y se van)

    const newLine = () => {
      const row = document.createElement("div");
      row.className = "ln";
      row.innerHTML = `<b>${li + 1}</b><span></span><em class="caret"></em>`;
      body.appendChild(row);
      while (body.children.length > MAX) body.firstElementChild?.remove();
      cur = row;
    };
    const render = (done = false) => {
      if (!cur) return;
      const span = cur.querySelector("span")!;
      span.innerHTML = highlight(lines[li].slice(0, ci));
      if (done) cur.querySelector(".caret")?.remove();
      body.scrollTop = body.scrollHeight;
    };
    const step = () => {
      if (li >= lines.length) {
        // Terminó: pausa, se desvanece y vuelve a escribir desde el inicio.
        timer = window.setTimeout(() => {
          body.classList.add("fade");
          timer = window.setTimeout(() => { body.innerHTML = ""; body.classList.remove("fade"); li = 0; ci = 0; newLine(); step(); }, 700);
        }, 2600);
        return;
      }
      const line = lines[li];
      if (ci === 0) {
        // La sangría aparece de una vez (como el autoindentado del editor).
        ci = line.length - line.trimStart().length;
      }
      if (ci < line.length) {
        ci += 1 + (Math.random() < 0.55 ? 1 : 0) + (Math.random() < 0.2 ? 1 : 0);
        ci = Math.min(ci, line.length);
        render();
        const ch = line[ci - 1];
        timer = window.setTimeout(step, ch === " " ? 22 : 14 + Math.random() * 22);
      } else {
        render(true);
        li++; ci = 0;
        if (li < lines.length) newLine();
        timer = window.setTimeout(step, line.trim() === "" ? 60 : 90 + Math.random() * 110);
      }
    };
    newLine();
    step();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="lab-code" aria-hidden="true">
      <div className="lab-code-bar"><i /><i /><i /><span>neon-face-scan.ts</span></div>
      <div className="lab-code-body" ref={bodyRef} />
    </div>
  );
}
