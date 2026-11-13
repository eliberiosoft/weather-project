/* Navegación por hash: #inicio, #mapa/z/lat/lon, #mapa/recinto/<id>, #reportar, #muro/<id>, #avisos, #avisos/<id>[/push],
   #privacidad, #tormentas.
   Los enlaces /r/<id> de la API redirigen a /#muro/<id>. Funciones puras (se prueban sin navegador). */
import { VISTAS, type Vista } from "./store";

export type VistaMapa = { recinto: string } | { z: number; lat: number; lon: number } | Record<string, never>;

/** #avisos/<id> (enlace compartido) o #avisos/<id>/push (se tocó la notificación) */
export interface RutaAviso { id: number; push: boolean }

export interface Ruta { vista: Vista | null; muroId: string | null; mapa: VistaMapa | null; aviso: RutaAviso | null }

export function leerRuta(hash: string): Ruta {
  const partes = hash.replace(/^#/, "").split("/");
  const v = partes[0] || "inicio";
  const vista = (VISTAS as readonly string[]).includes(v) ? (v as Vista) : null;
  const id = partes[1] || "";
  return {
    vista,
    muroId: vista === "muro" && /^[0-9a-f]{12}$/.test(id) ? id : null,
    mapa: vista === "mapa" ? leerVistaMapa(partes) : null,
    aviso: vista === "avisos" && /^\d{1,9}$/.test(id) ? { id: Number(id), push: partes[2] === "push" } : null,
  };
}

function leerVistaMapa(p: string[]): VistaMapa {
  if (p[1] === "recinto" && p[2]) return { recinto: p[2] };
  const [z, lat, lon] = p.slice(1, 4).map(Number);
  return Number.isFinite(z) && Number.isFinite(lat) && Number.isFinite(lon) && p.length >= 4
    ? { z: z as number, lat: lat as number, lon: lon as number } : {};
}

export const hashMapa = (z: number, lat: number, lon: number) => `#mapa/${z}/${lat.toFixed(4)}/${lon.toFixed(4)}`;
export const hashRecinto = (id: number | string) => `#mapa/recinto/${id}`;
