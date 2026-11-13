/* Mientras baja el archivo de «Tormentas» (usa Leaflet, va aparte) y si no se pudo bajar (sin conexión la primera
   vez): la vista con su título y «Cargando…» o el aviso con «Reintentar», nunca un área en blanco. */
import { ChipCarga } from "../shared/componentes/ChipCarga";
import { ErrorCarga } from "../shared/componentes/ErrorCarga";
import { Vista } from "../shared/componentes/Vista";
import { K } from "../shared/estilo";
import { useI18n } from "../shared/i18n";

export function TormentasCargando() {
  const { t } = useI18n();
  return (
    <Vista id="tormentas" etiqueta="app.torm.titulo" className={K.vista}>
      <h1 className={K.h1}>{t("app.torm.titulo")}</h1>
      <div aria-busy="true" className="mt-6 flex justify-center"><ChipCarga texto={t("app.carga.etq")} /></div>
    </Vista>
  );
}

export function TormentasNoCarga() {
  const { t } = useI18n();
  return (
    <Vista id="tormentas" etiqueta="app.torm.titulo" className={K.vista}>
      <h1 className={K.h1}>{t("app.torm.titulo")}</h1>
      <ErrorCarga className="mt-4" onReintentar={() => location.reload()} />
    </Vista>
  );
}
