/* Llamar al ECU 911 con confirmación: un toque sin querer (en el bolsillo, con prisa) no marca a emergencias.
   Los botones de la app solo abren esta ventana; la llamada sale del enlace tel:911 de la ventana. */
import { useEffect, useRef } from "react";
import { Icono } from "../shared/componentes/Icono";
import { useI18n } from "../shared/i18n";
import { store, useApp } from "../shared/store";

export const pedirLlamada911 = () => store.set({ llamar911: true });
const cerrar = () => store.set({ llamar911: false });

export function Confirmar911() {
  const { t } = useI18n();
  const abierta = useApp((s) => s.llamar911);
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);
  return (
    <dialog ref={dlg} aria-labelledby="t911-titulo" aria-describedby="t911-texto" onCancel={(e) => { e.preventDefault(); cerrar(); }}
      onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-ficha bg-papel p-0 text-texto shadow-flota backdrop:bg-negro/60">
      <div className="p-5">
        <span className="grid size-12 place-items-center rounded-full bg-negro text-white"><Icono id="i-tel" className="size-6" /></span>
        <h2 id="t911-titulo" className="mt-3 text-xl leading-tight font-bold">{t("app.911.titulo")}</h2>
        <p id="t911-texto" className="mt-1.5 text-sm text-gris text-pretty">{t("app.911.texto")}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {/* «Cancelar» recibe el foco al abrir: Enter o un segundo toque sin querer no llaman */}
          <button type="button" autoFocus onClick={cerrar} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-suelo px-4 font-semibold text-tinta active:scale-[.98]">
            {t("app.cancelar")}
          </button>
          <a href="tel:911" onClick={cerrar} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-negro px-4 font-bold text-white no-underline active:scale-[.98]">
            <Icono id="i-tel" className="size-5" />{t("app.911.llamar")}
          </a>
        </div>
      </div>
    </dialog>
  );
}
