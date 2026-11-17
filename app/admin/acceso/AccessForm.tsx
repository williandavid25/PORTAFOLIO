"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setupAccessAction, type SetupResult } from "./actions";

export default function AccessForm() {
  const [state, action, pending] = useActionState<SetupResult | null, FormData>(setupAccessAction, null);
  if (state?.ok) {
    return (
      <div>
        <div className="alert ok">Listo. Tu contraseña quedó guardada.</div>
        <Link href="/admin/login" className="btn btn-p" style={{ width: "100%", marginTop: 16 }}>Iniciar sesión</Link>
      </div>
    );
  }
  return (
    <form action={action}>
      <div className="f"><label htmlFor="a-email">Correo del administrador</label><input id="a-email" name="email" type="email" className="in" autoComplete="username" required /></div>
      <div className="f"><label htmlFor="a-code">Código privado de configuración</label><input id="a-code" name="code" className="in" autoComplete="off" spellCheck={false} required /></div>
      <div className="f"><label htmlFor="a-pass">Nueva contraseña</label><input id="a-pass" name="password" type="password" className="in" autoComplete="new-password" minLength={10} required /><div className="hint">Mínimo 10 caracteres, con letras y números.</div></div>
      <div className="f"><label htmlFor="a-conf">Repite la contraseña</label><input id="a-conf" name="confirm" type="password" className="in" autoComplete="new-password" minLength={10} required /></div>
      <button className="btn btn-p" style={{ width: "100%", marginTop: 6 }} disabled={pending}>{pending ? "Guardando…" : "Guardar contraseña"}</button>
      {state && !state.ok && <div className="alert err" role="alert">{state.error}</div>}
    </form>
  );
}
