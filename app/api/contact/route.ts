import { createHash } from "node:crypto";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre.").max(80),
  email: z.string().trim().email("Escribe un correo válido.").max(160),
  projectType: z.string().trim().max(60).optional().default(""),
  message: z.string().trim().min(10, "Cuéntame un poco más (mínimo 10 caracteres).").max(3000),
  website: z.string().max(0).optional(), // trampa anti-bots: debe venir vacío
});

const WINDOW_MIN = 15;
const MAX_PER_WINDOW = 3;

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "Formato no válido." }, { status: 415 });
  }
  const raw = await request.text();
  if (raw.length > 10_000) return Response.json({ error: "Mensaje demasiado largo." }, { status: 413 });

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Formato no válido." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Si cayó en la trampa, respondemos "ok" para no darle pistas al bot.
    if ((body as { website?: string })?.website) return Response.json({ ok: true });
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Revisa los datos." }, { status: 400 });
  }

  const db = createServiceClient();
  if (!db) return Response.json({ error: "El formulario aún no está activo. Escríbeme por correo o WhatsApp." }, { status: 503 });

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "0.0.0.0";
  const salt = process.env.CONTACT_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const ipHash = createHash("sha256").update(`${salt}:${ip}`).digest("hex");

  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const { count } = await db.from("messages").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_WINDOW) {
    return Response.json({ error: "Enviaste varios mensajes seguidos. Intenta de nuevo en unos minutos." }, { status: 429 });
  }

  const { name, email, projectType, message } = parsed.data;
  const { error } = await db.from("messages").insert({ name, email, project_type: projectType, body: message, ip_hash: ipHash });
  if (error) return Response.json({ error: "No se pudo enviar. Intenta de nuevo." }, { status: 500 });
  return Response.json({ ok: true });
}
