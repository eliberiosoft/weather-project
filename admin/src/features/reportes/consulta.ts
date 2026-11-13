/* «Reportes» del panel: filtros, paginación y fechas de «visible hasta» (contrato de la spec 019). */
import { TIPOS } from "../incidentes/formulario";

export const ESTADOS = ["pendiente", "vecinos", "validado", "descartado", "resuelto", "retirado", "todos"] as const;
export const ORIGENES = ["todos", "vecino", "equipo"] as const;
export const VIGENCIAS = ["todas", "vigentes", "vencidos"] as const;
export const TIPOS_FILTRO = ["todos", ...TIPOS] as const;
export const POR_PAGINA = 20;

export interface Filtros {
  estado: (typeof ESTADOS)[number];
  origen: (typeof ORIGENES)[number];
  tipo: string;
  vigencia: (typeof VIGENCIAS)[number];
  q: string;
}
export const FILTROS_INICIALES: Filtros = { estado: "pendiente", origen: "todos", tipo: "todos", vigencia: "todas", q: "" };

/** Ruta de GET /api/panel/reportes con los filtros que cambian algo (los «todos» no se mandan). */
export function rutaReportes(f: Filtros, pagina: number, n = POR_PAGINA): string {
  const p = new URLSearchParams({ estado: f.estado, pagina: String(pagina), n: String(n) });
  if (f.origen !== "todos") p.set("origen", f.origen);
  if (f.tipo !== "todos") p.set("tipo", f.tipo);
  if (f.vigencia !== "todas") p.set("vigencia", f.vigencia);
  const q = f.q.trim().slice(0, 80);
  if (q) p.set("q", q);
  return "/api/panel/reportes?" + p.toString();
}

const dos = (n: number) => String(n).padStart(2, "0");

/** ISO → valor de <input type="datetime-local"> en la hora del equipo (la del navegador). */
export function aLocal(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> → ISO con zona (la API lo pasa a la hora de Ecuador). null si está vacío o mal. */
export function desdeLocal(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Límites que acepta la API: de 5 minutos a 90 días desde ahora. */
export const MAX_DIAS = 90;
export function fechaValida(iso: string | null, ahora = Date.now()): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return t >= ahora + 5 * 60_000 && t <= ahora + MAX_DIAS * 86_400_000;
}
