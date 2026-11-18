"use client";

import gsap from "gsap";

/**
 * Sonidos de los punteros, sintetizados en el navegador (Web Audio): sin archivos
 * que descargar. Clic de mouse, tecleo y "whoosh" de movimiento.
 * Los navegadores solo dejan sonar audio después del primer toque, clic o tecla:
 * hasta entonces todo queda en silencio. Se puede silenciar (se recuerda).
 */
type Ctx = { ac: AudioContext; out: GainNode; noise: AudioBuffer };
let S: Ctx | null = null;
let muted = false;
const listeners = new Set<(m: boolean) => void>();
const last: Record<string, number> = {};

try { muted = localStorage.getItem("pf-sound") === "off"; } catch {}

/** Crea/reanuda el audio. Debe llamarse desde un gesto del usuario. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!S) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    // Compresor suave: varios punteros a la vez nunca suenan fuerte ni saturan.
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.12;
    const out = ac.createGain();
    out.gain.value = 0.55;
    out.connect(comp).connect(ac.destination);
    const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    S = { ac, out, noise };
  }
  if (S.ac.state === "suspended") S.ac.resume().catch(() => {});
}

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem("pf-sound", m ? "off" : "on"); } catch {}
  if (!m) unlockAudio();
  listeners.forEach((f) => f(m));
}
export function onMuteChange(f: (m: boolean) => void) { listeners.add(f); return () => { listeners.delete(f); }; }

const ready = () => !!S && S.ac.state === "running" && !muted && !document.hidden;
const gate = (k: string, ms: number) => {
  const n = performance.now();
  if (n - (last[k] ?? -1e9) < ms) return false;
  last[k] = n;
  return true;
};

/** Ráfaga corta de ruido filtrado (la base de clics y teclas). */
function burst(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, vol: number, pan = 0) {
  const { ac, out, noise } = S!;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const f = ac.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.0015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = src.connect(f).connect(g);
  if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
  node.connect(out);
  src.start(t, Math.random() * 0.8);
  src.stop(t + dur + 0.02);
}
/** Golpe tonal muy corto (da "cuerpo" al clic/tecla). */
function thump(t: number, f0: number, f1: number, dur: number, vol: number) {
  const { ac, out } = S!;
  const o = ac.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const panFor = (x?: number) => (x === undefined ? 0 : Math.max(-0.6, Math.min(0.6, (x / innerWidth) * 1.2 - 0.6)));

export const sfx = {
  /** Clic de mouse: presión + liberación. `x` (px) ubica el sonido a la izquierda/derecha. */
  click(x?: number) {
    if (!ready() || !gate("click", 70)) return;
    const t = S!.ac.currentTime + 0.005, p = panFor(x);
    burst(t, 0.022, "bandpass", 4200, 1.4, 0.5, p);
    thump(t, 1400, 700, 0.03, 0.12);
    burst(t + 0.06, 0.016, "bandpass", 3200, 1.6, 0.22, p);
  },
  /** Tecla: cada una con un tono un poco distinto, como un teclado real. */
  key(x?: number) {
    if (!ready() || !gate("key", 32)) return;
    const t = S!.ac.currentTime + 0.003, p = panFor(x);
    burst(t, 0.028, "bandpass", 2400 + Math.random() * 1800, 2.2, 0.26 + Math.random() * 0.1, p);
    thump(t, 260 + Math.random() * 80, 120, 0.04, 0.08);
  },
  /** Whoosh: ruido que sube (o baja) de tono y cruza de un lado al otro. */
  whoosh(dur = 0.5, vol = 0.5, rising = true) {
    if (!ready() || !gate("whoosh", 220)) return;
    const { ac, out, noise } = S!;
    const t = ac.currentTime + 0.01;
    const src = ac.createBufferSource();
    src.buffer = noise; src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = "bandpass"; f.Q.value = 1.1;
    f.frequency.setValueAtTime(rising ? 350 : 2600, t);
    f.frequency.exponentialRampToValueAtTime(rising ? 2600 : 350, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = src.connect(f).connect(g);
    if (ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.setValueAtTime(-0.5, t);
      p.pan.linearRampToValueAtTime(0.5, t + dur);
      node = node.connect(p);
    }
    node.connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  },
};

/** Para timelines ligados al scroll: el sonido solo se oye al avanzar (bajando), no al retroceder. */
export function cue(tl: gsap.core.Timeline, play: () => void, pos?: gsap.Position) {
  tl.call(() => {
    const st = tl.scrollTrigger;
    if (st && st.direction < 0) return;
    if (tl.reversed()) return;
    play();
  }, undefined, pos);
}
