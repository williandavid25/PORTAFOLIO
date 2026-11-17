"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import Icon from "./Icon";
import SectionTitle from "./SectionTitle";
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
    return () => io.disconnect();
  }, []);

  return (
    <section className="section" id="showreel" style={{ paddingTop: 40 }}>
      <div className="container">
        <SectionTitle main="Showreel" script="en movimiento" center />
        <div className="reel" ref={ref} data-crew="stretch" data-radius="28">
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
