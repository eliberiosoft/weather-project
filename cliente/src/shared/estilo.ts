/* Colores y clases de Tailwind que se arman en el código. Las clases van escritas completas para que
   Tailwind las encuentre al escanear los archivos. El color del semáforo solo se usa para decir un nivel. */

export const COL: Record<number, string> = { 1: "#1a9641", 2: "#ffd92f", 3: "#fd8d3c", 4: "#d7191c" };
/** altura del agua en calles: familia del agua (no compite con el semáforo) y grosor creciente */
export const AGUA: Record<number, string> = { 1: "#6baed6", 2: "#2171b5", 3: "#08306b" };
export const AGUA_W: Record<number, number> = { 1: 5, 2: 7, 3: 9 };
/** nubes de tormenta por clase (igual que la paleta del mosaico de la API, spec 020): índigos, nunca el semáforo */
export const NUBE: Record<number, string> = { 1: "#a5b4fc", 2: "#6366f1", 3: "#312e81" };
export const TINTA = "#1d5f84", NEGRO = "#102a3c", ESCENARIO = "#7a0177", SIN_DATO = "#d9dde5", GRIS = "#4b6478";

export const FONDO: Record<number, string> = { 0: "bg-n0 text-texto", 1: "bg-n1 text-black", 2: "bg-n2 text-texto", 3: "bg-n3 text-texto", 4: "bg-n4 text-white" };
export const fondoNivel = (n: number | null | undefined) => FONDO[n || 0] ?? FONDO[0];

export const K = {
  nota: "mt-2 text-[.85rem] leading-snug text-gris",
  vacio: "py-3 text-sm text-gris",
  item: "flex gap-3 border-b border-regla py-3 last:border-0",
  itemIco: "grid size-10 shrink-0 place-items-center rounded-xl bg-tinta-suave text-tinta",
  meta: "mt-0.5 text-sm text-gris",
  desc: "mt-1 text-sm",
  btn: "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-tinta px-4 font-semibold text-white transition hover:bg-tinta-2 active:scale-[.98]",
  btnSec: "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-tinta-suave px-4 font-semibold text-tinta transition active:scale-[.98]",
  btnChico: "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-tinta-suave px-3.5 text-sm font-semibold text-tinta active:scale-95",
  dato: "flex justify-between gap-4 border-b border-regla py-2.5 text-sm last:border-0",
  placa: "inline-flex h-7 items-center rounded-full px-3 text-xs font-bold tracking-wide whitespace-nowrap",
  marcaCert: "inline-flex items-center gap-1 text-sm font-semibold text-tinta",
  eleccion: "flex min-h-26 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/80 px-2 py-3 text-center text-sm leading-tight font-semibold text-texto ring-1 ring-regla transition active:scale-[.97] aria-checked:bg-tinta aria-checked:text-white aria-checked:ring-tinta",
  ficha: "rounded-ficha bg-vidrio p-5 shadow-ficha ring-1 ring-white/70",
  vista: "vista mx-auto hidden max-w-lg px-4 pt-5 [&.activa]:block [&.activa]:animate-entra",
  h1: "text-[1.75rem] leading-tight font-bold tracking-tight",
  h2Paso: "text-[1.75rem] leading-tight font-bold tracking-tight outline-none",
  ayuda: "mt-1 text-[.85rem] text-gris",
  hoja: "absolute inset-x-0 bottom-0 z-[1004] max-h-[75%] animate-hoja overflow-auto rounded-t-[1.75rem] bg-papel px-4 pb-4 shadow-hoja md:right-auto md:bottom-4 md:left-4 md:max-h-[calc(100%-6.5rem)] md:w-[24rem] md:rounded-ficha md:shadow-flota",
  segmento: "min-h-10 rounded-xl text-sm font-semibold text-gris aria-checked:bg-papel aria-checked:shadow-ficha",
} as const;

export const ESTADO_CLS: Record<string, string> = {
  validado: "ml-1 inline-flex items-center rounded-full bg-tinta px-2 py-0.5 align-[1px] text-xs font-semibold text-white",
  pendiente: "ml-1 inline-flex items-center rounded-full bg-tinta-suave px-2 py-0.5 align-[1px] text-xs font-semibold text-tinta",
  descartado: "ml-1 inline-flex items-center rounded-full bg-suelo px-2 py-0.5 align-[1px] text-xs font-semibold text-gris",
  resuelto: "ml-1 inline-flex items-center rounded-full bg-suelo px-2 py-0.5 align-[1px] text-xs font-semibold text-gris",
};

/** Marcadores DOM del mapa (L.divIcon): «grid!» porque Leaflet pone display:block. */
export const MK = {
  pc: "grid! place-items-center rounded-lg bg-white text-xs leading-none font-bold text-texto shadow-flota",
  equip: "grid! place-items-center rounded-full bg-white text-tinta shadow-flota",
  rep: "grid! place-items-center rounded-full bg-tinta text-white ring-2 ring-white shadow-flota",
  repPend: "grid! place-items-center rounded-full bg-tinta/80 text-white ring-2 ring-white ring-offset-0 shadow-flota outline-2 outline-dashed outline-tinta outline-offset-2",
  /** incidente del equipo de riesgo: cuadrado y oscuro, para no confundirlo con un vecino (sin colores del semáforo) */
  repEquipo: "grid! place-items-center rounded-lg bg-negro text-white ring-2 ring-white shadow-flota",
  yo: "rounded-full border-3 border-white bg-tinta shadow-flota",
  /** distancia de un anillo de acercamiento en el mapa de tormentas */
  anillo: "grid! place-items-center rounded-full bg-papel/90 text-xs font-semibold text-tinta shadow-flota",
  /** mi lugar en el mapa de tormentas: la casita de «Mi lugar», para no confundirlo con un rayo (punto oscuro) */
  miLugar: "grid! place-items-center rounded-full border-3 border-white bg-tinta text-white shadow-flota",
  /** albergue: cuadrado blanco con borde de tinta y casita (no compite con el semáforo ni con los reportes) */
  albergue: "grid! place-items-center rounded-xl border-3 border-tinta bg-white text-tinta shadow-flota",
} as const;
