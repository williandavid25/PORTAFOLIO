"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Message } from "@/lib/content";
import { deleteMessageAction, markMessageAction } from "@/app/admin/actions";

export default function MessageList({ rows }: { rows: Message[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const act = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  if (!rows.length) return <div className="panel"><p style={{ color: "var(--g3)", fontSize: 14 }}>Todavía no hay mensajes.</p></div>;
  return (
    <div className="items" style={{ opacity: pending ? 0.8 : 1 }}>
      {rows.map((m) => (
        <article key={m.id} className={`msg${m.read ? "" : " unread"}`}>
          <header>
            <div>
              <b>{m.name}</b>{" "}
              <a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: tu proyecto")}`}>{m.email}</a>
              {m.project_type && <span className="tag acc" style={{ marginLeft: 8 }}>{m.project_type}</span>}
            </div>
            <time>{new Date(m.created_at).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" })}</time>
          </header>
          <p>{m.body}</p>
          <div className="actions" style={{ marginTop: 12 }}>
            <a className="btn btn-sm btn-p" href={`mailto:${m.email}?subject=${encodeURIComponent("Re: tu proyecto")}`}>Responder</a>
            <button className="btn btn-sm btn-o" onClick={() => act(() => markMessageAction(m.id, !m.read))}>{m.read ? "Marcar no leído" : "Marcar leído"}</button>
            {confirmDel === m.id
              ? <button className="btn btn-sm btn-d" onClick={() => { setConfirmDel(null); act(() => deleteMessageAction(m.id)); }}>¿Borrar?</button>
              : <button className="btn btn-sm btn-d" onClick={() => setConfirmDel(m.id)}>Eliminar</button>}
          </div>
        </article>
      ))}
    </div>
  );
}
