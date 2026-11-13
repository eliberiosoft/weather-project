/* Los casos graves verificados que suben un lugar a RESPUESTA (motivo «graves» de la API, con sus ids): cada uno con
   «Ver en el mapa», que lleva al caso y abre su hoja. Sin esto el nivel rojo no decía qué lo causaba ni dónde estaba. */
import type { Motivo } from "@compartido/i18n/motor.js";
import { Icono } from "../../shared/componentes/Icono";
import { autoria, etiquetaTipo } from "../../shared/dominio";
import { K } from "../../shared/estilo";
import { hace } from "../../shared/formato";
import { useI18n } from "../../shared/i18n";
import { useApp } from "../../shared/store";
import { verEnMapa } from "./acciones";

/** Ids de los casos graves de una lista de motivos (vacío si no hay). */
export function idsGraves(motivos: Motivo[] | null | undefined): string[] {
  const m = motivos?.find((x) => x.k === "graves");
  const ids = m?.v?.ids;
  return typeof ids === "string" && ids ? ids.split(",") : [];
}

export function CasosGraves({ motivos, className = "mt-3 rounded-2xl bg-suelo p-3.5" }: { motivos: Motivo[] | null | undefined; className?: string }) {
  const { t } = useI18n();
  const reportes = useApp((s) => s.reportes);
  const ids = idsGraves(motivos);
  if (!ids.length) return null;
  // los que todavía no llegaron en la lista de reportes (se están cargando) no se muestran
  const casos = ids.map((id) => reportes.find((r) => r.id === id)).filter((r) => r !== undefined);
  return (
    <section className={className} aria-label={t("app.graves.titulo")}>
      <h3 className="text-sm font-bold">{t("app.graves.titulo")}</h3>
      {casos.length ? (
        <ul className="mt-1 list-none p-0">
          {casos.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-b border-regla py-2.5 last:border-0 last:pb-0">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-papel text-tinta"><Icono id={"t-" + r.tipo} className="size-4.5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{etiquetaTipo({ tipo: r.tipo, etiqueta: r.etiqueta })}</p>
                <p className="truncate text-xs text-gris">
                  {t(autoria(r).tipo === "equipo" ? "app.graves.equipo" : "app.graves.vecino")} · {hace(r.creado)}
                </p>
              </div>
              <button type="button" onClick={() => void verEnMapa([r.lat, r.lon], 17, { tipo: "reporte", r })} className={K.btnChico}>
                <Icono id="i-mapa" className="size-4" />{t("app.graves.ver")}
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-1 text-xs text-gris">{t("app.graves.cargando")}</p>}
    </section>
  );
}
