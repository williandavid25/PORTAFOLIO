"use client";

import gsap from "gsap";
import { splitChars, splitWords } from "./split";

/**
 * “El equipo”: 20 punteros de colores (12 en el celular) que viven siempre en
 * pantalla y reconstruyen la página mientras bajas.
 *
 * - Cada sección tiene “trabajos” (escribir, firmar, estirar, arrastrar, llenar,
 *   contar, trazar, seleccionar) ligados al scroll. Un trabajo no mueve un puntero
 *   directamente: mueve una “sonda” invisible. El puntero asignado sigue la sonda
 *   mientras el trabajo está en curso. Así subir y bajar nunca hace saltar nada.
 * - Cuando un puntero está libre, no desaparece: va a otro bloque visible y sigue
 *   trabajando (seleccionar, ajustar, corregir texto, medir).
 *
 * Rendimiento: un solo bucle (ticker de GSAP), solo transform/opacity, se pausa
 * solo cuando la pestaña está oculta (requestAnimationFrame).
 */
export const CREW = [
  { name: "Edición", color: "#ff6a13" }, { name: "Color", color: "#3b82f6" }, { name: "Motion", color: "#ec4899" },
  { name: "Audio", color: "#22c55e" }, { name: "Guion", color: "#a855f7" }, { name: "Diseño", color: "#eab308" },
  { name: "VFX", color: "#06b6d4" }, { name: "Dirección", color: "#ef4444" }, { name: "Render", color: "#14b8a6" },
  { name: "Cliente", color: "#84cc16" }, { name: "Montaje", color: "#f97316" }, { name: "Cámara", color: "#6366f1" },
  { name: "Subtítulos", color: "#d946ef" }, { name: "Luces", color: "#facc15" }, { name: "Grading", color: "#0ea5e9" },
  { name: "Foley", color: "#10b981" }, { name: "3D", color: "#f43f5e" }, { name: "Tipografía", color: "#8b5cf6" },
  { name: "Música", color: "#2dd4bf" }, { name: "Producción", color: "#fb923c" },
] as const;
type Member = (typeof CREW)[number];
type Box = { x: number; y: number; w: number; h: number };
type TlVars = gsap.TimelineVars;
type Kind = "arrow" | "ibeam" | "pen";
/** Punto invisible que animan los trabajos; el puntero real lo sigue. */
export type Probe = { x: number; y: number; scale: number; opacity: number; verb: string; kind: Kind };
type Task = { probe: Probe; tl: gsap.core.Timeline; agent: number };

const ICONS: Record<Kind, string> = {
  arrow: '<svg class="i-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2.5l15.5 8.2-6.9 1.9-2.9 6.9z" fill="currentColor" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  ibeam: '<svg class="i-ibeam" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8M16 3h-3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h3" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
  pen: '<svg class="i-pen" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21l3.5-1 11-11-2.5-2.5-11 11zM14.5 6l2.5 2.5 2-2a1.77 1.77 0 0 0-2.5-2.5z" fill="currentColor" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>',
};
const IDLE = [
  { verb: "revisando", kind: "arrow" }, { verb: "alineando", kind: "arrow" }, { verb: "seleccionando", kind: "arrow" },
  { verb: "ajustando", kind: "arrow" }, { verb: "midiendo", kind: "arrow" }, { verb: "puliendo", kind: "arrow" },
] as const;
const TEXTY = ".stitle-main,.title,.lead,.hdesc,.hh,.card h3,.card p,.tcard p,.htag";
const WORK_TARGETS = `${TEXTY},.card,.vcard,.stat,.skill,.step,.tcard,.form-card,.btn,.about-frame,.reel,.chip,.hbadge,.citem,.fbig`;

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// =====================================================================
// Director: los punteros permanentes y su bucle.
// =====================================================================
type Agent = {
  el: HTMLElement; small: HTMLElement; x: number; y: number;
  tx: number; ty: number; next: number; verb: string; kind: Kind; idle: { verb: string; kind: Kind };
  claim: HTMLElement | null;
};

class Director {
  readonly count: number;
  private agents: Agent[] = [];
  private tasks = new Set<Task>();
  private flashes = 0;
  private visible = false;
  private claimed = new Set<HTMLElement>();
  private overlay: HTMLDivElement;

