"use client";

import gsap from "gsap";

/**
 * Diseño de sonido de los punteros, 100 % en código (Web Audio, sin archivos).
 *
 * Cada acción tiene su propio sonido, con un timbre distinto:
 *   clic de interfaz · presionar · pop (crear) · estirar (banda elástica) · encajar (madera)
 *   deslizar (fricción) · soltar · seleccionar (cristal) · tecla / barra espaciadora
 *   pluma · contador · campanita (FM) · whoosh (2 capas + sub) · riser e impacto (carga)
 *
 * Mezclador: solo UN sonido principal a la vez. Uno nuevo suena si el anterior ya
 * terminó o si es más importante; si no, se omite. El tecleo y el contador van de fondo
 * y bajan de volumen mientras suena el principal. Así nada se encima.
 *
 * El audio se intenta activar al cargar; los navegadores exigen un toque, así que
 * también se activa con el primer toque, clic o tecla (y con «Entrar» en la carga).
 */
type Ctx = { ac: AudioContext; out: GainNode; verb: GainNode; white: AudioBuffer; pink: AudioBuffer };
let S: Ctx | null = null;
let muted = false;
const listeners = new Set<(m: boolean) => void>();
const R = (a: number, b: number) => a + Math.random() * (b - a);
const clampPan = (p: number) => Math.max(-1, Math.min(1, p));

/** Crea/reanuda el audio (al cargar, y otra vez con cada gesto hasta que suene). */
export function unlockAudio(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!S) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return Promise.resolve();
    const ac = new AC();
    // Compresor suave: nunca satura, aunque varios punteros trabajen a la vez.
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
    comp.connect(ac.destination);
    const out = ac.createGain();
    out.gain.value = 0.7;
    out.connect(comp);
    // Reverberación generada: sala corta y limpia.
    const len = Math.floor(ac.sampleRate * 1.2);
    const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.6);
    }
    const conv = ac.createConvolver();
    conv.buffer = ir;
    const verb = ac.createGain();
    verb.gain.value = 0.18;
    verb.connect(conv).connect(comp);
    // Ruido blanco (brillo) y rosa (cuerpo, más natural para aire y roces).
    const white = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const pink = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const w = white.getChannelData(0), p = pink.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < w.length; i++) {
      const x = Math.random() * 2 - 1;
      w[i] = x;
      b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
      b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
      p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11;
      b6 = x * 0.115926;
    }
    S = { ac, out, verb, white, pink };
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

// ---------------------------------------------------------------- mezclador
/** Sonido principal en curso: hasta cuándo ocupa el espacio y qué tan importante es. */
let lead = { until: 0, prio: 0 };
/** Reserva el espacio para un sonido principal. false = se omite (no se encima). */
function claim(prio: number, holdMs: number) {
  const n = performance.now();
  if (n < lead.until && prio <= lead.prio) return false;
  lead = { until: n + holdMs, prio };
  return true;
}
/** Sonidos de fondo (tecleo, contador): su propio ritmo y más bajos si suena un principal. */
const bedLast: Record<string, number> = {};
function bed(k: string, ms: number) {
  const n = performance.now();
  if (n - (bedLast[k] ?? -1e9) < ms) return 0;
  bedLast[k] = n;
  return n < lead.until ? 0.4 : 1;
}

