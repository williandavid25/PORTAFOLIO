"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import VideoCard from "./VideoCard";
import { CATEGORIES, type Category, type Project } from "@/lib/content";

export type CardData = { project: Project; videoUrl: string | null; thumbUrl: string | null };

export default function PortfolioGrid({ items, showFilters = true }: { items: CardData[]; showFilters?: boolean }) {
  const [filter, setFilter] = useState<"all" | Category>("all");
  const gridRef = useRef<HTMLDivElement>(null);
  const used = new Set(items.map((i) => i.project.category));
  const cats = (Object.keys(CATEGORIES) as Category[]).filter((c) => used.has(c));
  const list = items.filter((i) => filter === "all" || i.project.category === filter);

  const choose = (f: "all" | Category) => {
    if (f === filter) return;
    const grid = gridRef.current;
    const kids = grid ? Array.from(grid.children) : [];
    if (!kids.length) return setFilter(f);
    gsap.to(kids, {
      y: -18, opacity: 0, duration: 0.28, stagger: 0.025, ease: "power2.in",
      onComplete: () => {
        setFilter(f);
        requestAnimationFrame(() => {
          const next = gridRef.current ? Array.from(gridRef.current.children) : [];
          gsap.fromTo(next, { y: 36, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.9, stagger: 0.07, ease: "expo.out", clearProps: "transform", onComplete: () => ScrollTrigger.refresh() });
        });
      },
    });
  };

  return (
    <>
      {showFilters && cats.length > 1 && (
        <div className="filters" role="tablist" aria-label="Filtrar por categoría" data-reveal>
          <button className={filter === "all" ? "on" : ""} onClick={() => choose("all")} role="tab" aria-selected={filter === "all"}>Todos</button>
          {cats.map((c) => (
            <button key={c} className={filter === c ? "on" : ""} onClick={() => choose(c)} role="tab" aria-selected={filter === c}>{CATEGORIES[c]}</button>
          ))}
        </div>
      )}
      <div className="pf-grid" ref={gridRef} style={{ marginTop: showFilters && cats.length > 1 ? 32 : 0 }}>
        {list.length ? (
          list.map((i) => <VideoCard key={i.project.id} {...i} tall={i.project.aspect === "9:16" || i.project.aspect === "4:5"} />)
        ) : (
          <div className="empty">
            <h3>Portafolio en construcción</h3>
            <p>Los proyectos se irán añadiendo pronto. Vuelve en breve.</p>
          </div>
        )}
      </div>
    </>
  );
}
