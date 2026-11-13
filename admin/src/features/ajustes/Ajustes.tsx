/* Ajustes: advertencia del INAMHI, aguaje e historial de niveles verificados. */
import { useState } from "react";
import { api, mensajeError } from "../../shared/api/cliente";
import type { Ajustes as TAjustes } from "../../shared/api/tipos";
import { aLocal, deLocal } from "../../shared/formato";
import { useI18n } from "../../shared/i18n/useI18n";
import { ErrorCarga } from "../../shared/ui/Carga";
import { EsqueletoBloque, EsqueletoCampo, EsqueletoFilas, EsqueletoLinea, EsqueletoPildora, Esperando } from "../../shared/ui/Esqueleto";
import { Nivel } from "../../shared/ui/Nivel";
import { K } from "../../shared/ui/clases";
import { toast } from "../../shared/ui/avisos";
import { usePanelDatos } from "../datos/PanelDatos";

export function Ajustes() {
  const { t, existe } = useI18n();
  const { ajustes, error, recargarTodo } = usePanelDatos();
  if (error && !ajustes) return <ErrorCarga texto={mensajeError(error, t, existe)} reintentar={recargarTodo} />;
  if (!ajustes) return <EsqueletoAjustes />;
  return (
    <div className="grid grid-cols-1 gap-4">
      {/* la key reinicia el formulario cuando llegan ajustes nuevos del servidor */}
      <FormAjustes key={JSON.stringify([ajustes.advertencia, ajustes.aguaje])} ajustes={ajustes} />
      <Historial ajustes={ajustes} />
    </div>
  );
}

function FormAjustes({ ajustes }: { ajustes: TAjustes }) {
  const { t, existe } = useI18n();
  const { recargarAjustes, recargarEstado } = usePanelDatos();
  const a = ajustes.advertencia ?? {};
  const g = ajustes.aguaje ?? {};
  const [vigente, setVigente] = useState(!!a.vigente);
  const [texto, setTexto] = useState(a.texto ?? "");
  const [hasta, setHasta] = useState(aLocal(a.hasta));
  const [aguHasta, setAguHasta] = useState(g.hasta ?? "");
  const [nota, setNota] = useState(g.nota ?? "");
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    setEnviando(true);
    try {
      await api("/api/panel/ajustes", {
        advertencia: { vigente, texto, hasta: deLocal(hasta) },
        aguaje: { hasta: aguHasta || null, nota },
      });
      toast(t("panel.aj.guardados"));
      await recargarAjustes();
      recargarEstado(true).catch(() => {});
    } catch (e) { toast(mensajeError(e, t, existe), 6000); } finally { setEnviando(false); }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <section className={K.ficha} aria-labelledby="aj-inamhi">
          <h2 id="aj-inamhi" className={K.h2}>{t("panel.aj.inamhi")}</h2>
          <label className="mt-4 flex items-start gap-2.5 text-sm">
            <input type="checkbox" checked={vigente} onChange={(e) => setVigente(e.target.checked)} className="mt-0.5 size-5 shrink-0" /> {t("panel.aj.vigente")}
          </label>
          <label htmlFor="adv-texto" className={`mt-4 ${K.etiqueta}`}>{t("panel.aj.texto")}</label>
          <input id="adv-texto" value={texto} maxLength={200} onChange={(e) => setTexto(e.target.value)} placeholder={t("panel.aj.texto_ph")} className={K.campo} />
          <label htmlFor="adv-hasta" className={`mt-4 ${K.etiqueta}`}>{t("panel.aj.hasta")}</label>
          <input id="adv-hasta" type="datetime-local" value={hasta} onChange={(e) => setHasta(e.target.value)} className={K.campo} />
        </section>
        <section className={K.ficha} aria-labelledby="aj-aguaje">
          <h2 id="aj-aguaje" className={K.h2}>{t("panel.aj.aguaje")}</h2>
          <p className="mt-2 text-sm text-gris">{t("panel.aj.aguaje_explica")}</p>
          <label htmlFor="agu-hasta" className={`mt-4 ${K.etiqueta}`}>{t("panel.aj.aguaje_hasta")}</label>
          <input id="agu-hasta" type="date" value={aguHasta} onChange={(e) => setAguHasta(e.target.value)} className={K.campo} />
          <label htmlFor="agu-nota" className={`mt-4 ${K.etiqueta}`}>{t("panel.aj.nota")}</label>
          <input id="agu-nota" value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} placeholder={t("panel.aj.nota_ph")} className={K.campo} />
        </section>
      </div>
      <div><button type="button" disabled={enviando} onClick={guardar} className={`${K.btnPrimario} px-6`}>{t("panel.aj.guardar")}</button></div>
    </>
  );
}

function Historial({ ajustes }: { ajustes: TAjustes }) {
  const { t, hora } = useI18n();
  return (
    <section className={K.ficha} aria-labelledby="aj-historial">
      <h2 id="aj-historial" className={K.h2}>{t("panel.aj.historial")}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className={K.tabla}>
          <CabezaHistorial />
          <tbody>
            {ajustes.historial_niveles.length ? ajustes.historial_niveles.map((h) => (
              <tr key={h.id}>
                <td>{hora(h.creado)}</td><td>{h.ambito_tipo} · {h.ambito_id}</td><td><Nivel n={h.nivel_cod} /></td><td className="text-sm text-gris">{h.motivo}</td>
              </tr>
            )) : <tr><td colSpan={4} className={K.vacio}>{t("panel.aj.sin_cambios")}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CabezaHistorial() {
  const { t } = useI18n();
  return <thead><tr><th scope="col">{t("panel.col.hora")}</th><th scope="col">{t("panel.col.ambito")}</th><th scope="col">{t("panel.col.nivel")}</th><th scope="col">{t("panel.col.motivo")}</th></tr></thead>;
}

/** Mientras llegan los ajustes: los dos formularios, el botón y el historial, en gris. */
function EsqueletoAjustes() {
  const { t } = useI18n();
  return (
    <Esperando className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className={K.ficha}>
          <h2 className={K.h2}>{t("panel.aj.inamhi")}</h2>
          <div className="mt-4 flex items-center gap-2.5"><EsqueletoBloque className="size-5 shrink-0 rounded-md" /><EsqueletoLinea className="w-2/3" /></div>
          <EsqueletoCampo etiqueta="w-40" />
          <EsqueletoCampo etiqueta="w-28" />
        </div>
        <div className={K.ficha}>
          <h2 className={K.h2}>{t("panel.aj.aguaje")}</h2>
          <div className="mt-2"><EsqueletoLinea /><EsqueletoLinea className="w-1/2" /></div>
          <EsqueletoCampo etiqueta="w-32" />
          <EsqueletoCampo etiqueta="w-24" />
        </div>
      </div>
      <EsqueletoBloque className="h-11 w-44 rounded-xl" />
      <div className={K.ficha}>
        <h2 className={K.h2}>{t("panel.aj.historial")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className={K.tabla}>
            <CabezaHistorial />
            <tbody><EsqueletoFilas filas={3} celdas={["w-24", "w-32", <EsqueletoPildora />, "w-48"]} /></tbody>
          </table>
        </div>
      </div>
    </Esperando>
  );
}
