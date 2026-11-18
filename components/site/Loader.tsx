"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { markReady, splitChars } from "@/components/motion/MotionRoot";
import { endCrewFlock, lowerCrew, startCrewFlock } from "@/components/motion/Crew";

/**
 * Pantalla de carga (solo la primera vez por sesión y solo en la portada).
 * En lugar de una barra, el equipo de punteros vuela en formación como avioncitos
 * alrededor del nombre; al terminar, esos mismos punteros salen a construir la portada.
 */
export default function Loader({ name }: { name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const el = ref.current;
    let seen = false;
    try { seen = sessionStorage.getItem("pf-loaded") === "1"; } catch {}
    if (!el || seen || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShow(false);
      markReady();
      return;
    }
    try { sessionStorage.setItem("pf-loaded", "1"); } catch {}
    const layer = document.querySelector<HTMLElement>(".crew");
    if (layer) startCrewFlock(layer);

    const chars = splitChars(el.querySelector<HTMLElement>(".loader-name")!);
    const num = el.querySelector<HTMLElement>(".loader-count span")!;
    const o = { v: 0 };
    const tl = gsap.timeline({ onComplete: () => { lowerCrew(); setShow(false); } });
    tl.from(chars, { yPercent: 110, opacity: 0, stagger: 0.03, duration: 0.6, ease: "expo.out" }, 0.05)
      .to(o, { v: 100, duration: 0.95, ease: "power2.inOut", onUpdate: () => { num.textContent = String(Math.round(o.v)); } }, 0)
      // Termina la carga: los punteros rompen la formación y van a construir la portada.
      .add(endCrewFlock)
      .add(markReady)
      .to(chars, { yPercent: -110, opacity: 0, stagger: 0.02, duration: 0.3, ease: "expo.in" })
      .to(el.querySelectorAll(".loader-top,.loader-bot"), { opacity: 0, duration: 0.35 }, "<")
      .to(el, { clipPath: "inset(0 0 100% 0)", duration: 0.7, ease: "expo.inOut" }, "-=.12");
    return () => { tl.kill(); };
  }, []);

  if (!show) return null;
  return (
    <div className="loader" ref={ref} aria-hidden="true">
      <div className="loader-glow" />
      <div className="loader-top"><span>Portfolio</span><span>{new Date().getFullYear()}</span></div>
      <div className="loader-mid"><span className="loader-name">{name}</span></div>
      <div className="loader-bot"><span className="loader-hint">Construyendo la experiencia</span><div className="loader-count"><span>0</span></div></div>
    </div>
  );
}
