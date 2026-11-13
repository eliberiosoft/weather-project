/* Cuando una carga falla y no hay nada guardado que mostrar: el aviso con «Reintentar» en lugar de un placeholder sin fin. */
import { K } from "../estilo";
import { useI18n } from "../i18n";
import { pendientes } from "../pendientes";
import { Icono } from "./Icono";

export function ErrorCarga({ texto, onReintentar = () => pendientes.reintentar(), className = "" }: { texto?: string; onReintentar?: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <div className={`${K.ficha} ${className}`}>
      <p className="flex items-start gap-3 font-medium text-pretty">
        <Icono id="i-sinred" className="mt-0.5 size-5 shrink-0 text-tinta" />
        <span>{texto || t("app.carga.error")}</span>
      </p>
      <button type="button" onClick={onReintentar} className={`mt-4 ${K.btnSec}`}>{t("app.carga.reintentar")}</button>
    </div>
  );
}