  constructor(private layer: HTMLElement) {
    this.count = window.innerWidth < 640 ? 12 : CREW.length;
    this.overlay = document.createElement("div");
    this.overlay.className = "crew-agents";
    this.overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(this.overlay);
    for (let i = 0; i < this.count; i++) {
      const m = CREW[i];
      const el = document.createElement("div");
      el.className = "cc";
      el.style.color = m.color;
      el.style.setProperty("--c", m.color);
      el.innerHTML = `${ICONS.arrow}${ICONS.ibeam}${ICONS.pen}<span class="cc-tag">${m.name}<small></small></span>`;
      this.overlay.appendChild(el);
      const a: Agent = { el, small: el.querySelector("small")!, x: rand(0, innerWidth), y: rand(0, innerHeight), tx: 0, ty: 0, next: 0, verb: "", kind: "arrow", idle: IDLE[i % IDLE.length], claim: null };
      a.tx = a.x; a.ty = a.y;
      this.agents.push(a);
    }
    gsap.ticker.add(this.tick);
  }

  member(i: number): Member { return CREW[i % this.count]; }
  add(t: Task) { this.tasks.add(t); }
  remove(t: Task) { this.tasks.delete(t); }

  /** Entran desde los bordes, escalonados. */
  show() {
    if (this.visible) return;
    this.visible = true;
    this.agents.forEach((a, i) => {
      const side = i % 4;
      a.x = side === 0 ? -40 : side === 1 ? innerWidth + 20 : rand(0, innerWidth);
      a.y = side === 2 ? -40 : side === 3 ? innerHeight + 20 : rand(0, innerHeight);
      a.next = 0;
      gsap.fromTo(a.el, { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 0.15 + i * 0.06 });
    });
  }

