// Utilidades de video compartidas entre servidor y navegador.

export function youtubeId(url: string | null | undefined): string | null {
  const m = (url ?? "").match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function vimeoId(url: string | null | undefined): string | null {
  const m = (url ?? "").match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

/** Enlace de inserción seguro (solo YouTube sin cookies o Vimeo). */
export function embedUrl(url: string | null | undefined, autoplay = true): string | null {
  const yt = youtubeId(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1${autoplay ? "&autoplay=1" : ""}`;
  const vm = vimeoId(url);
  if (vm) return `https://player.vimeo.com/video/${vm}?dnt=1${autoplay ? "&autoplay=1" : ""}`;
  return null;
}

export function externalThumb(url: string | null | undefined): string | null {
  const yt = youtubeId(url);
  return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null;
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "proyecto";
}
