"use client";

import gsap from "gsap";

/**
 * Sonidos de los punteros, sintetizados en el navegador (Web Audio): sin archivos
 * que descargar. Paleta "premium": clics (3 variantes), teclas y barra espaciadora,
 * pop al crear, snap al encajar, swipe y caída al arrastrar, pluma, contador,
 * campanita al terminar, whoosh, riser e impacto cinematográfico en la carga.
 * Todo con pequeñas variaciones al azar (tono, volumen, lado) para que nunca suene
 * igual dos veces, y una reverberación suave que da espacio.
 * Se intenta activar solo al cargar la página; si el navegador lo bloquea (regla de
 * reproducción automática), se activa en el primer toque, clic o tecla.
 */
type Ctx = { ac: AudioContext; out: GainNode; verb: GainNode; noise: AudioBuffer };
let S: Ctx | null = null;
let muted = false;
const listeners = new Set<(m: boolean) => void>();
const last: Record<string, number> = {};
const R = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** Crea/reanuda el audio (al cargar, y otra vez con cada gesto hasta que suene). */
export function unlockAudio(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!S) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return Promise.resolve();
    const ac = new AC();
    // Compresor suave: varios punteros a la vez nunca suenan fuerte ni saturan.
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.12;
    comp.connect(ac.destination);
    const out = ac.createGain();
    out.gain.value = 0.55;
    out.connect(comp);
    // Reverberación generada (sala pequeña y elegante).
    const len = Math.floor(ac.sampleRate * 1.4);
    const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const conv = ac.createConvolver();
    conv.buffer = ir;
    const verb = ac.createGain();
    verb.gain.value = 0.2;
    verb.connect(conv).connect(comp);
    const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    S = { ac, out, verb, noise };
  }
  iosUnmute();
  if (S.ac.state === "running") return Promise.resolve();
  // Un búfer silencioso dentro del gesto: algunos iPhone/iPad lo necesitan para "despertar".
  try { const b = S.ac.createBufferSource(); b.buffer = S.ac.createBuffer(1, 1, 22050); b.connect(S.ac.destination); b.start(0); } catch {}
  return S.ac.resume().catch(() => {});
}

/**
 * iPhone: el botón de silencio apaga el audio web. Un <audio> silencioso en bucle
 * cambia la sesión a "reproducción" para que los efectos se oigan igual (como un video).
 */
let iosEl: HTMLAudioElement | null = null;
function iosUnmute() {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";
  } catch {}
  if (iosEl || !/iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) || !("ontouchend" in document)) return;
  const rate = 8000, n = rate / 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true);
  v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  iosEl = document.createElement("audio");
  iosEl.setAttribute("x-webkit-airplay", "deny");
  iosEl.loop = true;
  iosEl.preload = "auto";
  iosEl.src = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  iosEl.play().catch(() => { iosEl = null; });
}

export const isMuted = () => muted;
export const isRunning = () => !!S && S.ac.state === "running";
export function setMuted(m: boolean) {
  muted = m;
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
/**
 * Orden profesional: un sonido a la vez por "carril". Golpes (clic, pop, encaje,
 * caída, campanita) con un respiro entre uno y otro; el aire (whoosh, roce, pluma)
 * nunca se encima; y el tecleo se calla un instante cuando suena un golpe.
 */
const typeOk = () => {
  const n = performance.now();
  if (n - (last.fx ?? -1e9) < 60) return false;
  return gate("key", 45);
};
const at = (d = 0.004) => S!.ac.currentTime + d;

/** Conecta al final de la cadena: lado (pan) + mezcla seca/reverb. */
function route(node: AudioNode, pan = 0, wet = 0) {
  const { ac, out, verb } = S!;
  let n = node;
  if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); n = n.connect(p); }
  n.connect(out);
  if (wet > 0) { const w = ac.createGain(); w.gain.value = wet; n.connect(w).connect(verb); }
}
function env(g: GainNode, t: number, vol: number, atk: number, dur: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
/** Ráfaga corta de ruido filtrado (base de clics, teclas y roces). */
function burst(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, vol: number, pan = 0, wet = 0, atk = 0.0015) {
  const { ac, noise } = S!;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const f = ac.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain();
  env(g, t, vol, atk, dur);
  route(src.connect(f).connect(g), pan, wet);
  src.start(t, Math.random() * 0.8);
  src.stop(t + dur + 0.03);
}
/** Tono con barrido de frecuencia (cuerpo de clics, pops, golpes). */
function tone(t: number, f0: number, f1: number, dur: number, vol: number, type: OscillatorType = "sine", pan = 0, wet = 0, atk = 0.002) {
  const { ac } = S!;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ac.createGain();
  env(g, t, vol, atk, dur);
  route(o.connect(g), pan, wet);
  o.start(t);
  o.stop(t + dur + 0.03);
}
/** Ruido que barre de una frecuencia a otra (whoosh, swipe, riser). */
function sweep(t: number, dur: number, f0: number, f1: number, q: number, vol: number, panFrom: number, panTo: number, wet: number, peak = 0.45) {
  const { ac, noise } = S!;
  const src = ac.createBufferSource();
  src.buffer = noise; src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = "bandpass"; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * peak);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let n: AudioNode = src.connect(f).connect(g);
  if (ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.setValueAtTime(Math.max(-1, Math.min(1, panFrom)), t);
    p.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, panTo)), t + dur);
    n = n.connect(p);
  }
  n.connect(S!.out);
  if (wet) { const w = ac.createGain(); w.gain.value = wet; n.connect(w).connect(S!.verb); }
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}
const panFor = (x?: number) => (x === undefined ? R(-0.2, 0.2) : Math.max(-0.65, Math.min(0.65, (x / innerWidth) * 1.3 - 0.65)));
// Escala pentatónica (suena bien en cualquier combinación).
const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

