import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { getSupabaseConfig } from "@/lib/supabase/config";
import LoginForm from "@/components/admin/LoginForm";
import EmberField from "@/components/motion/EmberField";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  const configured = !!getSupabaseConfig() && !!process.env.ADMIN_EMAIL;
  return (
    <div className="login">
      <div className="hglow" />
      <EmberField />
      <div className="login-card">
        <span className="logo"><span className="logo-mark">W</span><span className="logo-txt"><b>Panel</b><i>Solo administrador</i></span></span>
        <h1>Bienvenido <em>de vuelta</em></h1>
        <p>Entra para subir videos y editar tu portafolio.</p>
        {configured ? <LoginForm /> : <div className="alert warn">El panel todavía no está conectado a la base de datos. Falta configurar Supabase (te guío en un paso).</div>}
      </div>
    </div>
  );
}
