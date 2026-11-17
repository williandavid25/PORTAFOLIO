"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { onReady, splitChars, splitWords } from "@/components/motion/MotionRoot";
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
        .from(document.querySelectorAll("[data-nav] > *"), { y: -24, opacity: 0, stagger: 0.08, duration: 1 }, 0.45)
        .fromTo(q(".hvis-media"), { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.8, ease: "expo.inOut", clearProps: "clipPath" }, 0.25)
        .from(q(".hvis-media > *"), { scale: 1.22, yPercent: 6, duration: 2.3, transformOrigin: "50% 100%" }, 0.25)
        .from(chars, { yPercent: 115, rotate: 6, opacity: 0, duration: 1.25, stagger: 0.032 }, 0.75)
        .from(q(".hctas .btn-p"), { y: 24, opacity: 0, duration: 1 }, 1.2)
        .from(q(".socials > *"), { y: 14, opacity: 0, stagger: 0.06, duration: 0.9 }, 1.35)
        .from(q(".hscroll"), { opacity: 0, x: 20, duration: 1 }, 2.4);
      // ---- El equipo arranca en la portada: uno escribe, otro estira la foto, otro hace clic ----
      const layer = document.querySelector<HTMLElement>(".crew");
      if (layer) {
        const crew = new Crew(layer, 0);
        cleanups.push(() => crew.destroy());
        const one = (sel: string) => (q(sel)[0] as HTMLElement | undefined) ?? null;
        /** Cada trabajo es su propio timeline dentro de la entrada: el puntero solo se ve mientras trabaja. */
        const job = (pos: number, build: (t: gsap.core.Timeline) => void) => {
          const t = gsap.timeline({ defaults: { ease: "power2.out" } });
          build(t);
          crew.bind(t);
          tl.add(t, pos);
        };

        // Menú: lo selecciona y aparece.
        const navIn = document.querySelector<HTMLElement>("[data-nav]");
        if (navIn) job(0.15, (t) => {
          const m = crew.next(); const c = crew.cursor(m, "seleccionando"); const s = crew.sel(m);
          const N = () => crew.box(navIn);
          t.fromTo(c, { x: () => N().x - 40, y: () => N().y + N().h + 40 }, { x: () => N().x + 4, y: () => N().y + 4, duration: 0.25 })
            .fromTo(s, { x: () => N().x, y: () => N().y, width: 0, height: 0, opacity: 1 }, { width: () => N().w, height: () => N().h, duration: 0.7, ease: "power2.inOut" })
            .to(c, { x: () => N().x + N().w - 30, y: () => N().y + N().h, duration: 0.7, ease: "power2.inOut" }, "<")
            .to(s, { opacity: 0, duration: 0.35 })
            .to(c, { y: "+=30", duration: 0.2 }, "<");
        });

        // Foto: estira el marco hacia arriba mientras se revela.
        const mediaEl = one(".hvis-media");
        if (mediaEl) job(0.1, (t) => {
          const m = crew.next(); const c = crew.cursor(m, "estirando"); const fr = crew.frame(m);
          const M = () => crew.box(mediaEl);
          t.fromTo(c, { x: () => M().x + M().w + 50, y: () => M().y + M().h + 30 }, { x: () => M().x + M().w, y: () => M().y + M().h, duration: 0.2 }, 0)
            .fromTo(fr, { x: () => M().x, y: () => M().y + M().h, width: () => M().w, height: 0, opacity: 0 }, { opacity: 1, duration: 0.12 }, 0.15)
            .to(fr, { y: () => M().y, height: () => M().h, duration: 1.8, ease: "expo.inOut" }, 0.15)
            .to(c, { y: () => M().y, duration: 1.8, ease: "expo.inOut" }, 0.15)
            .to(fr, { opacity: 0, duration: 0.35 }, 2)
            .to(c, { x: "+=30", y: "-=20", duration: 0.2 }, 2);
        });

        // Etiqueta "Disponible": la arrastra desde la derecha.
        const chip = one(".chip");
        if (chip) job(0.55, (t) => {
          const c = crew.cursor(crew.next(), "moviendo");
          const C = () => crew.box(chip);
          t.fromTo(chip, { x: 170, opacity: 0.25 }, { opacity: 0.6, duration: 0.05 }, 0.15)
            .fromTo(c, { x: () => C().x + C().w - 26 + 170, y: () => C().y + C().h + 40 }, { x: () => C().x + C().w - 26 + 170, y: () => C().y + C().h / 2, duration: 0.2 }, 0)
            .to(c, { scale: 0.86, duration: 0.05 }, 0.2)
            .to(chip, { x: 0, opacity: 1, duration: 0.75 }, 0.25)
            .to(c, { x: () => C().x + C().w - 26, duration: 0.75 }, 0.25)
            .to(c, { scale: 1, duration: 0.05 }, 1)
            .to(c, { y: "+=30", duration: 0.2 }, 1.05);
        });

        // Título: lo escribe.
        const hhEl = one(".hh");
        if (hhEl) job(0.45, (t) => {
          const c = crew.cursor(crew.next(), "escribiendo", true);
          const H = () => crew.box(hhEl);
          t.fromTo(c, { x: () => H().x - 60, y: () => H().y + H().h + 30 }, { x: () => H().x - 6, y: () => H().y + H().h * 0.3, duration: 0.3 })
            .to(c, { x: () => H().x + H().w, y: () => H().y + H().h * 0.62, duration: 1.45, ease: "none" }, 0.35)
            .to(c, { x: "+=30", y: "+=30", duration: 0.25 });
        });

        // Subtítulo: lo escribe letra por letra.
        const tag = one(".htag");
        if (tag) job(1.05, (t) => {
          const c = crew.cursor(crew.next(), "escribiendo", true);
          const letters = splitChars(tag);
          const T = () => crew.box(tag);
          t.fromTo(c, { x: () => T().x - 40, y: () => T().y + T().h + 30 }, { x: () => T().x - 4, y: () => T().y + T().h / 2, duration: 0.15 })
            .fromTo(letters, { opacity: 0 }, { opacity: 1, duration: 0.04, stagger: 1 / Math.max(1, letters.length) }, 0.15)
            .to(c, { x: () => T().x + T().w, duration: 1, ease: "none" }, 0.15)
            .to(c, { x: "+=30", y: "+=30", duration: 0.2 });
        });

        // Descripción: la selecciona y aparece.
        const desc = one(".hdesc");
        if (desc) job(1.3, (t) => {
          const m = crew.next(); const c = crew.cursor(m, "seleccionando"); const s = crew.sel(m);
          const D = () => crew.box(desc);
          t.fromTo(desc, { opacity: 0, y: 12 }, { opacity: 0, duration: 0.01 }, 0)
            .fromTo(c, { x: () => D().x - 40, y: () => D().y - 30 }, { x: () => D().x, y: () => D().y, duration: 0.2 }, 0)
            .fromTo(s, { x: () => D().x, y: () => D().y, width: 0, height: 0, opacity: 1 }, { width: () => D().w, height: () => D().h, duration: 0.55, ease: "power2.inOut" }, 0.2)
            .to(c, { x: () => D().x + D().w, y: () => D().y + D().h, duration: 0.55, ease: "power2.inOut" }, 0.2)
            .to(desc, { opacity: 1, y: 0, duration: 0.5 }, 0.7)
            .to(s, { opacity: 0, duration: 0.3 }, 0.8)
            .to(c, { x: "+=24", y: "+=24", duration: 0.2 }, 0.8);
        });

        // Insignia "3+ años": la estira desde su esquina.
        const badge = one(".hbadge");
        if (badge) job(1.5, (t) => {
          const c = crew.cursor(crew.next(), "estirando");
          const Bd = () => crew.box(badge);
          t.fromTo(badge, { scale: 0, opacity: 1, transformOrigin: "0% 0%" }, { scale: 0, duration: 0.01 }, 0)
            .fromTo(c, { x: () => Bd().x - 30, y: () => Bd().y - 30 }, { x: () => Bd().x, y: () => Bd().y, duration: 0.2 }, 0)
            .to(badge, { scale: 1, duration: 0.7, ease: "power2.inOut" }, 0.2)
            .to(c, { x: () => Bd().x + badge.offsetWidth, y: () => Bd().y + badge.offsetHeight, duration: 0.7, ease: "power2.inOut" }, 0.2)
            .to(c, { x: "+=24", y: "+=24", duration: 0.2 });
        });

        // Círculo "ver showreel": lo arrastra girando hasta su lugar.
        const play = one(".hplay");
        if (play) job(1.85, (t) => {
          const c = crew.cursor(crew.next(), "moviendo");
          const P = () => crew.box(play);
          t.fromTo(play, { x: -170, rotate: -140, opacity: 0.25 }, { opacity: 0.6, duration: 0.05 }, 0.15)
            .fromTo(c, { x: () => P().x + P().w / 2 - 170, y: () => P().y + P().h + 40 }, { x: () => P().x + P().w / 2 - 170, y: () => P().y + P().h / 2, duration: 0.2 }, 0)
            .to(c, { scale: 0.86, duration: 0.05 }, 0.2)
            .to(play, { x: 0, rotate: 0, opacity: 1, duration: 0.8 }, 0.25)
            .to(c, { x: () => P().x + P().w / 2, duration: 0.8 }, 0.25)
            .to(c, { scale: 1, duration: 0.05 }, 1.05)
            .to(c, { y: "+=30", duration: 0.2 }, 1.1);
        });

        // Botón "Contáctame": lo sube arrastrando.
        const btnO = one(".hctas .btn-o");
        if (btnO) job(1.7, (t) => {
          const c = crew.cursor(crew.next(), "moviendo");
          const Bo = () => crew.box(btnO);
          t.fromTo(btnO, { y: 110, opacity: 0.25 }, { opacity: 0.6, duration: 0.05 }, 0.15)
            .fromTo(c, { x: () => Bo().x + Bo().w / 2, y: () => Bo().y + 110 + Bo().h + 30 }, { x: () => Bo().x + Bo().w / 2, y: () => Bo().y + 110 + Bo().h / 2, duration: 0.2 }, 0)
            .to(c, { scale: 0.86, duration: 0.05 }, 0.2)
            .to(btnO, { y: 0, opacity: 1, duration: 0.7 }, 0.25)
            .to(c, { y: () => Bo().y + Bo().h / 2, duration: 0.7 }, 0.25)
            .to(c, { scale: 1, duration: 0.05 }, 0.95)
            .to(c, { x: "+=30", y: "+=30", duration: 0.2 }, 1);
        });

        // Botón "Ver portafolio": lo revisa con un clic.
        const btnP = one(".hctas .btn-p");
        if (btnP) job(2.05, (t) => {
          const m = crew.next(); const c = crew.cursor(m, "revisando"); const r = crew.ripple(m);
          const Bt = () => crew.box(btnP);
          t.fromTo(c, { x: () => Bt().x + Bt().w + 60, y: () => Bt().y + Bt().h + 50 }, { x: () => Bt().x + Bt().w * 0.6, y: () => Bt().y + Bt().h * 0.55, duration: 0.5 })
            .to(c, { scale: 0.82, duration: 0.08 })
            .fromTo(r, { x: () => Bt().x + Bt().w * 0.6, y: () => Bt().y + Bt().h * 0.55, scale: 0.2, opacity: 0.9 }, { scale: 1.8, opacity: 0, duration: 0.6 })
            .to(c, { scale: 1, duration: 0.1 }, "<")
            .to(c, { x: "+=40", y: "+=30", duration: 0.25 });
        });
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
    const hh = q(".hh")[0] as HTMLElement;
    const px = gsap.quickTo(par, "x", { duration: 1.2, ease: "power3" }), py = gsap.quickTo(par, "y", { duration: 1.2, ease: "power3" });
    const ry = gsap.quickTo(media, "rotateY", { duration: 1.2, ease: "power3" }), rx = gsap.quickTo(media, "rotateX", { duration: 1.2, ease: "power3" });
    const tx = gsap.quickTo(hh, "x", { duration: 1.4, ease: "power3" });
    const apply = (nx: number, ny: number) => { px(nx * -22); py(ny * -12); ry(nx * 14); rx(ny * -8); tx(nx * 12); };
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
                      <Image src={mediaUrl} alt={site.name} fill priority quality={90} sizes="(max-width: 900px) 90vw, 45vw" />
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
