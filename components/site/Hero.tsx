"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { onReady, splitWords } from "@/components/motion/MotionRoot";
import { Crew, showCrew } from "@/components/motion/Crew";
import Icon, { PlayIcon } from "./Icon";
import Socials from "./Socials";
import type { SiteData } from "@/lib/content";

type Props = { site: SiteData; mediaUrl: string | null; reelHref: string };

export default function Hero({ site, mediaUrl, reelHref }: Props) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current!;
    const q = gsap.utils.selector(el);
    const fine = matchMedia("(pointer: fine)").matches;
    const cleanups: Array<() => void> = [];

    const ctx = gsap.context(() => {
      // Título letra por letra.
      const words = splitWords(q(".hh")[0] as HTMLElement);
      const chars: HTMLElement[] = [];
      words.forEach((w) => {
        const t = w.textContent ?? "";
        w.textContent = "";
        Array.from(t).forEach((c) => { const s = document.createElement("span"); s.style.display = "inline-block"; s.textContent = c; w.appendChild(s); chars.push(s); });
      });

      // Movimiento continuo: arranca cuando termina la entrada (si no, partiría desde 0).
      const loops = () => {
        gsap.fromTo(q(".hglow"), { scale: 1, opacity: 1 }, { scale: 1.08, opacity: 0.82, duration: 4, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.to(q(".hbadge"), { y: -12, duration: 3, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.to(q(".hvis-media"), { y: -10, duration: 4.5, ease: "sine.inOut", yoyo: true, repeat: -1 });
      };
      const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" }, onComplete: loops });
      tl.from(q(".hero-card"), { scale: 0.94, opacity: 0, duration: 1.5 }, 0)
        .from(q(".hglow"), { scale: 0.2, opacity: 0, duration: 2.3 }, 0.1)
        .from(document.querySelectorAll("[data-nav] > *"),{ y: -36, opacity: 0, stagger: 0.08, duration: 1.1 }, 0.3)
        .fromTo(q(".hvis-media"), { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.8, ease: "expo.inOut", clearProps: "clipPath" }, 0.25)
        .from(q(".hvis-media > *"), { scale: 1.22, yPercent: 6, duration: 2.3, transformOrigin: "50% 100%" }, 0.25)
        .from(q(".chip"), { y: 22, opacity: 0, duration: 1 }, 0.7)
        .from(chars, { yPercent: 115, rotate: 6, opacity: 0, duration: 1.25, stagger: 0.032 }, 0.75)
        .from(q(".htag"), { opacity: 0, letterSpacing: "0.9em", duration: 1.7, ease: "power4.out" }, 1)
        .from(q(".hdesc"), { y: 24, opacity: 0, duration: 1.1 }, 1.1)
        .from(q(".hctas > *"), { y: 24, opacity: 0, stagger: 0.1, duration: 1.1 }, 1.2)
        .from(q(".socials > *"), { y: 14, opacity: 0, stagger: 0.06, duration: 0.9 }, 1.35)
        .from(q(".hbadge"), { scale: 0, opacity: 0, rotate: -10, ease: "back.out(2)", duration: 1 }, 1.4)
        .from(q(".hplay"), { scale: 0, opacity: 0, rotate: -90, ease: "back.out(1.8)", duration: 1.1 }, 1.5)
        .from(q(".hscroll"), { opacity: 0, x: 20, duration: 1 }, 1.6);
      // ---- El equipo arranca en la portada: uno escribe, otro estira la foto, otro hace clic ----
      const layer = document.querySelector<HTMLElement>(".crew");
      if (layer) {
        const crew = new Crew(layer, 0);
        cleanups.push(() => crew.destroy());
        const hhEl = q(".hh")[0] as HTMLElement, mediaEl = q(".hvis-media")[0] as HTMLElement;
        const btn = q(".hctas .btn-p")[0] as HTMLElement | undefined;
        const H = () => crew.box(hhEl), M = () => crew.box(mediaEl);

        const writer = crew.cursor(crew.next(), "escribiendo", true);
        tl.fromTo(writer, { x: () => H().x - 70, y: () => H().y + H().h + 30, opacity: 0 }, { x: () => H().x - 6, y: () => H().y + H().h * 0.25, opacity: 1, duration: 0.35, ease: "power2.out" }, 0.45)
          .to(writer, { x: () => H().x + H().w, y: () => H().y + H().h * 0.62, duration: 1.45, ease: "none" }, 0.8)
          .to(writer, { x: "+=50", y: "+=50", opacity: 0, duration: 0.4, ease: "power2.in" }, 2.3);

        const m2 = crew.next();
        const stretcher = crew.cursor(m2, "estirando");
        const frame = crew.frame(m2);
        tl.fromTo(frame, { x: () => M().x, y: () => M().y + M().h, width: () => M().w, height: 0, opacity: 0 }, { opacity: 1, duration: 0.15 }, 0.25)
          .fromTo(stretcher, { x: () => M().x + M().w + 60, y: () => M().y + M().h + 40, opacity: 0 }, { x: () => M().x + M().w, y: () => M().y + M().h, opacity: 1, duration: 0.3, ease: "power2.out" }, 0.1)
          .to(frame, { y: () => M().y, height: () => M().h, duration: 1.8, ease: "expo.inOut" }, 0.25)
          .to(stretcher, { y: () => M().y, duration: 1.8, ease: "expo.inOut" }, 0.25)
          .to(frame, { opacity: 0, duration: 0.4 }, 2.2)
          .to(stretcher, { x: "+=60", y: "-=30", opacity: 0, duration: 0.4, ease: "power2.in" }, 2.15);

        if (btn) {
          const m3 = crew.next();
          const clicker = crew.cursor(m3, "revisando");
          const ripple = crew.ripple(m3);
          const Bt = () => crew.box(btn);
          tl.fromTo(clicker, { x: () => Bt().x + Bt().w + 80, y: () => Bt().y + Bt().h + 70, opacity: 0 }, { x: () => Bt().x + Bt().w * 0.6, y: () => Bt().y + Bt().h * 0.55, opacity: 1, duration: 0.6, ease: "power2.out" }, 1.5)
            .to(clicker, { scale: 0.82, duration: 0.08 }, 2.15)
            .fromTo(ripple, { x: () => Bt().x + Bt().w * 0.6, y: () => Bt().y + Bt().h * 0.55, scale: 0.2, opacity: 0.9 }, { scale: 1.8, opacity: 0, duration: 0.6, ease: "power2.out" }, 2.18)
            .to(clicker, { scale: 1, duration: 0.1 }, 2.25)
            .to(clicker, { x: "+=70", y: "+=40", opacity: 0, duration: 0.45, ease: "power2.in" }, 2.6);
        }
        crew.bind(tl);
      }

      cleanups.push(onReady(() => { tl.play(); showCrew(); }));


      // Parallax al hacer scroll.
      const st = { trigger: el, start: "top top", end: "bottom top", scrub: true };
      gsap.to(q(".hero-shell"), { scale: 0.92, opacity: 0.35, ease: "none", scrollTrigger: st });
      gsap.to(q(".hvis"), { yPercent: 12, ease: "none", scrollTrigger: st });
      gsap.to(q(".htext"), { yPercent: -16, ease: "none", scrollTrigger: st });
    }, el);

    // Foto 3D: se inclina siguiendo al mouse; en el celular, con el giro del teléfono.
    const card = q(".hero-card")[0] as HTMLElement;
    const par = q(".hvis-par")[0] as HTMLElement;
    const media = q(".hvis-media")[0] as HTMLElement;
    const glow = q(".hglow")[0] as HTMLElement;
    const hh = q(".hh")[0] as HTMLElement;
    const gx = gsap.quickTo(glow, "x", { duration: 1.6, ease: "power3" }), gy = gsap.quickTo(glow, "y", { duration: 1.6, ease: "power3" });
    const px = gsap.quickTo(par, "x", { duration: 1.2, ease: "power3" }), py = gsap.quickTo(par, "y", { duration: 1.2, ease: "power3" });
    const ry = gsap.quickTo(media, "rotateY", { duration: 1.2, ease: "power3" }), rx = gsap.quickTo(media, "rotateX", { duration: 1.2, ease: "power3" });
    const tx = gsap.quickTo(hh, "x", { duration: 1.4, ease: "power3" });
    const apply = (nx: number, ny: number) => { gx(nx * 90); gy(ny * 70); px(nx * -22); py(ny * -12); ry(nx * 14); rx(ny * -8); tx(nx * 12); };
    if (fine) {
      const move = (e: PointerEvent) => { const r = card.getBoundingClientRect(); apply((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5); };
      const leave = () => apply(0, 0);
      card.addEventListener("pointermove", move);
      card.addEventListener("pointerleave", leave);
      cleanups.push(() => { card.removeEventListener("pointermove", move); card.removeEventListener("pointerleave", leave); });
    } else if ("DeviceOrientationEvent" in window) {
      // Android entrega la orientación sin pedir permiso; en iPhone se queda quieto (no pedimos permisos).
      const orient = (e: DeviceOrientationEvent) => {
        if (e.gamma == null || e.beta == null) return;
        apply(gsap.utils.clamp(-0.5, 0.5, e.gamma / 60), gsap.utils.clamp(-0.5, 0.5, (e.beta - 45) / 80));
      };
      addEventListener("deviceorientation", orient);
      cleanups.push(() => removeEventListener("deviceorientation", orient));
    }

    return () => { cleanups.forEach((c) => c()); ctx.revert(); };
  }, []);

  const isVideo = site.heroMediaType === "video";
  return (
    <section className="hero" id="inicio" data-side={site.heroSide} ref={root}>
      <div className="hero-shell">
        <div className="hero-card">
          <div className="hglow" />
          <div className="hglow2" />
          <div className="hgrid" />
          <div className="hc">
            <div className="hvis">
              <div className="hvis-par">
                <div className="hvis-media">
                  {mediaUrl ? (
                    isVideo ? (
                      <video src={mediaUrl} autoPlay muted loop playsInline preload="auto" aria-label={site.name} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl} alt={site.name} fetchPriority="high" />
                    )
                  ) : (
                    <div className="hvis-ph">
                      <div className="orb" />
                      <span>Aquí va tu foto 3D animada</span>
                      <small style={{ opacity: 0.7, fontSize: 11 }}>Súbela desde el panel → Perfil</small>
                    </div>
                  )}
                </div>
                <div className="hbadge"><b>{site.stats.years}+</b><span>años de<br />experiencia</span></div>
                <Link href={reelHref} className="hplay" aria-label="Ver showreel" data-magnetic>
                  <svg className="ring" viewBox="0 0 100 100" aria-hidden="true">
                    <defs><path id="hero-circ" d="M50,50 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0" /></defs>
                    <text><textPath href="#hero-circ">• ver showreel • ver showreel </textPath></text>
                  </svg>
                  <span className="core"><PlayIcon /></span>
                </Link>
              </div>
            </div>
            <div className="htext">
              {site.available && <div className="chip"><span className="dot" />Disponible para proyectos</div>}
              <h1 className="hh">Hola, soy <em>{site.name}.</em></h1>
              <p className="htag">{site.tagline}</p>
              <p className="hdesc">{site.heroDesc}</p>
              <div className="hctas">
                <Link href="/portafolio" className="btn btn-p" data-magnetic>Ver portafolio <Icon name="arrow" className="arr" /></Link>
                <Link href="/#contacto" className="btn btn-o" data-magnetic><Icon name="mail" />Contáctame</Link>
              </div>
              <Socials socials={site.socials} label />
            </div>
          </div>
          <div className="hfloor" />
          <div className="hscroll"><span>Scroll</span><div className="ln" /></div>
        </div>
      </div>
    </section>
  );
}
