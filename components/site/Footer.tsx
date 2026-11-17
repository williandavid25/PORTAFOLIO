import Link from "next/link";
import Icon from "./Icon";
import type { SiteData } from "@/lib/content";

export default function Footer({ site }: { site: SiteData }) {
  const socials = (["instagram", "tiktok", "youtube", "facebook"] as const).filter((k) => site.socials[k]);
  const names = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", facebook: "Facebook" };
  return (
    <footer className="footer">
      <div className="container">
        <div className="ftop">
          <div>
            <Link href="/" className="logo"><span className="logo-mark">{site.name.charAt(0)}</span><span className="logo-txt"><b>{site.name}</b><i>{site.role}</i></span></Link>
            <p>Creando contenido visual de impacto para marcas que quieren destacar.</p>
          </div>
          <div className="fcols">
            <div className="fcol"><h4>Navegación</h4><ul><li><Link href="/#inicio">Inicio</Link></li><li><Link href="/#sobre-mi">Sobre mí</Link></li><li><Link href="/#servicios">Servicios</Link></li><li><Link href="/portafolio">Portafolio</Link></li></ul></div>
            <div className="fcol"><h4>Servicios</h4><ul><li><Link href="/#servicios">Redes sociales</Link></li><li><Link href="/#servicios">Video comercial</Link></li><li><Link href="/#servicios">Corporativo</Link></li><li><Link href="/#servicios">Motion graphics</Link></li></ul></div>
            {socials.length > 0 && <div className="fcol"><h4>Social</h4><ul>{socials.map((k) => <li key={k}><a href={site.socials[k]} target="_blank" rel="noopener noreferrer">{names[k]}</a></li>)}</ul></div>}
          </div>
        </div>
        <div className="fbig" data-bigname aria-hidden="true">{site.name}</div>
        <div className="fbot">
          <p>© {new Date().getFullYear()} {site.name}. Todos los derechos reservados. Hecho con <span style={{ color: "var(--acc)" }}>♥</span> en {site.location || "Ecuador"}</p>
          <Link href="/#inicio" style={{ display: "inline-flex", gap: 8, alignItems: "center", letterSpacing: ".15em", textTransform: "uppercase", fontSize: 12 }}>Volver arriba <Icon name="up" size={14} /></Link>
        </div>
      </div>
    </footer>
  );
}
