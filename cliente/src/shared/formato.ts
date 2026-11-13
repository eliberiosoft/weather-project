/* Formato de fechas, números y nombres en el idioma activo, y geometría simple. */
import { I18N } from "./i18n";

export const hora = (iso: string | Date | null | undefined) =>
  iso ? I18N.fecha(iso, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

/** Solo la hora («21:50»), para lo que es de hace minutos. */
export const horaCorta = (iso: string) => I18N.fecha(iso, { hour: "2-digit", minute: "2-digit" });

/** «hace 5 min», «hace 3 h»; más de un día, la fecha y hora. */
export function hace(iso: string, ahora = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(I18N.locale(), { numeric: "auto", style: "short" });
  const m = Math.round((new Date(iso).getTime() - ahora) / 60000);
  if (m > -60) return rtf.format(m, "minute");
  if (m > -1440) return rtf.format(Math.round(m / 60), "hour");
  return hora(iso);
}

export const num = (v: number | null | undefined, dec = 0) =>
  Number(v).toLocaleString(I18N.locale(), { maximumFractionDigits: dec, minimumFractionDigits: dec });

export const metros = (m: number | null | undefined) => (m == null ? "—" : m >= 1000 ? num(m / 1000, 1) + " km" : num(m) + " m");

/** «SAN JACINTO DE YAGUACHI» → «San Jacinto de Yaguachi» (los nombres vienen en mayúsculas de la capa CONALI). */
export const nombrePropio = (x: string | null | undefined) => String(x || "").toLowerCase()
  .replace(/(^|[\s(.-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase())
  .replace(/ (De|Del|La|Las|Los|Y|J\.) /g, (m) => m.toLowerCase().replace("j.", "J."));

/** Para buscar sin tildes ni mayúsculas. */
export const normalizar = (x: unknown) => String(x || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

/** Distancia aproximada en metros (equirectangular: basta a escala de cantón). */
export function distM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const x = (lon2 - lon1) * 111320 * Math.cos((lat1 * Math.PI) / 180), y = (lat2 - lat1) * 110574;
  return Math.hypot(x, y);
}

export const sinMovimiento = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Lo mínimo para publicar un texto (igual que la API, texto_con_sentido en api/servidor.py): al menos `minimo`
    caracteres y 3 letras o números. «.» o «...» no cuentan: nada se publica vacío. */
export const MIN_DESCRIPCION = 5;
export function textoConSentido(t: string, minimo = MIN_DESCRIPCION): boolean {
  const s = t.trim();
  return s.length >= minimo && (s.match(/[\p{L}\p{N}]/gu) ?? []).length >= 3;
}
