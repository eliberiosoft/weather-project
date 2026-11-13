import { ErrorCarga } from "../shared/componentes/ErrorCarga";
import { useI18n } from "../shared/i18n";
import { useApp } from "../shared/store";

/** Si el archivo del mapa no se pudo bajar (sin conexión la primera vez): «Reintentar» recarga la página. */
export function MapaNoCarga() {
  const { t } = useI18n();
  const activa = useApp((s) => s.vista === "mapa");
  return (
    <section id="v-mapa" className={`vista mx-auto hidden max-w-lg px-4 pt-5 [&.activa]:block ${activa ? "activa" : ""}`}>
      <ErrorCarga texto={t("app.mapa.error")} onReintentar={() => location.reload()} />
    </section>
  );
}
