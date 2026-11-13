import { ChipCarga } from "../shared/componentes/ChipCarga";
import { useI18n } from "../shared/i18n";
import { useApp } from "../shared/store";

/** Mientras baja el archivo del mapa (Leaflet va aparte): el fondo del mapa y «Cargando el mapa…», nunca un área en blanco. */
export function MapaCargando() {
  const { t } = useI18n();
  const activa = useApp((s) => s.vista === "mapa");
  return (
    <section id="v-mapa" aria-label={t("app.sec.mapa")} aria-busy="true"
      className={`vista hidden bg-cielo-2 [&.activa]:fixed [&.activa]:inset-x-0 [&.activa]:top-14 [&.activa]:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] [&.activa]:grid [&.activa]:place-items-center lg:[&.activa]:bottom-0 ${activa ? "activa" : ""}`}>
      <ChipCarga texto={t("app.carga.mapa")} />
    </section>
  );
}
