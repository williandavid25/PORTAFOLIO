import type { CookieOptions } from "@supabase/ssr";

export type CookieToSet = { name: string; value: string; options: CookieOptions };

/** Devuelve la configuración pública de Supabase, o null si aún no está puesta. */
export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export const MEDIA_BUCKET = "media";

/** URL pública de un archivo del bucket (fotos y videos). */
export function mediaUrl(path: string | null | undefined): string | null {
  const cfg = getSupabaseConfig();
  if (!path || !cfg) return null;
  return `${cfg.url}/storage/v1/object/public/${MEDIA_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
