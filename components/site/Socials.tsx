import type { SiteData } from "@/lib/content";

/**
 * Redes sociales con el ícono de cada app tal como se ve en el teléfono
 * (cuadrito redondeado, color de marca y símbolo grande con un leve brillo).
 * Solo se muestran las que tienen link.
 */
type Key = keyof SiteData["socials"];
const NAMES: Record<Key, string> = { linkedin: "LinkedIn", github: "GitHub", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
const ORDER: Key[] = ["linkedin", "github", "facebook", "instagram", "tiktok", "youtube"];

/** Símbolo blanco con un degradado muy suave (blanco → tono claro de la marca), como en iOS. */
function Glyph({ k, id }: { k: Key; id: string }) {
  const g = `url(#${id})`;
  const tint: Record<Key, string> = { linkedin: "#dceaff", github: "#e6e9ee", facebook: "#cfe0ff", instagram: "#fff0f7", tiktok: "#ffffff", youtube: "#ffe3e3" };
  const defs = (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor={tint[k]} />
      </linearGradient>
    </defs>
  );
  switch (k) {
    case "facebook":
      // «f» grande que llega al borde inferior (como el ícono de la app).
      return (<svg viewBox="0 0 24 24" className="g-fb" aria-hidden="true">{defs}<path fill={g} d="M15.3 24.5v-9.2h3.05l.46-3.55H15.3V9.5c0-1.03.29-1.73 1.76-1.73h1.88V4.6a25 25 0 0 0-2.74-.14c-2.71 0-4.57 1.66-4.57 4.7v2.6H8.58v3.55h3.05v9.2z" /></svg>);
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" className="g-ig" aria-hidden="true">{defs}
          <g fill="none" stroke={g} strokeWidth="2.15">
            <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.4" />
            <circle cx="12" cy="12" r="4.15" />
          </g>
          <circle cx="17.35" cy="6.65" r="1.18" fill={g} />
        </svg>
      );
    case "tiktok":
      return (<svg viewBox="0 0 24 24" className="g-tt" aria-hidden="true">{defs}<path fill={g} d="M16.6 2h-3.3v13.3a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6.05.9.14V9.15a6.3 6.3 0 1 0 5.3 6.2V8.6a7.7 7.7 0 0 0 4.4 1.4V6.7a4.5 4.5 0 0 1-4.4-4.7z" /></svg>);
    case "linkedin":
      return (<svg viewBox="0 0 24 24" className="g-li" aria-hidden="true">{defs}<path fill={g} d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z" /></svg>);
    case "github":
      return (<svg viewBox="0 0 24 24" className="g-gh" aria-hidden="true">{defs}<path fill={g} d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.82-.26.82-.58v-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.21.7.82.58A12 12 0 0 0 12 .3" /></svg>);
    default:
      return (<svg viewBox="0 0 24 24" className="g-yt" aria-hidden="true">{defs}<path fill={g} d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" /></svg>);
  }
}

export default function Socials({ socials, label = false }: { socials: SiteData["socials"]; label?: boolean }) {
  const items = ORDER.filter((k) => socials[k]);
  if (!items.length) return null;
  const where = label ? "h" : "c"; // la portada y el contacto usan ids distintos para los degradados
  return (
    <div className="socials">
      {label && <span>Sígueme</span>}
      {items.map((k) => (
        <a key={k} className={`si app app-${k}`} href={socials[k]} target="_blank" rel="noopener noreferrer" aria-label={NAMES[k]} title={NAMES[k]}>
          <Glyph k={k} id={`sg-${where}-${k}`} />
        </a>
      ))}
    </div>
  );
}
