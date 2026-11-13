/* Mini mapa Leaflet del cantón para elegir dónde ocurre un incidente.
   - Al abrir pide la ubicación del teléfono: se centra ahí, marca «estás aquí» y, si cae dentro del cantón y aún
     no hay punto, lo deja elegido (el operador suele publicar desde el lugar). Tocar el mapa lo corrige.
   - Vectores en canvas; el límite del cantón como referencia y maxBounds con margen.
   - En «calle inundada» el toque se ajusta a la calle OSM más cercana (≤ 70 m) y se marca el tramo con
     la familia del agua (no con el semáforo) y grosor creciente según la altura. */
import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "./mapa.css";
import urlLimite from "@compartido/capas/limite_canton.geojson?url";
import urlCalles from "@compartido/capas/calles.geojson?url";
import { useI18n } from "../../shared/i18n/useI18n";
import { Icono } from "../../shared/ui/Icono";
import { dentroDe, tramoCercano, type Calles, type Geometria } from "./geo";

export interface Eleccion { lat: number; lon: number; dentro: boolean; tramo: [number, number][] | null; via: string | null; sinCalle: boolean; gps?: boolean }

const AGUA: Record<number, { color: string; weight: number }> = {
  1: { color: "#6baed6", weight: 5 }, 2: { color: "#2171b5", weight: 7 }, 3: { color: "#08306b", weight: 9 },
};
const TINTA = "#1d5f84";
const CIELO = "#3bb3e8";

type Limite = { features: { geometry: Geometria }[] };
type EstadoGps = "buscando" | "listo" | "error" | "permiso" | "inseguro" | "fuera" | "sin";

/** Por qué no hubo ubicación: página sin HTTPS, permiso negado (o bloqueado por Permissions-Policy) o sin señal de GPS. */
function motivoGps(e: unknown): EstadoGps {
  if (typeof window !== "undefined" && !window.isSecureContext) return "inseguro";
  return (e as GeolocationPositionError | null)?.code === 1 ? "permiso" : "error";
}

