"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { markReady, splitChars } from "@/components/motion/MotionRoot";
import { endCrewFlock, lowerCrew, startCrewFlock } from "@/components/motion/Crew";
import { isRunning, sfx, unlockAudio } from "@/components/motion/sfx";

/**
 * Pantalla de carga de la portada (cada vez que se abre la página).
 * PORTFOLIO sube letra por letra mientras los punteros vuelan como avioncitos.
 * Al llegar a 100 aparece «Entrar»: ese toque es el que permite el sonido (los
 * navegadores no dejan sonar una página sin un toque). Si el navegador ya permite
 * el sonido, entra sola. Al entrar: impacto + whoosh y los punteros construyen la portada.
 */
export default function Loader({ name }: { name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(true);
  const [gate, setGate] = useState(false);
  const enterRef = useRef<() => void>(() => {});

  useEffect(() => {
    const el = ref.current;
    const w = window as unknown as { __pfLoader?: boolean };
    // Una vez por carga de la página (al volver a la portada sin recargar, no se repite).
    if (!el || w.__pfLoader || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShow(false);
      markReady();
      return;
    }
    w.__pfLoader = true;
    const layer = document.querySelector<HTMLElement>(".crew");
    if (layer) startCrewFlock(layer);
    unlockAudio();

    const chars = splitChars(el.querySelector<HTMLElement>(".loader-name")!);
    const num = el.querySelector<HTMLElement>(".loader-count span")!;
    const o = { v: 0 };
    let entered = false;
    let outro: gsap.core.Timeline | null = null;

    const enter = () => {
      if (entered) return;
      entered = true;
      setGate(false);
      const go = () => {
        outro = gsap.timeline({ onComplete: () => { lowerCrew(); setShow(false); } });
        outro
          // Los punteros rompen la formación y van a construir la portada.
          .add(() => { endCrewFlock(); sfx.impact(); sfx.whoosh(0.9, 0.55); })
          .to(el.querySelector(".loader-enter"), { opacity: 0, y: 12, duration: 0.25 }, 0)
          .to(chars, { yPercent: -105, stagger: 0.025, duration: 0.35, ease: "expo.in" }, 0)
          .to(el.querySelectorAll(".loader-top,.loader-bot"), { opacity: 0, duration: 0.35 }, "<")
          .to(el, { clipPath: "inset(0 0 100% 0)", duration: 0.7, ease: "expo.inOut" }, "-=.12")
          .add(markReady, "-=.35");
      };
      // Espera (máx. 250 ms) a que el audio arranque para que el impacto se oiga.
      Promise.race([unlockAudio(), new Promise((r) => setTimeout(r, 250))]).then(go);
    };
    enterRef.current = enter;

    const intro = gsap.timeline({
      onComplete: () => {
        if (isRunning()) enter(); // el navegador ya deja sonar: entra sola
        else setGate(true);
      },
    });
    intro.from(chars, { yPercent: 105, stagger: 0.045, duration: 0.75, ease: "expo.out" }, 0.05)
      .call(() => sfx.riser(1.05), undefined, 0)
      .to(o, { v: 100, duration: 0.95, ease: "power2.inOut", onUpdate: () => { num.textContent = String(Math.round(o.v)); } }, 0);
    // Cada letra suena al llegar a su lugar.
    chars.forEach((_, i) => intro.call(() => sfx.land(), undefined, 0.05 + i * 0.045 + 0.14));

    // Tocar en cualquier parte de la pantalla de carga (o Enter / espacio) también entra.
    const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enter(); } };
    const onTap = () => { if (intro.progress() > 0.6) enter(); else unlockAudio(); };
    el.addEventListener("pointerdown", onTap);
    window.addEventListener("keydown", onKey);
    return () => {
      intro.kill(); outro?.kill();
      el.removeEventListener("pointerdown", onTap);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!show) return null;
  return (
    <div className={`loader${gate ? " gated" : ""}`} ref={ref}>
      <div className="loader-glow" aria-hidden="true" />
      <div className="loader-top" aria-hidden="true"><span>{name}</span><span>{new Date().getFullYear()}</span></div>
      <div className="loader-mid">
        <span className="loader-name" aria-hidden="true">Portfolio</span>
        <button type="button" className="loader-enter" tabIndex={gate ? 0 : -1} aria-hidden={!gate} onClick={() => enterRef.current()}>
          <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>
          Entrar
        </button>
      </div>
      <div className="loader-bot" aria-hidden="true"><span className="loader-hint">{gate ? "Toca para entrar · con sonido" : "Construyendo la experiencia"}</span><div className="loader-count"><span>0</span></div></div>
    </div>
  );
}