// ---------------------------------------------------------------- piezas
const at = (d = 0.004) => S!.ac.currentTime + d;
function route(node: AudioNode, pan = 0, wet = 0) {
  const { ac, out, verb } = S!;
  let n = node;
  if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clampPan(pan); n = n.connect(p); }
  n.connect(out);
  if (wet > 0) { const g = ac.createGain(); g.gain.value = wet; n.connect(g).connect(verb); }
}
function env(g: AudioParam, t: number, vol: number, atk: number, dur: number) {
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + atk);
  g.exponentialRampToValueAtTime(0.0001, t + dur);
}
type NoiseOpt = { color?: "white" | "pink"; type: BiquadFilterType; f: number; f1?: number; q: number; vol: number; atk?: number; pan?: number; wet?: number };
/** Ruido filtrado con envolvente (transitorios, roces, aire). */
function noise(t: number, dur: number, o: NoiseOpt) {
  const { ac } = S!;
  const src = ac.createBufferSource();
  src.buffer = o.color === "pink" ? S!.pink : S!.white;
  const f = ac.createBiquadFilter();
  f.type = o.type; f.Q.value = o.q;
  f.frequency.setValueAtTime(o.f, t);
  if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
  const g = ac.createGain();
  env(g.gain, t, o.vol, o.atk ?? 0.0015, dur);
  route(src.connect(f).connect(g), o.pan ?? 0, o.wet ?? 0);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.03);
}
type ToneOpt = { type?: OscillatorType; f: number; f1?: number; vol: number; atk?: number; pan?: number; wet?: number; lp?: number };
/** Tono con barrido opcional y filtro paso bajo opcional. */
function tone(t: number, dur: number, o: ToneOpt) {
  const { ac } = S!;
  const osc = ac.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur);
  const g = ac.createGain();
  env(g.gain, t, o.vol, o.atk ?? 0.002, dur);
  let n: AudioNode = osc;
  if (o.lp) { const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; n = n.connect(f); }
  route(n.connect(g), o.pan ?? 0, o.wet ?? 0);
  osc.start(t);
  osc.stop(t + dur + 0.03);
  return osc;
}
/** Paneo que viaja de un lado a otro (movimiento en el espacio). */
function travel(node: AudioNode, t: number, dur: number, from: number, to: number) {
  const { ac } = S!;
  if (!ac.createStereoPanner) return node;
  const p = ac.createStereoPanner();
  p.pan.setValueAtTime(clampPan(from), t);
  p.pan.linearRampToValueAtTime(clampPan(to), t + dur);
  return node.connect(p);
}
const panFor = (x?: number) => (x === undefined ? R(-0.15, 0.15) : Math.max(-0.6, Math.min(0.6, (x / innerWidth) * 1.2 - 0.6)));
// Pentatónica mayor (do): cualquier par de notas suena bien.
const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98];

