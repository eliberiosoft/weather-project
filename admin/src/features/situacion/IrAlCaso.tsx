/* Cuando un recinto está en RESPUESTA por casos graves verificados (motivo «graves»), lleva a donde se gestionan:
   los incidentes del equipo a «Incidentes» (resolver, retirar o eliminar) y los de vecinos a «Reportes» (revisar).
   Antes el porqué decía «vecinos reportaron…» aunque fuera un incidente del equipo y no había cómo llegar a él. */
import type { ConMotivos } from "../../shared/api/tipos";
import { useI18n } from "../../shared/i18n/useI18n";
import { K } from "../../shared/ui/clases";

export function IrAlCaso({ e }: { e: ConMotivos }) {
  const { t } = useI18n();
  const g = e.motivos?.find((m) => m.k === "graves")?.v;
  if (!g) return null;
  const equipo = Number(g.equipo) || 0, vecinos = Number(g.vecinos) || 0;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {equipo > 0 && <a href="#incidentes" className={`${K.btnChico} no-underline`}>{t("panel.sit.ver_incidentes", { n: equipo })}</a>}
      {vecinos > 0 && <a href="#reportes" className={`${K.btnChico} no-underline`}>{t("panel.sit.ver_reportes", { n: vecinos })}</a>}
    </div>
  );
}
