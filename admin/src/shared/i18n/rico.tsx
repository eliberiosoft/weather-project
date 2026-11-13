/* Textos propios con <b> y <code> (p. ej. «panel.sit.explica»): se arman como nodos de React,
   sin innerHTML. Cualquier otra etiqueta queda como texto. */
import { Fragment, type ReactNode } from "react";

export type Trozo = { tipo: "texto" | "b" | "code"; texto: string };

export function trocear(s: string): Trozo[] {
  const out: Trozo[] = [];
  const re = /<(b|code)>([\s\S]*?)<\/\1>/g;
  let i = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > i) out.push({ tipo: "texto", texto: s.slice(i, m.index) });
    out.push({ tipo: m[1] as "b" | "code", texto: m[2] ?? "" });
    i = m.index + m[0].length;
  }
  if (i < s.length) out.push({ tipo: "texto", texto: s.slice(i) });
  return out;
}

export function Rico({ texto }: { texto: string }): ReactNode {
  return trocear(texto).map((p, i) =>
    p.tipo === "b" ? <b key={i}>{p.texto}</b> : p.tipo === "code" ? <code key={i}>{p.texto}</code> : <Fragment key={i}>{p.texto}</Fragment>);
}
