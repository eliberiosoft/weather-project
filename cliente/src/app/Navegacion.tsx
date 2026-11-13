import { Icono, type IdIcono } from "../shared/componentes/Icono";
import { useI18n } from "../shared/i18n";
import { irA } from "../shared/navegacion";
import { useApp, type Vista } from "../shared/store";

const BOTONES: [Vista, IdIcono][] = [["inicio", "i-casa"], ["mapa", "i-mapa"], ["muro", "i-muro"], ["reportar", "i-mas"], ["avisos", "i-campana"]];

export function Navegacion() {
  const { t } = useI18n();
  const vista = useApp((s) => s.vista);
  const nuevos = useApp((s) => s.avisosNuevos);
  return (
    <nav aria-label={t("app.nav.etq")} className="fixed inset-x-0 bottom-0 z-[1001] grid h-[calc(4.5rem+env(safe-area-inset-bottom))] grid-cols-5 border-t border-white/60 bg-white/75 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:inset-x-auto lg:bottom-4 lg:left-1/2 lg:h-16 lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-full lg:border lg:pb-0 lg:shadow-flota">
      {BOTONES.map(([v, ico]) => (
        <button key={v} type="button" onClick={() => irA(v)} aria-current={vista === v ? "page" : undefined}
          className={`group relative flex flex-col items-center justify-center gap-1 text-xs font-semibold text-gris [&.activa]:text-tinta ${vista === v ? "activa" : ""}`}>
          <span className="relative grid h-8 w-14 place-items-center rounded-full transition group-[.activa]:bg-tinta-suave">
            <Icono id={ico} className="size-5.5" />
            {v === "avisos" && (
              <span hidden={!nuevos} className="absolute -top-0.5 right-2.5 h-5 min-w-5 rounded-full bg-tinta px-1 text-xs leading-5 font-bold text-white ring-2 ring-papel">{nuevos}</span>
            )}
          </span>
          <span>{t("app.sec." + v)}</span>
        </button>
      ))}
    </nav>
  );
}
