/* Vista «Mapa»: Leaflet (motor.ts) con controles propios, hojas inferiores (detalle, capas, calle inundada),
   estado en el hash y los modos «toca la calle» y «toca el lugar del problema». Se carga perezosamente. */
import { useCallback, useEffect, useRef, useState } from "react";
import { almacen } from "../../shared/almacen";
import { tramoCercano, type Tramo } from "../../shared/calles";
import { ChipCarga } from "../../shared/componentes/ChipCarga";
import { ErrorCarga } from "../../shared/componentes/ErrorCarga";
import { Icono } from "../../shared/componentes/Icono";
import { cargarAlbergues, cargarLugar, refrescarReportes } from "../../shared/datos";
import { K } from "../../shared/estilo";
import { metros, num } from "../../shared/formato";
import { useI18n } from "../../shared/i18n";
import { registrarMapa, type InfoMapa } from "../../shared/mapaControl";
import { irA } from "../../shared/navegacion";
import { UMBRAL_BARRA } from "../../shared/pendientes";
import { hashMapa, hashRecinto, leerRuta } from "../../shared/ruta";
import { store, toast, useApp } from "../../shared/store";
import type { LatLon, Territorio } from "../../shared/tipos";
import { ubicar } from "../../shared/ubicacion";
import type { LugarBuscado } from "../../shared/lugares";
import { fijarUbicacionReporte } from "../reportar/asistente";
import { BuscadorLugar } from "../lugar/Buscador";
import { modoCalle } from "./acciones";
import { capasDef, capasEncendidas, guardarCapa } from "./capas";
import { CuerpoInfo, tituloInfo } from "./HojaInfo";
import { HojaCalle } from "./HojaCalle";
import { MotorMapa, type ClaveCapa, type Fondo, type Tocado } from "./motor";

const CABEZA_HOJA = "sticky top-0 z-10 bg-papel pt-2 pb-3";
const ASA = <span className="mx-auto mb-2 block h-1.5 w-10 rounded-full bg-regla md:hidden" aria-hidden="true"></span>;
const BTN_CERRAR = "grid size-9 shrink-0 place-items-center rounded-full bg-suelo text-gris";

export default function Mapa() {
  const terr = useApp((s) => s.terr);
  if (!terr) return <MapaVacio />;
  return <MapaListo terr={terr} />;
}

/** Sin territorio todavía: «Cargando el mapa…» mientras llega; si falló sin copia guardada, el error con «Reintentar». */
function MapaVacio() {
  const { t } = useI18n();
  const activa = useApp((s) => s.vista === "mapa");
  const error = useApp((s) => s.arranque === "error");
  return (
    <section id="v-mapa" aria-busy={!error}
      className={`vista hidden bg-cielo-2 [&.activa]:fixed [&.activa]:inset-x-0 [&.activa]:top-14 [&.activa]:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] [&.activa]:block lg:[&.activa]:bottom-0 ${activa ? "activa" : ""}`}>
      {error ? <ErrorCarga texto={t("app.mapa.error")} className="mx-auto mt-5 max-w-lg" />
        : <div className="grid h-full place-items-center"><ChipCarga texto={t("app.carga.mapa")} /></div>}
    </section>
  );
}

/** «Cargando capas…» solo si la descarga pasa de 400 ms (las capas guardadas no hacen parpadear nada). */
function useCapasBajando(n: number): boolean {
  const [ver, setVer] = useState(false);
  const bajando = n > 0;
  useEffect(() => {
    if (!bajando) return;
    const h = setTimeout(() => setVer(true), UMBRAL_BARRA);
    return () => { clearTimeout(h); setVer(false); };
  }, [bajando]);
  return ver && bajando;
}

