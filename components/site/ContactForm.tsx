"use client";

import { useState, type FormEvent } from "react";
import Icon from "./Icon";

const TYPES = ["Edición de video para redes", "Video publicitario", "Video corporativo", "YouTube / Streaming", "Motion Graphics", "Página o herramienta web", "Community management", "Otro"];

export default function ContactForm() {
  const [state, setState] = useState<{ status: "idle" | "sending" | "ok" | "err"; msg?: string }>({ status: "idle" });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(fd.entries())),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "No se pudo enviar. Intenta de nuevo.");
      form.reset();
      setState({ status: "ok", msg: "¡Mensaje enviado! Te responderé en menos de 24 horas." });
    } catch (err) {
      setState({ status: "err", msg: err instanceof Error ? err.message : "No se pudo enviar." });
    }
  }

  return (
    <form onSubmit={submit} noValidate={false}>
      {/* Trampa para bots: los humanos no ven este campo. */}
      <div className="hp" aria-hidden="true">
        <label>No llenar<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="frow">
        <div className="fg"><label htmlFor="f-name">Nombre</label><input id="f-name" name="name" className="fi" placeholder="Tu nombre" required maxLength={80} autoComplete="name" /></div>
        <div className="fg"><label htmlFor="f-email">Email</label><input id="f-email" name="email" type="email" className="fi" placeholder="tu@email.com" required maxLength={160} autoComplete="email" /></div>
      </div>
      <div className="fg">
        <label htmlFor="f-type">Tipo de proyecto</label>
        <select id="f-type" name="projectType" className="fi" defaultValue="">
          <option value="">Selecciona una opción</option>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="fg"><label htmlFor="f-msg">Cuéntame sobre tu proyecto</label><textarea id="f-msg" name="message" className="fi" placeholder="Describe tu proyecto, objetivos, plazos..." required maxLength={3000} rows={5} /></div>
      <button type="submit" className="btn btn-p" style={{ width: "100%" }} disabled={state.status === "sending"} data-magnetic>
        <Icon name="send" /> {state.status === "sending" ? "Enviando…" : "Enviar mensaje"}
      </button>
      {(state.status === "ok" || state.status === "err") && <div className={`notice ${state.status}`} role="status">{state.msg}</div>}
    </form>
  );
}
