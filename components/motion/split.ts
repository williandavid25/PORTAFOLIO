/** Parte un texto en palabras (con máscara) conservando <em>, <br>, etc. */
export function splitWords(el: HTMLElement): HTMLElement[] {
  if (el.dataset.splitDone) return Array.from(el.querySelectorAll<HTMLElement>(".wi"));
  const walk = (node: Node) => {
    Array.from(node.childNodes).forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        (n.textContent ?? "").split(/(\s+)/).forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) return void frag.appendChild(document.createTextNode(" "));
          const w = document.createElement("span");
          w.className = "w";
          const i = document.createElement("span");
          i.className = "wi";
          i.textContent = p;
          w.appendChild(i);
          frag.appendChild(w);
        });
        n.parentNode?.replaceChild(frag, n);
      } else if (n.nodeType === 1 && (n as HTMLElement).tagName !== "BR") walk(n);
    });
  };
  walk(el);
  el.dataset.splitDone = "1";
  return Array.from(el.querySelectorAll<HTMLElement>(".wi"));
}

/** Parte en letras sueltas (sin máscara). Idempotente. */
export function splitChars(el: HTMLElement): HTMLElement[] {
  if (el.dataset.charsDone) return Array.from(el.querySelectorAll<HTMLElement>(".lc"));
  const text = el.textContent ?? "";
  el.textContent = "";
  el.dataset.charsDone = "1";
  const out: HTMLElement[] = [];
  Array.from(text).forEach((c) => {
    // Los espacios quedan como texto normal para que la línea pueda partirse en el celular.
    if (c === " ") return void el.appendChild(document.createTextNode(" "));
    const s = document.createElement("span");
    s.className = "lc";
    s.textContent = c;
    el.appendChild(s);
    out.push(s);
  });
  return out;
}
