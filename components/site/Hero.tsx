"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { onReady, splitChars, splitWords } from "@/components/motion/MotionRoot";
import { Crew, showCrew } from "@/components/motion/Crew";
import { cue, sfx } from "@/components/motion/sfx";
import Icon from "./Icon";
import Socials from "./Socials";
import type { SiteData } from "@/lib/content";

type Props = { site: SiteData; mediaUrl: string | null; reelHref: string };

export default function Hero({ site, mediaUrl }: Props) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current!;
    const q = gsap.utils.selector(el);
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
      };
      const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" }, onComplete: loops });
      tl.from(q(".hero-card"), { scale: 0.94, opacity: 0, duration: 1.5 }, 0)
        .from(q(".hglow"), { scale: 0.2, opacity: 0, duration: 2.3 }, 0.1)
        .from(document.querySelectorAll("[data-nav] .pill"), { y: -12, opacity: 0, duration: 0.6 }, 0.15)
        .fromTo(q(".hvis-media"), { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.8, ease: "expo.inOut", clearProps: "clipPath" }, 0.25)
        .from(q(".hvis-media .hmain, .hvis-media .hvis-ph"), { scale: 1.08, duration: 2.3, transformOrigin: "50% 100%" }, 0.25)
        .from(q(".hctas .btn-p"), { y: 24, opacity: 0, duration: 1 }, 1.2)
        .from(q(".socials > *"), { y: 14, opacity: 0, stagger: 0.06, duration: 0.9 }, 1.35);
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
          cue(t, () => sfx.click(c.x), 0.25);
          cue(t, () => sfx.select(0.7, c.x), 0.28);
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
          cue(t, () => sfx.press(c.x), 0.16);
          cue(t, () => sfx.whoosh(1.2, 0.45), 0.3);
          cue(t, () => sfx.snap(c.x), 1.9);
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
          cue(t, () => sfx.press(c.x), 0.2);
          cue(t, () => sfx.swipe(0.7, c.x), 0.26);
          cue(t, () => sfx.drop(c.x), 1);
        });

        /**
         * Texto como en un editor: un puntero ESTIRA el cuadro de texto desde su esquina
         * y, con el cuadro listo, otro puntero ESCRIBE dentro (letra por letra o palabra
         * por palabra). El marco queda visible mientras se escribe y luego se desvanece.
         */
        const textBox = (el: HTMLElement, units: HTMLElement[], pos: number, per: number) => {
          if (!units.length) return;
          const STRETCH = 0.45;
          const typing = 0.15 + units.length * per + 0.2;
          job(pos, (t) => {
            const m = crew.next(); const c = crew.cursor(m, "estirando"); const fr = crew.frame(m);
            const B = () => crew.box(el);
            t.fromTo(c, { x: () => B().x - 36, y: () => B().y - 30 }, { x: () => B().x, y: () => B().y, duration: 0.18 })
              .fromTo(fr, { x: () => B().x - 6, y: () => B().y - 6, width: 0, height: 0, opacity: 1 }, { width: () => B().w + 12, height: () => B().h + 12, duration: STRETCH, ease: "power2.inOut" })
              .to(c, { x: () => B().x + B().w + 6, y: () => B().y + B().h + 6, duration: STRETCH, ease: "power2.inOut" }, "<")
              .to(c, { x: "+=30", y: "+=26", duration: 0.2 })
              .to(fr, { opacity: 0, duration: 0.3 }, 0.18 + STRETCH + typing);
            cue(t, () => sfx.press(c.x), 0.18);
            cue(t, () => sfx.stretch(0.45, c.x), 0.2);
            cue(t, () => sfx.snap(c.x), 0.18 + STRETCH);
          });
          job(pos + 0.18 + STRETCH, (t) => {
            const c = crew.cursor(crew.next(), "escribiendo", true);
            const U = (i: number) => crew.box(units[i]);
            t.fromTo(c, { x: () => U(0).x - 24, y: () => U(0).y + U(0).h + 18 }, { x: () => U(0).x - 2, y: () => U(0).y + U(0).h * 0.5, duration: 0.15 });
            units.forEach((u, i) => {
              t.fromTo(u, { opacity: 0 }, { opacity: 1, duration: Math.max(0.02, per * 0.7) }, ">");
              cue(t, () => (u.textContent?.trim() ? sfx.key(c.x) : sfx.space(c.x)), "<");
              t.to(c, { x: () => U(i).x + U(i).w, y: () => U(i).y + U(i).h * 0.5, duration: per, ease: "none" }, "<");
            });
            t.to(c, { x: "+=26", y: "+=22", duration: 0.2 });
          });
        };

        // Título: cuadro estirado + "Hola, soy DevWilly." escrito letra por letra.
        const hhEl = one(".hh");
        if (hhEl) textBox(hhEl, chars, 0.3, 0.05);
        // Subtítulo: cuadro + letra por letra.
        const tag = one(".htag");
        if (tag) textBox(tag, splitChars(tag), 1.15, 0.022);
        // Descripción: cuadro + palabra por palabra.
        const desc = one(".hdesc");
        if (desc) textBox(desc, splitWords(desc), 1.45, 0.04);

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
          cue(t, () => sfx.press(c.x), 0.2);
          cue(t, () => sfx.stretch(0.7, c.x), 0.22);
          cue(t, () => sfx.snap(c.x), 0.9);
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
          cue(t, () => sfx.press(c.x), 0.2);
          cue(t, () => sfx.swipe(0.7, c.x), 0.26);
          cue(t, () => sfx.drop(c.x), 0.95);
        });

        // ---- Más trabajos para que ningún puntero de la carga se quede sin hacer nada ----
        const visible = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).offsetWidth > 0 && (el as HTMLElement).offsetHeight > 0;
        /** El puntero llega, hace clic y el elemento se crea en ese instante (con una onda). */
        const tap = (el: HTMLElement, pos: number, create = true) => job(pos, (t) => {
          const m = crew.next(); const c = crew.cursor(m, "ajustando"); const r = crew.ripple(m);
          const E = () => crew.box(el);
          if (create) t.fromTo(el, { opacity: 0, scale: 0.55 }, { opacity: 1, scale: 1, duration: 0.42, ease: "back.out(2.4)" }, 0.4);
          t.fromTo(c, { x: () => E().x + E().w / 2 + 40, y: () => E().y + E().h + 40 }, { x: () => E().x + E().w / 2, y: () => E().y + E().h / 2, duration: 0.35 })
            .to(c, { scale: 0.82, duration: 0.06 })
            .fromTo(r, { x: () => E().x + E().w / 2, y: () => E().y + E().h / 2, scale: 0.2, opacity: 0.8 }, { scale: 1.3, opacity: 0, duration: 0.45, immediateRender: false })
            .to(c, { scale: 1, duration: 0.08 }, "<")
            .to(c, { y: "+=26", duration: 0.2 });
          cue(t, () => (create ? sfx.pop(c.x) : sfx.click(c.x)), 0.38);
        });
        const logo = document.querySelector<HTMLElement>("[data-nav] .logo");
        if (visible(logo)) tap(logo, 0.1);
        document.querySelectorAll<HTMLElement>("[data-nav] .pill a").forEach((a, k) => { if (visible(a)) tap(a, 0.25 + k * 0.09); });
        const cta = document.querySelector<HTMLElement>("[data-nav] .nav-cta");
        if (visible(cta)) tap(cta, 0.55);
        const burger = document.querySelector<HTMLElement>("[data-nav] .burger");
        if (visible(burger)) tap(burger, 0.3);
        const scrollHint = one(".hscroll");
        if (visible(scrollHint)) tap(scrollHint, 1.6);
        const name = one(".hh em");
        if (visible(name)) tap(name, 1.25, false);
        const dot = one(".chip .dot");
        if (visible(dot)) tap(dot, 0.95, false);

        // Botón "Ver portafolio": lo revisa con un clic.
        const btnP = one(".hctas .btn-p");
        if (btnP) job(2.05, (t) => {
          const m = crew.next(); const c = crew.cursor(m, "revisando"); const r = crew.ripple(m);
          const Bt = () => crew.box(btnP);
          t.fromTo(c, { x: () => Bt().x + Bt().w + 60, y: () => Bt().y + Bt().h + 50 }, { x: () => Bt().x + Bt().w * 0.6, y: () => Bt().y + Bt().h * 0.55, duration: 0.5 })
            .to(c, { scale: 0.82, duration: 0.08 })
            .fromTo(r, { x: () => Bt().x + Bt().w * 0.6, y: () => Bt().y + Bt().h * 0.55, scale: 0.2, opacity: 0.9 }, { scale: 1.8, opacity: 0, duration: 0.6, immediateRender: false })
            .to(c, { scale: 1, duration: 0.1 }, "<")
            .to(c, { x: "+=40", y: "+=30", duration: 0.25 });
          cue(t, () => sfx.click(c.x), 0.5);
          cue(t, () => sfx.chime(c.x), 0.62);
        });
      }

      // Construcción ágil: toda la línea de tiempo (contenido + punteros) va 1.6x más rápido.
      tl.timeScale(1.25);
      cleanups.push(onReady(() => { tl.play(); showCrew(); }));


      // Parallax al hacer scroll.
      const st = { trigger: el, start: "top top", end: "bottom top", scrub: true };
      gsap.to(q(".hero-shell"), { scale: 0.92, opacity: 0.35, ease: "none", scrollTrigger: st });
      gsap.to(q(".htext"), { yPercent: -16, ease: "none", scrollTrigger: st });
    }, el);

    return () => { cleanups.forEach((c) => c()); ctx.revert(); };
  }, []);

  const isVideo = site.heroMediaType === "video";
  return (
    <section className="hero" id="inicio" data-side={site.heroSide} data-photo={mediaUrl && !isVideo ? "1" : undefined} ref={root}>
      <div className="hero-shell">
        <div className="hero-card">
          <div className="hglow" />
          <div className="hglow2" />
          <div className="hgrid" />
          <div className="hstage-floor" aria-hidden="true" />
          <div className="hc">
            <div className="hvis">
              <div className="hvis-par">
                <div className={`hvis-media${mediaUrl && !isVideo ? " has-photo" : ""}`}>
                  {mediaUrl ? (
                    isVideo ? (
                      <video src={mediaUrl} autoPlay muted loop playsInline preload="auto" aria-label={site.name} className="hmain" />
                    ) : (
                      <>
                        {/* Copia a calidad 95 del tamaño justo para cada pantalla (AVIF/WebP con transparencia).
                            El original sigue intacto en la nube. */}
                        <Image src={mediaUrl} alt={site.name} className="hmain" width={0} height={0} quality={95} preload
                          sizes="(max-width: 900px) 440px, 640px" style={{ height: "100%", width: "auto" }} />
                      </>
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
