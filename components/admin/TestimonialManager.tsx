"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Testimonial } from "@/lib/content";
import { deleteTestimonialAction, saveTestimonialAction } from "@/app/admin/actions";
import { checkFile, fileName, shrinkImage, uploadFile } from "./upload";

type Row = Testimonial & { avatarSrc: string | null };

export default function TestimonialManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  return (
    <>
      <div className="adm-head">
        <div><h1>Testimonios</h1><p>Lo que dicen tus clientes (solo publica testimonios reales).</p></div>
        <button className="btn btn-p" onClick={() => setEditing("new")}>+ Añadir</button>
      </div>
      {err && <div className="alert err">{err}</div>}
      <div className="panel">
        {rows.length ? (
          <div className="items">
            {rows.map((t) => (
              <div className="item" key={t.id} style={{ opacity: pending ? 0.75 : 1 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="th" style={{ width: 52, aspectRatio: "1", borderRadius: "50%" }}>{t.avatarSrc ? <img src={t.avatarSrc} alt="" /> : t.name.charAt(0)}</div>
                <div className="meta"><b>{t.name}</b><span>{"★".repeat(t.stars)} · {t.role || "—"} · {t.published ? "Publicado" : "Oculto"}</span></div>
                <button className="ibtn" title="Editar" onClick={() => setEditing(t)}>✎</button>
                {confirmDel === t.id ? (
                  <button className="btn btn-sm btn-d" onClick={() => start(async () => { setConfirmDel(null); const r = await deleteTestimonialAction(t.id); if (!r.ok) setErr(r.error); router.refresh(); })}>¿Borrar?</button>
                ) : (
                  <button className="ibtn danger" title="Eliminar" onClick={() => setConfirmDel(t.id)}>🗑</button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--g3)", fontSize: 14 }}>Aún no hay testimonios.</p>
        )}
      </div>
      {editing && <TestimonialForm row={editing === "new" ? null : editing} onClose={(saved) => { setEditing(null); if (saved) router.refresh(); }} />}
    </>
  );
}

function TestimonialForm({ row, onClose }: { row: Row | null; onClose: (saved: boolean) => void }) {
  const [id] = useState(() => row?.id ?? crypto.randomUUID());
  const [name, setName] = useState(row?.name ?? "");
  const [role, setRole] = useState(row?.role ?? "");
  const [body, setBody] = useState(row?.body ?? "");
  const [stars, setStars] = useState(row?.stars ?? 5);
  const [published, setPublished] = useState(row?.published ?? true);
  const [avatar, setAvatar] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(row?.avatarSrc ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(f: File | undefined) {
    if (!f) return;
    const p = checkFile(f, "image");
    if (p) return setError(p);
    const b = await shrinkImage(f, 400);
    setAvatar(b);
    setPreview(URL.createObjectURL(b));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      let avatarPath = row?.avatar_path ?? null;
      if (avatar) {
        avatarPath = `testimonials/${id}/${fileName("avatar", avatar.type || "image/jpeg")}`;
        await uploadFile(avatarPath, avatar);
      }
      const r = await saveTestimonialAction({ id, isNew: !row, name, role, body, stars, avatarPath, published });
      if (!r.ok) throw new Error(r.error);
      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-bg" data-lenis-prevent onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(false); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head"><h2>{row ? "Editar testimonio" : "Nuevo testimonio"}</h2><button className="ibtn" onClick={() => onClose(false)} aria-label="Cerrar">✕</button></div>
        <div className="grid2">
          <div className="f"><label htmlFor="t-name">Nombre del cliente</label><input id="t-name" className="in" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
          <div className="f"><label htmlFor="t-role">Cargo / empresa</label><input id="t-role" className="in" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} /></div>
        </div>
        <div className="f"><label htmlFor="t-body">Testimonio</label><textarea id="t-body" className="in" value={body} onChange={(e) => setBody(e.target.value)} maxLength={800} /></div>
        <div className="grid2">
          <div className="f"><label htmlFor="t-stars">Estrellas</label>
            <select id="t-stars" className="in" value={stars} onChange={(e) => setStars(Number(e.target.value))}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select>
          </div>
          <div className="f"><span className="lbl">Foto (opcional)</span>
            <div className="drop" style={{ padding: 14 }}>
              <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} aria-label="Foto del cliente" />
              <small>Toca para elegir</small>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {preview && <img className="prev" src={preview} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} />}
            </div>
          </div>
        </div>
        <label className="switch"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Publicado</label>
        {error && <div className="alert err">{error}</div>}
        <div className="actions" style={{ marginTop: 18 }}>
          <button className="btn btn-p" onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
          <button className="btn btn-o" onClick={() => onClose(false)} disabled={busy}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
