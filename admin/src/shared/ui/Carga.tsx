/* Estados de carga y error (spec 015).
   - BarraCarga: barra fina indeterminada bajo la cabecera fija, solo si algo tarda más de 400 ms.
   - ConexionLenta: aviso discreto a los 8 s con algo pendiente, con «Reintentar».
   - Cargando: texto breve mientras se sabe si hay sesión. ErrorCarga: el error de una sección con «Reintentar». */
import { pendientes, usePendientes } from "../api/pendientes";
import { useI18n } from "../i18n/useI18n";
import { Icono } from "./Icono";
import { K } from "./clases";

export function Cargando() {
  const { t } = useI18n();
  return <p role="status" className={K.vacio}>{t("panel.cargando")}</p>;
}

export function ErrorCarga({ texto, reintentar }: { texto?: string; reintentar?: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className={`${K.ficha} flex flex-wrap items-center justify-between gap-3`}>
      <p className="font-semibold">{texto || t("panel.error.cargar")}</p>
      {reintentar && <button type="button" className={K.btnChico} onClick={reintentar}>{t("panel.reintentar")}</button>}
    </div>
  );
}

/** Va dentro de la cabecera (sticky): se apoya en su borde inferior sin ocupar lugar. */
export function BarraCarga() {
  const { t } = useI18n();
  const { barra } = usePendientes();
  if (!barra) return null;
  return (
    <div role="progressbar" aria-label={t("panel.carga.etq")}
      className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 overflow-hidden bg-tinta-suave">
      <div className="h-full w-1/3 animate-carga rounded-full bg-tinta motion-reduce:w-full motion-reduce:animate-none" />
    </div>
  );
}

/** Flota bajo la cabecera y las pestañas (no las tapa ni empuja el contenido). */
export function ConexionLenta() {
  const { t } = useI18n();
  const { lenta } = usePendientes();
  if (!lenta) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-30 flex justify-center px-4 sm:justify-end lg:top-36 lg:px-6">
      <div role="status" className="pointer-events-auto flex max-w-md animate-entra items-center gap-3 rounded-2xl bg-papel py-2 pr-2 pl-4 text-sm shadow-flota">
        <Icono id="alerta" className="size-5 shrink-0 text-tinta" />
        <p className="font-semibold">{t("panel.carga.lenta")}</p>
        <button type="button" onClick={() => pendientes.reintentar()} className={K.btnChico}>{t("panel.reintentar")}</button>
      </div>
    </div>
  );
}
