/* Clases de Tailwind que se repiten en el panel (escritas completas para que Tailwind las encuentre).
   Modo «Operate»: papel sólido, controles compactos de 44 px, tinta para la acción principal. */

export const K = {
  ficha: "rounded-ficha bg-papel p-5 shadow-ficha",
  h2: "text-lg font-bold text-texto",
  mini: "text-xs text-gris",
  ayuda: "text-sm text-gris",
  vacio: "py-3 text-sm text-gris",
  etiqueta: "mb-1.5 block text-sm font-semibold text-texto",
  etiquetaChica: "mb-1.5 block text-xs font-semibold text-gris",
  campo: "w-full rounded-xl border border-regla bg-suelo px-3 py-2.5 focus:border-tinta focus:bg-papel focus:ring-4 focus:ring-tinta/15 focus:outline-none",
  campoChico: "rounded-xl border border-regla bg-suelo px-3 py-2 text-sm focus:border-tinta focus:bg-papel focus:ring-4 focus:ring-tinta/15 focus:outline-none",
  btnPrimario: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-tinta px-4 font-semibold text-white transition hover:bg-tinta-2 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60",
  btnSecundario: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-tinta-suave px-4 font-semibold text-tinta transition hover:brightness-95 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60",
  btnChico: "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-tinta-suave px-3.5 text-sm font-semibold text-tinta transition hover:brightness-95 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60",
  btnChicoFuerte: "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-tinta px-4 text-sm font-semibold text-white transition hover:bg-tinta-2 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60",
  btnNeutro: "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-regla bg-papel px-3.5 text-sm font-semibold text-texto transition hover:bg-suelo active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60",
  tabla: "w-full border-collapse text-sm [&_td]:border-b [&_td]:border-regla [&_td]:px-2 [&_td]:py-3 [&_td]:align-top [&_th]:border-b [&_th]:border-regla [&_th]:px-2 [&_th]:pb-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-gris [&_tr:last-child_td]:border-b-0",
  nota: "flex items-start gap-2 rounded-xl bg-suelo px-3 py-2 text-sm font-semibold",
  pildora: {
    validado: "rounded-full bg-tinta px-2.5 py-0.5 text-xs font-semibold text-white",
    pendiente: "rounded-full border border-dashed border-tinta bg-tinta-suave px-2.5 py-0.5 text-xs font-semibold text-tinta",
    apagado: "rounded-full bg-suelo px-2.5 py-0.5 text-xs font-semibold text-gris",
    suave: "rounded-full bg-tinta-suave px-2.5 py-0.5 text-xs font-semibold text-tinta",
  },
} as const;

export const pildoraEstado = (estado: string): string =>
  estado === "validado" ? K.pildora.validado : estado === "pendiente" ? K.pildora.pendiente : K.pildora.apagado;
