/* Visor de fotos, uno para toda la app: las de los reportes («Mi lugar», el mapa y «Vecinos») y las de los albergues.
   La foto se ve dentro de la app (antes «ver foto» abría la imagen en otra ventana y, con la app instalada, el botón
   Atrás del teléfono cerraba la app). Al abrirse deja un paso en el historial: Atrás cierra el visor y vuelve a donde
   estabas. Se cierra también con su botón, tocando el fondo o con Escape. Con varias fotos (hasta 3) se pasa de una a
   otra deslizando, con las flechas de la pantalla o con las del teclado. */
import { useEffect, useRef } from "react";
import { tituloReporte, urlsFotos } from "../dominio";
import { useI18n } from "../i18n";
import { store, useApp, type FotosAbiertas } from "../store";
import type { Reporte } from "../tipos";
import { Icono } from "./Icono";

/** ¿Hay un paso del visor en el historial? (se quita al cerrar, para que Atrás no quede «vacío») */
let enHistorial = false;

/** Abre el visor con unas fotos, empezando por la `i`. */
export function verFotos(f: FotosAbiertas): void {
  if (!f.urls.length) return;
  store.set({ fotoAbierta: { ...f, i: Math.min(Math.max(0, f.i), f.urls.length - 1) } });
  if (!enHistorial) {
    history.pushState({ visorFoto: true }, "");
    enHistorial = true;
  }
}

/** Las fotos de un reporte. */
export const verFoto = (r: Reporte, i = 0) => verFotos({ titulo: tituloReporte(r), urls: urlsFotos(r), i });

/** Cerrar desde la app (botón, fondo, Escape): se deshace el paso del historial y el «popstate» lo cierra. */
export function cerrarFoto(): void {
  if (enHistorial) {
    enHistorial = false;
    history.back();
  } else if (store.get().fotoAbierta) store.set({ fotoAbierta: null });
}

// Atrás del teléfono (o del navegador) con la foto abierta: se cierra el visor y nada más
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    enHistorial = false;
    if (store.get().fotoAbierta) store.set({ fotoAbierta: null });
  });
}

export function VisorFoto() {
  const { t } = useI18n();
  const f = useApp((s) => s.fotoAbierta);
  const dlg = useRef<HTMLDialogElement>(null);
  const tira = useRef<HTMLDivElement>(null);
  const n = f?.urls.length ?? 0;
  const i = f?.i ?? 0;
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (f && !d.open) d.showModal();
    if (!f && d.open) d.close();
  }, [f]);
  // la foto elegida a la vista (al abrir y con las flechas)
  useEffect(() => {
    const el = tira.current?.children[i] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", inline: "start" });
  }, [i, f?.urls]);

  const ir = (j: number) => { const x = store.get().fotoAbierta; if (x) store.set({ fotoAbierta: { ...x, i: (j + x.urls.length) % x.urls.length } }); };
  /** al deslizar con el dedo, el contador sigue a la foto que quedó a la vista */
  const alDeslizar = () => {
    const el = tira.current, x = store.get().fotoAbierta;
    if (!el || !x || !el.clientWidth) return;
    const j = Math.round(el.scrollLeft / el.clientWidth);
    if (j !== x.i && j >= 0 && j < x.urls.length) store.set({ fotoAbierta: { ...x, i: j } });
  };
  const flecha = "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-negro/70 text-white";

  return (
    <dialog ref={dlg} onClose={cerrarFoto} onClick={(e) => { if (e.target === dlg.current) cerrarFoto(); }}
      onKeyDown={(e) => { if (n > 1 && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { e.preventDefault(); ir(i + (e.key === "ArrowRight" ? 1 : -1)); } }}
      aria-label={f?.titulo}
      className="m-auto max-h-[92vh] w-[min(92vw,56rem)] overflow-hidden rounded-ficha bg-negro p-0 text-white shadow-flota backdrop:bg-negro/80">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="min-w-0 truncate font-semibold">{f?.titulo}</p>
        {n > 1 ? <p aria-live="polite" className="shrink-0 text-sm font-semibold text-white/80 tabular-nums">{t("app.foto.de", { i: i + 1, n })}</p> : null}
        <button type="button" onClick={cerrarFoto} aria-label={t("app.cerrar")} className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15"><Icono id="i-x" className="size-5" /></button>
      </div>
      <div className="relative">
        <div ref={tira} onScroll={alDeslizar} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
          {f?.urls.map((u, j) => (
            <img key={u} src={u} alt={t(n > 1 ? "app.foto.alt_n" : "app.muro.foto.alt", { titulo: f.titulo, i: j + 1, n })}
              className="block max-h-[80vh] w-full shrink-0 snap-start object-contain" />
          ))}
        </div>
        {n > 1 ? (
          <>
            <button type="button" onClick={() => ir(i - 1)} aria-label={t("app.foto.anterior")} className={`${flecha} left-2`}><Icono id="i-atras" className="size-5" /></button>
            <button type="button" onClick={() => ir(i + 1)} aria-label={t("app.foto.siguiente")} className={`${flecha} right-2`}><Icono id="i-adelante" className="size-5" /></button>
          </>
        ) : null}
      </div>
    </dialog>
  );
}
