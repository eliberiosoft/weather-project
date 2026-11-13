/* Incidentes del equipo: publicar uno con el asistente (sale verificado en la app) y gestionar los publicados. */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, mensajeError } from "../../shared/api/cliente";
import type { Reporte, Usuario } from "../../shared/api/tipos";
import { useI18n } from "../../shared/i18n/useI18n";
import { ErrorCarga } from "../../shared/ui/Carga";
import { EsqueletoItemLista, Esperando } from "../../shared/ui/Esqueleto";
import { Icono } from "../../shared/ui/Icono";
import { K, pildoraEstado } from "../../shared/ui/clases";
import { confirmar, toast } from "../../shared/ui/avisos";
import { puedeGestionarIncidente, tiene } from "../auth/permisos";
import { AsistenteIncidente } from "./Asistente";
import { useCola, type IncidenteEnCola } from "./cola";
import { VerTelefonos } from "../alcance/Alcance";

/** Incidentes por tanda: la lista crece sola al bajar (scroll infinito). */
const PAGINA = 30;
type Pagina = { incidentes: Reporte[]; mas: boolean };

export function Incidentes({ usuario }: { usuario: Usuario }) {
  const { t, existe } = useI18n();
  const [lista, setLista] = useState<Reporte[] | null>(null);
  const [mas, setMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [falloMas, setFalloMas] = useState(false);     // tras un error no se reintenta solo: «Ver más»
  const [error, setError] = useState<unknown>(null);
  const actual = useRef<Reporte[] | null>(null);
  const pidiendo = useRef(false);
  useEffect(() => { actual.current = lista; }, [lista]);

  /** Primera tanda; al actualizar tras un cambio, otra vez todo lo ya cargado (hasta 100) para no perder el lugar. */
  const cargar = useCallback(async () => {
    setError(null);
    const n = Math.min(100, Math.max(PAGINA, actual.current?.length ?? 0));
    try {
      const r = await api<Pagina>(`/api/panel/incidentes?n=${n}`);
      setLista(r.incidentes); setMas(r.mas); setFalloMas(false);
    } catch (e) { setError(e); }
  }, []);

  /** La tanda siguiente, desde el último ya mostrado (del más nuevo al más viejo, sin repetir). */
  const cargarMas = useCallback(async () => {
    const l = actual.current;
    const u = l?.[l.length - 1];
    if (!u || pidiendo.current) return;
    pidiendo.current = true;
    setCargandoMas(true);
    try {
      const q = new URLSearchParams({ n: String(PAGINA), antes: u.creado, antes_id: u.id });
      const r = await api<Pagina>(`/api/panel/incidentes?${q}`);
      setLista((x) => {
        const ya = new Set((x ?? []).map((i) => i.id));
        return [...(x ?? []), ...r.incidentes.filter((i) => !ya.has(i.id))];
      });
      setMas(r.mas); setFalloMas(false);
    } catch (e) { setFalloMas(true); toast(mensajeError(e, t, existe), 6000); } finally { pidiendo.current = false; setCargandoMas(false); }
  }, [t, existe]);

  const cola = useCola(usuario.id);
  // cada vez que se publica algo guardado sin señal, la lista se pone al día
  useEffect(() => { void cargar(); }, [cargar, cola.enviados]);
  const irALista = () => document.getElementById("inc-lista")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
      {tiene(usuario, "incidentes.crear") && <AsistenteIncidente usuario={usuario} alPublicar={cargar} irALista={irALista} />}
      <section className={K.ficha} aria-labelledby="inc-lista">
        <h2 id="inc-lista" className={K.h2}>{t(tiene(usuario, "incidentes.gestionar") ? "panel.inc.lista" : "panel.inc.lista_mios")}</h2>
        {cola.items.length > 0 && <PorEnviar items={cola.items} enviando={cola.enviando} />}
        <div className="mt-2" aria-busy={cargandoMas}>
          {error ? <ErrorCarga texto={mensajeError(error, t, existe)} reintentar={() => void cargar()} />
            : !lista ? <Esperando>{[0, 1, 2].map((i) => <EsqueletoItemLista key={i} />)}</Esperando>
            : !lista.length ? <p className={K.vacio}>{t("panel.inc.vacio")}</p>
            : <>
              {lista.map((r) => <FilaIncidente key={r.id} r={r} usuario={usuario} alCambiar={cargar} />)}
              {mas ? (
                <>
                  <Centinela activo={!cargandoMas && !falloMas} alVer={() => void cargarMas()} />
                  {cargandoMas
                    ? <div role="status"><span className="sr-only">{t("panel.inc.cargando_mas")}</span><Esperando><EsqueletoItemLista /></Esperando></div>
                    : <button type="button" onClick={() => void cargarMas()} className={`${K.btnNeutro} mt-3 w-full`}>{t("panel.inc.ver_mas")}</button>}
                </>
              ) : lista.length > PAGINA && <p className={`${K.mini} pt-3 text-center`}>{t("panel.inc.fin_lista")}</p>}
            </>}
        </div>
      </section>
    </div>
  );
}

/** Marca invisible al final de la lista: al acercarse a la vista (400 px antes) pide la tanda siguiente. */
function Centinela({ activo, alVer }: { activo: boolean; alVer: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(alVer);
  useEffect(() => { cb.current = alVer; }, [alVer]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !activo || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) cb.current(); }, { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [activo]);
  return <div ref={ref} aria-hidden="true" className="h-px" />;
}

