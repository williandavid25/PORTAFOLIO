"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { Crew, destroyDirector, onScroll, showCrew } from "./Crew";
import { splitChars, splitWords } from "./split";

gsap.registerPlugin(ScrollTrigger);
export { splitChars, splitWords };

type Ctx = { stop: () => void; start: () => void };
const MotionCtx = createContext<Ctx>({ stop() {}, start() {} });
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

export default function MotionRoot({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // ---- Equipos lentos: activa el modo liviano (mismas animaciones, efectos caros desactivados) ----
  useEffect(() => {
    const root = document.documentElement;
    const nav = navigator as Navigator & { deviceMemory?: number };
    if ((nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4) root.classList.add("lowfx");
    // Medición real: si en 2 s los cuadros van lentos, también pasa a modo liviano.
    let frames = 0, raf = 0;
    const start = performance.now();
    const loop = () => {
      frames++;
      if (performance.now() - start < 2000) raf = requestAnimationFrame(loop);
      else if (frames / 2 < 45) root.classList.add("lowfx");
    };
    const t = setTimeout(() => { raf = requestAnimationFrame(loop); }, 2500);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, []);

  // ---- Desplazamiento suave + barra de progreso (una sola vez) ----
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

    const prog = document.querySelector<HTMLElement>(".progress");
    const progTween = prog ? gsap.to(prog, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } }) : null;

    return () => {
      document.removeEventListener("click", onClick, true);
      progTween?.scrollTrigger?.kill();
      progTween?.kill();
      if (lenis) gsap.ticker.remove(tick);
      lenis?.destroy();
      lenisRef.current = null;
      destroyDirector();
    };
  }, []);

  // ---- Animaciones de cada página (se rehacen al cambiar de ruta) ----
  useEffect(() => {
    lenisRef.current?.scrollTo(0, { immediate: true });
    const fine = isFine();
    const layer = layerRef.current;
    const cleanups: Array<() => void> = [];
    // El hero usa los 10 primeros punteros; las secciones siguen desde el 11.º.
    const crew = layer ? new Crew(layer, 10) : null;

    const ctx = gsap.context(() => {
      const crewOwned = (el: Element) => el.closest("[data-crew]") !== null && (el as HTMLElement).dataset.crew !== undefined;

      // ---- El equipo de punteros construye cada sección al bajar ----
      if (crew) {
        // Palabra grande (se escribe) + texto manuscrito (se firma).
        document.querySelectorAll<HTMLElement>(".stitle").forEach((t) => {
          const main = t.querySelector<HTMLElement>(".stitle-main");
          const script = t.querySelector<HTMLElement>(".stitle-script");
          if (main) crew.type(main, onScroll(t, "top 92%", "top 52%"));
          if (script) crew.sign(script, onScroll(t, "top 72%", "top 38%"));
        });
        // Títulos en serif (ej. página de un proyecto).
        document.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => crew.write(el, onScroll(el, "top 92%", "top 58%")));

        document.querySelectorAll<HTMLElement>("[data-crew]").forEach((el, i) => {
          const kind = el.dataset.crew;
          const lag = (i % 3) * 4; // tarjetas de una misma fila: arrancan escalonadas
          const st = onScroll(el, `top ${90 - lag}%`, `top ${45 - lag}%`);
          if (kind === "stretch") crew.stretch(el, Number(el.dataset.radius ?? 22), st);
          else if (kind === "drag-left") crew.drag(el, "left", st);
          else if (kind === "drag-right") crew.drag(el, "right", st);
          else if (kind === "select") crew.select(el, st);
        });

        // Cifras: un clic y cuentan.
        document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
          crew.count(el, Number(el.dataset.count) || 0, el.dataset.suffix ?? "", onScroll(el, "top 92%", "top 62%"));
        });
        // Barras de habilidades: se arrastran hasta su nivel.
        document.querySelectorAll<HTMLElement>("[data-skill]").forEach((el, i) => {
          crew.fill(el, Number(el.dataset.skill) || 0, onScroll(el, `top ${92 - i * 3}%`, `top ${60 - i * 3}%`));
        });
        // Línea del proceso.
        document.querySelectorAll<HTMLElement>("[data-steps]").forEach((wrap) => {
          const fill = wrap.querySelector<HTMLElement>(".steps-fill");
          if (fill && getComputedStyle(fill.parentElement!).display !== "none") crew.draw(fill, onScroll(wrap, "top 75%", "bottom 60%"));
          wrap.querySelectorAll<HTMLElement>(".step").forEach((s, i) => {
            ScrollTrigger.create({ trigger: wrap, start: `top ${74 - i * 3}%`, onEnter: () => s.classList.add("on"), onLeaveBack: () => s.classList.remove("on") });
          });
        });
      }

      // ---- Lo demás aparece con un deslizamiento suave ----
      const reveals = gsap.utils.toArray<HTMLElement>("[data-reveal]").filter((el) => !crewOwned(el));
      gsap.set(reveals, { y: 46, opacity: 0 });
      ScrollTrigger.batch(reveals, {
        start: "top 90%",
        once: true,
        onEnter: (b) => gsap.to(b, { y: 0, opacity: 1, duration: 1.1, stagger: 0.09, ease: "expo.out", overwrite: true }),
      });

      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
        gsap.fromTo(el, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: el.parentElement ?? el, start: "top bottom", end: "bottom top", scrub: true } });
      });

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

      document.querySelectorAll<HTMLElement>("[data-bigname]").forEach((el) => {
        const chars = splitChars(el);
        gsap.from(chars, { yPercent: 100, opacity: 0, stagger: 0.05, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 96%" } });
      });
    });

    // Inclinación 3D y luz que sigue al puntero (solo con mouse).
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

    // Sin pantalla de carga (otras páginas o visita repetida), el equipo entra de una vez.
    if (!document.querySelector(".loader")) markReady();
    cleanups.push(onReady(showCrew));

    const refresh = () => ScrollTrigger.refresh();
    const t = setTimeout(refresh, 400);
    window.addEventListener("load", refresh);
    document.fonts?.ready.then(refresh).catch(() => {});
    if (location.hash) {
      const target = document.querySelector<HTMLElement>(location.hash);
      if (target) setTimeout(() => lenisRef.current?.scrollTo(target, { offset: -70, immediate: true }), 60);
    }
    return () => {
      clearTimeout(t);
      window.removeEventListener("load", refresh);
      cleanups.forEach((c) => c());
      crew?.destroy();
      ctx.revert();
    };
  }, [pathname]);

  const api: Ctx = { stop: () => lenisRef.current?.stop(), start: () => lenisRef.current?.start() };

  return (
    <MotionCtx.Provider value={api}>
      <div className="progress" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="page-wrap">
        <div className="crew" ref={layerRef} aria-hidden="true" />
        {children}
      </div>
    </MotionCtx.Provider>
  );
}
