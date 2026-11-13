/* «Reportes»: reportes de vecinos e incidentes del equipo, con filtros (estado, origen, tipo, vigencia, texto) y
   paginación. Se verifican, resuelven o descartan uno por uno; con la casilla se eligen varios para cambiar hasta
   cuándo se ven (superadmin y analista, reportes.vigencia) o eliminarlos para siempre (solo superadmin, reportes.eliminar). */
import { FotosReporte } from "../../shared/ui/FotosReporte";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, mensajeError } from "../../shared/api/cliente";
import type { EstadoReporte, Reporte, Usuario } from "../../shared/api/tipos";
import { useI18n } from "../../shared/i18n/useI18n";
import { ErrorCarga } from "../../shared/ui/Carga";
import { EsqueletoBloque, EsqueletoLinea, Esperando } from "../../shared/ui/Esqueleto";
import { Icono } from "../../shared/ui/Icono";
import { K, pildoraEstado } from "../../shared/ui/clases";
import { confirmar, toast } from "../../shared/ui/avisos";
import { tiene } from "../auth/permisos";
import { usePanelDatos } from "../datos/PanelDatos";
import { aLocal, desdeLocal, ESTADOS, fechaValida, FILTROS_INICIALES, ORIGENES, TIPOS_FILTRO, VIGENCIAS, rutaReportes, type Filtros } from "./consulta";

interface Pagina { reportes: Reporte[]; total: number; pagina: number; paginas: number }

