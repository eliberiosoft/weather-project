/* Lo que el tablero calcula sin tocar el mapa: filtros, contadores, eventos nuevos entre refrescos y la ruta. */
import type { EventoMapa } from "../../shared/api/tipos";

export const CADA_MS = 3 * 60 * 1000;   // el mapa se refresca cada 3 minutos

export type Filtro = "todos" | "pendiente" | "validado" | "equipo";

export const esEquipo = (e: Pick<EventoMapa, "origen">) => e.origen === "equipo";

export function pasaFiltro(e: EventoMapa, f: Filtro): boolean {
  if (f === "todos") return true;
  if (f === "equipo") return esEquipo(e);
  return !esEquipo(e) && e.estado === f;
}

export interface Cuentas { todos: number; pendiente: number; validado: number; equipo: number }

export function contar(eventos: EventoMapa[]): Cuentas {
  const c: Cuentas = { todos: eventos.length, pendiente: 0, validado: 0, equipo: 0 };
  for (const e of eventos) {
    if (esEquipo(e)) c.equipo++;
    else if (e.estado === "pendiente") c.pendiente++;
    else if (e.estado === "validado") c.validado++;
  }
  return c;
}

/** Ids que llegaron en este refresco y no estaban en el anterior (en la primera carga, ninguno es «nuevo»). */
export function nuevos(antes: Set<string> | null, ahora: EventoMapa[]): Set<string> {
  if (!antes) return new Set();
  return new Set(ahora.filter((e) => !antes.has(e.id)).map((e) => e.id));
}

export type Modo = "auto" | "pie";

/** Rutas de OpenStreetMap Alemania (FOSSGIS, OSRM): sin clave; un servidor por modo. */
export function urlRuta(modo: Modo, desde: [number, number], hasta: [number, number]): string {
  const servidor = modo === "auto" ? "routed-car" : "routed-foot";
  const c = (p: [number, number]) => `${p[1].toFixed(6)},${p[0].toFixed(6)}`;   // OSRM: lon,lat
  return `https://routing.openstreetmap.de/${servidor}/route/v1/driving/${c(desde)};${c(hasta)}?overview=full&geometries=geojson`;
}

export interface Ruta { linea: [number, number][]; metros: number; segundos: number }

/** Respuesta de OSRM → línea [lat, lon], distancia y tiempo; null si no hay ruta. */
export function leerRuta(j: unknown): Ruta | null {
  const r = (j as { code?: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] });
  const p = r?.code === "Ok" ? r.routes?.[0] : undefined;
  if (!p || !Array.isArray(p.geometry?.coordinates) || p.geometry.coordinates.length < 2) return null;
  return { linea: p.geometry.coordinates.map(([lon, lat]) => [lat, lon]), metros: p.distance, segundos: p.duration };
}

/** «12 min», «1 h 05 min», «menos de 1 min». */
export function duracion(seg: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  const min = Math.round(seg / 60);
  if (min < 1) return t("panel.mv.ruta_menos_min");
  if (min < 60) return t("panel.mv.ruta_min", { m: min });
  return t("panel.mv.ruta_h", { h: Math.floor(min / 60), m: String(min % 60).padStart(2, "0") });
}

export function distancia(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}