// ---------------------------------------------------------------- sonidos
export const sfx = {
  /** Clic de interfaz: transitorio fino + cuerpo de cristal corto + liberación. */
  click(x?: number) {
    if (!ready() || !claim(2, 110)) return;
    const t = at(), p = panFor(x), k = R(0.92, 1.1);
    noise(t, 0.008, { type: "highpass", f: 2500, q: 0.7, vol: 0.32, pan: p });
    tone(t, 0.028, { f: 3100 * k, f1: 2600 * k, vol: 0.07, pan: p, wet: 0.08 });
    noise(t + R(0.055, 0.07), 0.01, { type: "bandpass", f: 3800 * k, q: 1.5, vol: 0.12, pan: p });
  },
  /** Presionar para agarrar (antes de arrastrar o estirar): más grave y corto. */
  press(x?: number) {
    if (!ready() || !claim(2, 90)) return;
    const t = at(), p = panFor(x);
    noise(t, 0.014, { type: "bandpass", f: R(1600, 2000), q: 1.2, vol: 0.26, pan: p });
    tone(t, 0.03, { f: 760, f1: 480, vol: 0.08, pan: p });
  },
  /** Pop: aparece un elemento nuevo (burbuja que sube de tono). */
  pop(x?: number) {
    if (!ready() || !claim(3, 140)) return;
    const t = at(), p = panFor(x), f = R(260, 340);
    tone(t, 0.06, { f, f1: f * 3, vol: 0.18, pan: p, wet: 0.2, atk: 0.003 });
    noise(t, 0.012, { type: "bandpass", f: 2400, q: 2, vol: 0.08, pan: p });
  },
  /** Estirar: banda elástica que sube de tono mientras el marco crece. */
  stretch(dur = 0.5, x?: number) {
    if (!ready() || !claim(3, dur * 800)) return;
    const { ac } = S!;
    const t = at(), p = panFor(x), d = Math.max(0.25, dur), f0 = R(150, 190);
    const osc = tone(t, d, { type: "triangle", f: f0, f1: f0 * 3.2, vol: 0.06, pan: p, lp: 1600, atk: d * 0.3 });
    // Vibrato suave (tensión de la goma).
    const lfo = ac.createOscillator(), depth = ac.createGain();
    lfo.frequency.value = R(6, 8); depth.gain.value = f0 * 0.04;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t); lfo.stop(t + d + 0.03);
    noise(t, d, { color: "pink", type: "bandpass", f: 500, f1: 1800, q: 2.2, vol: 0.05, atk: d * 0.4, pan: p });
  },
  /** Encajar: bloque de madera (dos golpes secos y afinados). */
  snap(x?: number) {
    if (!ready() || !claim(3, 140)) return;
    const t = at(), p = panFor(x), k = R(0.94, 1.08);
    noise(t, 0.006, { type: "bandpass", f: 2600, q: 1.5, vol: 0.16, pan: p });
    tone(t, 0.05, { f: 1150 * k, f1: 1080 * k, vol: 0.12, pan: p, wet: 0.12 });
    tone(t + 0.028, 0.04, { type: "triangle", f: 1720 * k, vol: 0.05, pan: p, wet: 0.12 });
  },
  /** Deslizar: fricción granulada que avanza en la dirección del arrastre. */
  swipe(dur = 0.4, x?: number) {
    if (!ready() || !claim(3, dur * 800)) return;
    const { ac } = S!;
    const t = at(), p = panFor(x), d = Math.max(0.2, dur * R(0.9, 1.1));
    const src = ac.createBufferSource(); src.buffer = S!.pink; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 3.5;
    f.frequency.setValueAtTime(R(900, 1200), t); f.frequency.exponentialRampToValueAtTime(R(1900, 2400), t + d);
    const g = ac.createGain(); env(g.gain, t, 0.14, d * 0.35, d);
    // Trémolo rápido = textura de roce.
    const am = ac.createGain(); am.gain.value = 0.6;
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = R(24, 32); lg.gain.value = 0.4;
    lfo.connect(lg).connect(am.gain);
    const n = travel(src.connect(f).connect(am).connect(g), t, d, p - 0.3, p + 0.3);
    n.connect(S!.out);
    src.start(t, Math.random()); src.stop(t + d + 0.04);
    lfo.start(t); lfo.stop(t + d + 0.04);
  },
  /** Soltar en su lugar: golpe suave con un pequeño rebote. */
  drop(x?: number) {
    if (!ready() || !claim(3, 160)) return;
    const t = at(), p = panFor(x);
    tone(t, 0.16, { f: R(130, 160), f1: 55, vol: 0.22, pan: p, wet: 0.1 });
    noise(t, 0.05, { color: "pink", type: "lowpass", f: 1200, q: 0.7, vol: 0.12, pan: p });
    noise(t + 0.045, 0.012, { type: "bandpass", f: 3000, q: 2, vol: 0.04, pan: p });
  },
  /** Seleccionar: barrido de cristal suave mientras se dibuja el recuadro. */
  select(dur = 0.5, x?: number) {
    if (!ready() || !claim(3, dur * 700)) return;
    const t = at(), p = panFor(x), d = Math.max(0.25, dur), f = R(700, 820);
    tone(t, d, { f, f1: f * 1.5, vol: 0.035, pan: p, wet: 0.35, atk: d * 0.4 });
    tone(t, d, { f: f * 2.005, f1: f * 3, vol: 0.012, pan: p, wet: 0.35, atk: d * 0.4 });
    noise(t, d, { type: "highpass", f: 5000, f1: 8000, q: 0.7, vol: 0.02, atk: d * 0.5, pan: p });
  },
  /** Tecla mecánica: clic agudo + golpe de cuerpo + fondo, cada una distinta. */
  key(x?: number) {
    if (!ready()) return;
    const v = bed("key", 42);
    if (!v) return;
    const t = at(0.003), p = panFor(x) + R(-0.06, 0.06);
    noise(t, 0.006, { type: "bandpass", f: R(4200, 6200), q: 2, vol: 0.13 * v, pan: p });
    noise(t + 0.002, R(0.025, 0.04), { color: "pink", type: "bandpass", f: R(330, 560), q: 1.4, vol: 0.2 * v, pan: p });
    tone(t + 0.002, 0.04, { f: R(170, 230), f1: 110, vol: 0.05 * v, pan: p });
    if (Math.random() < 0.3) noise(t + R(0.04, 0.055), 0.006, { type: "bandpass", f: R(3600, 4600), q: 2, vol: 0.05 * v, pan: p });
  },
  /** Barra espaciadora: más grave y ancha. */
  space(x?: number) {
    if (!ready()) return;
    const v = bed("key", 42);
    if (!v) return;
    const t = at(0.003), p = panFor(x);
    noise(t, 0.006, { type: "bandpass", f: 3600, q: 1.5, vol: 0.1 * v, pan: p });
    noise(t + 0.002, 0.06, { color: "pink", type: "bandpass", f: R(220, 300), q: 1.2, vol: 0.26 * v, pan: p });
    noise(t + 0.05, 0.01, { type: "bandpass", f: 2400, q: 2, vol: 0.05 * v, pan: p });
  },
  /** Pluma sobre papel: trazos cortos de ruido rosa agudo. */
  scribble(dur = 0.8, x?: number) {
    if (!ready() || !claim(3, dur * 900)) return;
    const t0 = at(0.006), p = panFor(x), step = 0.075, n = Math.round(dur / step);
    for (let i = 0; i < n; i++) {
      noise(t0 + i * step + R(0, 0.02), R(0.05, 0.08), { color: "pink", type: "bandpass", f: R(2800, 5200), f1: R(2600, 5600), q: R(2.5, 5), vol: R(0.05, 0.09), atk: 0.012, pan: p });
    }
  },
  /** Contador: tic que sube de tono con el avance (0–1). */
  tick(progress = 0, x?: number) {
    if (!ready()) return;
    const v = bed("tick", 55);
    if (!v) return;
    const t = at(0.003), f = 1500 + progress * 1100;
    tone(t, 0.016, { f, vol: 0.05 * v, pan: panFor(x) });
    noise(t, 0.004, { type: "highpass", f: 4000, q: 0.7, vol: 0.05 * v });
  },
  /** Campanita de "listo": campana FM de dos notas con cola de sala. */
  chime(x?: number) {
    if (!ready() || !claim(4, 520)) return;
    const { ac } = S!;
    const t = at(0.008), p = panFor(x), i = Math.floor(R(0, NOTES.length - 3));
    [NOTES[i], NOTES[i + 2]].forEach((f, k) => {
      const tt = t + k * 0.075;
      const car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
      car.frequency.value = f; mod.frequency.value = f * 1.4;
      mg.gain.setValueAtTime(f * 1.6, tt); mg.gain.exponentialRampToValueAtTime(f * 0.05, tt + 0.6);
      mod.connect(mg).connect(car.frequency);
      env(g.gain, tt, 0.055, 0.004, 1.1);
      route(car.connect(g), p, 0.5);
      car.start(tt); mod.start(tt); car.stop(tt + 1.15); mod.stop(tt + 1.15);
    });
  },
  /** Golpe grave (letra que llega). */
  land() {
    if (!ready() || !claim(2, 40)) return;
    const t = at();
    tone(t, 0.3, { f: R(110, 135), f1: 42, vol: 0.32, pan: R(-0.25, 0.25), wet: 0.15 });
    noise(t, 0.07, { color: "pink", type: "lowpass", f: 900, q: 0.7, vol: 0.14 });
  },
  /** Riser: tensión que sube (carga). */
  riser(dur = 1.1) {
    if (!ready() || !claim(5, dur * 1000)) return;
    const t = at(0.01);
    noise(t, dur, { color: "pink", type: "bandpass", f: 220, f1: 5200, q: 1.3, vol: 0.22, atk: dur * 0.9, wet: 0.35 });
    tone(t, dur, { type: "sawtooth", f: 110, f1: 330, vol: 0.035, lp: 1400, atk: dur * 0.85, wet: 0.3 });
  },
  /** Impacto de entrada: sub-golpe, cuerpo y brillo, con cola de sala. */
  impact() {
    if (!ready() || !claim(5, 700)) return;
    const t = at(0.006);
    tone(t, 1.1, { f: 92, f1: 30, vol: 0.55, wet: 0.3 });
    noise(t, 0.4, { color: "pink", type: "lowpass", f: 1600, f1: 300, q: 0.7, vol: 0.3, atk: 0.003, wet: 0.45 });
    noise(t, 0.09, { type: "highpass", f: 6000, q: 0.7, vol: 0.08, wet: 0.5 });
  },
  /** Whoosh: cuerpo (rosa) + aire (blanco agudo) + sub, que cruza de lado a lado. */
  whoosh(dur = 0.6, vol = 0.45) {
    if (!ready() || !claim(4, dur * 750)) return;
    const { ac } = S!;
    const t = at(0.01), d = dur * R(0.9, 1.15), dir = Math.random() < 0.5 ? -1 : 1, peak = d * R(0.5, 0.6);
    const layer = (buf: AudioBuffer, type: BiquadFilterType, f0: number, fp: number, f1: number, q: number, v: number) => {
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t);
      f.frequency.exponentialRampToValueAtTime(fp, t + peak);
      f.frequency.exponentialRampToValueAtTime(f1, t + d);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + peak);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      const n = travel(src.connect(f).connect(g), t, d, -0.7 * dir, 0.7 * dir);
      n.connect(S!.out);
      const w = ac.createGain(); w.gain.value = 0.25; n.connect(w).connect(S!.verb);
      src.start(t, Math.random()); src.stop(t + d + 0.05);
    };
    layer(S!.pink, "bandpass", R(220, 300), R(1100, 1500), R(300, 420), 0.8, vol);
    layer(S!.white, "highpass", 3500, R(6500, 8000), 4000, 0.7, vol * 0.18);
    tone(t, d, { f: 52, f1: 70, vol: vol * 0.25, atk: peak });
  },
};

