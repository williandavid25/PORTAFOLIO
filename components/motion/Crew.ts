"use client";

import gsap from "gsap";
import { splitChars, splitWords } from "./split";

/**
 * “El equipo”: hasta 20 punteros en blanco y negro (12 en el celular) que
 * construyen la página mientras bajas. Cada trabajo (escribir, firmar, estirar,
 * arrastrar, llenar, contar, trazar, seleccionar) mueve una “sonda” invisible
 * ligada al scroll; el puntero asignado aparece solo para hacer ese trabajo,
 * lo sigue y se retira. Subir y bajar nunca hace saltar nada.
 * Rendimiento: un solo bucle (ticker de GSAP) y solo transform/opacity.
 */
export const CREW_SIZE = 20;
/** Tono de cada puntero: blanco con borde negro o negro con borde blanco. */
type Member = { tone: "light" | "dark"; color: string };
const LINE = "rgba(255,255,255,0.9)"; // marcos, selecciones y ondas: siempre blancos
type Box = { x: number; y: number; w: number; h: number };
type TlVars = gsap.TimelineVars;
type Kind = "arrow" | "ibeam" | "pen";
/** Punto invisible que animan los trabajos; el puntero real lo sigue. */
export type Probe = { x: number; y: number; scale: number; opacity: number; verb: string; kind: Kind };
type Task = { probe: Probe; tl: gsap.core.Timeline; agent: number; el: Element | null; doneAt: number };

