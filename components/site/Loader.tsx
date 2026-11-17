"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { markReady, splitChars } from "@/components/motion/MotionRoot";

/** Pantalla de carga: solo la primera vez por sesión y solo en la portada. */
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
    const chars = splitChars(el.querySelector<HTMLElement>(".loader-name")!);
    const num = el.querySelector<HTMLElement>(".loader-count span")!;
    const bar = el.querySelector<HTMLElement>(".loader-bar i")!;
    const o = { v: 0 };
    const tl = gsap.timeline({ onComplete: () => setShow(false) });
    tl.from(chars, { yPercent: 110, opacity: 0, stagger: 0.06, duration: 1, ease: "expo.out" }, 0)
      .to(o, { v: 100, duration: 1.5, ease: "power2.inOut", onUpdate: () => { num.textContent = String(Math.round(o.v)); bar.style.transform = `scaleX(${o.v / 100})`; } }, 0)
      .to(chars, { yPercent: -110, opacity: 0, stagger: 0.03, duration: 0.55, ease: "expo.in" })
      .to(el.querySelectorAll(".loader-top,.loader-bot"), { opacity: 0, duration: 0.35 }, "<")
      .to(el, { clipPath: "inset(0 0 100% 0)", duration: 1.05, ease: "expo.inOut" }, "-=.1")
      .add(markReady, "-=.7");
    return () => { tl.kill(); };
  }, []);

  if (!show) return null;
  return (
    <div className="loader" ref={ref} aria-hidden="true">
      <div className="loader-glow" />
      <div className="loader-top"><span>Portfolio</span><span>{new Date().getFullYear()}</span></div>
      <div className="loader-mid"><span className="loader-name">{name}</span></div>
      <div className="loader-bot"><div className="loader-bar"><i /></div><div className="loader-count"><span>0</span></div></div>
    </div>
  );
}
