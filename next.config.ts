import type { NextConfig } from "next";
import { PUBLIC_SUPABASE_URL } from "./lib/supabase/public";

const isDev = process.env.NODE_ENV !== "production";
const supabase = PUBLIC_SUPABASE_URL;
const supabaseHost = supabase ? new URL(supabase).host : "";
const sb = supabaseHost ? `https://${supabaseHost}` : "";
const sbWs = supabaseHost ? `wss://${supabaseHost}` : "";

// Política de seguridad de contenido: solo se cargan recursos de este sitio,
// de Supabase (fotos/videos) y de YouTube/Vimeo (videos insertados).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${sb} https://i.ytimg.com https://i.vimeocdn.com`,
  `media-src 'self' blob: ${sb}`,
  "font-src 'self' data:",
  `connect-src 'self' ${sb} ${sbWs}${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

// Solo /lab: cámara permitida y el detector de MediaPipe (WebAssembly desde jsDelivr,
// modelos desde Google). El resto del sitio sigue con la cámara bloqueada.
const labCsp = csp
  .replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net")
  .replace("connect-src 'self'", "connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com");
const labHeaders = [
  { key: "Content-Security-Policy", value: labCsp },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
];

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Fotos: el original queda intacto en Supabase; el optimizador entrega a cada
  // pantalla una copia del tamaño justo con calidad alta (90).
  images: {
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/portafolio/**" }] : [],
    qualities: [75, 90, 95],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }, { source: "/lab", headers: labHeaders }];
  },
};

export default nextConfig;
