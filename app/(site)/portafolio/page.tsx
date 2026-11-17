import type { Metadata } from "next";
import PortfolioGrid from "@/components/site/PortfolioGrid";
import { getProjects } from "@/lib/data";
import { toCard } from "@/lib/cards";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Portafolio",
  description: "Reels, comerciales, videos corporativos y motion graphics editados por Willy.",
};

export default async function PortfolioPage() {
  const projects = await getProjects();
  return (
    <section className="section" style={{ paddingTop: 150 }}>
      <div className="container">
        <div className="sec-head">
          <div className="eyebrow" data-reveal>Portafolio</div>
          <h1 className="title" data-split>Todos mis <em>trabajos</em></h1>
          <p className="lead" data-reveal style={{ maxWidth: 560 }}>Pasa el mouse (o desliza en el celular) para ver la vista previa de cada video. Toca para verlo completo con sonido.</p>
        </div>
        <PortfolioGrid items={projects.map(toCard)} />
      </div>
    </section>
  );
}
