/* La barra de carga global (bajo la cabecera) y el aviso de conexión lenta (spec 015).
   - La barra aparece si alguna lectura de la API pasa de 400 ms y se va cuando no queda ninguna pendiente.
   - A los 8 s, un aviso discreto con «Reintentar» (vuelve a pedir lo de la vista actual) y su cierre. */
import { Icono } from "../shared/componentes/Icono";
import { K } from "../shared/estilo";
import { useI18n } from "../shared/i18n";
import { pendientes, usePendientes } from "../shared/pendientes";

/** Va dentro de la cabecera (sticky), pegada a su borde inferior. */
export function BarraCarga() {
  const { t } = useI18n();
  const barra = usePendientes((s) => s.barra);
  return (
    <>
      {barra ? (
        <div role="progressbar" aria-label={t("app.carga.etq")} className="pointer-events-none absolute inset-x-0 -bottom-px h-[3px] overflow-hidden bg-tinta/15">
          <span className="block h-full w-2/5 rounded-full bg-tinta animate-carga motion-reduce:w-full motion-reduce:opacity-60"></span>
        </div>
      ) : null}
      {/* el lector de pantalla oye «Cargando…» una sola vez por racha */}
      <span role="status" className="sr-only">{barra ? t("app.carga.etq") : ""}</span>
    </>
  );
}

export function AvisoLento() {
  const { t } = useI18n();
  const lento = usePendientes((s) => s.lento);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-3 top-[calc(3.5rem+.5rem)] z-[1006] flex justify-center">
      {lento ? (
        <div className="pointer-events-auto flex max-w-md animate-entra items-center gap-2 rounded-2xl bg-papel py-2 pr-2 pl-3.5 text-sm leading-snug font-medium text-texto shadow-flota">
          <Icono id="i-sinred" className="size-4.5 shrink-0 text-tinta" />
          <span className="min-w-0 flex-1 text-pretty">{t("app.carga.lento")}</span>
          <button type="button" onClick={() => pendientes.reintentar()} className={`${K.btnChico} shrink-0`}>{t("app.carga.reintentar")}</button>
          <button type="button" onClick={() => pendientes.descartarLento()} aria-label={t("app.cerrar")} title={t("app.cerrar")}
            className="grid size-9 shrink-0 place-items-center rounded-full text-gris active:scale-95">
            <Icono id="i-x" className="size-4.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
