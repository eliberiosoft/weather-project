/* Mapa en vivo del superadmin (dashboard.ver): todos los eventos activos a pantalla completa.
   - Agrupados con contador; doble toque (o doble clic) en un grupo lo abre: acerca el mapa o, si están en el mismo
     punto, los abanica. Un toque solo explica cómo abrirlo.
   - Tocar un evento abre la barra lateral (abajo en el celular) con lo reportado y «Ver ruta»: ruta en auto o a pie
     desde el GPS, con tiempo y distancia (OSRM de OpenStreetMap Alemania; no sabe qué calles están inundadas).
   - Se refresca cada 3 minutos sin mover la vista; lo nuevo se resalta hasta el siguiente refresco.
   Simbología (skill cartografia-riesgo): los reportes no son niveles, así que nada del semáforo. Por revisar: borde
   discontinuo; verificado: borde negro grueso; del equipo: fondo oscuro; calle inundada: color del agua. */
import { FotosReporte } from "../../shared/ui/FotosReporte";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "./tablero.css";
import urlLimite from "@compartido/capas/limite_canton.geojson?url";
import { api, mensajeError } from "../../shared/api/cliente";
import type { EventoMapa } from "../../shared/api/tipos";
import { useI18n } from "../../shared/i18n/useI18n";
import { ErrorCarga } from "../../shared/ui/Carga";
import { Icono } from "../../shared/ui/Icono";
import { K } from "../../shared/ui/clases";
import { toast } from "../../shared/ui/avisos";
import { TIPOS } from "../incidentes/formulario";
import { CADA_MS, contar, distancia, duracion, esEquipo, leerRuta, nuevos, pasaFiltro, urlRuta, type Filtro, type Modo, type Ruta } from "./datos";

const TINTA = "#1d5f84", CIELO = "#3bb3e8";
const AGUA: Record<number, string> = { 1: "#6baed6", 2: "#2171b5", 3: "#08306b" };

/** Clases del marcador según quién lo reportó y su estado (escritas completas para que Tailwind las encuentre). */
function claseMarcador(e: EventoMapa, nuevo: boolean, elegido: boolean): string {
  const calle = e.tipo === "calle_inundada";
  const fondo = calle ? (e.altura_agua === 1 ? "bg-a1 text-negro" : e.altura_agua === 3 ? "bg-a3 text-white" : "bg-a2 text-white")
    : esEquipo(e) ? "bg-negro text-white" : "bg-papel text-tinta";
  const borde = esEquipo(e) ? "border-2 border-white" : e.estado === "pendiente" ? "border-[3px] border-dashed border-tinta" : "border-[3px] border-negro";
  const extra = elegido ? "scale-125 ring-4 ring-tinta" : nuevo ? "ring-4 ring-cielo motion-safe:animate-pulse" : "";
  return `grid size-9 place-items-center rounded-full shadow-flota transition-transform ${fondo} ${borde} ${extra}`;
}

function iconoGrupo(c: L.MarkerCluster, hayNuevos: (ids: string[]) => boolean): L.DivIcon {
  const hijos = c.getAllChildMarkers();
  const n = hijos.length;
  const tam = n < 10 ? "size-10 text-sm" : n < 100 ? "size-12 text-base" : "size-14 text-base";
  const px = n < 10 ? 40 : n < 100 ? 48 : 56;
  const nuevo = hayNuevos(hijos.map((m) => (m.options as { idEvento?: string }).idEvento ?? ""));
  return L.divIcon({
    className: "",
    iconSize: [px, px],
    html: `<span class="relative grid ${tam} place-items-center rounded-full bg-tinta font-bold text-white tabular-nums ring-4 ring-white/85 shadow-flota">${n}`
      + (nuevo ? '<span class="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-cielo ring-2 ring-white"></span>' : "")
      + "</span>",
  });
}

