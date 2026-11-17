import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { logoutAction } from "../actions";

export default async function Dashboard() {
  const { supabase, user } = await requireAdminPage();
  const head = { count: "exact" as const, head: true };
  const [projects, published, tests, unread, recent] = await Promise.all([
    supabase.from("pf_projects").select("id", head),
    supabase.from("pf_projects").select("id", head).eq("published", true),
    supabase.from("pf_testimonials").select("id", head),
    supabase.from("pf_messages").select("id", head).eq("read", false),
    supabase.from("pf_messages").select("id,name,email,body,created_at,read").order("created_at", { ascending: false }).limit(4),
  ]);

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Hola de nuevo 👋</h1>
          <p>Sesión iniciada como {user.email}</p>
        </div>
        <div className="actions">
          <Link href="/admin/proyectos?nuevo=1" className="btn btn-p">+ Subir video</Link>
          <form action={logoutAction}><button className="btn btn-o">Salir</button></form>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><b>{projects.count ?? 0}</b><span>Videos en total</span></div>
        <div className="kpi"><b>{published.count ?? 0}</b><span>Publicados</span></div>
        <div className="kpi"><b>{tests.count ?? 0}</b><span>Testimonios</span></div>
        <div className="kpi"><b>{unread.count ?? 0}</b><span>Mensajes sin leer</span></div>
      </div>
      <div className="panel">
        <h2>Últimos mensajes</h2>
        {recent.data?.length ? (
          <div className="items">
            {recent.data.map((m) => (
              <Link href="/admin/mensajes" key={m.id} className={`msg${m.read ? "" : " unread"}`}>
                <header><b>{m.name}</b><time>{new Date(m.created_at).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" })}</time></header>
                <p style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.body}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--g3)", fontSize: 14 }}>Todavía no llegan mensajes del formulario de contacto.</p>
        )}
      </div>
    </>
  );
}
