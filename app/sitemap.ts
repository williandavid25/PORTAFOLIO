import type { MetadataRoute } from "next";
import { getProjects } from "@/lib/data";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const projects = await getProjects();
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/portafolio`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/lab`, changeFrequency: "monthly", priority: 0.5 },
    ...projects.map((p) => ({ url: `${base}/portafolio/${p.slug}`, lastModified: p.created_at, priority: 0.7 })),
  ];
}