export const sfx = {
  /** Clic de mouse: 3 variantes (seco, suave, doble) con tono al azar. */
  click(x?: number) {
    if (!ready() || !gate("fx", 150)) return;
    const t = at(0.005), p = panFor(x), k = R(0.85, 1.18), v = pick([0, 1, 2]);
    if (v === 0) {
      burst(t, 0.02, "bandpass", 4300 * k, 1.4, 0.48, p, 0.08);
      tone(t, 1500 * k, 700, 0.03, 0.12, "sine", p);
      burst(t + R(0.05, 0.07), 0.015, "bandpass", 3300 * k, 1.6, 0.2, p);
    } else if (v === 1) {
      burst(t, 0.03, "bandpass", 2600 * k, 1.1, 0.36, p, 0.12);
      tone(t, 900 * k, 380, 0.045, 0.16, "sine", p);
      burst(t + R(0.07, 0.09), 0.02, "bandpass", 2100 * k, 1.3, 0.14, p);
    } else {
      burst(t, 0.016, "highpass", 5200 * k, 0.8, 0.3, p, 0.06);
      burst(t + 0.012, 0.02, "bandpass", 3600 * k, 1.8, 0.34, p);
      tone(t + 0.012, 1200 * k, 600, 0.03, 0.1, "triangle", p);
    }
  },
  /** Tecla: cada una distinta (tono, dureza, lado), como un teclado mecánico real. */
  key(x?: number) {
    if (!ready() || !typeOk()) return;
    const t = at(0.003), p = panFor(x) + R(-0.08, 0.08);
    burst(t, R(0.02, 0.034), "bandpass", R(2200, 4400), R(1.6, 2.8), R(0.22, 0.36), p, 0.05);
    tone(t, R(240, 360), 110, R(0.03, 0.05), R(0.06, 0.1), "sine", p);
    if (Math.random() < 0.35) burst(t + R(0.035, 0.05), 0.012, "bandpass", R(3000, 4200), 2, 0.1, p);
  },
  /** Barra espaciadora: más grave y amplia. */
  space(x?: number) {
    if (!ready() || !typeOk()) return;
    const t = at(0.003), p = panFor(x);
    burst(t, 0.05, "bandpass", R(1100, 1500), 1.2, 0.34, p, 0.08);
    tone(t, R(170, 210), 80, 0.07, 0.14, "sine", p);
  },
  /** Pop burbujeante al crear un elemento. */
  pop(x?: number) {
    if (!ready() || !gate("fx", 150)) return;
    const t = at(0.006), p = panFor(x), f = R(420, 640);
    tone(t, f, f * 2.4, 0.07, 0.22, "sine", p, 0.25, 0.003);
    burst(t, 0.025, "bandpass", f * 4, 3, 0.12, p);
  },
  /** Snap: el marco encaja en su lugar (golpe corto y brillante). */
  snap(x?: number) {
    if (!ready() || !gate("fx", 150)) return;
    const t = at(0.004), p = panFor(x), k = R(0.9, 1.12);
    burst(t, 0.03, "highpass", 3800 * k, 0.9, 0.32, p, 0.2);
    tone(t, 2200 * k, 1700 * k, 0.06, 0.08, "triangle", p, 0.25);
    tone(t + 0.035, 3000 * k, 2600 * k, 0.08, 0.05, "sine", p, 0.3);
  },
  /** Swipe: roce de arrastre (más corto y "de fricción" que el whoosh). */
  swipe(dur = 0.4, x?: number) {
    if (!ready() || !gate("air", 450)) return;
    const p = panFor(x), d = dur * R(0.85, 1.15), f = R(900, 1500);
    sweep(at(0.006), d, f, f * R(2.2, 3), R(2, 3.2), R(0.18, 0.26), p - 0.25, p + 0.25, 0.12, 0.3);
  },
  /** Caída suave al soltar algo en su lugar. */
  drop(x?: number) {
    if (!ready() || !gate("fx", 150)) return;
    const t = at(0.004), p = panFor(x);
    tone(t, R(150, 190), 60, 0.16, 0.26, "sine", p, 0.15);
    burst(t, 0.05, "lowpass", 1400, 0.7, 0.16, p);
  },
  /** Pluma sobre papel (firma). */
  scribble(dur = 0.8, x?: number) {
    if (!ready() || !gate("air", 450)) return;
    const t0 = at(0.006), p = panFor(x), n = Math.round(dur / 0.07);
    for (let i = 0; i < n; i++) burst(t0 + i * 0.07 + R(0, 0.02), R(0.05, 0.09), "bandpass", R(3200, 6000), R(3, 6), R(0.06, 0.12), p, 0.05, 0.01);
  },
  /** Tic del contador (sube de tono según el avance 0–1). */
  tick(progress = 0, x?: number) {
    if (!ready() || !gate("tick", 45)) return;
    const t = at(0.003), f = 900 + progress * 900;
    tone(t, f, f * 0.98, 0.025, 0.06, "square", panFor(x), 0.05);
  },
  /** Campanita de "listo": dos notas pentatónicas con brillo y reverb. */
  chime(x?: number) {
    if (!ready() || !gate("fx", 420)) return;
    const t = at(0.008), p = panFor(x), i = Math.floor(R(0, NOTES.length - 3));
    [NOTES[i], NOTES[i + 2]].forEach((f, k) => {
      tone(t + k * 0.06, f, f, 0.9, 0.07, "sine", p, 0.6, 0.004);
      tone(t + k * 0.06, f * 3.01, f * 3, 0.35, 0.018, "sine", p, 0.6, 0.002);
    });
  },
  /** Golpe grave y cinematográfico (cada letra del PORTFOLIO al llegar). */
  land() {
    if (!ready() || !gate("land", 38)) return;
    const t = at(0.004);
    tone(t, R(120, 145), 42, 0.32, 0.42, "sine", R(-0.3, 0.3), 0.2);
    burst(t, 0.09, "lowpass", R(700, 1100), 0.8, 0.22, 0, 0.15);
  },
  /** Riser: tensión que sube mientras carga. */
  riser(dur = 1.1) {
    if (!ready() || !gate("air", 800)) return;
    const t = at(0.01);
    sweep(t, dur, 200, 4200, 1.4, 0.3, -0.4, 0.4, 0.4, 0.92);
    tone(t, 110, 220, dur, 0.05, "sawtooth", 0, 0.3, dur * 0.8);
  },
  /** Impacto final de la carga: sub-golpe + brillo, con cola de reverb. */
  impact() {
    if (!ready() || !gate("fx", 600)) return;
    const t = at(0.006);
    tone(t, 95, 32, 0.9, 0.6, "sine", 0, 0.35);
    burst(t, 0.35, "lowpass", 1800, 0.7, 0.35, 0, 0.5, 0.004);
    burst(t, 0.12, "highpass", 6000, 0.7, 0.12, 0, 0.6);
  },
  /** Whoosh: aire que cruza de un lado al otro, cada uno distinto. */
  whoosh(dur = 0.5, vol = 0.5, rising = true) {
    if (!ready() || !gate("air", 450)) return;
    const d = dur * R(0.85, 1.2), lo = R(260, 450), hi = R(2000, 3400), dir = Math.random() < 0.5 ? -1 : 1;
    sweep(at(0.01), d, rising ? lo : hi, rising ? hi : lo, R(0.8, 1.4), vol * R(0.8, 1.05), -0.55 * dir, 0.55 * dir, 0.25);
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
