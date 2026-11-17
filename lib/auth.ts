import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSessionClient } from "./supabase/server";

/** Correo autorizado. Doble candado: variable de entorno + tabla pf_admins (RLS). */
function allowedEmail() {
  return (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
}

export type AdminSession = { user: User; supabase: SupabaseClient };

/** Devuelve la sesión solo si es el administrador; si no, null. */
export async function getAdmin(): Promise<AdminSession | null> {
  const supabase = await createSessionClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!user || !email || !allowedEmail() || email !== allowedEmail()) return null;
  const { data: ok, error } = await supabase.rpc("pf_is_admin");
  if (error || ok !== true) return null;
  return { user, supabase };
}

/** Para páginas del panel: redirige al login si no es el administrador. */
export async function requireAdminPage(): Promise<AdminSession> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** Para Server Actions: lanza error si no es el administrador. */
export async function requireAdminAction(): Promise<AdminSession> {
  const admin = await getAdmin();
  if (!admin) throw new Error("No autorizado.");
  return admin;
}
