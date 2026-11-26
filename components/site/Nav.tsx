"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const LINKS = [
  { href: "/#inicio", id: "inicio", label: "Inicio" },
  { href: "/#sobre-mi", id: "sobre-mi", label: "Sobre mí" },
  { href: "/#servicios", id: "servicios", label: "Servicios" },
  { href: "/portafolio", id: "portafolio", label: "Portafolio" },
  { href: "/#testimonios", id: "testimonios", label: "Testimonios" },
  { href: "/#contacto", id: "contacto", label: "Contacto" },
  { href: "/lab", id: "lab", label: "Lab" },
];

export default function Nav({ name, role }: { name: string; role: string }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current!, pill = pillRef.current!;
    const ind = pill.querySelector<HTMLElement>(".pill-ind")!;
    const links = Array.from(pill.querySelectorAll<HTMLAnchorElement>("a"));
    let active: HTMLAnchorElement | undefined = pathname.startsWith("/portafolio") ? links.find((l) => l.dataset.id === "portafolio") : links[0];
    const moveTo = (a?: HTMLAnchorElement) => {
      if (!a) return void gsap.to(ind, { opacity: 0, duration: 0.3 });
      gsap.to(ind, { x: a.offsetLeft, width: a.offsetWidth, opacity: 1, duration: 0.6, ease: "expo.out" });
    };
    const setActive = (a?: HTMLAnchorElement) => { active = a; links.forEach((l) => l.classList.toggle("on", l === a)); moveTo(a); };
    setActive(active);

    const triggers: ScrollTrigger[] = [ScrollTrigger.create({ start: 60, end: 1e7, onToggle: (s) => nav.classList.toggle("scrolled", s.isActive) })];
    if (pathname === "/") {
      links.forEach((l) => {
        const sec = document.getElementById(l.dataset.id!);
        if (sec) triggers.push(ScrollTrigger.create({ trigger: sec, start: "top 45%", end: "bottom 45%", onToggle: (s) => s.isActive && setActive(l) }));
      });
    }
    const enters = links.map((l) => { const f = () => moveTo(l); l.addEventListener("pointerenter", f); return () => l.removeEventListener("pointerenter", f); });
    const leave = () => moveTo(active);
    pill.addEventListener("pointerleave", leave);
    const onResize = () => moveTo(active);
    addEventListener("resize", onResize);
    return () => {
      triggers.forEach((t) => t.kill());
      enters.forEach((f) => f());
      pill.removeEventListener("pointerleave", leave);
      removeEventListener("resize", onResize);
      document.body.classList.remove("menu-open");
    };
  }, [pathname]);

  const close = () => document.body.classList.remove("menu-open");
  return (
    <>
      <header className="nav" ref={navRef}>
        <div className="nav-in" data-nav>
          <Link href="/" className="logo" data-magnetic aria-label={`${name} — inicio`}>
            <span className="logo-mark">{name.charAt(0).toUpperCase()}</span>
            <span className="logo-txt"><b>{name}</b><i>{role}</i></span>
          </Link>
          <nav className="pill" ref={pillRef} aria-label="Principal">
            <span className="pill-ind" />
            {LINKS.map((l) => <Link key={l.id} href={l.href} data-id={l.id}>{l.label}</Link>)}
          </nav>
          <button className="burger" aria-label="Abrir menú" onClick={() => document.body.classList.toggle("menu-open")}><span /><span /></button>
        </div>
      </header>
      <div className="mnav">
        {LINKS.map((l, i) => <Link key={l.id} href={l.href} onClick={close}><small>0{i + 1}</small>{l.label}</Link>)}
      </div>
    </>
  );
}
