import { almacen } from "../shared/almacen";
import { useI18n } from "../shared/i18n";
import { store, useApp } from "../shared/store";

/** Aviso de una vez: no hay cookies de seguimiento; solo se guarda lo necesario en el teléfono. */
export function AvisoCookies() {
  const { t } = useI18n();
  const ver = useApp((s) => s.avisoCookies);
  const cerrar = () => { almacen.set("aviso_cookies", true); store.set({ avisoCookies: false }); };
  return (
    <div hidden={!ver} role="region" aria-label={t("app.priv.titulo")} className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+.75rem)] z-[1500] mx-auto max-w-lg animate-entra rounded-2xl bg-negro p-4 text-white shadow-flota lg:bottom-24">
      <p className="text-sm leading-snug text-pretty">{t("app.priv.aviso")}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={cerrar} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold text-negro">{t("app.priv.entendido")}</button>
        <a href="#privacidad" className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-white/15 px-3 text-sm font-semibold text-white no-underline">{t("app.priv.ver")}</a>
      </div>
    </div>
  );
}
