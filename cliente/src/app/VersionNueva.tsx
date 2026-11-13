/* «Hay una versión nueva»: cuando el despliegue nuevo ya está listo pero recargar ahora interrumpiría algo (un reporte
   a medias) o la persona está usando la app. Recarga sola al pasar a segundo plano (features/pwa/version.ts). */
import { Icono } from "../shared/componentes/Icono";
import { useI18n } from "../shared/i18n";
import { useApp } from "../shared/store";
import { actualizarAhora } from "../features/pwa/version";

export function VersionNueva() {
  const { t } = useI18n();
  const lista = useApp((s) => s.versionLista);
  if (!lista) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[1003] flex items-center gap-3 rounded-2xl bg-negro py-2 pr-2 pl-4 text-white shadow-flota md:right-auto md:left-1/2 md:w-[28rem] md:-translate-x-1/2 lg:bottom-24">
      <Icono id="i-refrescar" className="size-5 shrink-0" />
      <span className="flex-1 text-sm leading-snug font-semibold">{t("app.version.nueva")}</span>
      <button type="button" onClick={actualizarAhora} className="min-h-11 shrink-0 rounded-xl bg-white px-4 text-sm font-bold text-negro active:scale-95">{t("app.version.actualizar")}</button>
    </div>
  );
}
