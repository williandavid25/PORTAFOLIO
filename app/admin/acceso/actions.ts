"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

export type SetupResult = { ok: true } | { ok: false; error: string };

// Límite de intentos por IP (memoria del servidor) para frenar ataques de fuerza bruta.
const attempts = new Map<string, { n: number; until: number }>();
const MAX = 5;
const WINDOW = 15 * 60_000;

function sameSecret(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Crea o cambia la contraseña del administrador del portafolio.
 * Requiere el código privado de configuración (ADMIN_SETUP_CODE, solo en el
 * servidor) y que el correo sea exactamente el del administrador.
 */
export async function setupAccessAction(_: SetupResult | null, form: FormData): Promise<SetupResult> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && rec.until > now && rec.n >= MAX) return { ok: false, error: "Demasiados intentos. Espera 15 minutos." };

  const fail = async (error: string): Promise<SetupResult> => {
    const r = attempts.get(ip);
    attempts.set(ip, r && r.until > now ? { n: r.n + 1, until: r.until } : { n: 1, until: now + WINDOW });
    await new Promise((res) => setTimeout(res, 700));
    return { ok: false, error };
  };

  const admin = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const code = process.env.ADMIN_SETUP_CODE ?? "";
  const db = createServiceClient();
  if (!admin || code.length < 16 || !db) return { ok: false, error: "El acceso todavía no está configurado en el servidor." };

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const given = String(form.get("code") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  // Mensaje genérico: no revela si falló el correo o el código.
  if (email !== admin || !sameSecret(given, code)) return fail("Correo o código de configuración incorrectos.");
  if (password !== confirm) return { ok: false, error: "Las contraseñas no coinciden." };
  if (password.length < 10 || password.length > 72 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return { ok: false, error: "Usa al menos 10 caracteres, con letras y números." };
  }

  // Debe estar en la lista de administradores de la base de datos.
  const { data: row } = await db.from("pf_admins").select("email").eq("email", admin).maybeSingle();
  if (!row) return { ok: false, error: "Este correo no está autorizado como administrador." };

  // Busca la cuenta; si no existe, la crea ya confirmada.
  let userId: string | null = null;
  for (let page = 1; page <= 10 && !userId; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { ok: false, error: "No se pudo verificar la cuenta. Intenta de nuevo." };
    userId = data.users.find((u) => u.email?.toLowerCase() === admin)?.id ?? null;
    if (data.users.length < 200) break;
  }
  const res = userId
    ? await db.auth.admin.updateUserById(userId, { password })
    : await db.auth.admin.createUser({ email: admin, password, email_confirm: true });
  if (res.error) return { ok: false, error: "No se pudo guardar la contraseña. Intenta con otra." };

  attempts.delete(ip);
  return { ok: true };
}
