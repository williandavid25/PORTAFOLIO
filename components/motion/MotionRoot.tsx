"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

type Ctx = { stop: () => void; start: () => void; scrollTo: (target: string | HTMLElement | number) => void };
const MotionCtx = createContext<Ctx>({ stop() {}, start() {}, scrollTo() {} });
export const useMotion = () => useContext(MotionCtx);

/** Evento global: la pantalla de carga terminó y el hero puede animarse. */
export function onReady(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const w = window as unknown as { __pfReady?: boolean };
  if (w.__pfReady) {
    cb();
    return () => {};
  }
  window.addEventListener("pf:ready", cb, { once: true });
  return () => window.removeEventListener("pf:ready", cb);
}
export function markReady() {
  const w = window as unknown as { __pfReady?: boolean };
  if (w.__pfReady) return;
  w.__pfReady = true;
  window.dispatchEvent(new Event("pf:ready"));
}

const isFine = () => window.matchMedia("(pointer: fine)").matches;
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Parte un texto en palabras (con máscara) conservando <em>, <br>, etc. */
export function splitWords(el: HTMLElement): HTMLElement[] {
  if (el.dataset.splitDone) return Array.from(el.querySelectorAll<HTMLElement>(".wi"));
  const walk = (node: Node) => {
    Array.from(node.childNodes).forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        (n.textContent ?? "").split(/(\s+)/).forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) return void frag.appendChild(document.createTextNode(" "));
          const w = document.createElement("span");
          w.className = "w";
          const i = document.createElement("span");
          i.className = "wi";
          i.textContent = p;
          w.appendChild(i);
          frag.appendChild(w);
        });
        n.parentNode?.replaceChild(frag, n);
      } else if (n.nodeType === 1 && (n as HTMLElement).tagName !== "BR") walk(n);
    });
  };
  walk(el);
  el.dataset.splitDone = "1";
  return Array.from(el.querySelectorAll<HTMLElement>(".wi"));
}

export function splitChars(el: HTMLElement): HTMLElement[] {
  const text = el.textContent ?? "";
  el.textContent = "";
  return Array.from(text).map((c) => {
    const s = document.createElement("span");
    s.className = "lc";
    s.textContent = c === " " ? " " : c;
    el.appendChild(s);
    return s;
  });
}