function MapaListo({ terr }: { terr: Territorio }) {
  const { t } = useI18n();
  const activa = useApp((s) => s.vista === "mapa");
  const estado = useApp((s) => s.estado);
  const reportes = useApp((s) => s.reportes);
  const modo = useApp((s) => s.modoMapa);
  const ubicRep = useApp((s) => s.rep.ubic);
  const albergues = useApp((s) => s.albergues);
  const ruta = useApp((s) => s.ruta);

  const contenedor = useRef<HTMLDivElement>(null);
  const [motor, setMotor] = useState<MotorMapa | null>(null);
  const [info, setInfo] = useState<Tocado | null>(null);
  const [verCapas, setVerCapas] = useState(false);
  const [tramo, setTramo] = useState<Tramo | null>(null);
  const [capasOn, setCapasOn] = useState(capasEncendidas);
  const [capasPend, setCapasPend] = useState(0);
  const verCargaCapas = useCapasBajando(capasPend);
  const [fondo, setFondo] = useState<Fondo>(() => (almacen.get<string>("fondo", "osm") === "sat" ? "sat" : "osm"));
  const hojaInfo = useRef<HTMLDivElement>(null);
  const hojaCapas = useRef<HTMLDivElement>(null);

  // lo que necesitan los manejadores de Leaflet sin volver a crear el mapa
  const vivo = useRef({ info, verCapas, activa, motor });
  useEffect(() => { vivo.current = { info, verCapas, activa, motor }; });
  /** hasta fijar la vista inicial no se escribe el hash (se perdería el enlace con el que se abrió) */
  const vistaLista = useRef(false);

  /** Vista en el hash: #mapa/recinto/<id> con un recinto abierto, si no #mapa/z/lat/lon. */
  const guardarVista = useCallback(() => {
    const { motor: m, activa: a, info: i } = vivo.current;
    if (!m || !a || !vistaLista.current) return;
    if (i?.tipo === "recinto") return history.replaceState(null, "", hashRecinto(i.id));
    const c = m.mapa.getCenter();
    history.replaceState(null, "", hashMapa(m.mapa.getZoom(), c.lat, c.lng));
  }, []);

  const cerrarHojas = useCallback(() => {
    setInfo(null);
    setVerCapas(false);
    vivo.current.motor?.quitarSeleccion();
  }, []);

  /** Abre la hoja de detalle y resalta lo tocado. En los modos de reporte no se abre nada. */
  const abrirInfo = useCallback((o: Tocado): boolean => {
    const m = vivo.current.motor;
    if (store.get().modoMapa || !m) return false;
    setVerCapas(false);
    setInfo(o);
    if (o.tipo === "recinto") {
      const p = terr.recintos[o.id];
      if (p) m.resaltar({ latlng: [p.lat, p.lon] });
    } else if (o.tipo === "albergue") m.resaltar({ latlng: [o.a.lat, o.a.lon] });
    else if (o.tipo === "calle" || o.tipo === "reporte") {
      m.resaltar(o.r.tramo && o.r.tramo.length > 1 ? { linea: o.r.tramo } : { latlng: [o.r.lat, o.r.lon] });
    } else if (o.tipo === "punto" || o.tipo === "equip") m.resaltar({ latlng: o.latlng });
    else if ("f" in o) m.resaltar({ geo: o.f });
    return true;
  }, [terr]);

  /** Un toque en el mapa vacío: elige la calle, fija el lugar del reporte o cierra las hojas. */
  const alClicMapa = useCallback(async ([lat, lon]: LatLon) => {
    const modoActual = store.get().modoMapa;
    const m = vivo.current.motor;
    if (modoActual === "calle") {
      const tr = await tramoCercano(lat, lon).catch(() => null);
      if (!tr) return toast(t("app.toast.toca_calle"));
      setTramo(tr);
      m?.tramoTemporal(tr.coords);
      m?.encimaDeLaHoja(tr.punto);
      return;
    }
    if (modoActual === "reporte") return fijarUbicacionReporte(lat, lon, "mapa");
    if (vivo.current.info || vivo.current.verCapas) cerrarHojas();
  }, [cerrarHojas, t]);

  // ---------- montar el mapa una sola vez ----------
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const h = leerRuta(location.hash).mapa;
    vistaLista.current = false;
    const m = new MotorMapa(el, terr, {
      alTocar: (o) => abrirInfo(o),
      alClic: (ll) => void alClicMapa(ll),
      alMover: () => guardarVista(),
      errorCapa: (k) => toast(k === "limite" ? t("app.mapa.error") : t("app.toast.capa", { capa: t("app.capa." + k) })),
      sinTeselas: () => toast(t("app.toast.teselas")),
      capasPendientes: setCapasPend,
    }, fondo);
    vivo.current.motor = m;
    setMotor(m);
    const on = capasEncendidas();
    for (const g of capasDef()) for (const i of g.items) if (on[i.k]) m.encender(i.k, true);

    // vista inicial: enlace compartido > lugar guardado > todo el cantón
    void m.cargarLimite().then(() => {
      if (m.destruido) return;
      const lugar = store.get().lugar;
      const recH = h && "recinto" in h ? terr.recintos[h.recinto] : undefined;
      if (recH) m.mapa.setView([recH.lat, recH.lon], 15);
      else if (h && "z" in h) m.mapa.setView([h.lat, h.lon], h.z);
      else if (lugar?.tipo === "punto") m.mapa.setView([lugar.lat, lugar.lon], 15);
      else if (lugar?.tipo === "recinto" && terr.recintos[lugar.id]) {
        const r = terr.recintos[lugar.id];
        if (r) m.mapa.setView([r.lat, r.lon], 14);
      } else m.verCanton(false);
      vistaLista.current = true;
      if (recH) abrirInfo({ tipo: "recinto", id: recH.id });
      guardarVista();
      // las otras vistas pueden pedir cosas al mapa recién ahora (no las pisa la vista inicial)
      registrarMapa({
        // el mapa puede estar recién mostrado: se espera un instante y se recalcula su tamaño
        irAlPunto: (ll, z, luego?: InfoMapa) => setTimeout(() => {
          m.mapa.invalidateSize();
          if (luego) m.mapa.once("moveend", () => abrirInfo(luego.tipo === "reporte"
            ? { tipo: luego.r.tipo === "calle_inundada" ? "calle" : "reporte", r: luego.r } : luego));
          m.irAlPunto(ll, z);
        }, 80),
        cerrarHojas,
        zoom: () => m.mapa.getZoom(),
      });
    });

    return () => m.destruir();
    // el mapa se crea una sola vez; lo que cambia llega por los efectos de abajo
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- datos vivos ----------
  useEffect(() => { motor?.refrescarEstado(estado); }, [motor, estado]);
  useEffect(() => { motor?.pintarReportes(reportes); }, [motor, reportes]);
  useEffect(() => { motor?.marcadorReporte(ubicRep ? [ubicRep.lat, ubicRep.lon] : null); }, [motor, ubicRep]);
  useEffect(() => { motor?.pintarAlbergues(albergues); }, [motor, albergues]);
  // la ruta nueva se dibuja y se encuadra; tu ubicación queda marcada en el inicio
  useEffect(() => {
    if (!motor) return;
    motor.dibujarRuta(ruta?.linea ?? null);
    if (ruta) motor.ubicacion(ruta.desde, 20, t("app.tu_ubicacion"));
  }, [motor, ruta, t]);

  // al mostrarse: recalcula el tamaño, recarga los reportes y guarda la vista
  useEffect(() => {
    if (!activa || !motor) return;
    const h = setTimeout(() => motor.mapa.invalidateSize(), 60);
    void refrescarReportes();
    void cargarAlbergues();
    guardarVista();
    return () => clearTimeout(h);
  }, [activa, motor, guardarVista]);

  useEffect(() => { guardarVista(); }, [info, guardarVista]);

  // un enlace #mapa/… nuevo con el mapa ya montado
  useEffect(() => {
    const alCambiar = () => {
      const h = leerRuta(location.hash).mapa;
      if (!h || !motor) return;
      if ("recinto" in h) {
        const r = terr.recintos[h.recinto];
        if (r) { motor.mapa.setView([r.lat, r.lon], 15); abrirInfo({ tipo: "recinto", id: r.id }); }
      } else if ("z" in h) motor.mapa.setView([h.lat, h.lon], h.z);
    };
    window.addEventListener("hashchange", alCambiar);
    return () => window.removeEventListener("hashchange", alCambiar);
  }, [motor, terr, abrirInfo]);

  // entrar en un modo cierra las hojas; salir del modo calle quita el tramo elegido
  useEffect(() => {
    let previo = store.get().modoMapa;
    return store.subscribe(() => {
      const m = store.get().modoMapa;
      if (m === previo) return;
      previo = m;
      if (m) cerrarHojas();
      if (m !== "calle") { setTramo(null); vivo.current.motor?.tramoTemporal(null); }
    });
  }, [cerrarHojas]);

  // la hoja abierta empieza arriba y con el foco en «Cerrar»
  useEffect(() => {
    const h = info ? hojaInfo.current : verCapas ? hojaCapas.current : null;
    if (!h) return;
    h.scrollTop = 0;
    h.querySelector<HTMLElement>("[data-cerrar]")?.focus({ preventScroll: true });
  }, [info, verCapas]);

  const cancelarModo = useCallback(() => store.set({ modoMapa: null }), []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (store.get().modoMapa) cancelarModo();
      else cerrarHojas();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [cancelarModo, cerrarHojas]);

  const calleAqui = (ll: LatLon) => {
    cerrarHojas();
    motor?.irAlPunto(ll, 16);
    void modoCalle();
  };
  const verLugar = (id: number) => {
    cerrarHojas();
    void cargarLugar({ tipo: "recinto", id });
    irA("inicio");
  };

  const ubicarme = async () => {
    try {
      const u = await ubicar();
      motor?.ubicacion([u.lat, u.lon], u.prec, t("app.tu_ubicacion"));
      motor?.irAlPunto([u.lat, u.lon], 16);
      toast(t("app.toast.ubic", { m: num(u.prec) }));
    } catch (e) { toast((e as Error).message, 5000); }
  };

  /** Elegir un lugar en el buscador: el mapa va ahí y, si es un recinto, abre su hoja. */
  const irAEnMapa = (l: LugarBuscado): boolean => {
    if (!motor) return false;
    motor.irAlPunto([l.lat, l.lon], l.calle ? 17 : 15);
    if (l.tipo === "recinto") motor.mapa.once("moveend", () => abrirInfo({ tipo: "recinto", id: l.id }));
    return true;
  };

  const cambiarCapa = (k: ClaveCapa, on: boolean) => {
    motor?.encender(k, on);
    guardarCapa(k, on);
    setCapasOn((c) => ({ ...c, [k]: on }));
  };
  const cambiarFondo = (f: Fondo) => {
    motor?.fondo(f);
    almacen.set("fondo", f);
    setFondo(f);
  };

  const avisoModo = !!modo && !(modo === "calle" && tramo);
  const centro: LatLon = motor ? [motor.mapa.getCenter().lat, motor.mapa.getCenter().lng] : [0, 0];
  const recintoNombre = (id: number) => terr.recintos[id]?.nombre ?? "";

  return (
    <section id="v-mapa" aria-label={t("app.sec.mapa")}
      className={`vista hidden [&.activa]:fixed [&.activa]:inset-x-0 [&.activa]:top-14 [&.activa]:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] [&.activa]:block lg:[&.activa]:bottom-0 ${activa ? "activa" : ""}${modo ? " modo-reporte" : ""}`}>
      <div ref={contenedor} id="mapa" aria-label={t("app.mapa.etq")} className="absolute inset-0"></div>

      <div className="absolute inset-x-3 top-3 z-[1002] flex gap-2 md:right-auto md:w-[30rem]">
        <BuscadorLugar id="buscar-mapa" etiqueta={t("app.mapa.buscar.etq")} placeholder={t("app.mapa.buscar.ph")}
          alElegir={irAEnMapa} alNoEncontrar={() => toast(t("app.toast.no_mapa"))}
          className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-papel/95 pr-1.5 pl-4 text-gris shadow-flota backdrop-blur focus-within:ring-4 focus-within:ring-tinta/15" />
        <button type="button" aria-expanded={verCapas} aria-controls="hoja-capas" aria-label={t("app.capas")} title={t("app.capas")}
          onClick={() => { if (verCapas) cerrarHojas(); else { setInfo(null); motor?.quitarSeleccion(); setVerCapas(true); } }}
          className="grid size-12 place-items-center rounded-2xl bg-papel/95 text-tinta shadow-flota backdrop-blur active:scale-95 aria-expanded:bg-tinta aria-expanded:text-white">
          <Icono id="i-capas" />
        </button>
      </div>
      <div hidden={!avisoModo} className="absolute inset-x-3 top-[4.25rem] z-[1003] flex min-h-12 items-center gap-2.5 rounded-2xl bg-negro/90 py-1.5 pr-1.5 pl-4 font-semibold text-white shadow-flota backdrop-blur md:right-auto md:w-[30rem]">
        <span className="flex-1">{modo ? t(modo === "calle" ? "app.modo.calle" : "app.modo.reporte") : ""}</span>
        <button type="button" onClick={cancelarModo} className="h-9 rounded-full bg-white/15 px-3.5 text-sm font-semibold">{t("app.cancelar")}</button>
      </div>

      {verCargaCapas ? (
        <div className={`pointer-events-none absolute inset-x-0 top-[4.25rem] z-[1002] flex justify-center [&.bajo]:top-[7.75rem] ${modo ? "bajo" : ""}`}>
          <ChipCarga texto={t("app.carga.capas")} />
        </div>
      ) : null}

      <div className={`absolute top-[4.25rem] right-3 z-[1002] flex flex-col gap-2 [&.bajo]:top-[7.75rem] ${modo ? "bajo" : ""}`}>
        <div className="flex flex-col overflow-hidden rounded-2xl bg-papel/95 shadow-flota backdrop-blur">
          <button type="button" onClick={() => motor?.mapa.zoomIn()} aria-label={t("app.zoom.mas")} title={t("app.zoom.mas")} className="grid size-12 place-items-center text-texto active:bg-suelo"><Icono id="i-mas" className="size-5" /></button>
          <span className="mx-2.5 h-px bg-regla" aria-hidden="true"></span>
          <button type="button" onClick={() => motor?.mapa.zoomOut()} aria-label={t("app.zoom.menos")} title={t("app.zoom.menos")} className="grid size-12 place-items-center text-texto active:bg-suelo"><Icono id="i-menos" className="size-5" /></button>
        </div>
        <button type="button" onClick={ubicarme} aria-label={t("app.ubicarme")} title={t("app.ubicarme")} className="grid size-12 place-items-center rounded-2xl bg-papel/95 text-tinta shadow-flota backdrop-blur active:scale-95"><Icono id="i-gps" className="size-5" /></button>
        <button type="button" onClick={() => motor?.verCanton()} aria-label={t("app.canton")} title={t("app.canton")} className="grid size-12 place-items-center rounded-2xl bg-papel/95 text-texto shadow-flota backdrop-blur active:scale-95"><Icono id="i-canton" className="size-5" /></button>
        <button type="button" onClick={() => irA("tormentas")} aria-label={t("app.torm.titulo")} title={t("app.torm.titulo")} className="grid size-12 place-items-center rounded-2xl bg-papel/95 text-tinta shadow-flota backdrop-blur active:scale-95"><Icono id="i-tormenta" className="size-5.5" /></button>
      </div>

      {/* resumen de la ruta a un albergue, sobre los botones de reporte */}
      {ruta && !modo && !info && !verCapas ? (
        <div role="status" className="absolute inset-x-3 bottom-[4.75rem] z-[1002] flex items-center gap-3 rounded-2xl bg-papel p-3 shadow-flota md:left-auto md:w-[26rem]">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tinta text-white"><Icono id="i-ruta" className="size-5" /></span>
          <button type="button" onClick={() => abrirInfo({ tipo: "albergue", a: ruta.albergue })} className="min-w-0 flex-1 text-left">
            <b className="block truncate leading-tight">{t("app.alb.ruta_a", { nombre: ruta.albergue.nombre })}</b>
            <span className="block text-sm text-gris">{t("app.alb.resumen." + ruta.modo, { dist: metros(ruta.metros), min: Math.max(1, Math.round(ruta.segundos / 60)) })}</span>
            {ruta.cruzaAgua ? <span className="mt-0.5 flex items-start gap-1 text-sm font-semibold text-texto"><Icono id="i-alerta" className="mt-0.5 size-4 shrink-0 text-tinta" />{t("app.alb.cruza_agua")}</span> : null}
          </button>
          <button type="button" onClick={() => store.set({ ruta: null })} aria-label={t("app.alb.quitar_ruta")} title={t("app.alb.quitar_ruta")} className={BTN_CERRAR}><Icono id="i-x" className="size-5" /></button>
        </div>
      ) : null}

      <div hidden={!!modo} className="absolute inset-x-3 bottom-3 z-[1002] grid grid-cols-[1.2fr_1fr] gap-2 md:left-auto md:w-[26rem]">
        <button type="button" onClick={() => void modoCalle()} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-tinta px-3 font-semibold text-white shadow-flota transition hover:bg-tinta-2 active:scale-[.98]"><Icono id="i-ola" className="size-5" /><span>{t("app.btn.calle")}</span></button>
        <button type="button" onClick={() => store.set({ modoMapa: "reporte" })} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-papel px-3 font-semibold text-tinta shadow-flota active:scale-[.98]"><Icono id="i-pin" className="size-5" /><span>{t("app.btn.otro")}</span></button>
      </div>

      {/* hoja: detalle de lo que se toca en el mapa */}
      <div ref={hojaInfo} role="dialog" aria-modal="false" aria-labelledby="info-titulo" hidden={!info} className={K.hoja}>
        <div className={CABEZA_HOJA}>
          {ASA}
          <div className="flex items-start justify-between gap-3">
            <h2 id="info-titulo" className="pt-1 text-xl leading-tight font-bold text-balance">{info ? tituloInfo(info, t, recintoNombre) : ""}</h2>
            <button type="button" data-cerrar onClick={cerrarHojas} aria-label={t("app.cerrar")} className={BTN_CERRAR}><Icono id="i-x" className="size-5" /></button>
          </div>
        </div>
        <div>{info ? <CuerpoInfo o={info} centro={centro} onVerLugar={verLugar} onCalleAqui={calleAqui} onRutaLista={cerrarHojas} /> : null}</div>
      </div>

      {/* hoja: capas y leyenda */}
      <div ref={hojaCapas} id="hoja-capas" role="dialog" aria-modal="false" aria-labelledby="capas-titulo" hidden={!verCapas} className={K.hoja}>
        <div className={CABEZA_HOJA}>
          {ASA}
          <div className="flex items-start justify-between gap-3">
            <h2 id="capas-titulo" className="pt-1 text-xl leading-tight font-bold">{t("app.capas.titulo")}</h2>
            <button type="button" data-cerrar onClick={cerrarHojas} aria-label={t("app.cerrar")} className={BTN_CERRAR}><Icono id="i-x" className="size-5" /></button>
          </div>
        </div>
        <div role="radiogroup" aria-label={t("app.fondo.etq")} className="grid grid-cols-2 gap-1 rounded-2xl bg-suelo p-1">
          {(["osm", "sat"] as Fondo[]).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={fondo === f} onClick={() => cambiarFondo(f)}
              className="min-h-10 rounded-xl text-sm font-semibold text-gris aria-checked:bg-papel aria-checked:text-texto aria-checked:shadow-ficha">{t("app.fondo." + f)}</button>
          ))}
        </div>
        <div>
          {capasDef().map((g) => (
            <div key={g.grupo} className="mt-4">
              <h3 className="mb-1 text-sm font-semibold text-gris">{g.grupo}</h3>
              {g.nota ? <p className="mb-2 text-[.85rem] text-gris">{g.nota}</p> : null}
              <div className="rounded-2xl bg-suelo px-3.5">
                {g.items.map((i) => (
                  <label key={i.k} className="flex cursor-pointer items-center gap-3 border-b border-regla py-3 last:border-0">
                    <span className="min-w-0 flex-1"><b className="block text-sm font-semibold">{t("app.capa." + i.k)}</b><span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[.78rem] text-gris">{i.ley}</span></span>
                    <input type="checkbox" checked={!!capasOn[i.k]} onChange={(e) => cambiarCapa(i.k, e.target.checked)} className="peer sr-only" />
                    <span aria-hidden="true" className="relative h-7 w-12 shrink-0 rounded-full bg-regla transition peer-checked:bg-tinta peer-focus-visible:ring-4 peer-focus-visible:ring-tinta/25 peer-checked:[&>span]:translate-x-5"><span className="absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow-flota transition"></span></span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <HojaCalle tramo={modo === "calle" ? tramo : null} onCancelar={cancelarModo} />
    </section>
  );
}
