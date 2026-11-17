import { ImageResponse } from "next/og";

/** Ícono de la app: “W” cursiva sobre esfera naranja (mismo estilo que el logo). */
export function renderIcon(size: number, rounded = true) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "#0a0503", borderRadius: rounded ? size * 0.22 : 0,
        }}
      >
        <div
          style={{
            width: size * 0.72, height: size * 0.72, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            background: "radial-gradient(circle at 30% 30%, #ffa25e, #ff6a13 45%, #8a2e00 100%)",
            color: "#fff", fontSize: size * 0.42, fontStyle: "italic", fontWeight: 700, fontFamily: "serif",
            boxShadow: `0 0 ${size * 0.12}px rgba(255,106,19,.6)`,
          }}
        >
          W
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
