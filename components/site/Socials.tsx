import type { SiteData } from "@/lib/content";

/**
 * Redes sociales con el ícono real de cada app (en su color de marca, como un ícono de app).
 * Solo se muestran las que tienen link.
 */
type Key = keyof SiteData["socials"];
const NAMES: Record<Key, string> = { linkedin: "LinkedIn", github: "GitHub", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
const ORDER: Key[] = ["linkedin", "github", "facebook", "instagram", "tiktok", "youtube"];

const GLYPHS: Record<Key, React.ReactNode> = {
  linkedin: <path fill="currentColor" d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z" />,
  github: <path fill="currentColor" d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.82-.26.82-.58v-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.21.7.82.58A12 12 0 0 0 12 .3" />,
  facebook: <path fill="currentColor" d="M13.4 23v-9.2h3.1l.46-3.6H13.4V7.9c0-1.04.29-1.75 1.78-1.75h1.9V2.94a25 25 0 0 0-2.77-.14c-2.74 0-4.62 1.67-4.62 4.75v2.65H6.6v3.6h3.1V23h3.7z" />,
  instagram: (
    <g fill="none" stroke="currentColor" strokeWidth="2.1">
      <rect x="3" y="3" width="18" height="18" rx="5.2" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </g>
  ),
  tiktok: <path fill="currentColor" d="M16.6 2h-3.3v13.3a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6.05.9.14V9.15a6.3 6.3 0 1 0 5.3 6.2V8.6a7.7 7.7 0 0 0 4.4 1.4V6.7a4.5 4.5 0 0 1-4.4-4.7z" />,
  youtube: <path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />,
};

export default function Socials({ socials, label = false }: { socials: SiteData["socials"]; label?: boolean }) {
  const items = ORDER.filter((k) => socials[k]);
  if (!items.length) return null;
  return (
    <div className="socials">
      {label && <span>Sígueme</span>}
      {items.map((k) => (
        <a key={k} className={`si app app-${k}`} href={socials[k]} target="_blank" rel="noopener noreferrer" aria-label={NAMES[k]} title={NAMES[k]}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{GLYPHS[k]}</svg>
        </a>
      ))}
    </div>
  );
}
