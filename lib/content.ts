import { z } from "zod";

export const CATEGORIES = {
  social: "Social Media",
  commercial: "Comercial",
  corporate: "Corporativo",
  music: "Música",
  youtube: "YouTube",
  motion: "Motion Graphics",
} as const;
export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as [Category, ...Category[]];

const url = z.union([z.literal(""), z.string().trim().url().max(300).refine((v) => v.startsWith("https://"), "Debe empezar con https://")]);
const storagePath = z.union([z.literal(""), z.string().regex(/^site\/[0-9a-f-]{36}\/[a-z0-9._-]{1,80}$/)]);

export const siteSchema = z.object({
  name: z.string().trim().min(1).max(40),
  role: z.string().trim().max(40),
  tagline: z.string().trim().max(80),
  heroDesc: z.string().trim().max(300),
  available: z.boolean(),
  heroSide: z.enum(["left", "right"]),
  heroMediaPath: storagePath,
  heroMediaType: z.enum(["", "image", "video"]),
  aboutTitle: z.string().trim().max(80),
  bio: z.string().trim().max(1500),
  aboutImagePath: storagePath,
  skills: z.array(z.object({ name: z.string().trim().min(1).max(40), level: z.number().int().min(0).max(100) })).max(8),
  stats: z.object({
    projects: z.number().int().min(0).max(100000),
    clients: z.number().int().min(0).max(100000),
    years: z.number().int().min(0).max(80),
    satisfaction: z.number().int().min(0).max(100),
  }),
  email: z.union([z.literal(""), z.string().trim().email().max(160)]),
  whatsapp: z.string().trim().regex(/^\d{0,15}$/, "Solo números con código de país"),
  location: z.string().trim().max(80),
  cvUrl: url,
  socials: z.object({ instagram: url, tiktok: url, youtube: url, facebook: url }),
  /** Herramientas que usa, en grupos (Edición, Programación, Community). */
  tools: z.array(z.object({
    group: z.string().trim().min(1).max(40),
    items: z.array(z.string().trim().min(1).max(40)).max(16),
  })).max(4),
});
export type SiteData = z.infer<typeof siteSchema>;

export const DEFAULT_SITE: SiteData = {
  name: "DevWilly",
  role: "Editor & Developer",
  tagline: "Video Editor · Programador · Community Manager",
  heroDesc: "Edito videos que detienen el scroll, programo páginas y herramientas web, y gestiono comunidades en redes. Todo lo que tu marca necesita para verse y crecer en digital.",
  available: true,
  heroSide: "left",
  heroMediaPath: "",
  heroMediaType: "",
  aboutTitle: "Edito, programo y hago crecer marcas",
  bio: "Soy editor de video especializado en contenido para redes sociales, campañas publicitarias y producciones corporativas. Además soy programador: creo páginas y herramientas web con Visual Studio Code y GitHub. Y como community manager gestiono las redes de las marcas: planifico el contenido, publico, respondo a la comunidad y mido los resultados.",
  aboutImagePath: "",
  skills: [
    { name: "Premiere Pro", level: 95 },
    { name: "After Effects", level: 90 },
    { name: "DaVinci Resolve", level: 85 },
    { name: "Motion Graphics", level: 80 },
  ],
  stats: { projects: 50, clients: 30, years: 3, satisfaction: 100 },
  email: "",
  whatsapp: "",
  location: "Ecuador",
  cvUrl: "",
  socials: { instagram: "", tiktok: "", youtube: "", facebook: "" },
  tools: [
    { group: "Edición de video", items: ["Premiere Pro", "After Effects", "DaVinci Resolve"] },
    { group: "Programación", items: ["Visual Studio Code", "Git", "GitHub", "HTML", "CSS", "JavaScript"] },
    { group: "Community Manager", items: ["Instagram", "TikTok", "Facebook", "YouTube"] },
  ],
};

/** Mezcla lo guardado con los valores por defecto y descarta lo inválido. */
export function normalizeSite(raw: unknown): SiteData {
  const merged = { ...DEFAULT_SITE, ...(raw && typeof raw === "object" ? raw : {}) } as Record<string, unknown>;
  merged.stats = { ...DEFAULT_SITE.stats, ...((merged.stats as object) ?? {}) };
  merged.socials = { ...DEFAULT_SITE.socials, ...((merged.socials as object) ?? {}) };
  const parsed = siteSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SITE;
}

export type Project = {
  id: string;
  slug: string;
  title: string;
  category: Category;
  description: string;
  client: string;
  year: number | null;
  video_path: string | null;
  video_url: string | null;
  thumb_path: string | null;
  aspect: "16:9" | "9:16" | "1:1" | "4:5";
  featured: boolean;
  published: boolean;
  sort_order: number;
  created_at: string;
};

export type Testimonial = {
  id: string;
  name: string;
  role: string;
  body: string;
  stars: number;
  avatar_path: string | null;
  published: boolean;
  sort_order: number;
};

export type Message = {
  id: string;
  name: string;
  email: string;
  project_type: string;
  body: string;
  read: boolean;
  created_at: string;
};

export const PROJECT_COLUMNS =
  "id,slug,title,category,description,client,year,video_path,video_url,thumb_path,aspect,featured,published,sort_order,created_at";