  private pick(a: Agent, lr: DOMRect, now: number) {
    const vw = innerWidth, vh = innerHeight;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(WORK_TARGETS)).filter((n) => {
      const r = n.getBoundingClientRect();
      return r.width > 20 && r.bottom > 60 && r.top < vh - 40 && r.right > 0 && r.left < vw;
    });
    a.next = now + rand(2600, 5200);
    if (a.claim) { this.claimed.delete(a.claim); a.claim = null; }
    // Cada uno busca un bloque que nadie esté trabajando; si no hay, recorre el espacio libre.
    const free = nodes.filter((n) => !this.claimed.has(n));
    if (!free.length || Math.random() < 0.28) {
      const side = Math.random() < 0.5;
      const narrow = vw < 640;
      a.tx = (side ? rand(0.02, narrow ? 0.3 : 0.16) : rand(narrow ? 0.45 : 0.84, narrow ? 0.72 : 0.92)) * vw - lr.left;
      a.ty = rand(0.18, 0.88) * vh - lr.top;
      a.idle = IDLE[Math.floor(Math.random() * IDLE.length)];
      return;
    }
    const n = free[Math.floor(Math.random() * free.length)];
    this.claimed.add(n);
    a.claim = n;
    const r = n.getBoundingClientRect();
    const texty = n.matches(TEXTY) && Math.random() < 0.45;
    // Un punto sobre el borde o dentro del bloque, en coordenadas de la página.
    const edge = Math.random();
    const px = texty ? r.left + rand(0.1, 0.9) * r.width : edge < 0.5 ? r.left + rand(0, 1) * r.width : (Math.random() < 0.5 ? r.left : r.right);
    const py = texty ? r.top + r.height * rand(0.3, 0.7) : edge < 0.5 ? (Math.random() < 0.5 ? r.top : r.bottom) : r.top + rand(0, 1) * r.height;
    a.tx = Math.min(vw - 40, Math.max(8, px)) - lr.left;
    a.ty = py - lr.top;
    a.idle = texty ? { verb: Math.random() < 0.5 ? "corrigiendo" : "escribiendo", kind: "ibeam" } : IDLE[Math.floor(Math.random() * IDLE.length)];
    // A veces marca el bloque con un recuadro de selección, como en un editor.
    if (!texty && this.flashes < 5 && Math.random() < 0.5) this.flash(n, CREW[this.agents.indexOf(a)].color, now);
  }

  private flash(n: HTMLElement, color: string, now: number) {
    this.flashes++;
    const lr = this.layer.getBoundingClientRect();
    const r = n.getBoundingClientRect();
    const f = document.createElement("div");
    f.className = "crew-flash";
    f.style.cssText = `left:${r.left - lr.left - 4}px;top:${r.top - lr.top - 4}px;width:${r.width + 8}px;height:${r.height + 8}px;border-color:${color};background:${rgba(color, 0.05)}`;
    f.innerHTML = `<i class="tl" style="border-color:${color}"></i><i class="tr" style="border-color:${color}"></i><i class="bl" style="border-color:${color}"></i><i class="br" style="border-color:${color}"></i>`;
    this.layer.appendChild(f);
    void now;
    gsap.timeline({ delay: 0.9, onComplete: () => { f.remove(); this.flashes--; } })
      .fromTo(f, { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" })
      .to(f, { opacity: 0, duration: 0.5 }, "+=0.9");
  }

  private tick = () => {
    if (!this.visible) return;
    const lr = this.layer.getBoundingClientRect();
    const now = performance.now();
    const vw = innerWidth, vh = innerHeight;
    const busy = new Map<number, Task>();
    this.tasks.forEach((t) => {
      const p = t.tl.progress();
      if (p > 0.0005 && p < 0.9995) busy.set(t.agent, t);
    });
    this.agents.forEach((a, i) => {
      const t = busy.get(i);
      let tx: number, ty: number, k: number, verb: string, kind: Kind, scale = 1;
      if (t) {
        tx = t.probe.x + lr.left; ty = t.probe.y + lr.top; k = 0.32;
        verb = t.probe.verb; kind = t.probe.kind; scale = t.probe.scale || 1;
        a.next = now + rand(400, 1200); // al terminar, descansa un instante y sigue
      } else {
        let sy = a.ty + lr.top;
        if (now > a.next || sy < 30 || sy > vh - 20) { this.pick(a, lr, now); sy = a.ty + lr.top; }
        tx = a.tx + lr.left + Math.sin(now / 900 + i) * 7;
        ty = sy + Math.cos(now / 1100 + i * 1.7) * 5;
        k = 0.05; verb = a.idle.verb; kind = a.idle.kind;
      }
      // Siempre dentro de la pantalla, con espacio para la etiqueta.
      a.x += (Math.min(vw - (vw < 640 ? 84 : 130), Math.max(4, tx)) - a.x) * k;
      a.y += (Math.min(vh - 22, Math.max(-6, ty)) - a.y) * k;
      a.el.style.transform = `translate3d(${a.x.toFixed(1)}px,${a.y.toFixed(1)}px,0) scale(${scale})`;
      if (verb !== a.verb) { a.verb = verb; a.small.textContent = verb; }
      if (kind !== a.kind) { a.el.classList.remove(`k-${a.kind}`); a.el.classList.add(`k-${kind}`); a.kind = kind; }
    });
  };

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
  bind(tl: gsap.core.Timeline) {
    this.pending.forEach((p) => {
      const t: Task = { probe: p, tl, agent: (p as Probe & { agent: number }).agent };
      this.tasks.push(t);
      this.dir.add(t);
    });
    this.pending = [];
  }

  frame(m: Member) {
    const f = document.createElement("div");
    f.className = "crew-frame";
    f.style.setProperty("--c", m.color);
    f.innerHTML = '<i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i><span class="dim"></span>';
    return this.add(f);
  }
  sel(m: Member) {
    const s = document.createElement("div");
    s.className = "crew-sel";
    s.style.borderColor = m.color;
    s.style.background = rgba(m.color, 0.1);
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
    this.bind(t);
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
    const dim = f.querySelector<HTMLElement>(".dim")!;
    const B = () => this.box(el);
    const k = 0.16;
    const tl = this.tl(vars);
    tl.fromTo(c, { x: () => this.cx(B().x + B().w * k + 80), y: () => B().y + B().h * k + 70 }, { x: () => this.cx(B().x + B().w * k), y: () => B().y + B().h * k, duration: 0.25, ease: "power2.out" })
      .fromTo(f, { x: () => B().x, y: () => B().y, width: () => B().w * k, height: () => B().h * k, opacity: 0 }, { opacity: 1, duration: 0.08 }, "<0.15")
      .fromTo(el, { clipPath: () => `inset(0px ${B().w * (1 - k)}px ${B().h * (1 - k)}px 0px round ${radius}px)` }, { clipPath: `inset(-60px -60px -60px -60px round ${radius}px)`, duration: 0.6, ease: "power2.inOut" })
      .to(f, { width: () => B().w, height: () => B().h, duration: 0.6, ease: "power2.inOut", onUpdate: () => { dim.textContent = `${Math.round(Number(gsap.getProperty(f, "width")))} × ${Math.round(Number(gsap.getProperty(f, "height")))}`; } }, "<")
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
      .fromTo(rp, { x: () => B().x + B().w / 2, y: () => B().y + B().h / 2, scale: 0.2, opacity: 0.9 }, { scale: 1.6, opacity: 0, duration: 0.3 })
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
