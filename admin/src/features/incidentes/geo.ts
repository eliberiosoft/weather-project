/* Geometría mínima para elegir la ubicación de un incidente (sin dependencias):
   distancia, punto dentro del cantón y tramo de calle de ±120 m (igual que la app ciudadana). */

export type Pos = [number, number];            // [lon, lat] como en GeoJSON
export interface Geometria { type: string; coordinates: unknown }
export interface Calle { type: "Feature"; properties: { nombre?: string | null; clase?: string }; geometry: Geometria }
export interface Calles { features: Calle[] }

/** Distancia en metros (equirectangular: sobra a escala de un cantón). */
export function distM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const kx = 111320 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.hypot((lon2 - lon1) * kx, (lat2 - lat1) * 110574);
}

function enAnillo(lon: number, lat: number, anillo: Pos[]): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i]!, [xj, yj] = anillo[j]!;
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function enPoligono(lon: number, lat: number, anillos: Pos[][]): boolean {
  const [exterior, ...huecos] = anillos;
  return !!exterior && enAnillo(lon, lat, exterior) && !huecos.some((h) => enAnillo(lon, lat, h));
}

/** ¿El punto cae dentro de un Polygon/MultiPolygon (o de una FeatureCollection de ellos)? */
export function dentroDe(lon: number, lat: number, g: Geometria | { features: { geometry: Geometria }[] }): boolean {
  if ("features" in g) return g.features.some((f) => dentroDe(lon, lat, f.geometry));
  if (g.type === "Polygon") return enPoligono(lon, lat, g.coordinates as Pos[][]);
  if (g.type === "MultiPolygon") return (g.coordinates as Pos[][][]).some((p) => enPoligono(lon, lat, p));
  return false;
}

export interface Tramo { nombre: string | null; coords: [number, number][]; punto: [number, number]; dist: number }

/** Calle más cercana (≤ maxDist m) y un tramo de ±medio m alrededor del punto. Coordenadas de salida [lat, lon]. */
export function tramoCercano(lat: number, lon: number, calles: Calles, maxDist = 70, medio = 120): Tramo | null {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180), ky = 110574;
  const P = (c: Pos): Pos => [(c[0] - lon) * kx, (c[1] - lat) * ky];
  let mejor: { d: number; f: Calle; ln: Pos[]; i: number; t: number } | null = null;
  for (const f of calles.features) {
    const g = f.geometry;
    const lineas = (g.type === "MultiLineString" ? g.coordinates : g.type === "LineString" ? [g.coordinates] : []) as Pos[][];
    for (const ln of lineas) {
      for (let i = 0; i < ln.length - 1; i++) {
        const [ax, ay] = P(ln[i]!), [bx, by] = P(ln[i + 1]!);
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
        const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
        const d = Math.hypot(ax + t * dx, ay + t * dy);
        if (!mejor || d < mejor.d) mejor = { d, f, ln, i, t };
      }
    }
  }
  if (!mejor || mejor.d > maxDist) return null;
  const { ln, i, t, f } = mejor;
  const lerp = (a: Pos, b: Pos, k: number): Pos => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const seg = (a: Pos, b: Pos) => distM(a[0], a[1], b[0], b[1]);
  const p0 = lerp(ln[i]!, ln[i + 1]!, t);
  const recorrer = (desde: number, paso: 1 | -1): Pos[] => {
    const out: Pos[] = [];
    let resto = medio, prev = p0;
    for (let j = desde; j >= 0 && j < ln.length && resto > 0; j += paso) {
      const q = ln[j]!, d = seg(prev, q);
      if (d >= resto) { out.push(lerp(prev, q, resto / d)); break; }
      out.push(q); resto -= d; prev = q;
    }
    return out;
  };
  const coords = [...recorrer(i, -1).reverse(), p0, ...recorrer(i + 1, 1)]
    .map((c): [number, number] => [+c[1].toFixed(6), +c[0].toFixed(6)]);
  return { nombre: f.properties.nombre || null, coords, punto: [+p0[1].toFixed(6), +p0[0].toFixed(6)], dist: mejor.d };
}
