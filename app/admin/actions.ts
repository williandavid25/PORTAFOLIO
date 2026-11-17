"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminAction } from "@/lib/auth";
import { createSessionClient } from "@/lib/supabase/server";
import { getSupabaseConfig, MEDIA_BUCKET } from "@/lib/supabase/config";
import { CATEGORY_KEYS, siteSchema, type SiteData } from "@/lib/content";
import { slugify } from "@/lib/video";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const refreshSite = () => {
  revalidatePath("/", "layout");
};

// ---------------- Sesión ----------------
export async function loginAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  if (!getSupabaseConfig()) return fail("El panel aún no está conectado a la base de datos.");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const allowed = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const generic = "Correo o contraseña incorrectos.";
  if (!email || !password || password.length > 200) return fail(generic);

  const supabase = await createSessionClient();
  if (!supabase) return fail("El panel aún no está conectado a la base de datos.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await new Promise((r) => setTimeout(r, 600)); // frena ataques de fuerza bruta
    return fail(generic);
  }
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!allowed || data.user.email?.toLowerCase() !== allowed || isAdmin !== true) {
    await supabase.auth.signOut();
    return fail("Esta cuenta no tiene permiso para administrar el sitio.");
  }
  redirect("/admin");
}

export async function logoutAction() {
  const supabase = await createSessionClient();
  await supabase?.auth.signOut();
  redirect("/admin/login");
}

