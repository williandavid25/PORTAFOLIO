"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES, CATEGORY_KEYS, type Category, type Project } from "@/lib/content";
import { externalThumb, embedUrl } from "@/lib/video";
import { deleteProjectAction, reorderProjectsAction, saveProjectAction, toggleProjectAction } from "@/app/admin/actions";
import { checkFile, fileName, inspectVideo, shrinkImage, uploadFile } from "./upload";

type Row = Project & { videoSrc: string | null; thumbSrc: string | null };

export default function ProjectManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [editing, setEditing] = useState<Row | "new" | null>(params.get("nuevo") ? "new" : null);
  const [order, setOrder] = useState(rows.map((r) => r.id));
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  // Cuando llegan datos nuevos del servidor, se reinicia el orden local.
  const [seenRows, setSeenRows] = useState(rows);
  if (seenRows !== rows) {
    setSeenRows(rows);
    setOrder(rows.map((r) => r.id));
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setErr(null);
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "Error");
      router.refresh();
    });

  const move = (id: string, dir: -1 | 1) => {
    const i = order.indexOf(id), j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    run(() => reorderProjectsAction(next));
  };

  return (
    <>
      <div className="adm-head">
        <div><h1>Videos del portafolio</h1><p>Sube tus trabajos. Se ven con vista previa en el sitio apenas los guardas.</p></div>
        <button className="btn btn-p" onClick={() => setEditing("new")}>+ Subir video</button>
      </div>
      {err && <div className="alert err">{err}</div>}
      <div className="panel">
        {order.length ? (
          <div className="items">
            {order.map((id, i) => {
              const p = byId.get(id);
              if (!p) return null;
              return (
                <div className="item" key={id} style={{ opacity: pending ? 0.75 : 1 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <div className="th">{p.thumbSrc ? <img src={p.thumbSrc} alt="" loading="lazy" /> : p.title.charAt(0)}</div>
                  <div className="meta">
                    <b>{p.title}</b>
                    <span>{CATEGORIES[p.category]} · {p.aspect}{p.video_path ? " · video subido" : p.video_url ? " · link externo" : ""}</span>
                    <div className="tags">
                      <span className={`tag${p.published ? " acc" : ""}`}>{p.published ? "Publicado" : "Oculto"}</span>
                      {p.featured && <span className="tag acc">Destacado</span>}
                    </div>
                  </div>
                  <button className="ibtn" title="Subir" onClick={() => move(id, -1)} disabled={i === 0}>↑</button>
                  <button className="ibtn" title="Bajar" onClick={() => move(id, 1)} disabled={i === order.length - 1}>↓</button>
                  <button className={`ibtn${p.featured ? " on" : ""}`} title="Destacar en la portada" onClick={() => run(() => toggleProjectAction(id, "featured", !p.featured))}>★</button>
                  <button className={`ibtn${p.published ? " on" : ""}`} title={p.published ? "Ocultar" : "Publicar"} onClick={() => run(() => toggleProjectAction(id, "published", !p.published))}>{p.published ? "👁" : "—"}</button>
                  <button className="ibtn" title="Editar" onClick={() => setEditing(p)}>✎</button>
                  {confirmDel === id ? (
                    <button className="btn btn-sm btn-d" onClick={() => { setConfirmDel(null); run(() => deleteProjectAction(id)); }}>¿Borrar?</button>
                  ) : (
                    <button className="ibtn danger" title="Eliminar" onClick={() => { setConfirmDel(id); setTimeout(() => setConfirmDel((c) => (c === id ? null : c)), 3500); }}>🗑</button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: "var(--g3)", fontSize: 14 }}>Aún no hay videos. Toca “Subir video” para agregar el primero.</p>
        )}
      </div>
      {editing && <ProjectForm row={editing === "new" ? null : editing} onClose={(saved) => { setEditing(null); if (saved) router.refresh(); router.replace("/admin/proyectos"); }} />}
    </>
  );
}

function ProjectForm({ row, onClose }: { row: Row | null; onClose: (saved: boolean) => void }) {
  const [id] = useState(() => row?.id ?? crypto.randomUUID());
  const [title, setTitle] = useState(row?.title ?? "");
  const [category, setCategory] = useState<Category>(row?.category ?? "social");
  const [description, setDescription] = useState(row?.description ?? "");
  const [client, setClient] = useState(row?.client ?? "");
  const [year, setYear] = useState<string>(row?.year ? String(row.year) : String(new Date().getFullYear()));
  const [source, setSource] = useState<"file" | "link">(row?.video_url && !row.video_path ? "link" : "file");
  const [videoUrl, setVideoUrl] = useState(row?.video_url ?? "");
  const [aspect, setAspect] = useState<Row["aspect"]>(row?.aspect ?? "16:9");
  const [featured, setFeatured] = useState(row?.featured ?? false);
  const [published, setPublished] = useState(row?.published ?? true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(row?.videoSrc ?? null);
  const [thumbBlob, setThumbBlob] = useState<Blob | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(row?.thumbSrc ?? null);
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  async function pickVideo(f: File | undefined) {
    if (!f) return;
    const problem = checkFile(f, "video");
    if (problem) return setError(problem);
    setError(null);
    setVideoFile(f);
    setVideoPreview(URL.createObjectURL(f));
    const info = await inspectVideo(f);
    setAspect(info.aspect);
    if (info.thumb && !thumbBlob) { setThumbBlob(info.thumb); setThumbPreview(URL.createObjectURL(info.thumb)); }
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 120));
  }

  async function pickThumb(f: File | undefined) {
    if (!f) return;
    const problem = checkFile(f, "image");
    if (problem) return setError(problem);
    setError(null);
    const b = await shrinkImage(f, 1600);
    setThumbBlob(b);
    setThumbPreview(URL.createObjectURL(b));
  }

  async function save() {
    setError(null);
    if (!title.trim()) return setError("Escribe un título.");
    if (source === "link" && !embedUrl(videoUrl)) return setError("Pega un link válido de YouTube o Vimeo.");
    if (source === "file" && !videoFile && !row?.video_path) return setError("Elige el archivo de video.");
    setBusy(true);
    try {
      let videoPath = source === "file" ? row?.video_path ?? null : null;
      let thumbPath = row?.thumb_path ?? null;
      if (source === "file" && videoFile) {
        videoPath = `projects/${id}/${fileName("video", videoFile.type)}`;
        await uploadFile(videoPath, videoFile, (pct) => setProgress({ label: "Subiendo video", pct }));
      }
      if (thumbBlob) {
        thumbPath = `projects/${id}/${fileName("thumb", thumbBlob.type || "image/jpeg")}`;
        await uploadFile(thumbPath, thumbBlob, (pct) => setProgress({ label: "Subiendo miniatura", pct }));
      }
      setProgress({ label: "Guardando", pct: 100 });
      const res = await saveProjectAction({
        id, isNew: !row, title, slug: row?.slug ?? "", category, description, client,
        year: year ? Number(year) : null, videoPath, videoUrl: source === "link" ? videoUrl.trim() : "",
        thumbPath, aspect, featured, published,
      });
      if (!res.ok) throw new Error(res.error);
      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  const extThumb = source === "link" ? externalThumb(videoUrl) : null;
  return (
    <div className="modal-bg" data-lenis-prevent onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(false); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={row ? "Editar video" : "Subir video"}>
        <div className="modal-head"><h2>{row ? "Editar video" : "Subir video"}</h2><button className="ibtn" onClick={() => !busy && onClose(false)} aria-label="Cerrar">✕</button></div>

        <div className="f">
          <span className="lbl">Origen del video</span>
          <div className="seg">
            <button className={source === "file" ? "on" : ""} onClick={() => setSource("file")} type="button">Subir archivo</button>
            <button className={source === "link" ? "on" : ""} onClick={() => setSource("link")} type="button">Link de YouTube / Vimeo</button>
          </div>
        </div>

        {source === "file" ? (
          <div className="f">
            <div className="drop">
              <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => pickVideo(e.target.files?.[0])} aria-label="Archivo de video" />
              <p><b>Toca o arrastra tu video aquí</b></p>
              <small>MP4, WEBM o MOV · máximo 50 MB · se detecta si es vertical u horizontal</small>
              {videoPreview && <video className="prev" src={videoPreview} muted controls playsInline />}
            </div>
          </div>
        ) : (
          <div className="f">
            <label htmlFor="p-url">Link del video</label>
            <input id="p-url" className="in" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtu.be/…  o  https://vimeo.com/…" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {extThumb && !thumbPreview && <img src={extThumb} alt="" style={{ marginTop: 12, borderRadius: 12, maxHeight: 180 }} />}
          </div>
        )}

        <div className="grid2">
          <div className="f"><label htmlFor="p-title">Título</label><input id="p-title" className="in" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
          <div className="f"><label htmlFor="p-cat">Categoría</label>
            <select id="p-cat" className="in" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORY_KEYS.map((c) => <option key={c} value={c}>{CATEGORIES[c]}</option>)}
            </select>
          </div>
        </div>
        <div className="grid3">
          <div className="f"><label htmlFor="p-client">Cliente (opcional)</label><input id="p-client" className="in" value={client} onChange={(e) => setClient(e.target.value)} maxLength={120} /></div>
          <div className="f"><label htmlFor="p-year">Año</label><input id="p-year" className="in" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} /></div>
          <div className="f"><label htmlFor="p-aspect">Formato</label>
            <select id="p-aspect" className="in" value={aspect} onChange={(e) => setAspect(e.target.value as Row["aspect"])}>
              <option value="16:9">Horizontal 16:9</option><option value="9:16">Vertical 9:16 (reel)</option><option value="4:5">Vertical 4:5</option><option value="1:1">Cuadrado 1:1</option>
            </select>
          </div>
        </div>
        <div className="f"><label htmlFor="p-desc">Descripción</label><textarea id="p-desc" className="in" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="De qué trata, qué hiciste, resultados…" /></div>

        <div className="f">
          <span className="lbl">Miniatura {source === "file" && "(se crea sola del video; puedes cambiarla)"}</span>
          <div className="drop">
            <input type="file" accept="image/*" onChange={(e) => pickThumb(e.target.files?.[0])} aria-label="Miniatura" />
            <small>JPG, PNG o WEBP</small>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {thumbPreview && <img className="prev" src={thumbPreview} alt="" />}
          </div>
        </div>

        <div className="actions" style={{ gap: 22, margin: "6px 0 18px" }}>
          <label className="switch"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Publicado</label>
          <label className="switch"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Destacado en la portada</label>
        </div>

        {progress && <div><small style={{ color: "var(--g2)" }}>{progress.label}… {progress.pct}%</small><div className="bar"><i style={{ width: `${progress.pct}%` }} /></div></div>}
        {error && <div className="alert err" role="alert">{error}</div>}
        <div className="actions" style={{ marginTop: 18 }}>
          <button className="btn btn-p" onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
          <button className="btn btn-o" onClick={() => onClose(false)} disabled={busy}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
