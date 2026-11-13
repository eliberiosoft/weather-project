/* Menú del panel según el tamaño de pantalla:
   - Escritorio (lg+): pestañas en píldora bajo la cabecera, con ícono y flechas del teclado.
   - Celular y tablet: barra inferior al alcance del pulgar, como la app. Hasta cinco secciones caben todas
     (el operador ve cuatro); con más, las cuatro primeras y «Más», que abre una hoja con el resto. */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useI18n } from "../../shared/i18n/useI18n";
import { Icono } from "../../shared/ui/Icono";
import type { Pestana } from "../auth/permisos";

interface PropsMenu {
  visibles: readonly Pestana[];
  activa: Pestana | null;
  elegir: (p: Pestana) => void;
  /** reportes por revisar (insignia de «Reportes») */
  pendientes: number | null;
}

const EN_BARRA = 5;
/** columnas de la barra según cuántos botones lleva (clases completas para que Tailwind las encuentre) */
const COLUMNAS = ["grid-cols-1", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4", "grid-cols-5"];

/** Qué va en la barra inferior y qué en «Más». */
export function repartir(visibles: readonly Pestana[]): { barra: Pestana[]; mas: Pestana[] } {
  if (visibles.length <= EN_BARRA) return { barra: [...visibles], mas: [] };
  return { barra: visibles.slice(0, EN_BARRA - 1), mas: visibles.slice(EN_BARRA - 1) };
}

function Insignia({ n, className = "" }: { n: number; className?: string }) {
  const { t } = useI18n();
  return <span aria-label={t("panel.tab.pendientes", { n })} className={`rounded-full bg-tinta px-1.5 text-xs leading-5 font-bold text-white tabular-nums ${className}`}>{n}</span>;
}

export function PestanasEscritorio({ visibles, activa, elegir, pendientes }: PropsMenu) {
  const { t } = useI18n();
  const muchas = visibles.length > 7;
  function teclas(e: KeyboardEvent<HTMLDivElement>) {
    if (!activa || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const i = visibles.indexOf(activa);
    const n = e.key === "Home" ? 0 : e.key === "End" ? visibles.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + visibles.length) % visibles.length;
    const sig = visibles[n]!;
    elegir(sig);
    document.getElementById("tab-" + sig)?.focus();
  }
  return (
    <div className="sticky top-16 z-10 hidden bg-suelo/90 px-6 pt-4 pb-3 backdrop-blur lg:block">
      <div role="tablist" aria-label={t("panel.tabs.etq")} onKeyDown={teclas}
        className="mx-auto flex w-max max-w-full gap-1 overflow-x-auto rounded-full bg-papel p-1 shadow-ficha">
        {visibles.map((p) => (
          <button key={p} type="button" role="tab" id={"tab-" + p} aria-selected={activa === p} aria-controls="panel-activo"
            tabIndex={activa === p ? 0 : -1} onClick={() => elegir(p)} title={t("panel.tab." + p)}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap text-gris transition hover:text-texto aria-selected:bg-tinta aria-selected:text-white">
            <Icono id={p} className="size-4.5" />
            {/* con muchas secciones (superadmin) solo la activa lleva el nombre hasta pantallas muy anchas; las demás, ícono y tooltip */}
            <span className={muchas && activa !== p ? "sr-only 2xl:not-sr-only" : ""}>{t("panel.tab." + p)}</span>
            {p === "reportes" && pendientes ? <Insignia n={pendientes} className="bg-tinta-suave text-tinta" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BarraInferior({ visibles, activa, elegir, pendientes }: PropsMenu) {
  const { t } = useI18n();
  const [hoja, setHoja] = useState(false);
  const { barra, mas } = repartir(visibles);
  const enMas = !!activa && mas.includes(activa);
  const ir = (p: Pestana) => { setHoja(false); elegir(p); };

  const boton = (id: string, etiqueta: string, actual: boolean, alTocar: () => void, extra?: ReactNode, abre?: boolean) => (
    <button key={id} type="button" onClick={alTocar} aria-current={actual && !abre ? "page" : undefined}
      aria-haspopup={abre ? "dialog" : undefined} aria-expanded={abre ? hoja : undefined}
      className={`group flex min-w-0 flex-col items-center justify-center gap-1 text-xs font-semibold text-gris [&.activa]:text-tinta ${actual ? "activa" : ""}`}>
      <span className="relative grid h-8 w-14 place-items-center rounded-full transition group-[.activa]:bg-tinta-suave">
        <Icono id={id} className="size-5.5" />
        {extra}
      </span>
      <span className="max-w-full truncate px-1">{etiqueta}</span>
    </button>
  );

  return (
    <>
      <nav aria-label={t("panel.tabs.etq")}
        className={`${COLUMNAS[barra.length + (mas.length ? 1 : 0)]} fixed inset-x-0 bottom-0 z-30 grid h-[calc(4.25rem+env(safe-area-inset-bottom))] border-t border-regla bg-papel/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden`}>
        {barra.map((p) => boton(p, t("panel.tab." + p), activa === p, () => ir(p),
          p === "reportes" && pendientes ? <Insignia n={pendientes} className="absolute -top-0.5 right-1.5 ring-2 ring-papel" /> : null))}
        {mas.length ? boton("menu", t("panel.nav.mas"), enMas || hoja, () => setHoja(true), null, true) : null}
      </nav>
      {mas.length ? <HojaMas abierta={hoja} cerrar={() => setHoja(false)} mas={mas} activa={activa} ir={ir} /> : null}
    </>
  );
}

function HojaMas({ abierta, cerrar, mas, activa, ir }: { abierta: boolean; cerrar: () => void; mas: Pestana[]; activa: Pestana | null; ir: (p: Pestana) => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);
  return (
    <dialog ref={ref} aria-labelledby="hoja-mas-titulo" onCancel={(e) => { e.preventDefault(); cerrar(); }}
      onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}
      className="mx-0 mt-auto mb-0 w-full max-w-none animate-hoja rounded-t-ficha bg-papel p-0 text-texto shadow-hoja backdrop:bg-negro/40 lg:hidden">
      <div className="px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-regla" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 id="hoja-mas-titulo" className="text-lg font-bold">{t("panel.nav.mas_titulo")}</h2>
          <button type="button" onClick={cerrar} aria-label={t("panel.cerrar")} className="grid size-11 place-items-center rounded-full bg-suelo text-gris">
            <Icono id="cerrar" className="size-5" />
          </button>
        </div>
        <ul className="mt-2 grid gap-1">
          {mas.map((p) => (
            <li key={p}>
              <button type="button" onClick={() => ir(p)} aria-current={activa === p ? "page" : undefined}
                className="flex min-h-13 w-full items-center gap-3 rounded-2xl px-3 text-left font-semibold text-texto transition hover:bg-suelo aria-[current=page]:bg-tinta-suave aria-[current=page]:text-tinta">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-suelo text-tinta"><Icono id={p} className="size-5" /></span>
                {t("panel.tab." + p)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
