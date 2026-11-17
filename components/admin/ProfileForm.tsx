"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteData } from "@/lib/content";
import { saveSiteAction } from "@/app/admin/actions";
import { checkFile, fileName, shrinkImage, uploadFile } from "./upload";

type Props = { initial: SiteData; heroSrc: string | null; aboutSrc: string | null };

export default function ProfileForm({ initial, heroSrc, aboutSrc }: Props) {
  const router = useRouter();
  const [d, setD] = useState<SiteData>(initial);
  const [heroPrev, setHeroPrev] = useState(heroSrc);
  const [aboutPrev, setAboutPrev] = useState(aboutSrc);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SiteData>(k: K, v: SiteData[K]) => setD((p) => ({ ...p, [k]: v }));

  async function persist(next: SiteData, text = "Cambios guardados. Ya se ven en el sitio.") {
    setBusy(true);
    setMsg(null);
    const r = await saveSiteAction(next);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
    return r.ok;
  }

  async function uploadMedia(kind: "hero" | "about", f: File | undefined) {
    if (!f) return;
    const problem = checkFile(f, kind === "hero" ? "media" : "image");
    if (problem) return setMsg({ ok: false, text: problem });
    try {
      setBusy(true);
      const isVideo = f.type.startsWith("video/");
      const blob = isVideo ? f : await shrinkImage(f, kind === "hero" ? 2000 : 1600);
      const path = `site/${crypto.randomUUID()}/${fileName(kind, blob.type || f.type)}`;
      await uploadFile(path, blob, setProgress);
      setProgress(null);
      const next: SiteData = kind === "hero"
        ? { ...d, heroMediaPath: path, heroMediaType: isVideo ? "video" : "image" }
        : { ...d, aboutImagePath: path };
      setD(next);
      const url = URL.createObjectURL(blob);
      if (kind === "hero") setHeroPrev(url); else setAboutPrev(url);
      await persist(next, kind === "hero" ? "Foto de portada actualizada." : "Foto de “Sobre mí” actualizada.");
    } catch (e) {
      setProgress(null);
      setBusy(false);
      setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo subir." });
    }
  }

  const isHeroVideo = d.heroMediaType === "video";
  return (
    <>
      <div className="adm-head">
        <div><h1>Perfil y portada</h1><p>Tu foto 3D, textos, cifras y datos de contacto.</p></div>
        <button className="btn btn-p" onClick={() => persist(d)} disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button>
      </div>
      {msg && <div className={`alert ${msg.ok ? "ok" : "err"}`} style={{ marginBottom: 18 }}>{msg.text}</div>}
      {progress !== null && <div className="bar" style={{ marginBottom: 18 }}><i style={{ width: `${progress}%` }} /></div>}

      <div className="panel">
        <h2>Portada (hero)</h2>
        <div className="grid2">
          <div className="f">
            <span className="lbl">Foto o video 3D animado</span>
            <div className="drop">
              <input type="file" accept="image/png,image/webp,image/jpeg,image/gif,video/mp4,video/webm" onChange={(e) => uploadMedia("hero", e.target.files?.[0])} aria-label="Foto o video del hero" />
              <p><b>PNG sin fondo</b> o <b>video WEBM con transparencia</b></p>
              <small>Así se integra con el resplandor naranja como en la referencia</small>
              {heroPrev && (isHeroVideo
                ? <video className="prev" src={heroPrev} autoPlay muted loop playsInline />
                // eslint-disable-next-line @next/next/no-img-element
                : <img className="prev" src={heroPrev} alt="" />)}
            </div>
            {d.heroMediaPath && <button className="btn btn-sm btn-d" style={{ marginTop: 10 }} onClick={() => { const n = { ...d, heroMediaPath: "", heroMediaType: "" as const }; setD(n); setHeroPrev(null); persist(n, "Foto quitada."); }}>Quitar</button>}
          </div>
          <div>
            <div className="f"><span className="lbl">Lado de la foto</span>
              <div className="seg">
                <button type="button" className={d.heroSide === "left" ? "on" : ""} onClick={() => set("heroSide", "left")}>Izquierda</button>
                <button type="button" className={d.heroSide === "right" ? "on" : ""} onClick={() => set("heroSide", "right")}>Derecha</button>
              </div>
            </div>
            <div className="f"><label className="switch"><input type="checkbox" checked={d.available} onChange={(e) => set("available", e.target.checked)} /> Mostrar “Disponible para proyectos”</label></div>
            <div className="grid2">
              <div className="f"><label htmlFor="s-name">Nombre</label><input id="s-name" className="in" value={d.name} onChange={(e) => set("name", e.target.value)} maxLength={40} /></div>
              <div className="f"><label htmlFor="s-role">Rol corto</label><input id="s-role" className="in" value={d.role} onChange={(e) => set("role", e.target.value)} maxLength={40} /></div>
            </div>
            <div className="f"><label htmlFor="s-tag">Tagline</label><input id="s-tag" className="in" value={d.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={80} /></div>
          </div>
        </div>
        <div className="f"><label htmlFor="s-hdesc">Descripción de la portada</label><textarea id="s-hdesc" className="in" value={d.heroDesc} onChange={(e) => set("heroDesc", e.target.value)} maxLength={300} /></div>
      </div>

      <div className="panel">
        <h2>Sobre mí</h2>
        <div className="grid2">
          <div className="f">
            <span className="lbl">Foto</span>
            <div className="drop">
              <input type="file" accept="image/*" onChange={(e) => uploadMedia("about", e.target.files?.[0])} aria-label="Foto sobre mí" />
              <small>JPG, PNG o WEBP</small>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {aboutPrev && <img className="prev" src={aboutPrev} alt="" />}
            </div>
          </div>
          <div>
            <div className="f"><label htmlFor="s-at">Título</label><input id="s-at" className="in" value={d.aboutTitle} onChange={(e) => set("aboutTitle", e.target.value)} maxLength={80} /></div>
            <div className="f"><label htmlFor="s-bio">Biografía</label><textarea id="s-bio" className="in" rows={6} value={d.bio} onChange={(e) => set("bio", e.target.value)} maxLength={1500} /></div>
          </div>
        </div>
        <span className="lbl" style={{ fontSize: 12, fontWeight: 600, color: "var(--g2)" }}>Habilidades</span>
        {d.skills.map((s, i) => (
          <div className="grid3" key={i} style={{ alignItems: "center", marginTop: 8 }}>
            <input className="in" value={s.name} onChange={(e) => set("skills", d.skills.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} maxLength={40} aria-label="Habilidad" />
            <input className="in" type="number" min={0} max={100} value={s.level} onChange={(e) => set("skills", d.skills.map((x, j) => (j === i ? { ...x, level: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x)))} aria-label="Nivel" />
            <button className="btn btn-sm btn-d" onClick={() => set("skills", d.skills.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        ))}
        {d.skills.length < 8 && <button className="btn btn-sm btn-o" style={{ marginTop: 12 }} onClick={() => set("skills", [...d.skills, { name: "Nueva habilidad", level: 80 }])}>+ Añadir habilidad</button>}
      </div>

      <div className="panel">
        <h2>Cifras</h2>
        <div className="kpis" style={{ marginBottom: 0 }}>
          {([["projects", "Proyectos"], ["clients", "Clientes"], ["years", "Años de experiencia"], ["satisfaction", "Satisfacción %"]] as const).map(([k, label]) => (
            <div className="f" key={k}><label htmlFor={`st-${k}`}>{label}</label><input id={`st-${k}`} className="in" type="number" min={0} value={d.stats[k]} onChange={(e) => set("stats", { ...d.stats, [k]: Math.max(0, Number(e.target.value) || 0) })} /></div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Contacto y redes</h2>
        <div className="grid3">
          <div className="f"><label htmlFor="c-email">Email público</label><input id="c-email" className="in" type="email" value={d.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div className="f"><label htmlFor="c-wa">WhatsApp</label><input id="c-wa" className="in" inputMode="numeric" value={d.whatsapp} onChange={(e) => set("whatsapp", e.target.value.replace(/\D/g, "").slice(0, 15))} placeholder="593991234567" /><div className="hint">Con código de país, sin “+”.</div></div>
          <div className="f"><label htmlFor="c-loc">Ubicación</label><input id="c-loc" className="in" value={d.location} onChange={(e) => set("location", e.target.value)} maxLength={80} /></div>
        </div>
        <div className="grid2">
          {(["instagram", "tiktok", "youtube", "facebook"] as const).map((k) => (
            <div className="f" key={k}><label htmlFor={`so-${k}`} style={{ textTransform: "capitalize" }}>{k}</label><input id={`so-${k}`} className="in" type="url" value={d.socials[k]} onChange={(e) => set("socials", { ...d.socials, [k]: e.target.value })} placeholder="https://…" /></div>
          ))}
        </div>
        <div className="f"><label htmlFor="c-cv">Link del CV (opcional)</label><input id="c-cv" className="in" type="url" value={d.cvUrl} onChange={(e) => set("cvUrl", e.target.value)} placeholder="https://drive.google.com/…" /></div>
        <button className="btn btn-p" onClick={() => persist(d)} disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button>
      </div>
    </>
  );
}