// ================================================================ Lab (cámara)
/** Sonidos del Lab: cada gesto tiene el suyo. */
export const labSfx = {
  /** Puño: pozo de gravedad — tensión que sube y se cierra en un golpe profundo con brillo. */
  implode() {
    if (!ready() || !claim(5, 650)) return;
    const t = at(0.006);
    tone(t, 0.42, { f: 90, f1: 360, vol: 0.07, atk: 0.38, wet: 0.3 });
    noise(t, 0.42, { color: "pink", type: "bandpass", f: 4200, f1: 260, q: 1.2, vol: 0.22, atk: 0.36, wet: 0.3 });
    tone(t + 0.4, 0.55, { f: 120, f1: 38, vol: 0.55, wet: 0.25 });
    noise(t + 0.4, 0.08, { color: "pink", type: "lowpass", f: 900, q: 0.7, vol: 0.2 });
    tone(t + 0.42, 0.7, { f: 1567.98, vol: 0.018, wet: 0.7, atk: 0.01 });
  },
  /** Abrir la mano: estallido con golpe, cuerpo, aire y escombros repartidos en estéreo. */
  blast() {
    if (!ready() || !claim(5, 900)) return;
    const t = at(0.006);
    noise(t, 0.012, { type: "highpass", f: 3000, q: 0.7, vol: 0.4 });
    tone(t, 1.1, { f: 98, f1: 28, vol: 0.62, wet: 0.35 });
    noise(t, 0.5, { color: "pink", type: "lowpass", f: 2600, f1: 240, q: 0.7, vol: 0.32, atk: 0.003, wet: 0.5 });
    noise(t + 0.03, 0.9, { color: "pink", type: "bandpass", f: 500, f1: 3600, q: 0.8, vol: 0.14, atk: 0.25, wet: 0.45 });
    for (let k = 0; k < 7; k++) noise(t + 0.05 + R(0, 0.35), R(0.02, 0.05), { type: "bandpass", f: R(2500, 7000), q: R(2, 5), vol: R(0.04, 0.08), pan: R(-0.9, 0.9), wet: 0.3 });
  },
  /** Corazón: acorde cálido (pad suave) al formarse. */
  warm() {
    if (!ready() || !claim(4, 900)) return;
    const t = at(0.01);
    for (const [f, d] of [[261.63, 0], [329.63, 0.04], [392, 0.08], [523.25, 0.12]] as [number, number][]) {
      tone(t + d, 1.6, { f, vol: 0.035, atk: 0.35, wet: 0.6, lp: 1800 });
      tone(t + d, 1.6, { type: "triangle", f: f * 1.003, vol: 0.012, atk: 0.4, wet: 0.6, lp: 1400 });
    }
  },
  /** Latido (lub-dub) profundo. */
  heartbeat() {
    if (!ready()) return;
    const t = at(0.004);
    tone(t, 0.15, { f: 68, f1: 42, vol: 0.6, wet: 0.12 });
    noise(t, 0.05, { color: "pink", type: "lowpass", f: 260, q: 0.7, vol: 0.22 });
    tone(t + 0.2, 0.17, { f: 58, f1: 38, vol: 0.46, wet: 0.12 });
  },
  /** Cambio de color (1–5 dedos): tic de cristal cuyo tono sube con los dedos. */
  blip(n: number) {
    if (!ready() || !claim(2, 120)) return;
    const t = at(0.004), f = NOTES[Math.min(NOTES.length - 1, Math.max(0, n) + 1)];
    tone(t, 0.18, { f, vol: 0.045, wet: 0.45, atk: 0.003 });
    tone(t, 0.08, { f: f * 3, vol: 0.012, wet: 0.45 });
  },
  /** La mano entra en cuadro: aire suave que sube. */
  handIn() {
    if (!ready() || !claim(2, 300)) return;
    const t = at(0.006);
    noise(t, 0.38, { color: "pink", type: "bandpass", f: 500, f1: 2600, q: 1.1, vol: 0.09, atk: 0.16, wet: 0.3, pan: R(-0.3, 0.3) });
    tone(t + 0.12, 0.25, { f: 880, f1: 1320, vol: 0.012, wet: 0.5, atk: 0.05 });
  },
  /** Mantener el puño: la energía se carga (tono que sube con brillo). */
  charge() {
    if (!ready()) return;
    const t = at(0.01);
    tone(t, 1.3, { type: "triangle", f: 110, f1: 440, vol: 0.03, atk: 1.1, lp: 1600, wet: 0.35 });
    noise(t, 1.3, { color: "pink", type: "bandpass", f: 300, f1: 3800, q: 2, vol: 0.05, atk: 1.15, wet: 0.35 });
  },
  /** Movimiento rápido de la mano: destello cristalino muy suave. */
  sparkle() {
    if (!ready()) return;
    const v = bed("sparkle", 140);
    if (!v) return;
    const t = at(0.004), f = NOTES[3 + Math.floor(R(0, NOTES.length - 3))] * 2;
    tone(t, 0.25, { f, vol: 0.014 * v, wet: 0.7, atk: 0.003, pan: R(-0.6, 0.6) });
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
