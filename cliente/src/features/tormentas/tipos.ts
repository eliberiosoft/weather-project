/* Lo que devuelve la API de tormentas (spec 020, contracts/api.md). */

export type EstadoCerca = "sin" | "lejos" | "cerca" | "encima";
export type Rumbo = "n" | "ne" | "e" | "se" | "s" | "so" | "o" | "no";
export type Tendencia = "acercandose" | "alejandose" | "quieta" | "nueva";

/** La nube de tormenta más cercana al centro del cantón, en la imagen de satélite más reciente. */
export interface Cerca {
  dist_km: number | null;
  rumbo: Rumbo | null;
  /** la más fuerte a menos de 40 km: 0 ninguna, 1 nube de tormenta, 2 fuerte, 3 muy fuerte */
  intensidad: 0 | 1 | 2 | 3;
  estado: EstadoCerca;
  tendencia: Tendencia | null;
  t: string;
  /** true: el satélite no respondió y es la última respuesta buena (de hasta 6 h) */
  viejo?: boolean;
}

/** Destellos de los últimos 30 min ([lat, lon, minutos atrás]). Mientras se leen por primera vez: {calculando: true}. */
export interface Rayos {
  calculando?: boolean;
  desde_min?: number;
  n?: number;
  cerca_n?: number;
  cerca_km?: number | null;
  completo?: boolean;
  t?: string;
  viejo?: boolean;
  puntos?: [number, number, number][];
}

/** Lluvia de las próximas 2 h en tramos de 15 min (modelo Open-Meteo, no medición). */
export interface Lluvia {
  proxima_hora_mm: number;
  max_15_mm: number;
  serie: { t: string; mm: number }[];
  viejo: boolean;
}

/** El radar de «Mi lugar»: celdas en km desde el centro del cantón (x al este, y al norte). */
export interface Radar {
  radio_km: number;
  t: string;
  /** [x_km, y_km, clase 1-3], celdas de 10 km */
  nubes: [number, number, 1 | 2 | 3][];
  /** [x_km, y_km, minutos del más reciente], celdas de 5 km; null mientras se leen los rayos */
  rayos: [number, number, number][] | null;
}

export interface ResumenTormentas {
  cerca: Cerca | null;
  rayos: Rayos | null;
  lluvia: Lluvia | null;
  radar: Radar | null;
  centro: [number, number];
  radios: { encima: number; cerca: number; lejos: number; rayos: number };
}

export interface ClaseNube { c: 1 | 2 | 3; color: string; alfa: number; desde: number }
export interface Marco { id: string; t: string }

/** Hacia dónde va cada tormenta: de dónde está a dónde estaría en 1 h si sigue igual (aproximado). */
export interface Flecha { desde: [number, number]; hacia: [number, number]; km_h: number; rumbo: Rumbo; clase: 1 | 2 | 3 }
export interface Movimiento { t: string; desde_min: number; flechas: Flecha[] }

export interface Tormentas extends ResumenTormentas {
  movimiento: Movimiento | null;
  /** marcos: solo las horas ya armadas en el servidor; preparando: cuántas se están armando todavía */
  mosaico: { limites: [[number, number], [number, number]]; clases: ClaseNube[]; marcos: Marco[]; preparando: number };
}
