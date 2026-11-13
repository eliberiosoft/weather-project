/* La lista de lugares del buscador (recintos, cabeceras y calles), compartida por «Mi lugar» y el mapa. */
import { normalizar } from "./formato";
import { I18N } from "./i18n";
import type { Territorio } from "./tipos";

export type LugarBuscado =
  | { tipo: "recinto"; id: number; texto: string; lat: number; lon: number; calle?: undefined }
  | { tipo: "punto"; lat: number; lon: number; nombre: string; texto: string; calle: true };

export interface Lugares { mapa: Map<string, LugarBuscado>; opciones: { valor: string; etiqueta: string }[] }

export function armarLugares(terr: Territorio): Lugares {
  const mapa = new Map<string, LugarBuscado>();
  const opciones: Lugares["opciones"] = [];
  const recs = Object.values(terr.recintos).sort((a, b) =>
    (b.etiqueta ? 1 : 0) - (a.etiqueta ? 1 : 0) || (a.nombre || "").localeCompare(b.nombre || ""));
  for (const r of recs) {
    const txt = r.etiqueta ? `${r.nombre} (${r.etiqueta})` : r.nombre;
    mapa.set(txt.toLowerCase(), { tipo: "recinto", id: r.id, texto: txt, lat: r.lat, lon: r.lon });
    opciones.push({ valor: txt, etiqueta: `${I18N.t(r.etiqueta ? "app.opt.cabecera" : "app.opt.recinto")} · ${r.parroquia || ""}` });
  }
  for (const c of terr.calles || []) {
    const txt = `${c.nombre} · ${c.cerca}`;
    mapa.set(txt.toLowerCase(), { tipo: "punto", lat: c.lat, lon: c.lon, nombre: `${c.nombre} (${c.cerca})`, texto: txt, calle: true });
    opciones.push({ valor: txt, etiqueta: I18N.t("app.opt.calle") });
  }
  return { mapa, opciones };
}

/** Coincidencia exacta y, si no, el primer lugar que contiene el texto. */
export function buscarLugar(mapa: Map<string, LugarBuscado>, texto: string): LugarBuscado | null {
  const q = texto.trim().toLowerCase();
  if (!q) return null;
  const exacto = mapa.get(q);
  if (exacto) return exacto;
  for (const [k, v] of mapa) if (k.includes(q)) return v;
  return null;
}

export interface Sugerencia { lugar: LugarBuscado; titulo: string; detalle: string; calle: boolean }

/** Sugerencias del buscador: sin distinguir tildes ni mayúsculas; primero las que empiezan con lo escrito (o tienen una
    palabra que empieza así) y luego las que lo contienen. Hasta `n`. */
export function sugerirLugares(lugares: Lugares, texto: string, n = 8): Sugerencia[] {
  const q = normalizar(texto.trim());
  if (!q) return [];
  const empiezan: Sugerencia[] = [], contienen: Sugerencia[] = [];
  for (const o of lugares.opciones) {
    const lugar = lugares.mapa.get(o.valor.toLowerCase());
    if (!lugar) continue;
    const k = normalizar(o.valor);
    const i = k.indexOf(q);
    if (i < 0) continue;
    const s = { lugar, titulo: o.valor, detalle: o.etiqueta, calle: lugar.tipo === "punto" };
    (i === 0 || k[i - 1] === " " || k[i - 1] === "(" ? empiezan : contienen).push(s);
    if (empiezan.length >= n) break;
  }
  return [...empiezan, ...contienen].slice(0, n);
}
