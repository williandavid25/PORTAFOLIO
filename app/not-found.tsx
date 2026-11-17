import Link from "next/link";

export default function NotFound() {
  return (
    <div className="login">
      <div className="hglow" style={{ left: "50%", top: "50%", transform: "translate(-50%,-50%)", position: "absolute", opacity: 0.5 }} />
      <div style={{ position: "relative", textAlign: "center", padding: 24 }}>
        <p style={{ fontFamily: "var(--fm)", fontSize: "clamp(6rem,24vw,14rem)", lineHeight: 0.9, color: "var(--acc)" }}>404</p>
        <h1 className="title">Esta escena <em>no existe</em></h1>
        <p className="lead" style={{ marginBottom: 28 }}>El enlace puede estar mal o el video fue retirado.</p>
        <Link href="/" className="btn btn-p">Volver al inicio</Link>
      </div>
    </div>
  );
}
