import type { CSSProperties } from "react";

type Props = { main: string; script: string; center?: boolean; sub?: string; as?: "h1" | "h2" };

/**
 * Título estilo referencia: palabra ancha y gruesa en blanco (como “Portfolio”)
 * con una firma manuscrita naranja encima (como “Hawra_Graphics”).
 * El tamaño se ajusta a la cantidad de letras para que nunca se salga en el celular.
 */
export default function SectionTitle({ main, script, center = false, sub, as: Tag = "h2" }: Props) {
  const style = { "--n": Math.max(main.length, 6), "--s": Math.max(script.length, 8) } as CSSProperties;
  return (
    <div className={`stitle${center ? " center" : ""}`} style={style}>
      <Tag style={{ margin: 0, font: "inherit" }}>
        <span className="stitle-main">{main}</span>
        <span className="sr-only"> — </span>
        <span className="stitle-script">{script}</span>
      </Tag>
      {sub && <span className="stitle-sub" data-reveal>{sub}</span>}
    </div>
  );
}
