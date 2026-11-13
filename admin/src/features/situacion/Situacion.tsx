/* Situación: nivel estimado (criterios del plan) frente al verificado (lo fija el analista), por cantón, río y recinto. */
import { useMemo, type ReactNode } from "react";
import type { Usuario } from "../../shared/api/tipos";
import { Rico } from "../../shared/i18n/rico";
import { useI18n } from "../../shared/i18n/useI18n";
import { ErrorCarga } from "../../shared/ui/Carga";
import { EsqueletoBloque, EsqueletoFilas, EsqueletoLinea, EsqueletoPildora, Esperando } from "../../shared/ui/Esqueleto";
import { Icono } from "../../shared/ui/Icono";
import { Nivel } from "../../shared/ui/Nivel";
import { K } from "../../shared/ui/clases";
import { useAncho } from "../../shared/ui/useAncho";
import { toast } from "../../shared/ui/avisos";
import { mensajeError } from "../../shared/api/cliente";
import { tiene } from "../auth/permisos";
import { usePanelDatos } from "../datos/PanelDatos";
import { ControlFijar } from "./ControlFijar";
import { IrAlCaso } from "./IrAlCaso";

export function Situacion({ usuario }: { usuario: Usuario }) {
  const { t, existe, motivo } = useI18n();
  const { estado: est, ajustes, error, recargarEstado, recargarTodo } = usePanelDatos();
  const puedeFijar = tiene(usuario, "niveles.fijar");
  // en el celular, las tablas pasan a tarjetas apiladas: nada de desplazarse de lado para fijar un nivel
  const ancho = useAncho();

  const recintos = useMemo(() => {
    if (!est || !ajustes) return [];
    return ajustes.recintos
      .map((x) => ({ ...x, e: est.recintos[String(x.id)] }))
      .filter((x): x is typeof x & { e: NonNullable<typeof x.e> } => !!x.e && (x.e.sugerido >= 2 || !!x.e.oficial))
      .sort((a, b) => (b.e.sugerido - a.e.sugerido) || a.nombre.localeCompare(b.nombre));
  }, [est, ajustes]);

  if (error && !est) return <ErrorCarga texto={mensajeError(error, t, existe)} reintentar={recargarTodo} />;
  if (!est || !ajustes) return ancho ? <EsqueletoSituacion puedeFijar={puedeFijar} /> : <EsqueletoPila />;
  const c = est.canton;

  async function recalcular() {
    toast(t("panel.sit.recalculando"));
    try { await recargarEstado(true); toast(t("panel.sit.listo")); } catch (e) { toast(mensajeError(e, t, existe)); }
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <section className={K.ficha} aria-labelledby="sit-canton">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="sit-canton" className={K.h2}>{t("panel.sit.canton")}</h2>
          <button type="button" onClick={recalcular} className={`${K.btnSecundario} text-sm`}>
            <Icono id="recalcular" className="size-4.5" />{t("panel.sit.recalcular")}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 items-end gap-4 md:grid-cols-[auto_auto_1fr]">
          <div><p className={K.etiquetaChica}>{t("panel.sit.estimado_canton")}</p><Nivel n={c.sugerido} /></div>
          <div>
            <p className={K.etiquetaChica}>{t("panel.sit.verificado_canton")}</p>
            <Nivel n={c.oficial} /> <span className={K.mini}>{c.oficial_motivo || ""}</span>
          </div>
          {puedeFijar && <div className="col-span-2 md:col-span-1"><ControlFijar tipo="canton" id="yaguachi" actual={c.oficial} nombre={t("panel.sit.canton")} fuerte apilado={!ancho} /></div>}
        </div>
        {est.advertencia && (
          <p className={`${K.nota} mt-3`}><Icono id="alerta" className="size-5 text-tinta" />{t("panel.sit.advertencia", { texto: est.advertencia.texto ?? "" })}</p>
        )}
        {est.aguaje && <p className={`${K.nota} mt-3`}><Icono id="luna" className="size-5 text-tinta" />{t("panel.sit.aguaje", { hasta: est.aguaje.hasta ?? "" })}</p>}
        {est.fuentes.lluvia_desactualizada && <p className={`${K.nota} mt-3`}><Icono id="alerta" className="size-5 text-tinta" />{t("panel.sit.lluvia_vieja")}</p>}
        <p className="mt-4 max-w-[80ch] text-sm text-gris"><Rico texto={t("panel.sit.explica")} /></p>
        {!puedeFijar && <p className={`${K.mini} mt-2`}>{t("panel.sit.solo_lectura")}</p>}
      </section>

      <section className={K.ficha} aria-labelledby="sit-rios">
        <h2 id="sit-rios" className={K.h2}>{t("panel.sit.rios")}</h2>
        {ancho ? (
          <div className="mt-3 overflow-x-auto">
            <table className={K.tabla}>
              <CabezaRios puedeFijar={puedeFijar} />
              <tbody>
                {est.rios.map((r) => (
                  <tr key={r.rio}>
                    <td><b>{r.rio}</b><div className={K.mini}>{r.puntos.join(", ") || t("panel.sit.sin_punto")}</div></td>
                    <td>
                      <Nivel n={r.sugerido} />
                      {r.sugerido_pleamar && <div className={`${K.mini} mt-1`}>{t("panel.sit.pleamar", { nivel: t("nivel." + r.sugerido_pleamar) })}</div>}
                      <div className={`${K.mini} mt-1`}>{existe("fuente." + r.fuente_sugerido) ? t("fuente." + r.fuente_sugerido) : r.fuente_sugerido}</div>
                    </td>
                    <td className="max-w-sm text-sm text-gris">{motivo(r)}</td>
                    <td><Nivel n={r.oficial} /><div className={`${K.mini} mt-1`}>{r.oficial_motivo || ""}</div></td>
                    {puedeFijar && <td><ControlFijar tipo="rio" id={r.rio} actual={r.oficial} nombre={r.rio} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="mt-3 grid gap-3">
            {est.rios.map((r) => (
              <Tarjeta key={r.rio} titulo={r.rio} sub={r.puntos.join(", ") || t("panel.sit.sin_punto")}
                estimado={<>
                  <Nivel n={r.sugerido} />
                  {r.sugerido_pleamar && <p className={`${K.mini} mt-1`}>{t("panel.sit.pleamar", { nivel: t("nivel." + r.sugerido_pleamar) })}</p>}
                  <p className={`${K.mini} mt-1`}>{existe("fuente." + r.fuente_sugerido) ? t("fuente." + r.fuente_sugerido) : r.fuente_sugerido}</p>
                </>}
                verificado={<><Nivel n={r.oficial} />{r.oficial_motivo && <p className={`${K.mini} mt-1`}>{r.oficial_motivo}</p>}</>}
                porque={motivo(r)}
                fijar={puedeFijar && <ControlFijar tipo="rio" id={r.rio} actual={r.oficial} nombre={r.rio} apilado />} />
            ))}
          </ul>
        )}
      </section>

      <section className={K.ficha} aria-labelledby="sit-recintos">
        <h2 id="sit-recintos" className={K.h2}>{t("panel.sit.recintos")}</h2>
        {ancho ? (
          <div className="mt-3 overflow-x-auto">
            <table className={K.tabla}>
              <CabezaRecintos puedeFijar={puedeFijar} />
              <tbody>
                {recintos.length ? recintos.map((x) => (
                  <tr key={x.id}>
                    <td><b>{x.nombre}</b></td>
                    <td className="text-sm text-gris">{x.parroquia}</td>
                    <td><Nivel n={x.e.sugerido} /></td>
                    <td className="max-w-xs text-sm text-gris">{motivo(x.e)}<IrAlCaso e={x.e} /></td>
                    <td><Nivel n={x.e.oficial} /><div className={`${K.mini} mt-1`}>{x.e.oficial_fuente || ""}</div></td>
                    {puedeFijar && <td><ControlFijar tipo="recinto" id={x.id} actual={x.e.oficial_fuente === "recinto" ? x.e.oficial : null} nombre={x.nombre} /></td>}
                  </tr>
                )) : <tr><td colSpan={6} className={K.vacio}>{t("panel.sit.ninguno")}</td></tr>}
              </tbody>
            </table>
          </div>
        ) : recintos.length ? (
          <ul className="mt-3 grid gap-3">
            {recintos.map((x) => (
              <Tarjeta key={x.id} titulo={x.nombre} sub={x.parroquia}
                estimado={<Nivel n={x.e.sugerido} />}
                verificado={<><Nivel n={x.e.oficial} />{x.e.oficial_fuente && <p className={`${K.mini} mt-1`}>{x.e.oficial_fuente}</p>}</>}
                porque={<>{motivo(x.e)}<IrAlCaso e={x.e} /></>}
                fijar={puedeFijar && <ControlFijar tipo="recinto" id={x.id} actual={x.e.oficial_fuente === "recinto" ? x.e.oficial : null} nombre={x.nombre} apilado />} />
            ))}
          </ul>
        ) : <p className={K.vacio}>{t("panel.sit.ninguno")}</p>}
      </section>
    </div>
  );
}

/** Un río o un recinto en el celular: lo estimado y lo verificado lado a lado, el porqué y el control para fijar. */
function Tarjeta({ titulo, sub, estimado, verificado, porque, fijar }: {
  titulo: string; sub?: string; estimado: ReactNode; verificado: ReactNode; porque: ReactNode; fijar: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <li className="rounded-2xl bg-suelo p-4">
      <h3 className="font-bold text-texto">{titulo}</h3>
      {sub && <p className={K.mini}>{sub}</p>}
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div className="min-w-0"><dt className={K.etiquetaChica}>{t("panel.col.estimado")}</dt><dd>{estimado}</dd></div>
        <div className="min-w-0"><dt className={K.etiquetaChica}>{t("panel.col.verificado")}</dt><dd>{verificado}</dd></div>
        {porque ? <div className="col-span-2"><dt className={K.etiquetaChica}>{t("panel.col.porque")}</dt><dd className="text-sm text-gris">{porque}</dd></div> : null}
      </dl>
      {fijar ? <div className="mt-3 border-t border-regla pt-3"><p className={K.etiquetaChica}>{t("panel.col.fijar_verificado")}</p>{fijar}</div> : null}
    </li>
  );
}

/** Mientras llega el estado, en el celular: la ficha del cantón y tarjetas grises. */
function EsqueletoPila() {
  const { t } = useI18n();
  const tarjeta = (i: number) => (
    <div key={i} className="rounded-2xl bg-suelo p-4">
      <EsqueletoLinea className="w-32" />
      <div className="mt-3 grid grid-cols-2 gap-3"><EsqueletoPildora /><EsqueletoPildora /></div>
      <EsqueletoLinea className="mt-3 w-11/12" />
    </div>
  );
  return (
    <Esperando className="grid grid-cols-1 gap-4">
      <div className={K.ficha}>
        <h2 className={K.h2}>{t("panel.sit.canton")}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3"><EsqueletoPildora /><EsqueletoPildora /></div>
        <EsqueletoBloque className="mt-4 h-11 w-full rounded-xl" />
      </div>
      <div className={K.ficha}>
        <h2 className={K.h2}>{t("panel.sit.rios")}</h2>
        <div className="mt-3 grid gap-3">{[0, 1, 2].map(tarjeta)}</div>
      </div>
    </Esperando>
  );
}

function CabezaRios({ puedeFijar }: { puedeFijar: boolean }) {
  const { t } = useI18n();
  return (
    <thead><tr>
      <th scope="col">{t("panel.col.rio")}</th><th scope="col">{t("panel.col.estimado")}</th><th scope="col">{t("panel.col.porque")}</th>
      <th scope="col">{t("panel.col.verificado")}</th>{puedeFijar && <th scope="col" className="min-w-80">{t("panel.col.fijar_verificado")}</th>}
    </tr></thead>
  );
}

function CabezaRecintos({ puedeFijar }: { puedeFijar: boolean }) {
  const { t } = useI18n();
  return (
    <thead><tr>
      <th scope="col">{t("panel.col.recinto")}</th><th scope="col">{t("panel.col.parroquia")}</th><th scope="col">{t("panel.col.estimado")}</th>
      <th scope="col">{t("panel.col.porque")}</th><th scope="col">{t("panel.col.verificado")}</th>
      {puedeFijar && <th scope="col" className="min-w-80">{t("panel.col.fijar")}</th>}
    </tr></thead>
  );
}

/** Mientras llega el estado: la ficha del cantón y las dos tablas, con sus encabezados reales y filas grises. */
function EsqueletoSituacion({ puedeFijar }: { puedeFijar: boolean }) {
  const { t } = useI18n();
  const nivel = <><EsqueletoPildora /><EsqueletoLinea className="mt-1 w-20" /></>;
  const fijar = <EsqueletoBloque className="h-11 w-full rounded-xl" />;
  return (
    <Esperando className="grid grid-cols-1 gap-4">
      <div className={K.ficha}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={K.h2}>{t("panel.sit.canton")}</h2>
          <EsqueletoBloque className="h-11 w-60 rounded-xl" />
        </div>
        <div className="mt-4 grid items-end gap-4 md:grid-cols-[auto_auto_1fr]">
          <div><EsqueletoLinea className="mb-1.5 w-44" /><EsqueletoPildora /></div>
          <div><EsqueletoLinea className="mb-1.5 w-40" /><EsqueletoPildora /></div>
          {puedeFijar && fijar}
        </div>
        <div className="mt-4 max-w-[80ch]">
          <EsqueletoLinea /><EsqueletoLinea className="w-11/12" /><EsqueletoLinea className="w-3/4" />
        </div>
      </div>
      <div className={K.ficha}>
        <h2 className={K.h2}>{t("panel.sit.rios")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className={K.tabla}>
            <CabezaRios puedeFijar={puedeFijar} />
            <tbody>
              <EsqueletoFilas filas={4} celdas={[<><EsqueletoLinea className="w-24" /><EsqueletoLinea className="w-16" /></>, nivel, "w-56", nivel, ...(puedeFijar ? [fijar] : [])]} />
            </tbody>
          </table>
        </div>
      </div>
      <div className={K.ficha}>
        <h2 className={K.h2}>{t("panel.sit.recintos")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className={K.tabla}>
            <CabezaRecintos puedeFijar={puedeFijar} />
            <tbody>
              <EsqueletoFilas filas={2} celdas={["w-32", "w-20", <EsqueletoPildora />, "w-48", nivel, ...(puedeFijar ? [fijar] : [])]} />
            </tbody>
          </table>
        </div>
      </div>
    </Esperando>
  );
}
