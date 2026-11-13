/* La portada que tapa la app (features/seguridad/proteccion.ts). Va en la capa superior (popover) para quedar
   también sobre las ventanas modales abiertas (ingreso, permisos, 911). */
import { useEffect, useRef } from "react";
import { Icono } from "../../shared/componentes/Icono";
import { useI18n } from "../../shared/i18n";
import { useApp } from "../../shared/store";
import { volverALaApp } from "./proteccion";

export function Portada() {
  const { t } = useI18n();
  const tapada = useApp((s) => s.tapada);
  const capa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = capa.current;
    if (!c || typeof c.showPopover !== "function") return;
    try {
      if (tapada && !c.matches(":popover-open")) c.showPopover();
      if (!tapada && c.matches(":popover-open")) c.hidePopover();
    } catch { /* el navegador no admite popover: queda el z-index */ }
  }, [tapada]);
  return (
    <div ref={capa} popover="manual" hidden={!tapada} role="alertdialog" aria-labelledby="port-titulo" aria-describedby="port-texto"
      className="fixed inset-0 z-[4000] m-0 grid h-dvh max-h-none w-screen max-w-none place-items-center border-0 bg-negro p-6 text-center text-white">
      <div className="max-w-xs">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-white/10"><Icono id="i-candado" className="size-8" /></span>
        <h2 id="port-titulo" className="mt-4 text-xl font-bold">{t("app.prot.titulo")}</h2>
        <p id="port-texto" className="mt-2 text-sm text-white/80 text-pretty">{t(tapada === "captura" ? "app.prot.captura" : "app.prot.fuera")}</p>
        <button type="button" onClick={volverALaApp} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-5 font-semibold text-negro active:scale-[.98]">
          {t("app.prot.seguir")}
        </button>
      </div>
    </div>
  );
}
