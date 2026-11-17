import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { getSupabaseConfig } from "@/lib/supabase/config";
import LoginForm from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  const configured = !!getSupabaseConfig() && !!process.env.ADMIN_EMAIL;
  return (
    <div className="login">
      <div className="hglow" />
      <div className="login-card">
        <span className="logo"><span className="logo-mark">D</span><span className="logo-txt"><b>DevWilly</b><i>Panel de administración</i></span></span>
        <h1>Bienvenido <em>de vuelta</em></h1>
        <p>Entra para subir videos y fotos y editar tu portafolio.</p>
        {configured ? <LoginForm /> : <div className="alert warn">El panel todavía no está conectado a la base de datos.</div>}
        <p style={{ marginTop: 18, fontSize: 13, color: "var(--g3)" }}>
          ¿Primera vez o olvidaste tu contraseña? <Link href="/admin/acceso" style={{ color: "var(--acc2)" }}>Configura tu acceso</Link>
        </p>
      </div>
    </div>
  );
}
