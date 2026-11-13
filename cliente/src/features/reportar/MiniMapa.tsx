/* Minimapa del paso «¿Dónde?»: muestra el punto (y el margen del GPS) para confirmar que es el lugar;
   se corrige arrastrando el punto o tocando el sitio correcto. */
import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { icoHtml } from "../../shared/componentes/Icono";
import { MK, TINTA } from "../../shared/estilo";
import { sinMovimiento } from "../../shared/formato";
import { useI18n } from "../../shared/i18n";
import type { UbicReporte } from "../../shared/store";
import { fijarUbicacionReporte } from "./asistente";

export default function MiniMapa({ ubic, visible }: { ubic: UbicReporte; visible: boolean }) {
  const { t } = useI18n();
  const el = useRef<HTMLDivElement>(null);
  const mapa = useRef<{ m: L.Map; marca: L.Marker; circulo: L.Circle | null } | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const ll: L.LatLngTuple = [ubic.lat, ubic.lon];
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, dragging: !L.Browser.mobile, tapHold: false }).setView(ll, 17);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
    L.control.zoom({ position: "topright" }).addTo(m);
    const marca = L.marker(ll, { draggable: true, keyboard: true, title: t("app.wiz.punto"), alt: t("app.wiz.punto"),
      icon: L.divIcon({ className: MK.rep, html: icoHtml("i-pin", "size-5"), iconSize: [40, 40] }) }).addTo(m);
    const mover = (p: L.LatLng) => fijarUbicacionReporte(+p.lat.toFixed(6), +p.lng.toFixed(6), "ajustada");
    marca.on("dragend", () => mover(marca.getLatLng()));
    m.on("click", (e: L.LeafletMouseEvent) => mover(e.latlng));
    mapa.current = { m, marca, circulo: null };
    return () => { m.remove(); mapa.current = null; };
    // se crea una vez; la ubicación nueva llega por el efecto de abajo
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const x = mapa.current;
    if (!x) return;
    const ll: L.LatLngTuple = [ubic.lat, ubic.lon];
    x.marca.setLatLng(ll);
    if (ubic.origen !== "ajustada") x.m.setView(ll, Math.max(x.m.getZoom(), 17));
    else x.m.panTo(ll, { animate: !sinMovimiento() });
    x.circulo?.remove();
    x.circulo = ubic.prec ? L.circle(ll, { radius: ubic.prec, color: TINTA, weight: 1.5, fillColor: TINTA, fillOpacity: 0.1, interactive: false }).addTo(x.m) : null;
  }, [ubic.lat, ubic.lon, ubic.origen, ubic.prec]);

  // el paso puede haber estado oculto al crearlo
  useEffect(() => {
    if (!visible) return;
    const h = setTimeout(() => mapa.current?.m.invalidateSize(), 60);
    return () => clearTimeout(h);
  }, [visible]);

  return <div ref={el} aria-label={t("app.wiz.minimapa")} className="mt-3 h-56 overflow-hidden rounded-2xl ring-1 ring-regla"></div>;
}
