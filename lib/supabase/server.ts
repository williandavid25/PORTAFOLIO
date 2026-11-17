import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseConfig, type CookieToSet } from "./config";

/** Cliente con la sesión del visitante (cookies). Respeta RLS. */
export async function createSessionClient(): Promise<SupabaseClient | null> {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  const store = await cookies();
  return createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list: CookieToSet[]) {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // En Server Components no siempre se pueden escribir cookies; el proxy las refresca.
        }
      },
    },
  });
}

/** Cliente anónimo sin cookies, para leer contenido público (cacheable). */
export function createPublicClient(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  return createPlainClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Service role: omite RLS. Solo para el formulario de contacto, nunca en el cliente. */
export function createServiceClient(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cfg || !service) return null;
  return createPlainClient(cfg.url, service, { auth: { persistSession: false, autoRefreshToken: false } });
}
