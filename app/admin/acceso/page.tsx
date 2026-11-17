import Link from "next/link";
import AccessForm from "./AccessForm";

export const dynamic = "force-dynamic";

export default function AccessPage() {
  return (
    <div className="login">
      <div className="hglow" />
      <div className="login-card">
        <span className="logo"><span className="logo-mark">D</span><span className="logo-txt"><b>DevWilly</b><i>Configurar acceso</i></span></span>
        <h1>Crea tu <em>contraseña</em></h1>
        <p>Solo el administrador puede hacerlo: necesitas tu correo autorizado y tu código privado de configuración.</p>
        <AccessForm />
        <p style={{ marginTop: 18, fontSize: 13, color: "var(--g3)" }}><Link href="/admin/login" style={{ color: "var(--acc2)" }}>← Volver a iniciar sesión</Link></p>
      </div>
    </div>
  );
}
