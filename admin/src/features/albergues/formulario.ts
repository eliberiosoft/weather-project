/* Formulario de un albergue: estado, validación y cuerpo para la API (funciones puras, se prueban sin navegador). */
import type { Albergue } from "../../shared/api/tipos";
import { textoConSentido } from "../../shared/formato";

export const MAX_NOMBRE = 80;
export const MAX_DESC = 280;
export const MAX_FOTOS = 3;
/** Las fotos de los albergues se ven en celulares: 1024 px de lado mayor bastan. */
export const LADO_FOTO = 1024;

/** Una foto del formulario: una que ya tiene el albergue (su número, 1–3) o una nueva (data URL JPEG). */
export type FotoForm = { n: number } | { nueva: string };

export interface FormAlbergue {
  nombre: string;
  descripcion: string;
  lat: number | null;
  lon: number | null;
  dentro: boolean;
  fotos: FotoForm[];
}

export function formDe(a: Albergue | null): FormAlbergue {
  if (!a) return { nombre: "", descripcion: "", lat: null, lon: null, dentro: true, fotos: [] };
  return { nombre: a.nombre, descripcion: a.descripcion ?? "", lat: a.lat, lon: a.lon, dentro: true,
    fotos: Array.from({ length: a.fotos }, (_, i) => ({ n: i + 1 })) };
}

/** Clave i18n de lo que falta, o null si se puede guardar. */
export function faltaAlbergue(f: FormAlbergue): string | null {
  if (!textoConSentido(f.nombre, 3) || f.nombre.trim().length > MAX_NOMBRE) return "albergues.nombre";
  if (f.descripcion.trim().length > MAX_DESC) return "albergues.descripcion";
  if (f.lat === null || f.lon === null) return "albergues.ubicacion";
  if (!f.dentro) return "albergues.fuera";
  if (f.fotos.length > MAX_FOTOS) return "foto.demasiadas";
  return null;
}

export function cuerpoAlbergue(f: FormAlbergue) {
  return {
    nombre: f.nombre.trim(), descripcion: f.descripcion.trim(), lat: f.lat, lon: f.lon,
    fotos: f.fotos.map((x) => ("n" in x ? x.n : x.nueva)),
  };
}

/** `v` cambia al editar: el navegador no se queda con una foto vieja guardada. */
export const urlFotoAlbergue = (a: Pick<Albergue, "id" | "actualizado">, n: number) =>
  `/api/albergues/${encodeURIComponent(a.id)}/foto/${n}?v=${encodeURIComponent(a.actualizado)}`;