/** Ubicación del teléfono (sin permiso, sin HTTPS o sin señal: rechaza). */
function ubicar(): Promise<GeolocationPosition> {
  return new Promise((ok, mal) => {
    if (!navigator.geolocation) return mal(new Error("sin gps"));
    navigator.geolocation.getCurrentPosition(ok, mal, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  });
}

let calles: Promise<Calles> | null = null;
const cargarCalles = () => (calles ??= fetch(urlCalles).then((r) => { if (!r.ok) throw new Error("calles"); return r.json() as Promise<Calles>; })
  .catch((e) => { calles = null; throw e; }));

export default function MapaUbicacion({ modoCalle, altura, punto, tramo, alElegir, rondaGps = 0, centrarEnPunto = false, textosGps = "panel.inc.gps_" }: {
  /** prefijo de los avisos del GPS («…toca el mapa donde ocurre» en incidentes; otro texto en albergues) */
  textosGps?: string;
  /** al cambiar (p. ej. «publicar otro»), vuelve a centrar en el teléfono y proponer ese punto */
  rondaGps?: number;
  /** al abrir con un punto ya elegido (editar un albergue), el mapa se centra en él y no en el teléfono */
  centrarEnPunto?: boolean;
  modoCalle: boolean;
  altura: 1 | 2 | 3 | null;
  punto: [number, number] | null;          // [lat, lon]
  tramo: [number, number][] | null;
  alElegir: (e: Eleccion) => void;
}) {
  const { t } = useI18n();
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const limite = useRef<Promise<Limite | null>>(Promise.resolve(null));
  const capaLimite = useRef<L.GeoJSON | null>(null);
  const marca = useRef<L.CircleMarker | null>(null);
  const linea = useRef<L.Polyline | null>(null);
  const lienzo = useRef<L.Canvas | null>(null);
  const aqui = useRef<L.LayerGroup | null>(null);
  const centrado = useRef(false);          // ya se centró en el GPS: el límite no vuelve a encuadrar el cantón
  const opciones = useRef({ modoCalle, alElegir, punto, centrarEnPunto });
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [gps, setGps] = useState<EstadoGps>("buscando");

  useEffect(() => { opciones.current = { modoCalle, alElegir, punto, centrarEnPunto }; }, [modoCalle, alElegir, punto, centrarEnPunto]);
  useEffect(() => { if (modoCalle) cargarCalles().catch(() => {}); }, [modoCalle]);

  /** Elige un punto: dentro o fuera del cantón y, en «calle inundada», ajustado a la calle más cercana. */
  const elegirEn = useCallback(async (lat: number, lon: number, gps = false) => {
    const g = await limite.current;
    const dentro = g ? dentroDe(lon, lat, g) : true;
    if (opciones.current.modoCalle) {
      try {
        const tr = tramoCercano(lat, lon, await cargarCalles());
        if (tr) {
          opciones.current.alElegir({ lat: tr.punto[0], lon: tr.punto[1], dentro, tramo: tr.coords, via: tr.nombre, sinCalle: false, gps });
          return;
        }
      } catch { /* sin calles: se usa el punto tocado */ }
      opciones.current.alElegir({ lat, lon, dentro, tramo: null, via: null, sinCalle: true, gps });
      return;
    }
    opciones.current.alElegir({ lat, lon, dentro, tramo: null, via: null, sinCalle: false, gps });
  }, []);

  /** Centra el mapa en el teléfono y marca «estás aquí». `elegir`: también deja ese punto como ubicación. */
  const irAMiUbicacion = useCallback(async (elegir: boolean) => {
    setGps("buscando");
    let pos: GeolocationPosition;
    try { pos = await ubicar(); } catch (e) { setGps(motivoGps(e)); return; }
    const m = mapa.current;
    if (!m) return;
    const { latitude: lat, longitude: lon, accuracy } = pos.coords;
    const g = await limite.current;
    if (g && !dentroDe(lon, lat, g)) { setGps("fuera"); return; }
    aqui.current?.remove();
    aqui.current = L.layerGroup([
      L.circle([lat, lon], { renderer: lienzo.current!, radius: Math.min(accuracy, 300), color: CIELO, weight: 1, fillColor: CIELO, fillOpacity: 0.12, interactive: false }),
      L.circleMarker([lat, lon], { renderer: lienzo.current!, radius: 7, color: "#ffffff", weight: 3, fillColor: CIELO, fillOpacity: 1, interactive: false }),
    ]).addTo(m);
    marca.current?.bringToFront();
    centrado.current = true;
    m.setView([lat, lon], 17);
    setGps("listo");
    if (elegir) await elegirEn(lat, lon, true);
  }, [elegirEn]);

  // «publicar otro»: se vuelve a pedir el GPS y a proponer ese punto
  const ronda = useRef(rondaGps);
  useEffect(() => {
    if (ronda.current === rondaGps) return;
    ronda.current = rondaGps;
    void irAMiUbicacion(true);
  }, [rondaGps, irAMiUbicacion]);

  // al pasar a «calle inundada» con un punto ya elegido (p. ej. el del GPS), se ajusta a la calle
  useEffect(() => {
    const p = opciones.current.punto;
    if (modoCalle && p) void elegirEn(p[0], p[1]);
  }, [modoCalle, elegirEn]);

  // crear el mapa una sola vez
  useEffect(() => {
    if (!caja.current) return;
    lienzo.current = L.canvas({ padding: 0.5, tolerance: 8 });
    const m = L.map(caja.current, { minZoom: 10, maxZoom: 19, zoomControl: true, attributionControl: true, maxBoundsViscosity: 0.8, scrollWheelZoom: false })
      .setView([-2.12, -79.68], 11);
    // el panel no manda Referer (no-referrer), pero la política de teselas de OSM lo exige: solo el origen, solo aquí
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap", referrerPolicy: "strict-origin" }).addTo(m);
    mapa.current = m;
    let vivo = true;
    limite.current = fetch(urlLimite).then((r) => (r.ok ? r.json() as Promise<Limite> : Promise.reject(new Error("limite")))).then((g) => {
      if (!vivo) return g;
      capaLimite.current = L.geoJSON(g as unknown as GeoJSON.GeoJsonObject, { renderer: lienzo.current!, interactive: false, style: { color: "#163a52", weight: 2, dashArray: "6 5", fill: false } } as L.GeoJSONOptions).addTo(m);
      const b = capaLimite.current.getBounds();
      m.invalidateSize();               // el contenedor pudo crecer mientras se pedía el límite
      m.setMaxBounds(b.pad(0.3));
      if (!centrado.current) m.fitBounds(b, { padding: [8, 8] });
      setEstado("listo");
      return g;
    }).catch(() => { if (vivo) setEstado("error"); return null; });

    // sin un punto elegido todavía, el GPS lo propone; con uno, solo se marca dónde está el teléfono
    const inicial = opciones.current.punto;
    if (inicial && opciones.current.centrarEnPunto) {
      centrado.current = true;
      m.setView(inicial, 16);
      setGps("sin");
    } else void irAMiUbicacion(!inicial);

    m.on("click", (ev: L.LeafletMouseEvent) => void elegirEn(ev.latlng.lat, ev.latlng.lng));
    // la rueda solo hace zoom después de tocar el mapa: así no se traga el desplazamiento del formulario
    m.on("focus click", () => m.scrollWheelZoom.enable());
    m.on("blur mouseout", () => m.scrollWheelZoom.disable());
    // el contenedor puede cambiar de tamaño al abrir la pestaña o al mostrarse el paso «Dónde» del asistente
    // (montado oculto: si el cantón se encuadró con tamaño cero, se vuelve a encuadrar al hacerse visible)
    let ancho = caja.current.clientWidth;
    const ro = new ResizeObserver(() => {
      const antes = ancho;
      ancho = caja.current?.clientWidth ?? 0;
      m.invalidateSize();
      const b = capaLimite.current?.getBounds();
      if (!antes && ancho && !centrado.current && b) m.fitBounds(b, { padding: [8, 8] });
    });
    ro.observe(caja.current);
    return () => { vivo = false; ro.disconnect(); m.remove(); mapa.current = null; marca.current = null; linea.current = null; aqui.current = null; };
  }, [elegirEn, irAMiUbicacion]);

  // punto elegido
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!punto) { marca.current?.remove(); marca.current = null; return; }
    if (!marca.current) {
      marca.current = L.circleMarker(punto, { renderer: lienzo.current!, radius: 9, color: "#ffffff", weight: 3, fillColor: TINTA, fillOpacity: 1, interactive: false }).addTo(m);
    } else marca.current.setLatLng(punto);
  }, [punto]);

  // tramo de calle con agua
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    linea.current?.remove();
    linea.current = null;
    if (tramo && tramo.length >= 2) {
      const e = AGUA[altura ?? 2]!;
      linea.current = L.polyline(tramo, { renderer: lienzo.current!, ...e, opacity: 0.95, lineCap: "round", interactive: false }).addTo(m);
      marca.current?.bringToFront();
    }
  }, [tramo, altura]);

  function verCanton() {
    const b = capaLimite.current?.getBounds();
    if (b && mapa.current) mapa.current.fitBounds(b, { padding: [8, 8] });
  }

  const AVISO: Partial<Record<EstadoGps, string>> = {
    buscando: "panel.inc.gps_buscando", error: textosGps + "error", permiso: textosGps + "permiso",
    inseguro: textosGps + "https", fuera: textosGps + "fuera",
  };
  const avisoGps = AVISO[gps] ?? null;
  const flotante = "inline-flex min-h-11 items-center gap-1.5 rounded-full bg-papel px-3.5 text-sm font-semibold text-tinta shadow-flota transition hover:bg-suelo disabled:opacity-70";
  return (
    // isolate: los z-index de Leaflet (400–1000) quedan dentro del mapa y no tapan la cabecera fija
    <div className="relative isolate">
      <div ref={caja} role="application" aria-label={t("panel.inc.mapa_etq")} className="mapa-elegir h-80 w-full overflow-hidden rounded-2xl bg-cielo-2 lg:h-96" />
      <div className="absolute top-2.5 right-2.5 z-[500] flex flex-col items-end gap-2">
        <button type="button" onClick={() => void irAMiUbicacion(true)} disabled={gps === "buscando"} className={flotante}>
          <Icono id="gps" className={`size-4.5 ${gps === "buscando" ? "animate-pulse" : ""}`} />{t("panel.inc.mi_ubicacion")}
        </button>
        {estado === "listo" && (
          <button type="button" onClick={verCanton} className={flotante}>
            <Icono id="canton" className="size-4.5" />{t("panel.inc.ver_canton")}
          </button>
        )}
      </div>
      {(estado !== "listo" || avisoGps) && (
        <p role="status" className="absolute inset-x-3 bottom-3 z-[500] rounded-xl bg-papel px-3 py-2 text-sm font-semibold shadow-flota">
          {estado !== "listo" ? t(estado === "error" ? "panel.inc.mapa_error" : "panel.inc.mapa_cargando") : t(avisoGps!)}
        </p>
      )}
    </div>
  );
}
