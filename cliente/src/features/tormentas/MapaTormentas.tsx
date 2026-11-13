/* Mapa de «Tormentas»: escala regional (zoom 5 a 10; el satélite tiene unos 2 km por punto), el mosaico de nubes
   frías que arma la API (un PNG por hora, encima de OSM), los rayos de los últimos 30 min en canvas, el límite del
   cantón y el círculo de 40 km que usa el aviso «cerca». Leaflet sin React adentro, como el mapa principal. */
import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Icono, icoHtml } from "../../shared/componentes/Icono";
import { MK, NEGRO, TINTA } from "../../shared/estilo";
import { useI18n } from "../../shared/i18n";
import { toast, useApp } from "../../shared/store";
import { ubicar } from "../../shared/ubicacion";
import { grados, largoFlecha } from "./radar";
import { urlMarco } from "./texto";
import type { Tormentas } from "./tipos";

interface Capas { m: L.Map; nubes: L.ImageOverlay | null; rayos: L.LayerGroup; flechas: L.LayerGroup; lienzo: L.Canvas; yo: L.Marker | null }

/** Flecha de movimiento (apunta al norte; se gira con CSS): halo blanco y trazo oscuro, sin colores del semáforo. */
function svgFlecha(largo: number, giro: number): string {
  const c = 48, y = c - largo;
  const trazo = `M${c} ${c}L${c} ${y}M${c - 7} ${y + 9}L${c} ${y}L${c + 7} ${y + 9}`;
  return `<svg viewBox="0 0 96 96" width="96" height="96" style="transform:rotate(${giro.toFixed(0)}deg)" aria-hidden="true">`
    + `<path d="${trazo}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${trazo}" fill="none" stroke="${NEGRO}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Zoom al ir a mi lugar: se ve el círculo de 40 km entero y lo que viene alrededor. */
const ZOOM_LUGAR = 8;

/** Pone (o mueve) el marcador de mi lugar. */
function marcarYo(c: Capas | null, ll: L.LatLngTuple, nombre: string) {
  if (!c) return;
  if (c.yo) c.yo.setLatLng(ll).options.title = nombre;
  else c.yo = L.marker(ll, { title: nombre, alt: nombre, keyboard: false, zIndexOffset: 1000,
    icon: L.divIcon({ className: MK.miLugar, html: icoHtml("i-casa", "size-4"), iconSize: [30, 30] }) }).addTo(c.m);
}

export function MapaTormentas({ datos, indice, activa }: { datos: Tormentas; indice: number; activa: boolean }) {
  const { t } = useI18n();
  const el = useRef<HTMLDivElement>(null);
  const capas = useRef<Capas | null>(null);
  const { centro, mosaico, rayos, radios, movimiento } = datos;
  const marco = mosaico.marcos[indice];
  const esUltimo = indice === mosaico.marcos.length - 1;
  // el lugar elegido en «Mi lugar» (recinto, calle o ubicación guardada)
  const lugar = useApp((s) => s.lugarDet?.recinto);
  const miLugar = lugar && Number.isFinite(lugar.lat) && Number.isFinite(lugar.lon)
    ? { lat: lugar.lat, lon: lugar.lon, nombre: (lugar.nombre || "").replace(/^(Tu ubicación|Your location)( · )?/, "") || t("app.tu_ubicacion") }
    : null;

  // el mapa se crea una vez
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, minZoom: 5, maxZoom: 10, attributionControl: true, maxBoundsViscosity: 0.8 })
      .setView(centro, 7);
    m.setMaxBounds(L.latLngBounds(mosaico.limites).pad(0.05));
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 10, attribution: "© OpenStreetMap" }).addTo(m);
    m.attributionControl.addAttribution("NOAA GOES-19 · NASA GIBS · GLM: Unidata");
    L.control.zoom({ position: "topright" }).addTo(m);
    const lienzo = L.canvas({ padding: 0.3 });
    // anillos de acercamiento (10, 40 y 150 km) con su distancia escrita arriba de cada uno
    for (const km of [radios.encima, radios.cerca, radios.lejos]) {
      L.circle(centro, { radius: km * 1000, color: TINTA, weight: 1.5, dashArray: "5 7", fill: false, interactive: false }).addTo(m);
      L.marker([centro[0] + km / 110.57, centro[1]], { interactive: false, keyboard: false,
        icon: L.divIcon({ className: MK.anillo, html: `${km} km`, iconSize: [56, 20], iconAnchor: [28, 10] }) }).addTo(m);
    }
    let vivo = true;
    void fetch(`capas/limite_canton.geojson?v=${__BUILD__}`).then((r) => (r.ok ? r.json() : null)).then((g) => {
      if (vivo && g) L.geoJSON(g, { interactive: false, style: { color: TINTA, weight: 2.5, fill: false } }).addTo(m);
    }).catch(() => { /* sin el límite el mapa sirve igual */ });
    capas.current = { m, nubes: null, rayos: L.layerGroup().addTo(m), flechas: L.layerGroup().addTo(m), lienzo, yo: null };
    return () => { vivo = false; m.remove(); capas.current = null; };
    // se crea una vez; los datos nuevos llegan por los efectos de abajo
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // el marcador de mi lugar (siempre a la vista: es la referencia para leer distancias)
  const latYo = miLugar?.lat, lonYo = miLugar?.lon, nombreYo = miLugar?.nombre;
  useEffect(() => {
    if (latYo == null || lonYo == null) return;
    marcarYo(capas.current, [latYo, lonYo], nombreYo ?? "");
  }, [latYo, lonYo, nombreYo]);

  // al volver a la vista, Leaflet recalcula el tamaño (estuvo oculto)
  useEffect(() => { if (activa) capas.current?.m.invalidateSize(); }, [activa]);

  // la imagen de la hora elegida
  useEffect(() => {
    const c = capas.current;
    if (!c) return;
    if (!marco) { c.nubes?.remove(); c.nubes = null; return; }
    if (c.nubes) c.nubes.setUrl(urlMarco(marco.id));
    else c.nubes = L.imageOverlay(urlMarco(marco.id), mosaico.limites, { interactive: false, alt: "" }).addTo(c.m);
  }, [marco, mosaico.limites]);

  // rayos: solo con la imagen más reciente (son de los últimos 30 min); los de 10 min o menos, más grandes
  useEffect(() => {
    const c = capas.current;
    if (!c) return;
    c.rayos.clearLayers();
    if (!esUltimo) return;
    for (const [lat, lon, min] of rayos?.puntos ?? []) {
      const nuevo = min <= 10;
      L.circleMarker([lat, lon], {
        renderer: c.lienzo, interactive: false, radius: nuevo ? 5 : 3.5, weight: nuevo ? 2 : 1.5,
        color: "#fff", fillColor: NEGRO, fillOpacity: nuevo ? 1 : 0.7, opacity: nuevo ? 1 : 0.8,
      }).addTo(c.rayos);
    }
  }, [rayos, esUltimo]);

  // hacia dónde va cada tormenta: solo con la imagen más reciente (se calcula contra la de 30 min antes)
  useEffect(() => {
    const c = capas.current;
    if (!c) return;
    c.flechas.clearLayers();
    if (!esUltimo) return;
    for (const f of movimiento?.flechas ?? []) {
      L.marker(f.desde, { interactive: false, keyboard: false, icon: L.divIcon({ className: "", html: svgFlecha(largoFlecha(f.km_h), grados(f.desde, f.hacia)), iconSize: [96, 96], iconAnchor: [48, 48] }) }).addTo(c.flechas);
    }
  }, [movimiento, esUltimo]);

  /** «Ir a mi lugar»: el lugar de «Mi lugar»; si no hay ninguno elegido, la ubicación del teléfono. */
  const irAMiLugar = async () => {
    const c = capas.current;
    if (!c) return;
    if (miLugar) { c.m.setView([miLugar.lat, miLugar.lon], ZOOM_LUGAR); return; }
    try {
      const u = await ubicar();
      marcarYo(c, [u.lat, u.lon], t("app.tu_ubicacion"));
      c.m.setView([u.lat, u.lon], ZOOM_LUGAR);
    } catch (e) { toast((e as Error).message, 5000); }
  };

  return (
    <div className="relative">
      <div ref={el} role="region" aria-label={t("app.torm.mapa.etq")} className="h-[min(62vh,26rem)] w-full overflow-hidden rounded-ficha bg-suelo shadow-ficha ring-1 ring-white/70"></div>
      <button type="button" onClick={() => void irAMiLugar()} aria-label={t("app.torm.mi_lugar")} title={t("app.torm.mi_lugar")}
        className="absolute top-[5.25rem] right-2.5 z-[1000] grid size-11 place-items-center rounded-xl bg-papel/95 text-tinta shadow-flota backdrop-blur active:scale-95">
        <Icono id="i-gps" className="size-5" />
      </button>
    </div>
  );
}
