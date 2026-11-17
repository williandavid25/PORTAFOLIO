"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import Icon from "./Icon";
import { CATEGORIES, type Project } from "@/lib/content";

/** Vista previa grande del proyecto destacado: se reproduce sola (sin sonido) al verse. */
export default function Showreel({ project, videoUrl, thumbUrl }: { project: Project | null; videoUrl: string | null; thumbUrl: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const io = new IntersectionObserver(([e]) => {
      const v = vid.current;
      if (!v) return;
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.25 });
    io.observe(box);
    const tw = gsap.fromTo(box, { clipPath: "inset(12% 8% 12% 8% round 28px)" }, { clipPath: "inset(0% 0% 0% 0% round 28px)", ease: "none", scrollTrigger: { trigger: box, start: "top 95%", end: "top 35%", scrub: true } });
    return () => { io.disconnect(); tw.scrollTrigger?.kill(); tw.kill(); };
  }, []);

  return (
    <section className="section" id="showreel" style={{ paddingTop: 40 }}>
      <div className="container">
        <div className="sec-head center">
          <div className="eyebrow center" data-reveal>Showreel</div>
          <h2 className="title" data-split>Mi trabajo <em>en movimiento</em></h2>
        </div>
        <div className="reel" ref={ref} data-cursor={project ? "view" : undefined}>
          {project ? (
            <>
              {videoUrl ? (
                <video ref={vid} src={videoUrl} poster={thumbUrl ?? undefined} muted loop playsInline preload="metadata" aria-label={project.title} />
              ) : thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl} alt={project.title} loading="lazy" />
              ) : null}
              <div className="reel-over">
                <span className="cat">{CATEGORIES[project.category]}</span>
                <h3>{project.title}</h3>
                <div><Link href={`/portafolio/${project.slug}`} className="btn btn-p" data-magnetic>Ver con sonido <Icon name="arrow" className="arr" /></Link></div>
              </div>
            </>
          ) : (
            <div className="reel-empty">
              <div>
                <Icon name="video" size={40} stroke={1.2} />
                <p style={{ marginTop: 12 }}>Aquí se verá tu video destacado.<br />Márcalo como “Destacado” en el panel.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