// ---------------- Perfil / ajustes ----------------
export async function saveSiteAction(input: SiteData): Promise<ActionResult> {
  const { supabase } = await requireAdminAction();
  const parsed = siteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos no válidos.");

  const { data: prev } = await supabase.from("site_settings").select("data").eq("id", 1).maybeSingle();
  const { error } = await supabase.from("site_settings").update({ data: parsed.data, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return fail("No se pudo guardar.");

  // Borra archivos que se reemplazaron.
  const old = (prev?.data ?? {}) as Partial<SiteData>;
  const stale = [old.heroMediaPath, old.aboutImagePath].filter((p): p is string => !!p && p !== parsed.data.heroMediaPath && p !== parsed.data.aboutImagePath);
  if (stale.length) await supabase.storage.from(MEDIA_BUCKET).remove(stale);
  refreshSite();
  return { ok: true };
}

// ---------------- Proyectos ----------------
const uuid = z.string().uuid();
const projectSchema = z.object({
  id: uuid,
  isNew: z.boolean(),
  title: z.string().trim().min(1, "Escribe un título.").max(120),
  slug: z.string().trim().max(90).optional().default(""),
  category: z.enum(CATEGORY_KEYS),
  description: z.string().trim().max(2000).default(""),
  client: z.string().trim().max(120).default(""),
  year: z.number().int().min(2000).max(2100).nullable(),
  videoPath: z.string().nullable(),
  videoUrl: z.union([z.literal(""), z.string().trim().url().max(300).refine((v) => v.startsWith("https://"), "El link debe empezar con https://")]).default(""),
  thumbPath: z.string().nullable(),
  aspect: z.enum(["16:9", "9:16", "1:1", "4:5"]),
  featured: z.boolean(),
  published: z.boolean(),
});
export type ProjectInput = z.input<typeof projectSchema>;

const ownPath = (id: string, p: string | null) => p === null || new RegExp(`^projects/${id}/[a-z0-9._-]{1,80}$`).test(p);

export async function saveProjectAction(input: ProjectInput): Promise<ActionResult> {
  const { supabase } = await requireAdminAction();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos no válidos.");
  const p = parsed.data;
  if (!ownPath(p.id, p.videoPath) || !ownPath(p.id, p.thumbPath)) return fail("Archivo no válido.");
  if (!p.videoPath && !p.videoUrl) return fail("Sube un video o pega un link de YouTube/Vimeo.");

  // Slug único y legible.
  const base = slugify(p.slug || p.title);
  let slug = base;
  for (let n = 2; n < 50; n++) {
    const { data } = await supabase.from("projects").select("id").eq("slug", slug).neq("id", p.id).maybeSingle();
    if (!data) break;
    slug = `${base}-${n}`;
  }

  const row = {
    slug, title: p.title, category: p.category, description: p.description, client: p.client, year: p.year,
    video_path: p.videoPath, video_url: p.videoUrl || null, thumb_path: p.thumbPath, aspect: p.aspect,
    featured: p.featured, published: p.published, updated_at: new Date().toISOString(),
  };

  let prev: { video_path: string | null; thumb_path: string | null } | null = null;
  if (p.isNew) {
    const { error } = await supabase.from("projects").insert({ id: p.id, ...row });
    if (error) return fail("No se pudo guardar el proyecto.");
  } else {
    const { data } = await supabase.from("projects").select("video_path,thumb_path").eq("id", p.id).maybeSingle();
    prev = data;
    const { error } = await supabase.from("projects").update(row).eq("id", p.id);
    if (error) return fail("No se pudo guardar el proyecto.");
  }
  // Solo un destacado a la vez.
  if (p.featured) await supabase.from("projects").update({ featured: false }).neq("id", p.id).eq("featured", true);
  const stale = [prev?.video_path, prev?.thumb_path].filter((x): x is string => !!x && x !== p.videoPath && x !== p.thumbPath);
  if (stale.length) await supabase.storage.from(MEDIA_BUCKET).remove(stale);

  refreshSite();
  return { ok: true, id: p.id };
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdminAction();
  if (!uuid.safeParse(id).success) return fail("Proyecto no válido.");
  const { data: files } = await supabase.storage.from(MEDIA_BUCKET).list(`projects/${id}`);
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return fail("No se pudo eliminar.");
  if (files?.length) await supabase.storage.from(MEDIA_BUCKET).remove(files.map((f) => `projects/${id}/${f.name}`));
  refreshSite();
  return { ok: true };
}

export async function toggleProjectAction(id: string, field: "published" | "featured", value: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdminAction();
  if (!uuid.safeParse(id).success) return fail("Proyecto no válido.");
  if (field === "featured" && value) await supabase.from("projects").update({ featured: false }).eq("featured", true);
  const { error } = await supabase.from("projects").update({ [field]: value }).eq("id", id);
  if (error) return fail("No se pudo actualizar.");
  refreshSite();
  return { ok: true };
}

export async function reorderProjectsAction(ids: string[]): Promise<ActionResult> {
  const { supabase } = await requireAdminAction();
  if (!z.array(uuid).max(300).safeParse(ids).success) return fail("Orden no válido.");
  for (let i = 0; i < ids.length; i++) await supabase.from("projects").update({ sort_order: i }).eq("id", ids[i]);
  refreshSite();
  return { ok: true };
}

// ---------------- Testimonios ----------------
const testimonialSchema = z.object({
  id: uuid,
  isNew: z.boolean(),
  name: z.string().trim().min(1, "Escribe el nombre.").max(80),
  role: z.string().trim().max(120).default(""),
  body: z.string().trim().min(1, "Escribe el testimonio.").max(800),
  stars: z.number().int().min(1).max(5),
  avatarPath: z.string().nullable(),
  published: z.boolean(),
});
export type TestimonialInput = z.input<typeof testimonialSchema>;

export async function saveTestimonialAction(input: TestimonialInput): Promise<ActionResult> {
  const { supabase } = await requireAdminAction();
  const parsed = testimonialSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos no válidos.");
  const t = parsed.data;
  if (t.avatarPath && !new RegExp(`^testimonials/${t.id}/[a-z0-9._-]{1,80}$`).test(t.avatarPath)) return fail("Archivo no válido.");
  const row = { name: t.name, role: t.role, body: t.body, stars: t.stars, avatar_path: t.avatarPath, published: t.published };
  const { error } = t.isNew
    ? await supabase.from("testimonials").insert({ id: t.id, ...row })
    : await supabase.from("testimonials").update(row).eq("id", t.id);
  if (error) return fail("No se pudo guardar.");
  refreshSite();
  return { ok: true, id: t.id };
}

export async function deleteTestimonialAction(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdminAction();
  if (!uuid.safeParse(id).success) return fail("No válido.");
  const { data: files } = await supabase.storage.from(MEDIA_BUCKET).list(`testimonials/${id}`);
  const { error } = await supabase.from("testimonials").delete().eq("id", id);
  if (error) return fail("No se pudo eliminar.");
  if (files?.length) await supabase.storage.from(MEDIA_BUCKET).remove(files.map((f) => `testimonials/${id}/${f.name}`));
  refreshSite();
  return { ok: true };
}

// ---------------- Mensajes ----------------
export async function markMessageAction(id: string, read: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdminAction();
  if (!uuid.safeParse(id).success) return fail("No válido.");
  const { error } = await supabase.from("messages").update({ read }).eq("id", id);
  if (error) return fail("No se pudo actualizar.");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function deleteMessageAction(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdminAction();
  if (!uuid.safeParse(id).success) return fail("No válido.");
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) return fail("No se pudo eliminar.");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