const ICONS: Record<Kind, string> = {
  arrow: '<svg class="i-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2.5l15.5 8.2-6.9 1.9-2.9 6.9z" class="fill" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  ibeam: '<svg class="i-ibeam" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8M16 3h-3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h3" class="halo" fill="none" stroke-width="4.6" stroke-linecap="round"/><path d="M8 3h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8M16 3h-3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h3" class="line" fill="none" stroke-width="2" stroke-linecap="round"/></svg>',
  pen: '<svg class="i-pen" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21l3.5-1 11-11-2.5-2.5-11 11zM14.5 6l2.5 2.5 2-2a1.77 1.77 0 0 0-2.5-2.5z" class="fill" stroke-width="1.4" stroke-linejoin="round"/></svg>',
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// =====================================================================
// Director: los punteros y su bucle. Un puntero solo se ve cuando tiene
// un trabajo por hacer cerca de la pantalla: llega, lo hace y se va.
// =====================================================================
type Agent = { el: HTMLElement; x: number; y: number; op: number; kind: Kind; rot: number; vx: number; vy: number };

class Director {
  readonly count: number;
  private agents: Agent[] = [];
  private tasks = new Set<Task>();
  private visible = false;
  private overlay: HTMLDivElement;

  constructor(private layer: HTMLElement) {
    this.count = window.innerWidth < 640 ? 12 : CREW_SIZE;
    this.overlay = document.createElement("div");
    this.overlay.className = "crew-agents";
    this.overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(this.overlay);
    for (let i = 0; i < this.count; i++) {
      const el = document.createElement("div");
      el.className = `cc ${i % 2 ? "tone-dark" : "tone-light"}`;
      el.innerHTML = `${ICONS.arrow}${ICONS.ibeam}${ICONS.pen}`;
      el.style.opacity = "0";
      this.overlay.appendChild(el);
      this.agents.push({ el, x: rand(0, innerWidth), y: rand(0, innerHeight), op: 0, kind: "arrow", rot: 0, vx: 0, vy: 0 });
    }
    gsap.ticker.add(this.tick);
  }

  member(i: number): Member { return { tone: i % 2 ? "dark" : "light", color: LINE }; }
  add(t: Task) { this.tasks.add(t); }
  remove(t: Task) { this.tasks.delete(t); }
  show() { this.visible = true; }

  // ---------- Bandada de la pantalla de carga ("avioncitos") ----------
  private flockOn = false;
  private flockT0 = 0;
  /** Los punteros vuelan en formación alrededor del nombre mientras carga la página. */
  startFlock() {
    this.flockOn = true;
    this.visible = true;
    this.idle = false;
    this.flockT0 = performance.now();
    this.overlay.classList.add("on-top");
    // Todos aparecen ya en la formación (nadie llega tarde ni desaparece).
    this.agents.forEach((a, i) => { const p = this.path(-i * 0.07); a.x = p.x; a.y = p.y; a.op = 0; a.rot = 0; });
  }
  /** Fin de la carga: dejan la formación y cada uno va a construir su parte de la portada. */
  private flockEndAt = 0;
  endFlock() { this.flockOn = false; this.flockEndAt = performance.now(); }
  /** Justo después de la carga: los que aún no tienen trabajo siguen volando en formación. */
  private circling(now: number) { return this.flockEndAt > 0 && now - this.flockEndAt < 3000; }
  /** ¿Tiene un trabajo de la portada que todavía no empieza? */
  private pendingHero(i: number) { for (const t of this.tasks) if (t.agent === i && !t.el && t.tl.progress() <= 0.0005) return true; return false; }
  /** Cuando la pantalla de carga desaparece, vuelven a su capa normal (debajo del menú). */
  lowerLayer() { this.overlay.classList.remove("on-top"); }

  /** Trayectoria en forma de 8 alrededor del centro de la pantalla. */
  private path(t: number) {
    const vw = innerWidth, vh = innerHeight;
    const A = Math.min(vw * 0.34, 560), B = Math.min(vh * 0.24, 230);
    return { x: vw / 2 + A * Math.sin(1.55 * t), y: vh / 2 + B * Math.sin(3.1 * t + 0.6) };
  }
  private flockTick(now: number) {
    this.agents.forEach((a, i) => this.fly(a, i, now));
  }
  /** Un puntero en la formación: sigue el 8 con la punta hacia donde vuela. */
  private fly(a: Agent, i: number, now: number) {
    const t = (now - this.flockT0) / 1000;
    {
      const d = i * 0.045;                                  // cada uno sigue al anterior (fila de aviones)
      const L = this.path(t - d), L2 = this.path(t - d + 0.016);
      const hx = L2.x - L.x, hy = L2.y - L.y, len = Math.hypot(hx, hy) || 1;
      const nx = -hy / len, ny = hx / len;                  // perpendicular al rumbo: abre la formación en V
      const side = i % 2 ? 1 : -1, rank = Math.ceil(i / 2);
      const spread = side * (rank * 7 + 6 * Math.sin(t * 2.2 + i));
      const tx = L.x + nx * spread, ty = L.y + ny * spread;
      a.vx = (tx - a.x) * 0.16; a.vy = (ty - a.y) * 0.16;
      a.x += (tx - a.x) * 0.16;
      a.y += (ty - a.y) * 0.16;
      // La punta del cursor (apunta arriba-izquierda, −135°) mira hacia donde vuela.
      const heading = (Math.atan2(hy, hx) * 180) / Math.PI + 135;
      let dr = heading - a.rot; dr = ((dr + 540) % 360) - 180;
      a.rot += dr * 0.2;
      const fadeIn = Math.min(1, t / 0.25);
      a.op += (fadeIn - a.op) * 0.2;
      if (a.kind !== "arrow") { a.el.classList.remove(`k-${a.kind}`); a.kind = "arrow"; }
      a.el.style.opacity = a.op.toFixed(3);
      a.el.style.transform = `translate3d(${a.x.toFixed(1)}px,${a.y.toFixed(1)}px,0) rotate(${a.rot.toFixed(1)}deg)`;
    }
  }

  private idle = false;
  private tick = () => {
    if (!this.visible) return;
    if (this.flockOn) return this.flockTick(performance.now());
    // Sin trabajos en curso ni punteros visibles: no hace nada en este cuadro (ahorra CPU).
    if (this.idle && !this.circling(performance.now()) && !Array.from(this.tasks).some((t) => { const p = t.tl.progress(); return p > 0.0005 && p < 0.9995; })) return;
    const lr = this.layer.getBoundingClientRect();
    const now = performance.now();
    const vw = innerWidth, vh = innerHeight;
    const near = (t: Task) => {
      if (!t.el) return true;
      const r = t.el.getBoundingClientRect();
      return r.bottom > -vh * 0.1 && r.top < vh * 1.02;
    };
    // Para cada puntero: el trabajo en curso; si no, el próximo por empezar a la vista;
    // si no, el que acaba de terminar (se queda un instante y se retira).
    const best = new Map<number, { t: Task; rank: number }>();
    this.tasks.forEach((t) => {
      const p = t.tl.progress();
      let rank = 0;
      if (p > 0.0005 && p < 0.9995) { rank = 3; t.doneAt = 0; }
      else if (p <= 0.0005 && t.el && near(t)) rank = 2;
      else if (p >= 0.9995) { if (!t.doneAt) t.doneAt = now; if (now - t.doneAt < 900 && near(t)) rank = 1; }
      if (!rank) return;
      const cur = best.get(t.agent);
      if (!cur || rank > cur.rank) best.set(t.agent, { t, rank });
    });

    this.agents.forEach((a, i) => {
      const b = best.get(i);
      // Al salir de la bandada, cada puntero se endereza suavemente.
      if (!b && this.circling(now) && this.pendingHero(i)) { this.fly(a, i, now); return; }
      a.rot += (0 - a.rot) * 0.14;
      if (!b) {
        // Sale volando en la dirección que llevaba mientras se desvanece.
        if (a.vx || a.vy) { a.x += a.vx * 1.6; a.y += a.vy * 1.6; a.vx *= 0.97; a.vy *= 0.97; }
        a.op += (0 - a.op) * 0.12;
        a.el.style.opacity = a.op < 0.02 ? "0" : a.op.toFixed(3);
        if (a.op >= 0.02) a.el.style.transform = `translate3d(${a.x.toFixed(1)}px,${a.y.toFixed(1)}px,0) rotate(${a.rot.toFixed(1)}deg)`;
        return;
      }
      const p = b.t.probe;
      const tx = Math.min(vw - 26, Math.max(2, p.x + lr.left));
      const ty = Math.min(vh - 26, Math.max(2, p.y + lr.top));
      if (a.op < 0.05) { a.x = tx; a.y = ty; } // aparece en su sitio, no cruza la pantalla
      const k = b.rank === 3 ? 0.35 : 0.12;
      a.x += (tx - a.x) * k;
      a.y += (ty - a.y) * k;
      const target = b.rank === 1 ? Math.max(0, 1 - (now - b.t.doneAt) / 900) : 1;
      a.op += (target - a.op) * 0.15;
      a.el.style.opacity = a.op.toFixed(3);
      a.el.style.transform = `translate3d(${a.x.toFixed(1)}px,${a.y.toFixed(1)}px,0) rotate(${a.rot.toFixed(1)}deg) scale(${p.scale || 1})`;
      if (p.kind !== a.kind) { a.el.classList.remove(`k-${a.kind}`); a.el.classList.add(`k-${p.kind}`); a.kind = p.kind; }
    });
    this.settle();
  };

  /** Se recalcula al final de cada cuadro: si todos los punteros están ocultos, queda en reposo. */
  private settle() { this.idle = this.agents.every((a) => a.op < 0.02); }
  destroy() {
    gsap.ticker.remove(this.tick);
    this.overlay.remove();
    this.tasks.clear();
  }
}

let director: Director | null = null;
export function getDirector(layer: HTMLElement) {
  if (!director || !document.body.contains(layer)) { director?.destroy(); director = new Director(layer); }
  return director;
}
export function showCrew() { director?.show(); }
export function startCrewFlock(layer: HTMLElement) { getDirector(layer).startFlock(); }
export function endCrewFlock() { director?.endFlock(); }
export function lowerCrew() { director?.lowerLayer(); }
export function destroyDirector() { director?.destroy(); director = null; }

// =====================================================================
// Crew: crea los trabajos de una página y los asigna a los punteros.
// =====================================================================
export class Crew {
  private i = 0;
  private last = 0;
  private pending: Probe[] = [];
  private nodes: HTMLElement[] = [];
  private tls: gsap.core.Timeline[] = [];
  private tasks: Task[] = [];
  private dir: Director;

  constructor(private layer: HTMLElement, private start = 0) {
    this.dir = getDirector(layer);
  }

  /** Asigna el siguiente puntero del equipo (en rueda). */
  next(): Member {
    this.last = (this.start + this.i++) % this.dir.count;
    return this.dir.member(this.last);
  }

  /** Posición del elemento dentro de la capa (sin contar los x/y que le pone GSAP). */
  box(el: Element): Box {
    const l = this.layer.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const gx = Number(gsap.getProperty(el, "x")) || 0;
    const gy = Number(gsap.getProperty(el, "y")) || 0;
    return { x: r.left - l.left - gx, y: r.top - l.top - gy, w: r.width, h: r.height };
  }
  private cx(x: number) { return Math.max(4, Math.min(this.layer.clientWidth - 40, x)); }
  private add<T extends HTMLElement>(el: T): T { this.layer.appendChild(el); this.nodes.push(el); return el; }

  /** Sonda del puntero asignado con next(). */
  cursor(_m: Member, verb: string, kind: boolean | Kind = false): Probe {
    const p: Probe = { x: -200, y: -200, scale: 1, opacity: 0, verb, kind: kind === true ? "ibeam" : kind === false ? "arrow" : kind };
    (p as Probe & { agent?: number }).agent = this.last;
    this.pending.push(p);
    return p;
  }
  /** Une las sondas creadas a una línea de tiempo (para timelines propios, ej. el hero). */
  bind(tl: gsap.core.Timeline, el: Element | null = null) {
    this.pending.forEach((p) => {
      const t: Task = { probe: p, tl, agent: (p as Probe & { agent: number }).agent, el, doneAt: 0 };
      this.tasks.push(t);
      this.dir.add(t);
    });
    this.pending = [];
  }

  frame(m: Member) {
    const f = document.createElement("div");
    f.className = "crew-frame";
    f.style.setProperty("--c", m.color);
    f.innerHTML = '<i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i>';
    return this.add(f);
  }
  sel(m: Member) {
    const s = document.createElement("div");
    s.className = "crew-sel";
    s.style.borderColor = m.color;
    s.style.background = "rgba(255,255,255,0.06)";
    return this.add(s);
  }
  ripple(m: Member) {
    const r = document.createElement("div");
    r.className = "crew-ripple";
    r.style.borderColor = m.color;
    return this.add(r);
  }

  private tl(vars: TlVars) {
    const t = gsap.timeline(vars);
    this.tls.push(t);
    const trig = (vars.scrollTrigger as { trigger?: unknown } | undefined)?.trigger;
    this.bind(t, trig instanceof Element ? trig : null);
    return t;
  }

  /** Escribe un título palabra por palabra. */
  write(el: HTMLElement, vars: TlVars = {}) {
    const m = this.next();
    const words = splitWords(el);
    const wraps = words.map((w) => w.parentElement as HTMLElement);
    if (!words.length) return null;
    const c = this.cursor(m, "escribiendo", true);
    const B = (i: number) => this.box(wraps[i]);
    const tl = this.tl(vars);
    tl.fromTo(c, { x: () => this.cx(B(0).x - 70), y: () => B(0).y + B(0).h + 50 }, { x: () => this.cx(B(0).x - 6), y: () => B(0).y + B(0).h * 0.5, duration: 0.3, ease: "power2.out" });
    words.forEach((w, i) => {
      tl.fromTo(w, { yPercent: 115, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 0.32, ease: "power3.out" });
      tl.to(c, { x: () => this.cx(B(i).x + B(i).w), y: () => B(i).y + B(i).h * 0.5, duration: 0.32, ease: "none" }, "<");
    });
    tl.to(c, { x: "+=40", y: "+=30", duration: 0.2 });
    return tl;
  }

  /** Escribe una palabra letra por letra (la palabra grande de cada sección). */
  type(el: HTMLElement, vars: TlVars = {}) {
    const m = this.next();
    const chars = splitChars(el);
    if (!chars.length) return null;
    const c = this.cursor(m, "escribiendo", true);
    const B = (i: number) => this.box(chars[i]);
    const tl = this.tl(vars);
    tl.fromTo(c, { x: () => this.cx(B(0).x - 80), y: () => B(0).y + B(0).h + 40 }, { x: () => this.cx(B(0).x - 4), y: () => B(0).y + B(0).h * 0.5, duration: 0.25, ease: "power2.out" });
    chars.forEach((ch, i) => {
      tl.fromTo(ch, { opacity: 0, y: 14, scale: 0.6 }, { opacity: 1, y: 0, scale: 1, duration: 0.1, ease: "back.out(3)" });
      tl.to(c, { x: () => this.cx(B(i).x + B(i).w), duration: 0.1, ease: "none" }, "<");
    });
    tl.to(c, { x: "+=40", y: "+=30", duration: 0.2 });
    return tl;
  }

  /** Firma el texto manuscrito con una pluma, de izquierda a derecha. */
  sign(el: HTMLElement, vars: TlVars = {}) {
    const m = this.next();
    const c = this.cursor(m, "firmando", "pen");
    const B = () => this.box(el);
    const tl = this.tl(vars);
    const steps = 7;
    tl.fromTo(c, { x: () => this.cx(B().x - 60), y: () => B().y - 30 }, { x: () => this.cx(B().x), y: () => B().y + B().h * 0.55, duration: 0.2 })
      .fromTo(el, { clipPath: "inset(-40% 100% -60% -5%)" }, { clipPath: "inset(-40% -10% -60% -5%)", duration: 0.8, ease: "none" });
    for (let i = 1; i <= steps; i++) {
      tl.to(c, { x: () => this.cx(B().x + (B().w * i) / steps), y: () => B().y + B().h * (i % 2 ? 0.3 : 0.75), duration: 0.8 / steps, ease: "sine.inOut" }, i === 1 ? "<" : ">");
    }
    tl.to(c, { x: "+=30", y: "-=20", duration: 0.2 });
    return tl;
  }

  /** Estira el elemento desde una esquina, con marco de selección y medidas. */
  stretch(el: HTMLElement, radius = 22, vars: TlVars = {}) {
    const m = this.next();
    const c = this.cursor(m, "estirando");
    const f = this.frame(m);
    const B = () => this.box(el);
    const k = 0.16;
    const tl = this.tl(vars);
    tl.fromTo(c, { x: () => this.cx(B().x + B().w * k + 80), y: () => B().y + B().h * k + 70 }, { x: () => this.cx(B().x + B().w * k), y: () => B().y + B().h * k, duration: 0.25, ease: "power2.out" })
      .fromTo(f, { x: () => B().x, y: () => B().y, width: () => B().w * k, height: () => B().h * k, opacity: 0 }, { opacity: 1, duration: 0.08 }, "<0.15")
      .fromTo(el, { clipPath: () => `inset(0px ${B().w * (1 - k)}px ${B().h * (1 - k)}px 0px round ${radius}px)` }, { clipPath: `inset(-60px -60px -60px -60px round ${radius}px)`, duration: 0.6, ease: "power2.inOut" })
      .to(f, { width: () => B().w, height: () => B().h, duration: 0.6, ease: "power2.inOut" }, "<")
      .to(c, { x: () => this.cx(B().x + B().w), y: () => B().y + B().h, duration: 0.6, ease: "power2.inOut" }, "<")
      .to(f, { opacity: 0, duration: 0.15 })
      .to(c, { x: "+=30", y: "+=20", duration: 0.15 }, "<");
    return tl;
  }

  /** Arrastra un bloque desde un costado hasta su lugar. */
  drag(el: HTMLElement, from: "left" | "right" = "left", vars: TlVars = {}) {
    const m = this.next();
    const c = this.cursor(m, "moviendo");
    const B = () => this.box(el);
    const dx = from === "left" ? -150 : 150;
    const gx = () => (from === "left" ? 34 : B().w - 34);
    const tl = this.tl(vars);
    tl.fromTo(c, { x: () => this.cx(B().x + gx() + dx - 40), y: () => B().y + 120, scale: 1 }, { x: () => this.cx(B().x + gx() + dx), y: () => B().y + 26 + 70, duration: 0.22 })
      .fromTo(el, { x: dx, y: 70, rotate: from === "left" ? -3 : 3, opacity: 0.25 }, { opacity: 0.6, duration: 0.1 }, "<0.12")
      .to(c, { scale: 0.86, duration: 0.06 })
      .to(el, { x: 0, y: 0, rotate: 0, opacity: 1, duration: 0.6, ease: "power2.out" })
      .to(c, { x: () => this.cx(B().x + gx()), y: () => B().y + 26, duration: 0.6, ease: "power2.out" }, "<")
      .to(c, { scale: 1, duration: 0.06 })
      .to(c, { y: "+=24", duration: 0.15 });
    return tl;
  }

  /** Llena una barra arrastrando su extremo. */
  fill(bar: HTMLElement, level: number, vars: TlVars = {}) {
    const m = this.next();
    const c = this.cursor(m, "ajustando");
    const track = bar.parentElement as HTMLElement;
    const B = () => this.box(track);
    const tl = this.tl(vars);
    tl.fromTo(c, { x: () => this.cx(B().x - 50), y: () => B().y + 40 }, { x: () => this.cx(B().x), y: () => B().y + 2, duration: 0.2 })
      .fromTo(bar, { width: "0%" }, { width: `${level}%`, duration: 0.6, ease: "none" })
      .to(c, { x: () => this.cx(B().x + (B().w * level) / 100), duration: 0.6, ease: "none" }, "<")
      .to(c, { y: "+=20", duration: 0.1 });
    return tl;
  }

  /** Hace clic en una cifra y la cuenta. */
  count(el: HTMLElement, target: number, suffix = "", vars: TlVars = {}) {
    const m = this.next();
    const c = this.cursor(m, "contando");
    const rp = this.ripple(m);
    const B = () => this.box(el);
    const o = { v: 0 };
    const tl = this.tl(vars);
    tl.fromTo(c, { x: () => this.cx(B().x + B().w / 2 + 60), y: () => B().y + B().h + 50 }, { x: () => this.cx(B().x + B().w / 2), y: () => B().y + B().h / 2, duration: 0.25, ease: "power2.out" })
      .to(c, { scale: 0.82, duration: 0.05 })
      .fromTo(rp, { x: () => B().x + B().w / 2, y: () => B().y + B().h / 2, scale: 0.2, opacity: 0.9 }, { scale: 1.6, opacity: 0, duration: 0.3, immediateRender: false })
      .to(c, { scale: 1, duration: 0.05 }, "<")
      .fromTo(o, { v: 0 }, { v: target, duration: 0.55, ease: "power2.out", onUpdate: () => { el.textContent = `${Math.round(o.v)}${suffix}`; } }, "<")
      .to(c, { y: "+=24", duration: 0.1 });
    return tl;
  }

  /** Traza una línea horizontal (escala X) de punta a punta. */
  draw(line: HTMLElement, vars: TlVars = {}) {
    const m = this.next();
    const c = this.cursor(m, "trazando");
    const B = () => this.box(line);
    const tl = this.tl(vars);
    tl.fromTo(c, { x: () => this.cx(B().x - 60), y: () => B().y + 50 }, { x: () => this.cx(B().x), y: () => B().y, duration: 0.15 })
      .fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 1, ease: "none", transformOrigin: "left center" })
      .to(c, { x: () => this.cx(B().x + B().w), duration: 1, ease: "none" }, "<")
      .to(c, { y: "+=24", duration: 0.1 });
    return tl;
  }

  /** Dibuja un recuadro de selección y el bloque aparece dentro. */
  select(el: HTMLElement, vars: TlVars = {}) {
    const m = this.next();
    const c = this.cursor(m, "seleccionando");
    const s = this.sel(m);
    const B = () => this.box(el);
    const tl = this.tl(vars);
    tl.fromTo(c, { x: () => this.cx(B().x - 70), y: () => B().y - 40 }, { x: () => this.cx(B().x), y: () => B().y, duration: 0.2 })
      .fromTo(el, { opacity: 0, y: 30, scale: 0.97 }, { opacity: 0, duration: 0.01 }, "<")
      .fromTo(s, { x: () => B().x, y: () => B().y, width: 0, height: 0, opacity: 1 }, { width: () => B().w, height: () => B().h, duration: 0.5, ease: "power2.inOut" })
      .to(c, { x: () => this.cx(B().x + B().w), y: () => B().y + B().h, duration: 0.5, ease: "power2.inOut" }, "<")
      .to(el, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "power3.out" })
      .to(s, { opacity: 0, duration: 0.3 }, "<0.1")
      .to(c, { x: "+=24", y: "+=20", duration: 0.2 }, "<");
    return tl;
  }

  destroy() {
    this.tasks.forEach((t) => this.dir.remove(t));
    this.tls.forEach((t) => { t.scrollTrigger?.kill(); t.kill(); });
    this.nodes.forEach((n) => n.remove());
    this.tasks = []; this.tls = []; this.nodes = []; this.pending = [];
  }
}

/** Configuración de scroll estándar: avanza al bajar y se deshace al subir. */
export const onScroll = (trigger: Element, start = "top 88%", end = "top 40%"): TlVars => ({
  scrollTrigger: { trigger, start, end, scrub: 0.7, invalidateOnRefresh: true },
});
