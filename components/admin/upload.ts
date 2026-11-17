"use client";

import { getBrowserClient } from "@/lib/supabase/client";

export const MAX_BYTES = 50 * 1024 * 1024; // límite por archivo del plan gratuito de Supabase
const IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO = ["video/mp4", "video/webm", "video/quicktime"];

export function checkFile(file: File, kind: "image" | "video" | "media"): string | null {
  const ok = kind === "image" ? IMAGE : kind === "video" ? VIDEO : [...IMAGE, ...VIDEO];
  if (!ok.includes(file.type)) return kind === "image" ? "Usa una imagen JPG, PNG, WEBP o GIF." : kind === "video" ? "Usa un video MP4, WEBM o MOV." : "Formato no permitido.";
  if (file.size > MAX_BYTES) return `El archivo pesa ${(file.size / 1048576).toFixed(1)} MB. El máximo es 50 MB (exporta en 1080p, H.264).`;
  return null;
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
export const fileName = (base: string, type: string) => `${base}-${Date.now().toString(36)}.${EXT[type] ?? "bin"}`;

/** Sube directo a Supabase Storage con barra de progreso. RLS exige que seas el admin. */
export async function uploadFile(path: string, file: Blob, onProgress?: (pct: number) => void): Promise<void> {
  const sb = getBrowserClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!sb || !url || !anon) throw new Error("Supabase no está configurado.");
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error("Tu sesión expiró. Vuelve a entrar.");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${url}/storage/v1/object/portafolio/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", anon);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = "No se pudo subir el archivo.";
      try { const j = JSON.parse(xhr.responseText); if (/size/i.test(j.message ?? "")) msg = "El archivo supera el tamaño permitido."; else if (/mime|type/i.test(j.message ?? "")) msg = "Formato no permitido."; else if (xhr.status === 403 || xhr.status === 401) msg = "No tienes permiso para subir archivos."; } catch {}
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Se cortó la conexión al subir."));
    xhr.send(file);
  });
}

/** Lee el tamaño del video y saca un fotograma como miniatura (sin subir nada aún). */
export function inspectVideo(file: File): Promise<{ aspect: "16:9" | "9:16" | "1:1" | "4:5"; thumb: Blob | null; duration: number }> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const src = URL.createObjectURL(file);
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = src;
    const done = (r: { aspect: "16:9" | "9:16" | "1:1" | "4:5"; thumb: Blob | null; duration: number }) => { URL.revokeObjectURL(src); resolve(r); };
    v.onloadedmetadata = () => { v.currentTime = Math.min(1.2, (v.duration || 3) / 3); };
    v.onseeked = () => {
      const ratio = v.videoWidth / v.videoHeight || 16 / 9;
      const aspect = ratio > 1.3 ? "16:9" : ratio < 0.7 ? "9:16" : ratio < 0.9 ? "4:5" : "1:1";
      const scale = 1; // miniatura a la resolución completa del video
      const c = document.createElement("canvas");
      c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((b) => done({ aspect, thumb: b, duration: v.duration }), "image/jpeg", 0.95);
    };
    v.onerror = () => done({ aspect: "16:9", thumb: null, duration: 0 });
  });
}

/** Achica imágenes grandes antes de subirlas (mantiene transparencia en PNG/WEBP). */
export async function shrinkImage(file: File, max = 1800): Promise<Blob> {
  if (file.type === "image/gif") return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (s === 1 && file.size < 1.5 * 1048576) return file;
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
  const alpha = file.type === "image/png" || file.type === "image/webp";
  return await new Promise<Blob>((r) => c.toBlob((b) => r(b ?? file), alpha ? "image/webp" : "image/jpeg", 0.86));
}
