/* Mapa de calor de los reportes del período (leaflet.heat). La escala es de la familia del agua (azules), nunca del
   semáforo: dice dónde se reporta más, no un nivel de alerta. `foco` acerca el mapa a una zona del ranking. */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.heat";
import "../tablero/tablero.css";
import urlLimite from "@compartido/capas/limite_canton.geojson?url";
import { useI18n } from "../../shared/i18n/useI18n";

/** de pocos a muchos reportes: azul claro → azul profundo */
export const ESCALA_CALOR = { 0.2: "#c6dbef", 0.4: "#6baed6", 0.6: "#2171b5", 0.8: "#08519c", 1: "#08306b" };

export default function MapaCalor({ puntos, foco }: { puntos: [number, number][]; foco: [number, number] | null }) {
  const { t } = useI18n();
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const calor = useRef<L.HeatLayer | null>(null);

  useEffect(() => {
    if (!caja.current) return;
    const m = L.map(caja.current, { minZoom: 10, maxZoom: 18, scrollWheelZoom: false }).setView([-2.12, -79.68], 11);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap", referrerPolicy: "strict-origin", opacity: 0.85 }).addTo(m);
    let vivo = true;
    fetch(urlLimite).then((r) => (r.ok ? r.json() : Promise.reject(new Error("limite")))).then((g: GeoJSON.GeoJsonObject) => {
      if (!vivo) return;
      const capa = L.geoJSON(g, { interactive: false, style: { color: "#163a52", weight: 2, dashArray: "6 5", fill: false } }).addTo(m);
      m.fitBounds(capa.getBounds(), { padding: [12, 12] });
    }).catch(() => {});
    calor.current = L.heatLayer([], { radius: 22, blur: 18, maxZoom: 16, minOpacity: 0.3, gradient: ESCALA_CALOR }).addTo(m);
    // la rueda solo hace zoom después de tocar el mapa: así no se traga el desplazamiento de la página
    m.on("focus click", () => m.scrollWheelZoom.enable());
    m.on("blur mouseout", () => m.scrollWheelZoom.disable());
    mapa.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(caja.current);
    return () => { vivo = false; ro.disconnect(); m.remove(); mapa.current = null; calor.current = null; };
  }, []);

  // intensidad 1 por reporte: el calor sale de cuántos hay juntos
  useEffect(() => { calor.current?.setLatLngs(puntos.map(([la, lo]) => [la, lo, 1] as L.HeatLatLngTuple)); }, [puntos]);
  useEffect(() => { if (foco) mapa.current?.flyTo(foco, 15, { duration: 0.6 }); }, [foco]);

  return <div ref={caja} role="img" aria-label={t("panel.an.calor_etq", { n: puntos.length })} className="tablero h-80 w-full overflow-hidden rounded-2xl bg-cielo-2 lg:h-[28rem]" />;
}
