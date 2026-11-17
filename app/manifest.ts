import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Willy — Video Editor",
    short_name: "Willy",
    description: "Portafolio de edición de video, reels y motion graphics.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0503",
    theme_color: "#0a0503",
    categories: ["photo", "entertainment", "business"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Portafolio", url: "/portafolio" },
      { name: "Panel admin", url: "/admin" },
    ],
  };
}
