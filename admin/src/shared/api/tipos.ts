/* Tipos de la API del panel (contrato: specs/014-usuarios-incidentes-push-react/contracts/api.md
   y las rutas /api/panel/* de api/servidor.py). */

export type Rol = "superadmin" | "analista" | "operador";
export const ROLES: readonly Rol[] = ["superadmin", "analista", "operador"];

export type Permiso =
  | "panel.ver" | "niveles.fijar" | "reportes.revisar" | "avisos.publicar" | "reglas.editar"
  | "ajustes.editar" | "incidentes.crear" | "incidentes.gestionar" | "usuarios.gestionar" | "config.editar"
  | "dashboard.ver" | "avisos.eliminar" | "incidentes.eliminar" | "incidentes.reactivar" | "albergues.gestionar"
  | "reportes.vigencia" | "reportes.eliminar" | "alcance.detalle";

export interface Usuario {
  id: number;
  usuario: string;
  nombre: string;
  rol: Rol;
  permisos: string[];
  debe_cambiar_clave: boolean;
  activo: boolean;
  creado: string;
  ultimo_ingreso: string | null;
}

export type NivelCod = 1 | 2 | 3 | 4;
export type Nivel = NivelCod | null | undefined;

/** Motivo estructurado que calcula el servidor (el motor i18n lo arma en el idioma activo). */
export interface ConMotivos { motivo?: string; motivos?: { k: string; v?: Record<string, string | number>; pid?: string; src?: string }[] }

export interface EstadoRio extends ConMotivos {
  rio: string;
  sugerido: Nivel;
  fuente_sugerido: string;
  sugerido_pleamar: Nivel;
  oficial: Nivel;
  oficial_motivo: string | null;
  oficial_hora: string | null;
  puntos: string[];
}

export interface EstadoRecinto extends ConMotivos {
  id: number;
  sugerido: NivelCod;
  oficial: Nivel;
  oficial_fuente?: string | null;
}

export interface EstadoPanel {
  generado: string;
  canton: { sugerido: Nivel; oficial: Nivel; oficial_motivo: string | null; oficial_hora: string | null };
  advertencia: { vigente?: boolean; texto?: string; hasta?: string | null } | null;
  aguaje: { hasta?: string | null; nota?: string } | null;
  rios: EstadoRio[];
  recintos: Record<string, EstadoRecinto>;
  fuentes: { lluvia_actualizada?: string | null; lluvia_desactualizada?: boolean };
}

export interface PuntoControl { id: string; rio: string; sitio: string }
export interface Lectura {
  creado: string; punto_id: string; lectura_m: number; tendencia: "sube" | "baja" | "igual" | null;
  lluvia: number; vigia: string | null;
}
/** Alcance (spec 021): teléfonos distintos que lo abrieron; `push`: cuántos desde la notificación; `enviados`: a
    cuántos les llegó la notificación (avisos; null si todavía no salió). Nunca quiénes. */
export interface Alcance { vistas: number; push: number; enviados?: number | null }

export interface Aviso {
  id: number; creado: string; nivel_cod: NivelCod; titulo: string; texto: string;
  ambito_tipo: AmbitoTipo; ambito_id: string; ambito_nombre: string | null; vigente_hasta: string; anulado: number;
  /** imagen tipo flyer: /api/avisos/<id>/flyer?v=… */
  flyer?: string | null;
  alcance?: Alcance;
}
export interface CambioNivel { id: number; creado: string; ambito_tipo: string; ambito_id: string; nivel_cod: Nivel; motivo: string }
export interface RecintoRef { id: number; nombre: string; parroquia: string }

export interface Ajustes {
  advertencia: { vigente?: boolean; texto?: string; hasta?: string | null } | null;
  aguaje: { hasta?: string | null; nota?: string } | null;
  reglas: Record<string, { punto_id: string; borde_m: number | null; nota?: string | null }>;
  lecturas: Record<string, Lectura[]>;
  puntos: Record<string, PuntoControl>;
  historial_niveles: CambioNivel[];
  avisos: Aviso[];
  parroquias: string[];
  recintos: RecintoRef[];
}

