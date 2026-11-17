import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/site/Icon";
import PortfolioGrid from "@/components/site/PortfolioGrid";
import { getProject, getProjects } from "@/lib/data";
import { toCard } from "@/lib/cards";
import { embedUrl } from "@/lib/video";
import { CATEGORIES } from "@/lib/content";

export const revalidate = 60;

export async function generateMetadata(props: PageProps<"/portafolio/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = await getProject(slug);
  if (!p) return { title: "Proyecto no encontrado" };
  const card = toCard(p);
  return {
    title: p.title,
    description: p.description.slice(0, 160) || `${CATEGORIES[p.category]} — proyecto de video.`,
    openGraph: card.thumbUrl ? { images: [card.thumbUrl] } : undefined,
  };
}

const RATIO = { "16:9": "r169", "9:16": "r916", "1:1": "r11", "4:5": "r45" } as const;

export default async function ProjectPage(props: PageProps<"/portafolio/[slug]">) {
  const { slug } = await props.params;
  const project = await getProject(slug);
  if (!project) notFound();
  const { videoUrl, thumbUrl } = toCard(project);
  const embed = embedUrl(project.video_url, false);
  const related = (await getProjects()).filter((p) => p.id !== project.id && p.category === project.category).slice(0, 3).map(toCard);

  return (
    <>
      <section className="section pd">
        <div className="container">
          <Link href="/portafolio" className="pd-back"><Icon name="back" size={14} /> Volver al portafolio</Link>
          <div className="pd-head">
            <div>
              <span className="cat" data-reveal>{CATEGORIES[project.category]}</span>
              <h1 className="title" style={{ margin: "8px 0 0" }} data-split>{project.title}</h1>
            </div>
            <div className="pd-meta" data-reveal>
              {project.client && <div>Cliente<b>{project.client}</b></div>}
              {project.year && <div>Año<b>{project.year}</b></div>}
              <div>Formato<b>{project.aspect}</b></div>
            </div>
          </div>
          <div className={`player ${RATIO[project.aspect]}`} data-reveal>
            {videoUrl ? (
              <video src={videoUrl} poster={thumbUrl ?? undefined} controls playsInline preload="metadata" />
            ) : embed ? (
              <iframe src={embed} title={project.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
            ) : (
              <div className="player-empty">Este proyecto aún no tiene video.</div>
            )}
          </div>
          {project.description && <p className="pd-desc" data-reveal>{project.description}</p>}
        </div>
      </section>
      {related.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="eyebrow" data-reveal>Más de {CATEGORIES[project.category]}</div>
            <PortfolioGrid items={related} showFilters={false} />
          </div>
        </section>
      )}
    </>
  );
}
