"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/admin/actions";

const I = {
  home: <path d="M3 10.5 12 3l9 7.5V21H3z" />,
  video: <><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="22,6 12,13 2,6" /></>,
  ext: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>,
  out: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
};
const Svg = ({ d }: { d: React.ReactNode }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;

const LINKS = [
  { href: "/admin", label: "Inicio", icon: I.home },
  { href: "/admin/proyectos", label: "Videos", icon: I.video },
  { href: "/admin/perfil", label: "Perfil", icon: I.user },
  { href: "/admin/testimonios", label: "Testimonios", icon: I.star },
  { href: "/admin/mensajes", label: "Mensajes", icon: I.mail },
];

export default function AdminNav({ unread }: { unread: number }) {
  const path = usePathname();
  return (
    <aside className="adm-side">
      <Link href="/" className="logo"><span className="logo-mark">D</span><span className="logo-txt"><b>Panel</b><i>Portafolio</i></span></Link>
      {LINKS.map((l) => {
        const on = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`adm-link${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>
            <Svg d={l.icon} /> {l.label}
            {l.href === "/admin/mensajes" && unread > 0 && <span className="badge">{unread}</span>}
          </Link>
        );
      })}
      <div className="grow" />
      <a href="/" target="_blank" rel="noopener" className="adm-link hide-m"><Svg d={I.ext} /> Ver sitio</a>
      <form action={logoutAction} className="hide-m"><button className="adm-link" style={{ width: "100%" }}><Svg d={I.out} /> Salir</button></form>
    </aside>
  );
}
