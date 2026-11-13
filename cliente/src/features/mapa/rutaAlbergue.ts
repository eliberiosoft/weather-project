/* Ruta hasta un albergue: tu ubicación → la API (que la pide a OpenStreetMap con el punto redondeado) → la línea
   en el mapa. Dice si el camino pasa por una calle que los vecinos marcaron «no cruces» (funciones puras aparte,
   se prueban sin navegador). */
import { api } from "../../shared/api";
import { esCalle, vigente } from "../../shared/dominio";
import { distM } from "../../shared/formato";
import { store } from "../../shared/store";
import type { Albergue, LatLon, ModoRuta, Reporte, RespuestaRuta, RutaAlbergue } from "../../shared/tipos";
import { ubicar } from "../../shared/ubicacion";

/** A cuántos metros de la ruta cuenta una calle con agua (el ancho de una calle más el margen del GPS). */
export const CERCA_RUTA = 25;

/** Distancia en metros de un punto a un segmento (aproximación plana: tramos cortos dentro del cantón). */
function aSegmento(p: LatLon, a: LatLon, b: LatLon): number {
  const kx = 111320 * Math.cos((p[0] * Math.PI) / 180), ky = 110574;
  const ax = (a[1] - p[1]) * kx, ay = (a[0] - p[0]) * ky, bx = (b[1] - p[1]) * kx, by = (b[0] - p[0]) * ky;
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function distanciaALinea(p: LatLon, linea: LatLon[]): number {
  if (linea.length === 1) return distM(p[1], p[0], linea[0]![1], linea[0]![0]);
  let d = Infinity;
  for (let i = 0; i < linea.length - 1; i++) d = Math.min(d, aSegmento(p, linea[i]!, linea[i + 1]!));
  return d;
}

/** ¿La ruta pasa por una calle con agua «no cruces» (altura 3) vigente y no descartada? */
export function cruzaNoCruces(linea: LatLon[], reportes: Reporte[], ahora = Date.now()): boolean {
  if (linea.length < 2) return false;
  return reportes.some((r) => {
    if (!esCalle(r) || r.altura_agua !== 3 || !["pendiente", "validado"].includes(r.estado) || !vigente(r, ahora)) return false;
    const puntos: LatLon[] = r.tramo && r.tramo.length ? r.tramo : [[r.lat, r.lon]];
    return puntos.some((p) => distanciaALinea(p, linea) <= CERCA_RUTA);
  });
}

/** Navegación paso a paso en Google Maps (abre la app de mapas del teléfono); el origen lo pone el teléfono. */
export const urlNavegar = (a: Pick<Albergue, "lat" | "lon">, modo: ModoRuta) =>
  `https://www.google.com/maps/dir/?api=1&destination=${a.lat.toFixed(6)},${a.lon.toFixed(6)}&travelmode=${modo === "auto" ? "driving" : "walking"}`;

/** Pide la ruta desde donde estás. Los errores ya traen el mensaje para la persona (GPS o API). */
export async function pedirRuta(a: Albergue, modo: ModoRuta): Promise<RutaAlbergue> {
  const u = await ubicar();
  // 4 decimales (~10 m): basta para la ruta y no deja la ubicación exacta en los registros
  const q = new URLSearchParams({ modo, lat: u.lat.toFixed(4), lon: u.lon.toFixed(4), albergue: a.id });
  const r = await api<RespuestaRuta>(`/api/ruta?${q}`);
  return { ...r, albergue: a, desde: [u.lat, u.lon], cruzaAgua: cruzaNoCruces(r.linea, store.get().reportes) };
}