export function Reportes({ usuario }: { usuario: Usuario }) {
  const { t, existe } = useI18n();
  const { recargarPendientes, recargarEstado } = usePanelDatos();
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<Pagina | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [hasta, setHasta] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const campoFecha = useRef<HTMLInputElement>(null);
  const puedeRevisar = tiene(usuario, "reportes.revisar");
  const puedeVigencia = tiene(usuario, "reportes.vigencia");
  const puedeEliminar = tiene(usuario, "reportes.eliminar");
  const conLote = puedeVigencia || puedeEliminar;

  const cargar = useCallback(async () => {
    setError(null);
    try { setDatos(await api<Pagina>(rutaReportes(filtros, pagina))); } catch (e) { setError(e); }
  }, [filtros, pagina]);
  useEffect(() => { void cargar(); }, [cargar]);
  // el texto se busca medio segundo después de dejar de escribir
  useEffect(() => {
    const h = setTimeout(() => setFiltros((f) => (f.q === texto ? f : { ...f, q: texto })), 450);
    return () => clearTimeout(h);
  }, [texto]);
  // al cambiar los filtros se vuelve a la página 1 y se suelta la selección
  useEffect(() => { setPagina(1); setSel(new Set()); }, [filtros]);

  const cambiarFiltro = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setFiltros((f) => ({ ...f, [k]: v }));
  const lista = datos?.reportes ?? null;
  const todosEnPagina = !!lista?.length && lista.every((r) => sel.has(r.id));
  const elegir = (id: string, si: boolean) => setSel((s) => { const n = new Set(s); if (si) n.add(id); else n.delete(id); return n; });
  const elegirPagina = (si: boolean) => setSel((s) => { const n = new Set(s); lista?.forEach((r) => (si ? n.add(r.id) : n.delete(r.id))); return n; });

  async function despues() {
    setSel(new Set());
    await cargar();
    void recargarPendientes();
    recargarEstado(true).catch(() => {});
  }

  async function revisar(id: string, estado: EstadoReporte, nota: string, gravedad: number | null) {
    try {
      await api("/api/panel/reportes/" + id, { estado, nota, ...(gravedad ? { gravedad } : {}) });
      toast(t("panel.rep.hecho", { estado: t("estado." + estado) }));
      await despues();
    } catch (e) { toast(mensajeError(e, t, existe), 6000); }
  }

  /** «Cambiar» en una ficha: la elige sola y lleva a la barra con su fecha actual. */
  function cambiarUna(r: Reporte) {
    setSel(new Set([r.id]));
    setHasta(aLocal(r.expira));
    setTimeout(() => campoFecha.current?.focus(), 0);
  }

  async function aplicarFecha() {
    const iso = desdeLocal(hasta);
    if (!fechaValida(iso)) { toast(t("panel.rep.lote.fecha_mala"), 6000); campoFecha.current?.focus(); return; }
    setOcupado(true);
    try {
      const r = await api<{ actualizados: number }>("/api/panel/reportes/vigencia", { ids: [...sel], hasta: iso });
      toast(t("panel.rep.lote.fecha_ok", { n: r.actualizados }));
      await despues();
    } catch (e) { toast(mensajeError(e, t, existe), 6000); } finally { setOcupado(false); }
  }

  async function eliminar() {
    if (!(await confirmar(t("panel.rep.lote.confirmar_eliminar", { n: sel.size }), t("panel.rep.lote.eliminar")))) return;
    setOcupado(true);
    try {
      const r = await api<{ eliminados: number }>("/api/panel/reportes/eliminar", { ids: [...sel] });
      toast(t("panel.rep.lote.eliminados", { n: r.eliminados }));
      await despues();
    } catch (e) { toast(mensajeError(e, t, existe), 6000); } finally { setOcupado(false); }
  }

  const SEL = `${K.campoChico} min-h-11 w-full font-semibold`;
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className={`${K.ficha} grid gap-3`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.6fr)]">
          <div>
            <label htmlFor="rep-estado" className={K.etiquetaChica}>{t("panel.rep.f.estado")}</label>
            <select id="rep-estado" value={filtros.estado} onChange={(e) => cambiarFiltro("estado", e.target.value as Filtros["estado"])} className={SEL}>
              {ESTADOS.map((f) => <option key={f} value={f}>{t("panel.rep.f." + f)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rep-origen" className={K.etiquetaChica}>{t("panel.rep.f.origen")}</label>
            <select id="rep-origen" value={filtros.origen} onChange={(e) => cambiarFiltro("origen", e.target.value as Filtros["origen"])} className={SEL}>
              {ORIGENES.map((f) => <option key={f} value={f}>{t("panel.rep.o." + f)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rep-tipo" className={K.etiquetaChica}>{t("panel.rep.f.tipo")}</label>
            <select id="rep-tipo" value={filtros.tipo} onChange={(e) => cambiarFiltro("tipo", e.target.value)} className={SEL}>
              {TIPOS_FILTRO.map((f) => <option key={f} value={f}>{f === "todos" ? t("panel.rep.t.todos") : existe("tipo." + f) ? t("tipo." + f) : f}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rep-vig" className={K.etiquetaChica}>{t("panel.rep.f.vigencia")}</label>
            <select id="rep-vig" value={filtros.vigencia} onChange={(e) => cambiarFiltro("vigencia", e.target.value as Filtros["vigencia"])} className={SEL}>
              {VIGENCIAS.map((f) => <option key={f} value={f}>{t("panel.rep.v." + f)}</option>)}
            </select>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="rep-q" className={K.etiquetaChica}>{t("panel.rep.f.buscar")}</label>
            <input id="rep-q" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={80}
              placeholder={t("panel.rep.f.buscar_ph")} className={`${K.campoChico} min-h-11 w-full`} />
          </div>
        </div>
        <p className="max-w-[90ch] text-sm text-gris">{t("panel.rep.ayuda")}</p>
        {!puedeRevisar && <p className={K.mini}>{t("panel.rep.solo_lectura")}</p>}
      </div>

      {conLote && !!lista?.length && (
        <label className="flex items-center gap-2.5 px-1 text-sm font-semibold text-texto">
          <input type="checkbox" checked={todosEnPagina} onChange={(e) => elegirPagina(e.target.checked)} className="size-5" />
          {t("panel.rep.lote.pagina", { n: lista.length })}
        </label>
      )}

      {error ? <ErrorCarga texto={mensajeError(error, t, existe)} reintentar={() => void cargar()} />
        : !lista ? <EsqueletoReportes />
        : !lista.length ? <p className={`${K.ficha} text-sm text-gris`}>{t("panel.rep.vacio")}</p>
        : lista.map((r) => <FichaReporte key={r.id} r={r} puedeRevisar={puedeRevisar} alRevisar={revisar}
            elegible={conLote} elegido={sel.has(r.id)} alElegir={(si) => elegir(r.id, si)}
            alCambiarFecha={puedeVigencia ? () => cambiarUna(r) : undefined} />)}

      {datos && datos.total > 0 && (
        <nav aria-label={t("panel.rep.pag.etq")} className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-sm text-gris">{t("panel.rep.pag.estado", { p: datos.pagina, de: datos.paginas, n: datos.total })}</p>
          <div className="flex gap-2">
            <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className={K.btnNeutro}>
              <Icono id="atras" className="size-4.5" />{t("panel.rep.pag.anterior")}
            </button>
            <button type="button" disabled={pagina >= datos.paginas} onClick={() => setPagina((p) => p + 1)} className={K.btnNeutro}>
              {t("panel.rep.pag.siguiente")}<Icono id="adelante" className="size-4.5" />
            </button>
          </div>
        </nav>
      )}

      {sel.size > 0 && (
        <div role="region" aria-label={t("panel.rep.lote.etq")}
          className="sticky bottom-3 z-10 flex flex-wrap items-end gap-3 rounded-ficha bg-negro p-4 text-white shadow-flota">
          <p className="mr-auto self-center font-semibold">{t("panel.rep.lote.n", { n: sel.size })}</p>
          {puedeVigencia && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="rep-hasta" className="mb-1 block text-xs font-semibold text-white/80">{t("panel.rep.lote.hasta")}</label>
                <input id="rep-hasta" ref={campoFecha} type="datetime-local" value={hasta} onChange={(e) => setHasta(e.target.value)}
                  min={aLocal(new Date(Date.now() + 5 * 60_000))} max={aLocal(new Date(Date.now() + 90 * 86_400_000))}
                  className="min-h-11 rounded-xl border border-white/30 bg-white px-3 text-sm text-texto focus:ring-4 focus:ring-white/30 focus:outline-none" />
              </div>
              <button type="button" disabled={ocupado || !hasta} onClick={() => void aplicarFecha()}
                className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-negro transition active:scale-[.98] disabled:opacity-60">
                {t("panel.rep.lote.aplicar")}
              </button>
            </div>
          )}
          {puedeEliminar && (
            <button type="button" disabled={ocupado} onClick={() => void eliminar()}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/40 px-4 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-[.98] disabled:opacity-60">
              <Icono id="papelera" className="size-4.5" />{t("panel.rep.lote.eliminar")}
            </button>
          )}
          <button type="button" onClick={() => setSel(new Set())} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-white/80 hover:text-white">
            {t("panel.rep.lote.soltar")}
          </button>
        </div>
      )}
    </div>
  );
}

function FichaReporte({ r, puedeRevisar, alRevisar, elegible, elegido, alElegir, alCambiarFecha }: {
  r: Reporte; puedeRevisar: boolean; alRevisar: (id: string, estado: EstadoReporte, nota: string, gravedad: number | null) => Promise<void>;
  elegible: boolean; elegido: boolean; alElegir: (si: boolean) => void; alCambiarFecha?: () => void;
}) {
  const { t, existe, hora } = useI18n();
  const [nota, setNota] = useState(r.nota_ugr ?? "");
  const [ocupado, setOcupado] = useState(false);
  // los vecinos no tipifican: el equipo fija la gravedad (la calle inundada la toma de la altura del agua)
  const calle = r.tipo === "calle_inundada";
  const [grav, setGrav] = useState<number | null>(r.gravedad >= 1 ? r.gravedad : null);
  const etiqueta = existe("tipo." + r.tipo) ? t("tipo." + r.tipo) : r.etiqueta ?? r.tipo;
  const accion = async (estado: EstadoReporte) => { setOcupado(true); try { await alRevisar(r.id, estado, nota, calle ? null : grav); } finally { setOcupado(false); } };

  return (
    <article className={`grid gap-5 rounded-ficha bg-papel p-5 shadow-ficha md:grid-cols-[1fr_15rem] ${elegido ? "ring-2 ring-tinta" : ""}`}>
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-center gap-2.5 text-lg font-bold text-texto">
          {elegible && <input type="checkbox" checked={elegido} onChange={(e) => alElegir(e.target.checked)}
            aria-label={t("panel.rep.lote.elegir", { tipo: existe("tipo." + r.tipo) ? t("tipo." + r.tipo) : r.tipo })} className="size-5 shrink-0" />}
          <span className="grid size-10 place-items-center rounded-xl bg-tinta-suave text-tinta"><Icono id={"t-" + r.tipo} className="size-5.5" /></span>
          {etiqueta}
          {r.validado_por === "vecinos" && r.estado === "validado"
            ? <span className={K.pildora.pendiente}>{t("estado.vecinos", { n: r.vecinos_n ?? 3 })}</span>
            : <span className={pildoraEstado(r.estado)}>{t("estado." + r.estado)}</span>}
          {r.origen === "equipo" && <span className={K.pildora.suave}>{t("panel.rep.equipo")}</span>}
        </h3>
        {r.tipo === "calle_inundada" && (
          <p className="mt-2">
            <b>{r.via || t("panel.rep.calle_default")}</b> · {r.altura_agua ? t(`altura.${r.altura_agua}.larga`) : r.altura_txt || ""}
            {r.estado === "pendiente" && <> · <span className={K.mini}>{t("panel.rep.ya_visible")}</span></>}
          </p>
        )}
        <p className={`${K.mini} mt-1.5`}>
          {hora(r.creado)} · {t("panel.rep.gravedad", { g: t("gravedad." + r.gravedad) })} · {r.recinto || t("panel.rep.sin_recinto")}
          {r.en_canton === false && <> · <b>{t("panel.rep.fuera")}</b></>}
          {r.dispositivo && <> · {t("panel.rep.disp", { id: r.dispositivo })}</>}
        </p>
        {r.validado_por === "vecinos" && r.estado === "validado" && (
          <p className={`${K.nota} mt-2 font-normal`}><Icono id="usuarios" className="mt-0.5 size-4.5 shrink-0 text-tinta" />{t("panel.rep.vecinos_nota", { n: r.vecinos_n ?? 3 })}</p>
        )}
        <p className="mt-3 max-w-[70ch] break-words">{r.descripcion || t("panel.rep.sin_detalles")}</p>
        <p className={`${K.mini} mt-1.5`}>
          <a href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lon}#map=17/${r.lat}/${r.lon}`} target="_blank" rel="noopener noreferrer"
            aria-label={t("panel.rep.ubicacion", { lat: r.lat.toFixed(5), lon: r.lon.toFixed(5) })}>
            {r.lat.toFixed(5)}, {r.lon.toFixed(5)}
          </a>
          {" · "}{t(Date.parse(r.expira) > Date.now() ? "panel.rep.vence" : "panel.rep.vencio", { hora: hora(r.expira) })}
          {alCambiarFecha && <> <button type="button" onClick={alCambiarFecha} className="font-semibold text-tinta underline underline-offset-2">{t("panel.rep.cambiar_fecha")}</button></>}
          {" · "}{t("panel.rep.vecinos", { sigue: r.sigue, ya_no: r.ya_no })}
        </p>
        {puedeRevisar ? (
          <>
            <label htmlFor={"nota-" + r.id} className={`mt-4 ${K.etiquetaChica}`}>{t("panel.rep.nota_etq")}</label>
            <input id={"nota-" + r.id} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} className={`${K.campoChico} min-h-11 w-full max-w-xl`} />
            {!calle && (
              <div className="mt-4">
                <p id={"grav-" + r.id} className={K.etiquetaChica}>{t("panel.rep.tipificar")}</p>
                <div role="radiogroup" aria-labelledby={"grav-" + r.id} className="mt-1 inline-flex flex-wrap gap-1 rounded-xl bg-suelo p-1">
                  {[1, 2, 3].map((g) => (
                    <button key={g} type="button" role="radio" aria-checked={grav === g} onClick={() => setGrav(g)}
                      className="min-h-10 rounded-lg px-3.5 text-sm font-semibold text-gris capitalize transition aria-checked:bg-papel aria-checked:text-tinta aria-checked:shadow-ficha">
                      {t("gravedad." + g)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={ocupado} className={K.btnChicoFuerte} onClick={() => void accion("validado")}>{t("panel.rep.validar")}</button>
              <button type="button" disabled={ocupado} className={K.btnChico} onClick={() => void accion("resuelto")}>{t("panel.rep.resuelto")}</button>
              <button type="button" disabled={ocupado} className={K.btnNeutro} onClick={() => void accion("descartado")}>{t("panel.rep.descartar")}</button>
            </div>
          </>
        ) : r.nota_ugr && <p className="mt-3 rounded-xl bg-suelo px-3 py-2 text-sm">{r.nota_ugr}</p>}
      </div>
      <div>
        {r.foto
          ? <FotosReporte r={r} />
          : <p className="grid h-full min-h-24 place-items-center rounded-2xl bg-suelo text-xs text-gris">{t("panel.rep.sin_foto")}</p>}
      </div>
    </article>
  );
}

/** Dos fichas de reporte grises: título con ícono y estado, datos, texto, acciones y la miniatura de la foto. */
function EsqueletoReportes() {
  return (
    <Esperando className="grid grid-cols-1 gap-4">
      {[0, 1].map((i) => (
        <div key={i} aria-hidden="true" className="grid gap-5 rounded-ficha bg-papel p-5 shadow-ficha md:grid-cols-[1fr_15rem]">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <EsqueletoBloque className="size-10 shrink-0 rounded-xl" />
              <EsqueletoBloque className="h-4.5 w-40 rounded-full" />
              <EsqueletoBloque className="h-6 w-20 rounded-full" />
            </div>
            <EsqueletoLinea className="mt-2.5 w-3/4" />
            <EsqueletoLinea className="mt-3 w-full" />
            <EsqueletoLinea className="w-5/6" />
            <EsqueletoLinea className="mt-1.5 w-2/3" />
            <EsqueletoBloque className="mt-4 h-11 w-full max-w-xl rounded-xl" />
            <div className="mt-4 flex gap-2">
              <EsqueletoBloque className="h-11 w-24 rounded-xl" />
              <EsqueletoBloque className="h-11 w-28 rounded-xl" />
              <EsqueletoBloque className="h-11 w-24 rounded-xl" />
            </div>
          </div>
          <EsqueletoBloque className="h-40 rounded-2xl md:h-full" />
        </div>
      ))}
    </Esperando>
  );
}