export default function Tablero() {
  const { t, existe, hora } = useI18n();
  const caja = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLDivElement>(null);
  const iconos = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const grupo = useRef<L.MarkerClusterGroup | null>(null);
  const capaRuta = useRef<L.LayerGroup | null>(null);
  const capaTramo = useRef<L.Polyline | null>(null);
  const svgTipo = useRef<Map<string, string>>(new Map());
  const vistos = useRef<Set<string> | null>(null);
  const [eventos, setEventos] = useState<EventoMapa[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [errorRefresco, setErrorRefresco] = useState(false);
  const [generado, setGenerado] = useState<string | null>(null);
  const [proximo, setProximo] = useState(() => Date.now() + CADA_MS);
  const [recientes, setRecientes] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [elegido, setElegido] = useState<string | null>(null);
  const [leyenda, setLeyenda] = useState(false);
  const [completa, setCompleta] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api<{ generado: string; eventos: EventoMapa[] }>("/api/panel/mapa");
      const nv = nuevos(vistos.current, r.eventos);
      vistos.current = new Set(r.eventos.map((e) => e.id));
      setRecientes(nv);
      if (nv.size) toast(t("panel.mv.nuevos", { n: nv.size }), 6000);
      setEventos(r.eventos);
      setGenerado(r.generado);
      setError(null);
      setErrorRefresco(false);
    } catch (e) {
      if (vistos.current) setErrorRefresco(true);    // ya había datos: se quedan y se avisa
      else setError(e);
    } finally {
      setProximo(Date.now() + CADA_MS);
    }
  }, [t]);

  // primera carga, cada 3 minutos y al volver a la pestaña si ya tocaba
  useEffect(() => {
    void cargar();
    const h = setInterval(() => void cargar(), CADA_MS);
    const visible = () => { if (document.visibilityState === "visible" && Date.now() >= proximoRef.current) void cargar(); };
    document.addEventListener("visibilitychange", visible);
    return () => { clearInterval(h); document.removeEventListener("visibilitychange", visible); };
  }, [cargar]);
  const proximoRef = useRef(proximo);
  useEffect(() => { proximoRef.current = proximo; }, [proximo]);

  // los íconos de cada tipo se dibujan una vez con <Icono> (oculto) y se reutilizan como HTML en los marcadores
  useEffect(() => {
    iconos.current?.querySelectorAll<HTMLElement>("[data-tipo]").forEach((el) => svgTipo.current.set(el.dataset.tipo!, el.innerHTML));
  }, []);

  // el mapa se crea una sola vez
  useEffect(() => {
    if (!lienzo.current) return;
    const m = L.map(lienzo.current, { minZoom: 10, maxZoom: 19, zoomControl: false, maxBoundsViscosity: 0.8, preferCanvas: true })
      .setView([-2.12, -79.68], 12);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    // el panel no manda Referer (no-referrer), pero la política de teselas de OSM lo exige: solo el origen, solo aquí
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap", referrerPolicy: "strict-origin" }).addTo(m);
    let vivo = true;
    fetch(urlLimite).then((r) => (r.ok ? r.json() : Promise.reject(new Error("limite")))).then((g: GeoJSON.GeoJsonObject) => {
      if (!vivo) return;
      const capa = L.geoJSON(g, { interactive: false, style: { color: "#163a52", weight: 2, dashArray: "6 5", fill: false } }).addTo(m);
      m.setMaxBounds(capa.getBounds().pad(0.4));
      m.fitBounds(capa.getBounds(), { padding: [16, 16] });
    }).catch(() => {});
    const g = L.markerClusterGroup({
      showCoverageOnHover: false, zoomToBoundsOnClick: false, spiderfyOnMaxZoom: false, maxClusterRadius: 50,
      iconCreateFunction: (c) => iconoGrupo(c, (ids) => ids.some((id) => recientesRef.current.has(id))),
    });
    // doble toque o doble clic: abrir el grupo (acercar o, si están en el mismo punto, abanicar)
    g.on("clusterdblclick", (ev: L.LeafletEvent) => {
      const c = (ev as L.LeafletEvent & { layer: L.MarkerCluster }).layer;
      const b = c.getBounds();
      if (b.getNorthEast().equals(b.getSouthWest()) || m.getZoom() >= m.getMaxZoom()) c.spiderfy();
      else c.zoomToBounds({ padding: [48, 48] });
    });
    g.on("clusterclick", () => avisoDoble());
    g.addTo(m);
    capaRuta.current = L.layerGroup().addTo(m);
    grupo.current = g;
    mapa.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(lienzo.current);
    return () => { vivo = false; ro.disconnect(); m.remove(); mapa.current = null; grupo.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const recientesRef = useRef(recientes);
  useEffect(() => { recientesRef.current = recientes; }, [recientes]);
  const avisado = useRef(false);
  const avisoDoble = () => { if (!avisado.current) { avisado.current = true; toast(t("panel.mv.doble"), 5000); } };

  const visibles = useMemo(() => (eventos ?? []).filter((e) => pasaFiltro(e, filtro)), [eventos, filtro]);

  // marcadores: se rehacen con cada refresco o filtro, sin mover la vista
  useEffect(() => {
    const g = grupo.current;
    if (!g) return;
    g.clearLayers();
    const marcas = visibles.map((e) => {
      const icono = L.divIcon({
        className: "", iconSize: [36, 36],
        html: `<span class="${claseMarcador(e, recientes.has(e.id), e.id === elegido)}">${svgTipo.current.get(e.tipo) ?? svgTipo.current.get("otro") ?? ""}</span>`,
      });
      const mk = L.marker([e.lat, e.lon], { icon: icono, keyboard: true, title: tipoTexto(e), alt: tipoTexto(e), idEvento: e.id } as L.MarkerOptions);
      mk.on("click", () => setElegido(e.id));
      return mk;
    });
    g.addLayers(marcas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibles, recientes, elegido]);

  const sel = elegido ? (eventos ?? []).find((e) => e.id === elegido) ?? null : null;
  const tipoTexto = (e: EventoMapa) => (existe("tipo." + e.tipo) ? t("tipo." + e.tipo) : e.etiqueta ?? e.tipo);

  // tramo de la calle con agua del evento elegido
  useEffect(() => {
    capaTramo.current?.remove();
    capaTramo.current = null;
    if (sel?.tramo && sel.tramo.length >= 2 && mapa.current) {
      capaTramo.current = L.polyline(sel.tramo, { color: AGUA[sel.altura_agua ?? 2], weight: 7, opacity: 0.9, lineCap: "round", interactive: false }).addTo(mapa.current);
    }
  }, [sel]);

  // pantalla completa (Fullscreen API) del tablero entero
  useEffect(() => {
    const cambio = () => { setCompleta(document.fullscreenElement === caja.current); mapa.current?.invalidateSize(); };
    document.addEventListener("fullscreenchange", cambio);
    return () => document.removeEventListener("fullscreenchange", cambio);
  }, []);
  const alternarCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void caja.current?.requestFullscreen?.().catch(() => toast(t("panel.mv.sin_completa")));
  };

  const cerrar = () => { setElegido(null); capaRuta.current?.clearLayers(); };
  const cuentas = useMemo(() => contar(eventos ?? []), [eventos]);
  const chip = (f: Filtro, n: number) => (
    <button key={f} type="button" role="radio" aria-checked={filtro === f} onClick={() => setFiltro(f)}
      className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl bg-suelo px-2.5 py-1.5 text-left font-semibold text-texto transition hover:bg-tinta-suave aria-checked:bg-tinta aria-checked:text-white sm:min-h-14 sm:flex-col sm:items-start sm:justify-center sm:gap-0">
      <span className="text-xl leading-none font-bold tabular-nums">{n}</span><span className="min-w-0 truncate text-xs sm:mt-0.5 sm:w-full">{t("panel.mv.f_" + f)}</span>
    </button>
  );

  return (
    // con la barra lateral abierta, el zoom se corre (escritorio) o se oculta (celular). Va en este contenedor y no en
    // el del mapa: Leaflet pone sus propias clases en el suyo y cambiarle className se las borraría (mapa en blanco)
    <div ref={caja} className={`relative isolate h-[calc(100dvh-4rem-4.25rem-env(safe-area-inset-bottom))] w-full overflow-hidden bg-cielo-2 lg:h-[calc(100dvh-4rem-5rem)] [&:fullscreen]:h-dvh ${elegido ? "lg:[&_.leaflet-bottom.leaflet-right]:right-[24.75rem] max-lg:[&_.leaflet-bottom.leaflet-right]:hidden" : ""}`}>
      <div ref={lienzo} role="application" aria-label={t("panel.mv.mapa_etq")} className="tablero absolute inset-0" />

      {/* íconos de cada tipo, dibujados una vez para los marcadores */}
      <div ref={iconos} hidden aria-hidden="true">
        {TIPOS.map((x) => <span key={x} data-tipo={x}><Icono id={"t-" + x} className="size-5" /></span>)}
      </div>

      {/* resumen y filtros */}
      <section aria-label={t("panel.mv.resumen")} className="absolute top-3 right-3 left-3 z-[500] rounded-2xl bg-papel p-3 shadow-flota sm:right-auto sm:w-[25rem]">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate font-bold text-texto">{t("panel.mv.titulo")}</h2>
          <button type="button" onClick={() => void cargar()} aria-label={t("panel.mv.refrescar")} title={t("panel.mv.refrescar")}
            className="grid size-10 place-items-center rounded-full bg-suelo text-tinta transition hover:bg-tinta-suave"><Icono id="recalcular" className="size-5" /></button>
          <button type="button" onClick={alternarCompleta} aria-pressed={completa} aria-label={t(completa ? "panel.mv.salir_completa" : "panel.mv.completa")} title={t(completa ? "panel.mv.salir_completa" : "panel.mv.completa")}
            className="grid size-10 place-items-center rounded-full bg-suelo text-tinta transition hover:bg-tinta-suave"><Icono id={completa ? "achicar" : "agrandar"} className="size-5" /></button>
        </div>
        <div role="radiogroup" aria-label={t("panel.mv.filtro")} className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {chip("todos", cuentas.todos)}{chip("pendiente", cuentas.pendiente)}{chip("validado", cuentas.validado)}{chip("equipo", cuentas.equipo)}
        </div>
        <p role="status" className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-gris">
          {generado && <span>{t("panel.mv.actualizado", { hora: hora(generado) })}</span>}
          <Cuenta hasta={proximo} />
          {errorRefresco && <span className="font-semibold text-texto">{t("panel.mv.error_refresco")}</span>}
        </p>
      </section>

      {/* leyenda en palabras de vecino */}
      <div className="absolute bottom-3 left-3 z-[500] max-w-[calc(100%-5rem)]">
        {leyenda ? (
          <div className="rounded-2xl bg-papel p-3 text-sm shadow-flota">
            <div className="mb-2 flex items-center justify-between gap-4"><b>{t("panel.mv.leyenda")}</b>
              <button type="button" onClick={() => setLeyenda(false)} aria-label={t("panel.cerrar")} className="grid size-8 place-items-center rounded-full bg-suelo text-gris"><Icono id="cerrar" className="size-4" /></button>
            </div>
            <ul className="grid gap-1.5">
              <Clave muestra={<span className="block size-5 rounded-full border-[3px] border-dashed border-tinta bg-papel" />}>{t("panel.mv.l_pendiente")}</Clave>
              <Clave muestra={<span className="block size-5 rounded-full border-[3px] border-negro bg-papel" />}>{t("panel.mv.l_verificado")}</Clave>
              <Clave muestra={<span className="block size-5 rounded-full border-2 border-white bg-negro" />}>{t("panel.mv.l_equipo")}</Clave>
              <Clave muestra={<span className="flex gap-0.5"><span className="block size-3 rounded-full bg-a1" /><span className="block size-3 rounded-full bg-a2" /><span className="block size-3 rounded-full bg-a3" /></span>}>{t("panel.mv.l_agua")}</Clave>
              <Clave muestra={<span className="grid size-5 place-items-center rounded-full bg-tinta text-[10px] font-bold text-white">5</span>}>{t("panel.mv.l_grupo")}</Clave>
              <Clave muestra={<span className="block size-5 rounded-full bg-papel ring-4 ring-cielo" />}>{t("panel.mv.l_nuevo")}</Clave>
            </ul>
          </div>
        ) : (
          <button type="button" onClick={() => setLeyenda(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-papel px-4 text-sm font-semibold text-tinta shadow-flota">
            <Icono id="capas" className="size-4.5" />{t("panel.mv.leyenda")}
          </button>
        )}
      </div>

      {error && !eventos ? (
        <div className="absolute inset-x-3 top-1/3 z-[600] mx-auto max-w-md rounded-2xl bg-papel p-4 shadow-flota">
          <ErrorCarga texto={mensajeError(error, t, existe)} reintentar={() => void cargar()} />
        </div>
      ) : eventos && !visibles.length ? (
        <p role="status" className="absolute inset-x-3 top-1/2 z-[500] mx-auto max-w-sm rounded-2xl bg-papel p-4 text-center text-sm font-semibold shadow-flota">
          {t(eventos.length ? "panel.mv.vacio_filtro" : "panel.mv.vacio")}
        </p>
      ) : null}

      {elegido && <Detalle e={sel} cerrar={cerrar} mapa={mapa} capa={capaRuta} />}
    </div>
  );
}

function Clave({ muestra, children }: { muestra: ReactNode; children: ReactNode }) {
  return <li className="flex items-center gap-2.5"><span className="grid w-10 shrink-0 place-items-center">{muestra}</span><span>{children}</span></li>;
}

/** «próximo en 2:31», una vez por segundo sin repintar el mapa. */
function Cuenta({ hasta }: { hasta: number }) {
  const { t } = useI18n();
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => { const h = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(h); }, []);
  const s = Math.max(0, Math.round((hasta - ahora) / 1000));
  return <span className="tabular-nums">{t("panel.mv.proximo", { t: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` })}</span>;
}

/** Barra lateral (abajo en el celular) con lo reportado y la ruta para llegar. */
function Detalle({ e, cerrar, mapa, capa }: {
  e: EventoMapa | null; cerrar: () => void; mapa: RefObject<L.Map | null>; capa: RefObject<L.LayerGroup | null>;
}) {
  const { t, existe, hora } = useI18n();
  const [modo, setModo] = useState<Modo>("auto");
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [estado, setEstado] = useState<"" | "buscando" | "gps" | "error" | "sin_ruta">("");
  const titulo = useRef<HTMLHeadingElement>(null);
  const id = e?.id;
  useEffect(() => { setRuta(null); setEstado(""); capa.current?.clearLayers(); titulo.current?.focus(); }, [id, capa]);
  useEffect(() => {
    const esc = (ev: KeyboardEvent) => { if (ev.key === "Escape") cerrar(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [cerrar]);

  async function verRuta(m: Modo) {
    if (!e || !mapa.current) return;
    setModo(m); setEstado("buscando"); setRuta(null);
    let pos: GeolocationPosition;
    try {
      pos = await new Promise<GeolocationPosition>((ok, mal) => {
        if (!navigator.geolocation) return mal(new Error("sin gps"));
        navigator.geolocation.getCurrentPosition(ok, mal, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
      });
    } catch { setEstado("gps"); return; }
    const desde: [number, number] = [pos.coords.latitude, pos.coords.longitude];
    try {
      // el servicio pide saber desde dónde se usa: solo el origen, como las teselas
      const r = await fetch(urlRuta(m, desde, [e.lat, e.lon]), { referrerPolicy: "strict-origin", credentials: "omit" });
      const ru = leerRuta(await r.json());
      if (!ru) { setEstado("sin_ruta"); return; }
      const g = capa.current, mp = mapa.current;
      if (!g || !mp) return;
      g.clearLayers();
      L.polyline(ru.linea, { color: "#ffffff", weight: 9, opacity: 0.9, interactive: false }).addTo(g);
      L.polyline(ru.linea, { color: TINTA, weight: 5, opacity: 1, interactive: false, dashArray: m === "pie" ? "2 9" : undefined, lineCap: "round" }).addTo(g);
      L.circleMarker(desde, { radius: 8, color: "#ffffff", weight: 3, fillColor: CIELO, fillOpacity: 1, interactive: false }).addTo(g);
      mp.fitBounds(L.latLngBounds(ru.linea), { padding: [60, 60] });
      setRuta(ru); setEstado("");
    } catch { setEstado("error"); }
  }

  const quitar = () => { capa.current?.clearLayers(); setRuta(null); setEstado(""); };
  const calle = e?.tipo === "calle_inundada";
  const dato = (etq: string, v: ReactNode) => (v === null || v === undefined || v === "" ? null
    : <div className="border-b border-regla py-2.5 last:border-0"><dt className="text-xs text-gris">{etq}</dt><dd className="mt-0.5 text-sm font-semibold break-words text-texto">{v}</dd></div>);

  return (
    <aside aria-labelledby="det-titulo"
      className="absolute inset-x-0 bottom-0 z-[700] flex max-h-[72%] flex-col rounded-t-ficha bg-papel shadow-hoja animate-hoja lg:inset-x-auto lg:top-3 lg:right-3 lg:bottom-3 lg:max-h-none lg:w-96 lg:rounded-ficha lg:shadow-flota lg:animate-entra">
      <div className="flex items-start gap-3 border-b border-regla p-4">
        {e && <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-tinta-suave text-tinta"><Icono id={"t-" + e.tipo} className="size-5.5" /></span>}
        <div className="min-w-0 flex-1">
          <h2 id="det-titulo" ref={titulo} tabIndex={-1} className="text-lg leading-tight font-bold text-texto outline-none">
            {e ? (existe("tipo." + e.tipo) ? t("tipo." + e.tipo) : e.etiqueta ?? e.tipo) : t("panel.mv.ya_no")}
          </h2>
          {e && <p className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={esEquipo(e) ? K.pildora.validado : e.estado === "pendiente" ? K.pildora.pendiente : K.pildora.validado}>
              {t(esEquipo(e) ? "panel.mv.l_equipo_corto" : "estado." + e.estado)}
            </span>
            <span className="text-xs text-gris">{hora(e.creado)}</span>
          </p>}
        </div>
        <button type="button" onClick={cerrar} aria-label={t("panel.cerrar")} className="grid size-10 shrink-0 place-items-center rounded-full bg-suelo text-gris transition hover:text-texto"><Icono id="cerrar" className="size-5" /></button>
      </div>

      {e ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <dl>
            {dato(t(calle ? "panel.mv.d_agua" : "panel.mv.d_gravedad"), calle ? (e.altura_agua ? t("altura." + e.altura_agua) : null) : t("gravedad." + e.gravedad))}
            {dato(t("panel.mv.d_lugar"), [e.via, e.recinto].filter(Boolean).join(" · "))}
            {dato(t("panel.mv.d_descripcion"), e.descripcion)}
            {dato(t("panel.mv.d_autor"), e.autor ? `${e.autor.nombre} (${t("rol." + e.autor.rol)})` : esEquipo(e) ? t("panel.inc.equipo") : t("panel.mv.d_vecino"))}
            {dato(t("panel.mv.d_nota"), e.nota_ugr)}
            {dato(t("panel.mv.d_vecinos"), (e.sigue || e.ya_no) ? t("panel.mv.d_votos", { s: e.sigue, n: e.ya_no }) : null)}
            {dato(t("panel.mv.d_vence"), hora(e.expira))}
          </dl>
          <FotosReporte r={e} className="mt-3" />
          {/* el mapa solo muestra: retirar, resolver o eliminar se hace en «Incidentes»; revisar, en «Reportes» */}
          <a href={esEquipo(e) ? "#incidentes" : "#reportes"} className={`${K.btnChico} mt-3 w-full no-underline`}>
            {t(esEquipo(e) ? "panel.mv.gestionar_incidente" : "panel.mv.revisar_reporte")}
          </a>

          <div className="mt-4 rounded-2xl bg-suelo p-3">
            <p className="text-sm font-bold text-texto">{t("panel.mv.ruta")}</p>
            <div role="group" aria-label={t("panel.mv.ruta")} className="mt-2 grid grid-cols-2 gap-2">
              {(["auto", "pie"] as const).map((m) => (
                <button key={m} type="button" onClick={() => void verRuta(m)} aria-pressed={!!ruta && modo === m} disabled={estado === "buscando"}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-papel px-3 text-sm font-semibold text-tinta transition hover:bg-tinta-suave aria-pressed:bg-tinta aria-pressed:text-white disabled:opacity-60">
                  <Icono id={m === "auto" ? "auto" : "caminar"} className="size-4.5" />{t("panel.mv.ruta_" + m)}
                </button>
              ))}
            </div>
            <div role="status" className="mt-2 text-sm empty:hidden">
              {estado === "buscando" && <span className="text-gris">{t("panel.mv.ruta_buscando")}</span>}
              {estado === "gps" && <span className="font-semibold">{t("panel.mv.ruta_gps")}</span>}
              {estado === "error" && <span className="font-semibold">{t("panel.mv.ruta_error")}</span>}
              {estado === "sin_ruta" && <span className="font-semibold">{t("panel.mv.ruta_sin")}</span>}
              {ruta && <>
                <p className="text-2xl leading-tight font-bold text-texto tabular-nums">{duracion(ruta.segundos, t)}</p>
                <p className="text-sm text-gris">{t("panel.mv.ruta_resumen", { d: distancia(ruta.metros), modo: t("panel.mv.ruta_" + modo).toLowerCase() })}</p>
                <p className="mt-2 text-xs text-gris">{t("panel.mv.ruta_aviso")}</p>
                <button type="button" onClick={quitar} className={`${K.btnNeutro} mt-2`}>{t("panel.mv.ruta_quitar")}</button>
              </>}
            </div>
          </div>
        </div>
      ) : (
        <p className="p-4 text-sm text-gris">{t("panel.mv.ya_no_texto")}</p>
      )}
    </aside>
  );
}
