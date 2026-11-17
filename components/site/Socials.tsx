import Icon from "./Icon";
import type { SiteData } from "@/lib/content";

const NAMES = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", facebook: "Facebook" } as const;

export default function Socials({ socials, label = false }: { socials: SiteData["socials"]; label?: boolean }) {
  const items = (Object.keys(NAMES) as Array<keyof typeof NAMES>).filter((k) => socials[k]);
  if (!items.length) return null;
  return (
    <div className="socials">
      {label && <span>Sígueme</span>}
      {items.map((k) => (
        <a key={k} className="si" href={socials[k]} target="_blank" rel="noopener noreferrer" aria-label={NAMES[k]}>
          <Icon name={k} />
        </a>
      ))}
    </div>
  );
}
