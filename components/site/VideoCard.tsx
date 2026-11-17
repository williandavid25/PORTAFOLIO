"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PlayIcon } from "./Icon";
import { CATEGORIES, type Project } from "@/lib/content";

type Props = { project: Project; videoUrl: string | null; thumbUrl: string | null; tall?: boolean };

/**
 * Tarjeta con vista previa: con mouse, el video se reproduce (sin sonido) al pasar
 * por encima; en el celular, cuando la tarjeta queda en el centro de la pantalla.
 * El video no se descarga hasta que hace falta (preload="none").
 */
export default function VideoCard({ project, videoUrl, thumbUrl, tall }: Props) {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const card = cardRef.current, vid = vidRef.current;
    if (!card || !vid) return;
    const play = () => { vid.play().then(() => setPlaying(true)).catch(() => {}); };
    const pause = () => { vid.pause(); setPlaying(false); };

    if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
      card.addEventListener("pointerenter", play);
      card.addEventListener("pointerleave", pause);
      return () => { card.removeEventListener("pointerenter", play); card.removeEventListener("pointerleave", pause); pause(); };
    }
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? play() : pause()), { rootMargin: "-35% 0px -35% 0px" });
    io.observe(card);
    return () => { io.disconnect(); pause(); };
  }, []);

  return (
    <Link href={`/portafolio/${project.slug}`} className={`vcard${tall ? " tall" : ""}${playing ? " playing" : ""}`} ref={cardRef} data-cursor="view" data-reveal>
      {thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        <div className="noimg">{project.title.charAt(0)}</div>
      )}
      {videoUrl && <video ref={vidRef} src={`${videoUrl}#t=0.1`} muted loop playsInline preload="none" aria-hidden="true" />}
      {project.featured && <span className="vcard-badge">Destacado</span>}
      <span className="vcard-play"><PlayIcon /></span>
      <div className="vcard-info">
        <span className="cat">{CATEGORIES[project.category]}</span>
        <h4>{project.title}</h4>
      </div>
    </Link>
  );
}
