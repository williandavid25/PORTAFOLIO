import "server-only";
import { cache } from "react";
import { createPublicClient } from "./supabase/server";
import { normalizeSite, DEFAULT_SITE, PROJECT_COLUMNS, type Project, type SiteData, type Testimonial } from "./content";

// Lecturas públicas. Si Supabase aún no está configurado o falla, la página
// se muestra igual con el contenido por defecto (nunca se cae).

export const getSite = cache(async (): Promise<SiteData> => {
  const db = createPublicClient();
  if (!db) return DEFAULT_SITE;
  const { data, error } = await db.from("pf_site").select("data").eq("id", 1).maybeSingle();
  if (error || !data) return DEFAULT_SITE;
  return normalizeSite(data.data);
});

export const getProjects = cache(async (): Promise<Project[]> => {
  const db = createPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("pf_projects")
    .select(PROJECT_COLUMNS)
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data as Project[];
});

export const getProject = cache(async (slug: string): Promise<Project | null> => {
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return null;
  const db = createPublicClient();
  if (!db) return null;
  const { data } = await db.from("pf_projects").select(PROJECT_COLUMNS).eq("slug", slug).eq("published", true).maybeSingle();
  return (data as Project | null) ?? null;
});

export const getTestimonials = cache(async (): Promise<Testimonial[]> => {
  const db = createPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("pf_testimonials")
    .select("id,name,role,body,stars,avatar_path,published,sort_order")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data) return [];
  return data as Testimonial[];
});
