/* Hoja «calle inundada»: el tramo tocado (±120 m), cuánta agua hay y el consentimiento (solo la primera vez). */
import { useEffect, useRef, useState } from "react";
import { almacen } from "../../shared/almacen";
import { DISP, postJSON } from "../../shared/api";
import { nombreVia, type Tramo } from "../../shared/calles";
import { Icono } from "../../shared/componentes/Icono";
import { refrescarReportes } from "../../shared/datos";
import { recintoMasCercano } from "../../shared/dominio";
import { K } from "../../shared/estilo";
import { useI18n } from "../../shared/i18n";
import { store, toast, useApp } from "../../shared/store";
import type { CuerpoReporte } from "../../shared/tipos";
import { avisoCola, encolar, esTemporal, guardado } from "../reportar/cola";
import { textoConSentido } from "../../shared/formato";

const ALTURA = "flex min-h-26 flex-col items-center justify-center gap-1 rounded-2xl bg-suelo px-1.5 py-3 text-center text-sm leading-tight font-semibold text-texto transition active:scale-[.97] aria-checked:bg-tinta aria-checked:text-white";

export function HojaCalle({ tramo, onCancelar }: { tramo: Tramo | null; onCancelar(): void }) {
  // el estado de la hoja vuelve a empezar con cada tramo nuevo
  return tramo ? <Hoja key={tramo.coords.join()} tramo={tramo} onCancelar={onCancelar} /> : null;
}

function Hoja({ tramo, onCancelar }: { tramo: Tramo; onCancelar(): void }) {
  const { t } = useI18n();
  const terr = useApp((s) => s.terr);
  const [altura, setAltura] = useState<number | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [consentDado] = useState(() => almacen.get("consent_ok", false));
  const primera = useRef<HTMLButtonElement>(null);
  const via = nombreVia(tramo, recintoMasCercano(terr, tramo.punto[0], tramo.punto[1]));

  useEffect(() => { primera.current?.focus({ preventScroll: true }); }, []);

  const enviar = async () => {
    if (!altura) return toast(t("app.val.altura"));
    if (!textoConSentido(descripcion)) return toast(t("app.val.descripcion"));
    if (!consentDado && !ok) return toast(t("app.val.consent"));
    const cuerpo: CuerpoReporte = { dispositivo: DISP, tipo: "calle_inundada", altura_agua: altura, via, tramo: tramo.coords,
      lat: tramo.punto[0], lon: tramo.punto[1], consentimiento: true, gravedad: altura, descripcion: descripcion.trim() };
    setEnviando(true);
    try {
      await postJSON("/api/reportes", cuerpo);
      almacen.set("consent_ok", true);
      toast(t("app.toast.calle_ok"), 4500);
      store.set({ modoMapa: null });
      void refrescarReportes();
    } catch (e) {
      if (esTemporal(e)) {
        const r = encolar(cuerpo);
        toast(avisoCola(r), 6000);
        if (guardado(r)) store.set({ modoMapa: null });
      } else toast((e as Error).message, 5000);
    } finally { setEnviando(false); }
  };

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="hoja-via" className={K.hoja}>
      <div className="sticky top-0 z-10 bg-papel pt-2 pb-3">
        <span className="mx-auto mb-2 block h-1.5 w-10 rounded-full bg-regla md:hidden" aria-hidden="true"></span>
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="hoja-via" className="pt-1 text-xl leading-tight font-bold text-balance">{via}</h2><p className="mt-0.5 text-sm text-gris">{t("app.calle.sub_tramo")}</p></div>
          <button type="button" onClick={onCancelar} aria-label={t("app.cancelar")} className="grid size-9 shrink-0 place-items-center rounded-full bg-suelo text-gris"><Icono id="i-x" className="size-5" /></button>
        </div>
      </div>
      <div role="radiogroup" aria-label={t("app.alturas.etq")} className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((a) => (
          <button key={a} ref={a === 1 ? primera : undefined} type="button" role="radio" aria-checked={altura === a} onClick={() => setAltura(a)} className={ALTURA}>
            <Icono id={"a-" + a} className="size-8" /><span>{t(`app.altura.${a}.boton`)}</span><small className="text-xs font-medium opacity-75">{t(`app.altura.${a}.nota`)}</small>
          </button>
        ))}
      </div>
      <label htmlFor="calle-desc" className="mt-3 mb-1.5 block text-sm font-semibold">{t("app.rep.detalles")}</label>
      <textarea id="calle-desc" rows={2} maxLength={500} required aria-describedby="calle-desc-nota" value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)} placeholder={t("app.calle.desc_ph")}
        className="w-full resize-y rounded-2xl border border-regla bg-suelo p-3 text-sm focus:border-tinta focus:bg-papel focus:ring-4 focus:ring-tinta/15 focus:outline-none" />
      <p id="calle-desc-nota" className={`mt-1 text-xs ${descripcion && !textoConSentido(descripcion) ? "font-semibold text-texto" : "text-gris"}`}>{t("app.rep.detalles.nota")}</p>
      {!consentDado ? (
        <label className="mt-3 flex items-start gap-3 text-[.85rem] leading-snug text-gris">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 size-5 shrink-0" />
          <span>{t("app.consent.calle")} <a href="#privacidad" className="font-semibold">{t("app.priv.ver")}</a></span>
        </label>
      ) : null}
      <button type="button" onClick={enviar} disabled={enviando || !altura || !textoConSentido(descripcion)} className="mt-3 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-tinta px-4 font-semibold text-white transition hover:bg-tinta-2 active:scale-[.98] disabled:opacity-45">{t("app.enviar")}</button>
    </div>
  );
}