export default function MotionRoot({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  // ---- Desplazamiento suave + cursor + barra de progreso (una sola vez) ----
  useEffect(() => {
    const lenis = reduced() ? null : new Lenis({ duration: 1.1, smoothWheel: true, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    lenisRef.current = lenis;
    const tick = (t: number) => lenis?.raf(t * 1000);
    if (lenis) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }

    // Enlaces internos (#seccion o /#seccion) con desplazamiento suave.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href*='#']");
      if (!a || e.metaKey || e.ctrlKey) return;
      const url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname || !url.hash) return;
      const t = document.querySelector<HTMLElement>(url.hash);
      if (!t) return;
      e.preventDefault();
      e.stopPropagation(); // evita que el Link de Next salte de golpe
      document.body.classList.remove("menu-open");
      if (lenis) lenis.scrollTo(t, { offset: url.hash === "#inicio" ? 0 : -70, duration: 1.5 });
      else t.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", url.hash);
    };
    document.addEventListener("click", onClick, true);

    // Barra de progreso de lectura.
    const prog = document.querySelector<HTMLElement>(".progress");
    const progTween = prog ? gsap.to(prog, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } }) : null;

    // Cursor personalizado (solo con mouse).
    let cleanupCursor = () => {};
    if (isFine()) {
      const dot = document.querySelector<HTMLElement>(".cur-dot");
      const ring = document.querySelector<HTMLElement>(".cur-ring");
      if (dot && ring) {
        document.body.classList.add("has-cursor");
        gsap.set([dot, ring], { x: innerWidth / 2, y: innerHeight / 2, opacity: 0 });
        const dx = gsap.quickTo(dot, "x", { duration: 0.08 }), dy = gsap.quickTo(dot, "y", { duration: 0.08 });
        const rx = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3" }), ry = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3" });
        const move = (e: PointerEvent) => {
          if (e.pointerType !== "mouse") return;
          dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
          gsap.to([dot, ring], { opacity: 1, duration: 0.2, overwrite: "auto" });
        };
        const over = (e: Event) => {
          const t = e.target as HTMLElement;
          const view = t.closest("[data-cursor='view']");
          const hov = t.closest("a,button,input,textarea,select,label,[data-tilt]");
          document.body.classList.toggle("cur-view", !!view);
          document.body.classList.toggle("cur-hover", !view && !!hov);
        };
        const leave = () => gsap.to([dot, ring], { opacity: 0, duration: 0.2 });
        addEventListener("pointermove", move, { passive: true });
        document.addEventListener("pointerover", over);
        document.documentElement.addEventListener("pointerleave", leave);
        cleanupCursor = () => {
          removeEventListener("pointermove", move);
          document.removeEventListener("pointerover", over);
          document.documentElement.removeEventListener("pointerleave", leave);
          document.body.classList.remove("has-cursor", "cur-view", "cur-hover");
        };
      }
    }

    return () => {
      document.removeEventListener("click", onClick, true);
      progTween?.scrollTrigger?.kill();
      progTween?.kill();
      cleanupCursor();
      if (lenis) gsap.ticker.remove(tick);
      lenis?.destroy();
      lenisRef.current = null;
    };
  }, []);

  // ---- Animaciones de cada página (se rehacen al cambiar de ruta) ----
  useEffect(() => {
    lenisRef.current?.scrollTo(0, { immediate: true });
    const fine = isFine();
    const cleanups: Array<() => void> = [];
    const ctx = gsap.context(() => {
      // Títulos que aparecen palabra por palabra.
      document.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
        const words = splitWords(el);
        gsap.from(words, { yPercent: 115, rotate: 4, duration: 1.25, stagger: 0.06, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
      });

      // Bloques que suben al entrar en pantalla (en grupos, con desfase).
      const reveals = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      gsap.set(reveals, { y: 46, opacity: 0 });
      ScrollTrigger.batch(reveals, {
        start: "top 90%",
        once: true,
        onEnter: (b) => gsap.to(b, { y: 0, opacity: 1, duration: 1.1, stagger: 0.09, ease: "expo.out", overwrite: true }),
      });

      // Contadores.
      document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
        const target = Number(el.dataset.count) || 0;
        const suffix = el.dataset.suffix ?? "";
        const o = { v: 0 };
        el.textContent = `0${suffix}`;
        ScrollTrigger.create({
          trigger: el, start: "top 92%", once: true,
          onEnter: () => gsap.to(o, { v: target, duration: 2.2, ease: "power3.out", onUpdate: () => { el.textContent = `${Math.round(o.v)}${suffix}`; } }),
        });
      });

      // Barras de habilidades.
      document.querySelectorAll<HTMLElement>("[data-skill]").forEach((el, i) => {
        gsap.from(el, { width: 0, duration: 1.8, delay: 0.12 * i, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 92%" } });
      });

      // Parallax suave en imágenes.
      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
        gsap.fromTo(el, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: el.parentElement ?? el, start: "top bottom", end: "bottom top", scrub: true } });
      });

      // Marquesina infinita que reacciona a la velocidad del scroll.
      document.querySelectorAll<HTMLElement>("[data-marquee]").forEach((track) => {
        const tw = gsap.to(track, { xPercent: -50, duration: 34, ease: "none", repeat: -1 });
        const skew = gsap.quickTo(track, "skewX", { duration: 0.5, ease: "power3" });
        let settle: gsap.core.Tween | null = null;
        ScrollTrigger.create({
          trigger: track, start: "top bottom", end: "bottom top",
          onToggle: (s) => (s.isActive ? tw.play() : tw.pause()),
          onUpdate: (s) => {
            const v = s.getVelocity();
            tw.timeScale(gsap.utils.clamp(-4, 4, 1 + (v / 500) * s.direction));
            skew(gsap.utils.clamp(-7, 7, v / -320));
            settle?.kill();
            settle = gsap.to(tw, { timeScale: 1, duration: 0.9, delay: 0.15 });
          },
        });
      });

      // Línea del proceso que se dibuja con el scroll.
      document.querySelectorAll<HTMLElement>("[data-steps]").forEach((wrap) => {
        const fill = wrap.querySelector(".steps-fill");
        if (fill) gsap.fromTo(fill, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { trigger: wrap, start: "top 75%", end: "bottom 55%", scrub: 0.6 } });
        wrap.querySelectorAll<HTMLElement>(".step").forEach((s, i) => {
          ScrollTrigger.create({ trigger: wrap, start: `top ${76 - i * 4}%`, onEnter: () => s.classList.add("on"), onLeaveBack: () => s.classList.remove("on") });
        });
      });

      // Nombre gigante del pie.
      document.querySelectorAll<HTMLElement>("[data-bigname]").forEach((el) => {
        const chars = splitChars(el);
        gsap.from(chars, { yPercent: 100, opacity: 0, stagger: 0.05, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 96%" } });
      });
    });

    // Tarjetas con inclinación 3D y luz que sigue al puntero.
    document.querySelectorAll<HTMLElement>("[data-tilt]").forEach((card) => {
      const move = (e: PointerEvent) => {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        card.style.setProperty("--mx", `${x}px`);
        card.style.setProperty("--my", `${y}px`);
        if (fine) gsap.to(card, { rotateY: (x / r.width - 0.5) * 8, rotateX: (y / r.height - 0.5) * -8, transformPerspective: 900, duration: 0.6, ease: "power3" });
      };
      const leave = () => gsap.to(card, { rotateX: 0, rotateY: 0, duration: 1, ease: "elastic.out(1,.4)" });
      card.addEventListener("pointermove", move);
      card.addEventListener("pointerleave", leave);
      cleanups.push(() => { card.removeEventListener("pointermove", move); card.removeEventListener("pointerleave", leave); });
    });

    // Botones magnéticos.
    if (fine) {
      document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
        const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3" }), yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3" });
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * 0.3);
          yTo((e.clientY - r.top - r.height / 2) * 0.35);
        };
        const leave = () => gsap.to(el, { x: 0, y: 0, duration: 1, ease: "elastic.out(1,.35)" });
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", leave);
        cleanups.push(() => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); });
      });
    }

    const refresh = () => ScrollTrigger.refresh();
    const t = setTimeout(refresh, 400);
    window.addEventListener("load", refresh);
    if (location.hash) {
      const target = document.querySelector<HTMLElement>(location.hash);
      if (target) setTimeout(() => lenisRef.current?.scrollTo(target, { offset: -70, immediate: true }), 60);
    }
    return () => {
      clearTimeout(t);
      window.removeEventListener("load", refresh);
      cleanups.forEach((c) => c());
      ctx.revert();
    };
  }, [pathname]);

  const api: Ctx = {
    stop: () => lenisRef.current?.stop(),
    start: () => lenisRef.current?.start(),
    scrollTo: (target) => {
      if (lenisRef.current) lenisRef.current.scrollTo(target as HTMLElement, { offset: -70 });
    },
  };

  return (
    <MotionCtx.Provider value={api}>
      <div className="progress" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="cur-dot" aria-hidden="true" />
      <div className="cur-ring" aria-hidden="true"><span>Ver</span></div>
      {children}
    </MotionCtx.Provider>
  );
}
