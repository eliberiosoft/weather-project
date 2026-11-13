/* Estado, validación y cuerpo del formulario de incidentes (contrato §5). */
import type { NuevoIncidente } from "../../shared/api/tipos";
import { textoConSentido } from "../../shared/formato";
import { bytesDataUrl, MAX_BYTES } from "./foto";

/** Horas de vigencia por defecto de cada tipo (las mismas de TIPOS en api/servidor.py). */
export const HORAS_TIPO: Record<string, number> = {
  calle_inundada: 8, vivienda_inundada: 24, rio_crecido: 12, desborde: 24, via_cerrada: 24, alcantarilla: 72,
  dique_filtracion: 72, socavon: 72, arbol_poste: 24, sin_luz: 12, lluvia_fuerte: 3, aislados: 24,
  cultivos_ganado: 72, bache: 168, basura: 48, robo: 24, otro: 24,
};
export const TIPOS = Object.keys(HORAS_TIPO);
export const MAX_DESCRIPCION = 500;

export interface FormIncidente {
  tipo: string;
  gravedad: 1 | 2 | 3;
  altura: 1 | 2 | 3 | null;
  descripcion: string;
  horas: string;
  via: string;
  foto: string | null;
  lat: number | null;
  lon: number | null;
  tramo: [number, number][] | null;
  dentro: boolean;
}

export const formVacio = (): FormIncidente => ({
  tipo: "", gravedad: 2, altura: null, descripcion: "", horas: "", via: "", foto: null, lat: null, lon: null, tramo: null, dentro: true,
});

export const esCalle = (f: Pick<FormIncidente, "tipo">) => f.tipo === "calle_inundada";

/** Primer problema del formulario como clave i18n, o null si se puede enviar. */
export function validarIncidente(f: FormIncidente): string | null {
  if (!f.tipo || !(f.tipo in HORAS_TIPO)) return "panel.inc.falta_tipo";
  if (esCalle(f) && !f.altura) return "panel.inc.falta_altura";
  const d = f.descripcion.trim();
  if (!textoConSentido(d) || d.length > MAX_DESCRIPCION) return "panel.inc.falta_descripcion";
  const h = Number(f.horas || HORAS_TIPO[f.tipo]);
  if (!Number.isInteger(h) || h < 1 || h > 168) return "panel.inc.horas_mal";
  if (f.lat === null || f.lon === null) return "panel.inc.ubicacion_falta";
  if (!f.dentro) return "panel.inc.fuera";
  if (f.foto && bytesDataUrl(f.foto) > MAX_BYTES) return "panel.inc.foto_grande";
  return null;
}

/** Cuerpo de POST /api/panel/incidentes. En «calle inundada» la gravedad sale de la altura del agua. */
export function cuerpoIncidente(f: FormIncidente): NuevoIncidente {
  if (f.lat === null || f.lon === null) throw new Error("sin ubicación");
  const calle = esCalle(f) && f.altura;
  const c: NuevoIncidente = {
    tipo: f.tipo,
    gravedad: calle ? f.altura as 1 | 2 | 3 : f.gravedad,
    descripcion: f.descripcion.trim(),
    lat: +f.lat.toFixed(6),
    lon: +f.lon.toFixed(6),
    horas: Number(f.horas || HORAS_TIPO[f.tipo]),
  };
  if (f.foto) c.foto = f.foto;
  if (calle) {
    c.altura_agua = f.altura as 1 | 2 | 3;
    if (f.via.trim()) c.via = f.via.trim().slice(0, 120);
    if (f.tramo && f.tramo.length >= 2) c.tramo = f.tramo;
  }
  return c;
}

/** Pasos del asistente: qué pasa → cuánta agua / qué tan grave → dónde → detalles y foto → revisar y publicar. */
export const PASOS = 5;

/** ¿Se puede pasar del paso n? (el último usa validarIncidente completo) */
export function pasoListo(f: FormIncidente, n: number): boolean {
  if (n === 1) return !!f.tipo && f.tipo in HORAS_TIPO;
  if (n === 2) return esCalle(f) ? !!f.altura : !!f.gravedad;
  if (n === 3) return f.lat !== null && f.lon !== null && f.dentro;
  if (n === 4) {
    const d = f.descripcion.trim(), h = Number(f.horas || HORAS_TIPO[f.tipo]);
    return textoConSentido(d) && d.length <= MAX_DESCRIPCION && Number.isInteger(h) && h >= 1 && h <= 168;
  }
  return validarIncidente(f) === null;
}