export type AmbitoTipo = "canton" | "parroquia" | "rio" | "recinto";
export type EstadoReporte = "pendiente" | "validado" | "descartado" | "resuelto" | "retirado";

export interface Autor { nombre: string; rol: Rol }

export interface Reporte {
  id: string;
  tipo: string;
  etiqueta?: string;
  /** 0: «por tipificar» (reporte de vecino que el equipo aún no clasifica) */
  gravedad: 0 | 1 | 2 | 3;
  descripcion: string | null;
  lat: number;
  lon: number;
  recinto: string | null;
  creado: string;
  expira: string;
  estado: EstadoReporte;
  nota_ugr: string | null;
  foto: boolean;
  /** cuántas fotos tiene (hasta 3): /api/foto/<id>, /api/foto/<id>/2, /api/foto/<id>/3 */
  n_fotos?: number;
  sigue: number;
  ya_no: number;
  altura_agua: 1 | 2 | 3 | null;
  altura_txt?: string | null;
  via: string | null;
  dispositivo?: string;
  en_canton?: boolean;
  origen?: "vecino" | "equipo";
  autor?: Autor | null;
  /** Solo en GET /api/panel/incidentes: la persona puede resolverlo o retirarlo (autora o incidentes.gestionar). */
  editable?: boolean;
  /** «vecinos»: lo publicaron varias personas del mismo sector sin revisión del equipo; «analista»: lo verificó después */
  validado_por?: "vecinos" | "analista" | null;
  vecinos_n?: number | null;
  /** Solo en GET /api/panel/incidentes: cuántos teléfonos lo abrieron (spec 021) */
  alcance?: Alcance;
}

export interface NuevoIncidente {
  tipo: string;
  gravedad: 1 | 2 | 3;
  descripcion: string;
  lat: number;
  lon: number;
  horas: number;
  foto?: string;
  altura_agua?: 1 | 2 | 3;
  via?: string;
  tramo?: [number, number][];
}

/** GET /api/panel/albergues (contrato §5 quater). `fotos`: cuántas tiene (/api/albergues/<id>/foto/<n>). */
export interface Albergue { id: string; nombre: string; descripcion: string | null; lat: number; lon: number; fotos: number; actualizado: string }

export interface ConfigPanel {
  incidentes_anonimos: boolean;
  /** lo que publica el operador sale validado (si no, queda pendiente hasta que lo verifiquen) */
  operador_valida_directo: boolean;
  validacion_vecinos: boolean;
  validacion_minimo: number;
  validacion_radio_m: number;
  validacion_horas: number;
}
/** GET /api/auth/me: la sesión y cómo se publican los incidentes (visible para todo rol). */
/** `publicacion`: cómo saldrá lo que publique esta persona (anónimo o con nombre; validado o pendiente). */
export interface RespuestaMe { usuario: Usuario; publicacion?: { incidentes_anonimos: boolean; validado_directo?: boolean } }

/** Un evento del mapa en vivo (GET /api/panel/mapa, solo dashboard.ver). */
export interface EventoMapa extends Reporte {
  tramo?: [number, number][] | null;
  revisado_en?: string | null;
}

/** GET /api/panel/analisis (solo dashboard.ver). Horas en hora de Ecuador; semana[0] es el lunes. */
export interface Analisis {
  periodo: { dias: number; desde: string; hasta: string };
  total: number;
  vecinos: number;
  equipo: number;
  limitado: boolean;
  por_estado: Record<string, number>;
  por_tipo: { tipo: string; etiqueta: string; n: number }[];
  puntos: [number, number][];
  zonas: { recinto: string | null; n: number; sin_atender: number; lat: number; lon: number }[];
  horas: number[];
  semana: number[][];
  pico: { hora: number | null; dia: number | null; hora_dia: number | null };
  sin_atender: {
    id: string; tipo: string; etiqueta: string; origen: "vecino" | "equipo"; estado: string; creado: string;
    recinto: string | null; lat: number; lon: number; descripcion: string; vencido: boolean; horas: number;
  }[];
  atencion: { revisados: number; mediana_horas: number | null; promedio_horas: number | null };
}
