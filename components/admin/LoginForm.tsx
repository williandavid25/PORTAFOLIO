"use client";

import { useActionState } from "react";
import { loginAction, type ActionResult } from "@/app/admin/actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(loginAction, null);
  return (
    <form action={action}>
      <div className="f"><label htmlFor="l-email">Correo</label><input id="l-email" name="email" type="email" className="in" autoComplete="username" required /></div>
      <div className="f"><label htmlFor="l-pass">Contraseña</label><input id="l-pass" name="password" type="password" className="in" autoComplete="current-password" required minLength={8} /></div>
      <button className="btn btn-p" style={{ width: "100%", marginTop: 6 }} disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
      {state && !state.ok && <div className="alert err" role="alert">{state.error}</div>}
    </form>
  );
}