/** Incidentes guardados en este equipo, esperando señal para publicarse solos. */
function PorEnviar({ items, enviando }: { items: IncidenteEnCola[]; enviando: boolean }) {
  const { t, hora } = useI18n();
  return (
    <div className="mt-3 rounded-2xl bg-suelo p-3.5">
      <p role="status" className="flex items-start gap-2 text-sm font-semibold text-texto">
        <Icono id={enviando ? "nube" : "sinred"} className={`mt-0.5 size-5 shrink-0 text-tinta ${enviando ? "animate-pulse" : ""}`} />
        {t(enviando ? "panel.cola.enviando" : "panel.cola.explica", { n: items.length })}
      </p>
      <ul className="mt-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-start gap-3 border-t border-regla py-2.5 first:border-t-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-papel text-tinta"><Icono id={"t-" + it.cuerpo.tipo} className="size-4.5" /></span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                {t("tipo." + it.cuerpo.tipo)}<span className={K.pildora.pendiente}>{t("panel.cola.pildora")}</span>
              </p>
              <p className={`${K.mini} mt-0.5`}>{t("panel.cola.guardado_a", { hora: hora(it.creado) })}</p>
              <p className="mt-1 line-clamp-2 text-sm break-words">{it.cuerpo.descripcion}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilaIncidente({ r, usuario, alCambiar }: { r: Reporte; usuario: Usuario; alCambiar: () => Promise<void> }) {
  const { t, existe, hora } = useI18n();
  const [ocupado, setOcupado] = useState(false);
  const abierto = r.estado !== "resuelto" && r.estado !== "retirado" && r.estado !== "descartado";
  const puede = abierto && puedeGestionarIncidente(usuario, r);
  // solo superadmin: volver a presentar uno retirado y borrarlo para siempre
  const puedeReactivar = r.estado === "retirado" && tiene(usuario, "incidentes.reactivar");
  const puedeEliminar = tiene(usuario, "incidentes.eliminar");

  async function cambiar(estado: "resuelto" | "retirado") {
    if (!(await confirmar(t(estado === "retirado" ? "panel.inc.confirmar_retirar" : "panel.inc.confirmar_resolver")))) return;
    setOcupado(true);
    try {
      await api("/api/panel/incidentes/" + encodeURIComponent(r.id), { estado });
      toast(t(estado === "retirado" ? "panel.inc.retirado" : "panel.inc.resuelto"));
      await alCambiar();
    } catch (e) { toast(mensajeError(e, t, existe), 6000); } finally { setOcupado(false); }
  }

  async function accionSuper(accion: "reactivar" | "eliminar") {
    const eliminar = accion === "eliminar";
    if (!(await confirmar(t(eliminar ? "panel.inc.confirmar_eliminar" : "panel.inc.confirmar_reactivar"),
      t(eliminar ? "panel.inc.eliminar" : "panel.inc.reactivar")))) return;
    setOcupado(true);
    try {
      await api(`/api/panel/incidentes/${encodeURIComponent(r.id)}/${accion}`, {});
      toast(t(eliminar ? "panel.inc.eliminado" : "panel.inc.reactivado"));
      await alCambiar();
    } catch (e) { toast(mensajeError(e, t, existe), 6000); } finally { setOcupado(false); }
  }

  return (
    <article className="border-b border-regla py-3.5 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tinta-suave text-tinta"><Icono id={"t-" + r.tipo} className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 font-bold">
            {existe("tipo." + r.tipo) ? t("tipo." + r.tipo) : r.etiqueta ?? r.tipo}
            <span className={pildoraEstado(r.estado)}>{existe("estado." + r.estado) ? t("estado." + r.estado) : r.estado}</span>
          </h3>
          <p className={`${K.mini} mt-0.5`}>
            {hora(r.creado)} · {r.tipo === "calle_inundada" && r.altura_agua ? t("altura." + r.altura_agua) : t("gravedad." + r.gravedad)}
            {r.via && <> · {r.via}</>}{r.recinto && <> · {r.recinto}</>}
          </p>
          {r.descripcion && <p className="mt-1.5 text-sm break-words">{r.descripcion}</p>}
          <p className={`${K.mini} mt-1`}>
            {r.autor ? t("panel.inc.por", { nombre: `${r.autor.nombre} (${t("rol." + r.autor.rol)})` }) : t("panel.inc.equipo")}
            {abierto && <> · {t("panel.inc.vence", { hora: hora(r.expira) })}</>}
          </p>
          {r.alcance && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-texto">
              <Icono id="ojo" className="size-4 text-tinta" />{t(r.alcance.vistas === 1 ? "panel.alcance.vistas1" : "panel.alcance.vistas", { n: r.alcance.vistas })}
            </p>
          )}
          {r.alcance && r.alcance.vistas > 0 && tiene(usuario, "alcance.detalle") && <VerTelefonos tipo="incidente" id={r.id} />}
          {(puede || puedeReactivar || puedeEliminar) && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {puede && <button type="button" disabled={ocupado} onClick={() => void cambiar("resuelto")} className={K.btnChico}>{t("panel.inc.resolver")}</button>}
              {puede && <button type="button" disabled={ocupado} onClick={() => void cambiar("retirado")} className={K.btnNeutro}>{t("panel.inc.retirar")}</button>}
              {puedeReactivar && <button type="button" disabled={ocupado} onClick={() => void accionSuper("reactivar")} className={K.btnChico}>{t("panel.inc.reactivar")}</button>}
              {puedeEliminar && (
                <button type="button" disabled={ocupado} onClick={() => void accionSuper("eliminar")} className={K.btnNeutro}>
                  <Icono id="papelera" className="size-4.5" />{t("panel.inc.eliminar")}
                </button>
              )}
            </div>
          )}
        </div>
        {r.foto && <img src={`/api/foto/${encodeURIComponent(r.id)}`} alt={t("panel.rep.foto_alt")} loading="lazy" className="size-16 shrink-0 rounded-xl bg-suelo object-cover" />}
      </div>
    </article>
  );
}
