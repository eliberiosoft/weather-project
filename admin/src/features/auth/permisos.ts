/* Permisos → pestañas visibles. La API decide de verdad (403 «auth.permiso»); esto solo evita mostrar
   lo que el rol no puede usar. Tabla de roles: contrato §2. */
import type { Permiso, Usuario } from "../../shared/api/tipos";

export type Pestana = "mapa" | "situacion" | "reportes" | "incidentes" | "albergues" | "reglas" | "avisos" | "analisis" | "dispositivos" | "ajustes" | "usuarios" | "config";

/** Orden de las pestañas y el permiso que exige cada una. */
export const PESTANAS: readonly { id: Pestana; permiso: Permiso }[] = [
  { id: "mapa", permiso: "dashboard.ver" },          // solo superadmin: mapa en vivo de eventos
  { id: "situacion", permiso: "panel.ver" },
  { id: "reportes", permiso: "panel.ver" },
  { id: "incidentes", permiso: "incidentes.crear" },
  { id: "albergues", permiso: "albergues.gestionar" },  // superadmin y analista
  { id: "avisos", permiso: "panel.ver" },
  { id: "analisis", permiso: "dashboard.ver" },      // solo superadmin: mapa de calor, horas pico, sin atender, Excel
  { id: "dispositivos", permiso: "alcance.detalle" }, // solo superadmin: teléfonos que usan la app (por código, sin nombres)
  { id: "reglas", permiso: "reglas.editar" },
  { id: "ajustes", permiso: "ajustes.editar" },
  { id: "usuarios", permiso: "usuarios.gestionar" },
  { id: "config", permiso: "config.editar" },
];

export const tiene = (u: Pick<Usuario, "permisos"> | null | undefined, p: Permiso): boolean =>
  !!u && u.permisos.includes(p);

export function pestanasVisibles(permisos: readonly string[]): Pestana[] {
  return PESTANAS.filter((x) => permisos.includes(x.permiso)).map((x) => x.id);
}

/** La pestaña con la que abre cada rol: el operador sale a terreno a publicar incidentes; los demás, la situación. */
export const pestanaDelRol = (rol: string): Pestana | null => (rol === "operador" ? "incidentes" : null);

/** La pestaña del hash si el rol la puede ver; si no, la preferida del rol (si la ve) o la primera visible. */
export function pestanaInicial(hash: string, visibles: readonly Pestana[], preferida: Pestana | null = null): Pestana | null {
  const pedida = hash.replace(/^#/, "") as Pestana;
  if (visibles.includes(pedida)) return pedida;
  if (preferida && visibles.includes(preferida)) return preferida;
  return visibles[0] ?? null;
}

/** ¿Puede resolver o retirar este incidente? Manda `editable` de la API (autor o incidentes.gestionar);
    si no viene, se decide por el permiso, y el operador solo recibe los suyos (contrato §5). */
export function puedeGestionarIncidente(u: Pick<Usuario, "permisos" | "rol">, inc: { editable?: boolean }): boolean {
  if (typeof inc.editable === "boolean") return inc.editable;
  if (u.permisos.includes("incidentes.gestionar")) return true;
  return u.permisos.includes("incidentes.crear") && u.rol === "operador";
}
