/* Tipos de lo que devuelve la API pública (api/servidor.py) y del estado local de la app. */
import type { Motivo } from "@compartido/i18n/motor.js";

export type Nivel = 0 | 1 | 2 | 3 | 4;
export type LatLon = [number, number];

export interface Recinto {
  id: number;
  nombre: string;
  parroquia?: string | null;
  etiqueta?: string | null;
  lat: number;
  lon: number;
  prioridad?: string | null;
  riesgo_base?: string | null;
  rio_cercano?: string | null;
  dist_rio_m?: number | null;
}

export interface TipoReporte { etiqueta: string; emoji?: string; horas?: number }

export interface Territorio {
  recintos: Record<string, Recinto>;
  calles?: { nombre: string; cerca: string; lat: number; lon: number }[];
  tipos: Record<string, TipoReporte>;
  url_publica?: string | null;
}

export interface Lluvia {
  prox_24h: number;
  suma_3d: number;
  ult_24h: number;
  hoy_indice: number;
  dias: { fecha: string; mm: number }[];
}

/** Nivel de un recinto, un lugar o un río: el sugerido (modelo y reportes) y el verificado («oficial» en la API). */
export interface NivelLugar {
  sugerido?: number | null;
  motivo?: string;
  motivos?: Motivo[];
  oficial?: number | null;
  oficial_fuente?: string | null;
  oficial_motivo?: string | null;
  oficial_hora?: string | null;
  lluvia?: Lluvia | null;
}

export interface EstadoRio extends NivelLugar {
  rio: string;
  fuente_sugerido?: string;
  sugerido_pleamar?: number | null;
  puntos: string[];
}

export interface Glofas {
  q_hoy?: number | null;
  p90: number;
  q2: number;
  q5: number;
  prob: { Q2_30d: number };
}

export interface Regla { lectura_m: number; hora: string; falta_borde_m?: number | null }

export interface EstadoApi {
  generado?: string;
  advertencia?: { texto?: string } | null;
  aguaje?: { hasta: string; nota?: string } | null;
  rios: EstadoRio[];
  puntos: Record<string, { glofas?: Glofas | null; regla?: Regla | null }>;
  recintos: Record<string, NivelLugar>;
}

/** Lo que el usuario eligió en «Mi lugar»: un recinto o un punto (calle o GPS). */
export type Lugar =
  | { tipo: "recinto"; id: number; texto?: string }
  | { tipo: "punto"; lat: number; lon: number; nombre?: string; texto?: string; gps?: boolean; calle?: boolean };

export interface LugarDetalle {
  recinto: Recinto & { recinto_cercano?: string | null; id: number | null };
  estado: NivelLugar;
  rio: EstadoRio | null;
  equipamientos: { nombre: string; categoria: string; dist_m: number }[];
  generado?: string;
}

export type EstadoReporte = "pendiente" | "validado" | "descartado" | "resuelto" | "retirado";

export interface Autor { nombre: string; rol?: string }

export interface Reporte {
  id: string;
  tipo: string;
  etiqueta?: string;
  gravedad: number;
  descripcion?: string | null;
  lat: number;
  lon: number;
  recinto?: string | null;
  creado: string;
  expira?: string | null;
  estado: EstadoReporte | string;
  nota_ugr?: string | null;
  foto?: boolean;
  /** cuántas fotos se pueden ver (hasta 3): /api/foto/<id>, /api/foto/<id>/2, /api/foto/<id>/3 */
  n_fotos?: number;
  foto_k?: string | null;
  sigue?: number;
  ya_no?: number;
  mio?: boolean;
  altura_agua?: number | null;
  via?: string | null;
  tramo?: LatLon[] | null;
  verificado?: boolean;
  /** «vecinos»: lo publicaron varias personas distintas del mismo sector, sin revisión del equipo (fotos privadas);
      «analista»: el equipo lo verificó después. `vecinos_n`: cuántas personas lo confirmaron. */
  validado_por?: "vecinos" | "analista" | null;
  vecinos_n?: number | null;
  likes?: number;
  me_gusta?: boolean;
  /** v2: «equipo» si lo publicó el panel; el autor es null para los vecinos o si el equipo publica en anónimo. */
  origen?: "vecino" | "equipo";
  autor?: Autor | null;
}

export interface Aviso {
  id: number;
  nivel_cod: number;
  titulo: string;
  texto: string;
  ambito_nombre?: string | null;
  creado: string;
  vigente_hasta: string;
  /** imagen tipo flyer (spec 021): /api/avisos/<id>/flyer?v=… */
  flyer?: string | null;
}

export interface Avisos { vigentes: Aviso[]; anteriores: Aviso[]; horas_silencio?: [number, number] }

/** Cuerpo de POST /api/reportes (también lo que queda en la cola sin conexión). */
export interface CuerpoReporte {
  dispositivo: string;
  tipo: string;
  /** la API la ignora en los reportes de vecinos (la tipifica el equipo); en calles va la altura del agua */
  gravedad?: number;
  descripcion?: string;
  lat: number;
  lon: number;
  /** hasta 3 fotos (data URL JPEG); `foto` suelta: reportes guardados por la versión anterior */
  fotos?: string[];
  foto?: string | null;
  consentimiento: true;
  /** enviar sin ligarlo a la cuenta (sin sesión ya es anónimo) */
  anonimo?: boolean;
  altura_agua?: number;
  via?: string;
  tramo?: LatLon[] | null;
}

export interface PushConfig {
  habilitado: boolean;
  firebase?: { apiKey: string; authDomain: string; projectId: string; messagingSenderId: string; appId: string };
  vapid_key?: string;
}

/** Cuenta de un vecino (spec 018): solo la ve su dueño. */
export interface Ciudadano {
  /** nombres y apellidos, en un solo texto */
  nombre: string;
  cedula: string;
  email: string;
  /** tiene foto de perfil (GET /api/cuenta/foto) */
  foto: boolean;
  creado: string;
}

/** Datos del formulario de registro o de perfil (la foto, como data URL JPEG). */
export interface DatosCuenta { nombre: string; cedula: string; email: string; clave?: string; foto?: string | null }

/** GET /api/albergues: los carga el equipo desde el panel. `fotos`: cuántas tiene (/api/albergues/<id>/foto/<n>). */
export interface Albergue { id: string; nombre: string; descripcion: string | null; lat: number; lon: number; fotos: number; actualizado: string }

export type ModoRuta = "pie" | "auto";
/** GET /api/ruta: el camino por las calles hasta un albergue. */
export interface RespuestaRuta { modo: ModoRuta; linea: LatLon[]; metros: number; segundos: number }
/** La ruta dibujada en el mapa. `desde`: tu ubicación al pedirla; `cruzaAgua`: pasa por una calle reportada «no cruces». */
export interface RutaAlbergue extends RespuestaRuta { albergue: Albergue; desde: LatLon; cruzaAgua: boolean }
