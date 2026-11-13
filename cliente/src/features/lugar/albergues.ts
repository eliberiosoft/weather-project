/* Albergues que cargó el equipo en el panel, ordenados por cercanía a tu lugar (para «Mi lugar»). */
import { distM } from "../../shared/formato";
import type { Albergue } from "../../shared/tipos";

export interface AlbergueCerca { a: Albergue; dist: number }

/** Los `n` más cercanos al centro del lugar (sin centro, en el orden en que llegaron). */
export function alberguesCercanos(albergues: Albergue[], centro: { lat: number; lon: number } | null, n = 3): AlbergueCerca[] {
  const conDist = albergues.map((a) => ({ a, dist: centro ? distM(centro.lon, centro.lat, a.lon, a.lat) : NaN }));
  if (centro) conDist.sort((x, y) => x.dist - y.dist);
  return conDist.slice(0, n);
}
