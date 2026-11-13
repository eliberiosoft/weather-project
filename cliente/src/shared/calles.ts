/* Calles de OSM (capas/calles.geojson, 345 KB): se bajan solo cuando hacen falta (modo calle, GPS, reporte de calle).
   tramoEnCalles encaja un toque a la calle más cercana (≤ 70 m) y devuelve el tramo de ±120 m alrededor. */
import { I18N } from "./i18n";
import { distM } from "./formato";
import type { LatLon } from "./tipos";

type Coord = [number, number];   // [lon, lat] como en GeoJSON
export interface Calles {
  features: { properties: { nombre?: string | null; clase?: string }; geometry: { type: string; coordinates: Coord[] | Coord[][] } }[];
}
export interface Tramo { nombre: string | null; clase?: string | undefined; coords: LatLon[]; punto: LatLon; dist: number }

let calles: Promise<Calles> | null = null;
export function cargarCalles(): Promise<Calles> {
  calles ??= fetch(`capas/calles.geojson?v=${__BUILD__}`).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<Calles>;
  }).catch((e: unknown) => { calles = null; throw e; });
  return calles;
}

export function tramoEnCalles(g: Calles, lat: number, lon: number, maxDist = 70, medio = 120): Tramo | null {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180), ky = 110574;
  const P = (c: Coord): Coord => [(c[0] - lon) * kx, (c[1] - lat) * ky];
  let mejor: { d: number; f: Calles["features"][number]; ln: Coord[]; i: number; t: number } | null = null;
  for (const f of g.features) {
    const lineas = (f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [f.geometry.coordinates]) as Coord[][];
    for (const ln of lineas) {
      for (let i = 0; i < ln.length - 1; i++) {
        const [ax, ay] = P(ln[i] as Coord), [bx, by] = P(ln[i + 1] as Coord);
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
        const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
        const d = Math.hypot(ax + t * dx, ay + t * dy);
        if (!mejor || d < mejor.d) mejor = { d, f, ln, i, t };
      }
    }
  }
  if (!mejor || mejor.d > maxDist) return null;
  const { ln, i, t, f } = mejor;
  const lerp = (a: Coord, b: Coord, k: number): Coord => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const seg = (a: Coord, b: Coord) => distM(a[0], a[1], b[0], b[1]);
  const p0 = lerp(ln[i] as Coord, ln[i + 1] as Coord, t);
  const atras: Coord[] = [p0];
  let resto = medio, prev = p0;
  for (let j = i; j >= 0; j--) {
    const c = ln[j] as Coord, d = seg(prev, c);
    if (d >= resto) { atras.push(lerp(prev, c, resto / d)); break; }
    atras.push(c); resto -= d; prev = c;
  }
  const adelante: Coord[] = [];
  resto = medio; prev = p0;
  for (let j = i + 1; j < ln.length; j++) {
    const c = ln[j] as Coord, d = seg(prev, c);
    if (d >= resto) { adelante.push(lerp(prev, c, resto / d)); break; }
    adelante.push(c); resto -= d; prev = c;
  }
  const coords = atras.reverse().concat(adelante).map((c): LatLon => [+c[1].toFixed(6), +c[0].toFixed(6)]);
  return { nombre: f.properties.nombre || null, clase: f.properties.clase, coords, punto: [p0[1], p0[0]], dist: mejor.d };
}

export async function tramoCercano(lat: number, lon: number, maxDist = 70, medio = 120): Promise<Tramo | null> {
  return tramoEnCalles(await cargarCalles(), lat, lon, maxDist, medio);
}

export function nombreVia(tr: Tramo | null, cercaDe: string | null): string {
  if (tr?.nombre) return tr.nombre;
  return cercaDe ? I18N.t("app.calle.sin_nombre_cerca", { lugar: cercaDe }) : I18N.t("app.calle.sin_nombre");
}
