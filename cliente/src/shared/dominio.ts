/* Reglas de la app que no dependen de la interfaz: nivel efectivo, textos de un reporte, autoría,
   vigencia y a qué recinto se piden los avisos. Se prueban con Vitest. */
import { I18N, motivoVecino } from "./i18n";
import { distM } from "./formato";
import type { Albergue, EstadoApi, Lugar, NivelLugar, Reporte, Territorio } from "./tipos";

export interface NivelEfectivo {
  n: number | null;
  oficial: boolean;
  motivo?: string | null;
  hora?: string | null;
  fuente?: string | null;
}

/** El verificado manda sobre el estimado; si no hay verificado, el sugerido con su motivo en frases de vecino. */
export function nivelEfectivo(r: NivelLugar | null | undefined): NivelEfectivo {
  if (!r) return { n: null, oficial: false };
  if (r.oficial) return { n: r.oficial, oficial: true, motivo: r.oficial_motivo, hora: r.oficial_hora, fuente: r.oficial_fuente };
  return { n: r.sugerido ?? null, oficial: false, motivo: motivoVecino(r) };
}

export function rioEstado(estado: EstadoApi | null, nombre: string) {
  const r = (estado?.rios || []).find((x) => x.rio === nombre);
  return { ...(r || { rio: nombre, puntos: [] as string[] }), n: r?.oficial || r?.sugerido || null, oficial: !!r?.oficial };
}

export const etiquetaTipo = (r: { tipo: string; etiqueta?: string | undefined }) =>
  I18N.existe("tipo." + r.tipo) ? I18N.t("tipo." + r.tipo) : r.etiqueta || r.tipo;

export const categoria = (c: string) => (I18N.existe("app.equip." + c) ? I18N.t("app.equip." + c) : c);

export const esCalle = (r: Pick<Reporte, "tipo">) => r.tipo === "calle_inundada";

/** «Calle X · sobre la vereda» para calles; el tipo para lo demás. */
export const tituloReporte = (r: Reporte) => (esCalle(r)
  ? `${r.via || I18N.t("app.calle.def")} · ${r.altura_agua ? I18N.t("altura." + r.altura_agua) : ""}`
  : etiquetaTipo({ tipo: r.tipo, etiqueta: r.etiqueta }));

/** ¿Sigue vigente? (la API ya oculta lo vencido de otros; los propios llegan siempre) */
export const vigente = (r: Pick<Reporte, "expira">, ahora = Date.now()) => !r.expira || Date.parse(r.expira) > ahora;

export type Autoria = { tipo: "tu" } | { tipo: "vecino" } | { tipo: "equipo"; nombre: string | null };

/** Quién publicó: tú, un vecino (siempre anónimo) o el equipo de riesgo (con nombre, o anónimo si autor es null). */
export function autoria(r: Pick<Reporte, "mio" | "origen" | "autor">): Autoria {
  if (r.origen === "equipo") return { tipo: "equipo", nombre: r.autor?.nombre?.trim() || null };
  return r.mio ? { tipo: "tu" } : { tipo: "vecino" };
}

/** Texto de la autoría: «Publicado por María López», «Equipo de riesgo», «Tú» o «Un vecino». */
export function textoAutoria(a: Autoria): string {
  if (a.tipo === "equipo") return a.nombre ? I18N.t("app.autor.publicado", { nombre: a.nombre }) : I18N.t("app.autor.equipo");
  return I18N.t(a.tipo === "tu" ? "app.muro.tu" : "app.muro.vecino");
}

/** URL de la foto: la pública tal cual; la propia aún sin verificar, con su llave firmada (sin el id del teléfono). */
export const urlFoto = (r: Pick<Reporte, "id" | "foto_k">, n = 1) =>
  `/api/foto/${encodeURIComponent(r.id)}${n > 1 ? "/" + n : ""}${r.foto_k ? `?k=${encodeURIComponent(r.foto_k)}` : ""}`;

/** Cuántas fotos se ven de un reporte (hasta 3; las versiones anteriores de la API no mandan n_fotos). */
export const cuantasFotos = (r: Pick<Reporte, "foto" | "n_fotos">) => (r.foto ? Math.min(3, Math.max(1, r.n_fotos ?? 1)) : 0);

/** Todas las URL de las fotos de un reporte, en orden. */
export const urlsFotos = (r: Pick<Reporte, "id" | "foto" | "n_fotos" | "foto_k">) =>
  Array.from({ length: cuantasFotos(r) }, (_, i) => urlFoto(r, i + 1));

/** Foto n (1–3) de un albergue; `v` cambia al editarlo, así el navegador no muestra una foto vieja. */
export const urlFotoAlbergue = (a: Pick<Albergue, "id" | "actualizado">, n = 1) =>
  `/api/albergues/${encodeURIComponent(a.id)}/foto/${n}?v=${encodeURIComponent(a.actualizado)}`;

export const urlCompartir = (r: Pick<Reporte, "id">, terr: Territorio | null, origen = location.origin) =>
  `${terr?.url_publica || origen}/r/${r.id}`;

/** Enlace para compartir un aviso: /a/<id> (vista previa con el flyer en WhatsApp y Facebook, spec 021). */
export const urlAviso = (a: { id: number }, terr: Territorio | null, origen = location.origin) =>
  `${terr?.url_publica || origen}/a/${a.id}`;

export const textoCompartir = (r: Reporte) =>
  I18N.t("app.muro.texto_compartir", { titulo: tituloReporte(r), lugar: r.recinto || I18N.t("app.muro.canton") });

/** Con un recinto, su id; con un punto GPS o una calle, el recinto más cercano a 3 km como máximo (si no, todo el cantón). */
export function recintoDeLugar(lugar: Lugar | null, terr: Territorio | null): number | null {
  if (!lugar) return null;
  if (lugar.tipo === "recinto") return lugar.id;
  if (!terr?.recintos) return null;
  let m: { d: number; id: number } | null = null;
  for (const r of Object.values(terr.recintos)) {
    const d = distM(lugar.lon, lugar.lat, r.lon, r.lat);
    if (!m || d < m.d) m = { d, id: r.id };
  }
  return m && m.d <= 3000 ? m.id : null;
}

/** Nombre del recinto más cercano a un punto (para nombrar calles sin nombre). */
export function recintoMasCercano(terr: Territorio | null, lat: number, lon: number): string | null {
  let m: { d: number; nombre: string } | null = null;
  for (const r of Object.values(terr?.recintos || {})) {
    const d = distM(lon, lat, r.lon, r.lat);
    if (!m || d < m.d) m = { d, nombre: r.nombre };
  }
  return m ? m.nombre : null;
}

/** En horas de silencio un aviso de nivel 1–2 espera. La hora es la de Ecuador (UTC−5), aunque el teléfono esté en otra zona. */
export function enSilencio(h: [number, number] | undefined, ahora = new Date()): boolean {
  const [a, b] = h || [22, 6];
  const x = (ahora.getUTCHours() + 19) % 24;
  return a > b ? x >= a || x < b : x >= a && x < b;
}
