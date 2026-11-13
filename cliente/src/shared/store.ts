/* Estado compartido de la app: un store mínimo con useSyncExternalStore (sin librerías).
   Solo vive aquí lo que comparten varias vistas: datos de la API, el lugar elegido, la vista activa,
   el asistente de reporte (el mapa le fija la ubicación) y los avisos de la interfaz. */
import { useSyncExternalStore } from "react";
import { almacen } from "./almacen";
import type { Albergue, Avisos, Ciudadano, EstadoApi, Lugar, LugarDetalle, Reporte, RutaAlbergue, Territorio } from "./tipos";

export type Vista = "inicio" | "mapa" | "muro" | "reportar" | "avisos" | "privacidad" | "tormentas";
export const VISTAS: readonly Vista[] = ["inicio", "mapa", "muro", "reportar", "avisos", "privacidad", "tormentas"];

export type FiltroMuro = "cerca" | "mios" | "todos";
export type OrigenUbic = "gps" | "mapa" | "ajustada";

export interface UbicReporte {
  lat: number;
  lon: number;
  origen: OrigenUbic;
  prec?: number | null;
  /** nombre de la calle (texto), false si no hay calle a menos de 70 m, undefined mientras se busca */
  calle?: string | false;
}

export interface Asistente {
  paso: number | "ok";
  atras: boolean;
  tipo: string | null;
  altura: number | null;
  ubic: UbicReporte | null;
  /** hasta 3 fotos, ya reducidas (data URL JPEG) */
  fotos: string[];
  descripcion: string;
  consent: boolean;
  /** con cuenta: enviar este reporte sin ligarlo a la cuenta (sin cuenta siempre es anónimo) */
  anonimo: boolean;
  okTexto: string;
  ultimo: { lat: number; lon: number; id: string | null } | null;
}

export const ASISTENTE_VACIO: Asistente = {
  paso: 1, atras: false, tipo: null, altura: null, ubic: null, fotos: [], descripcion: "", consent: false, anonimo: false, okTexto: "", ultimo: null,
};

/** Estado de una carga que alimenta una vista: en camino, lista o fallida sin nada guardado que mostrar. */
export type Carga = "cargando" | "ok" | "error";

export interface EstadoApp {
  vista: Vista;
  /** territorio y estado del arranque: hasta tenerlos, las vistas muestran sus placeholders */
  arranque: Carga;
  mapaVisitado: boolean;
  /** «Tormentas» (spec 020) se baja y se monta recién al abrirla la primera vez (usa Leaflet) */
  tormentasVisitado: boolean;
  /** hay un despliegue nuevo listo y se espera para recargar (features/pwa/version.ts) */
  versionLista: boolean;
  /** aviso que se abrió por un enlace compartido o tocando la notificación (spec 021) */
  avisoDestacado: { id: number; push: boolean } | null;
  terr: Territorio | null;
  estado: EstadoApi | null;
  sinRed: boolean;
  enLinea: boolean;
  reportes: Reporte[];
  /** la lista de reportes: «cargando» hasta la primera respuesta */
  reportesCarga: Carga;
  lugar: Lugar | null;
  lugarDet: LugarDetalle | null;
  /** falló el detalle del lugar y no había copia guardada */
  lugarError: boolean;
  /** primera vez: se está pidiendo la ubicación del teléfono para elegir el lugar */
  buscandoUbic: boolean;
  avisos: Avisos | null;
  /** fallaron los avisos y no había copia guardada */
  avisosError: boolean;
  avisosNuevos: number;
  avisoCookies: boolean;
  modoMapa: null | "reporte" | "calle";
  filtroMuro: FiltroMuro;
  destacado: string | null;
  toast: { msg: string; ms: number; n: number } | null;
  instalable: boolean;
  /** reportes guardados en el teléfono por falta de señal, esperando enviarse solos */
  colaPendiente: number;
  /** se están enviando ahora */
  sincronizando: boolean;
  /** el asistente está enviando un reporte (el botón no acepta otro toque) */
  enviandoReporte: boolean;
  /** fotos abiertas en el visor (componentes/VisorFoto): de un reporte o de un albergue */
  fotoAbierta: FotosAbiertas | null;
  /** albergues que cargó el equipo (se ven en el mapa) */
  albergues: Albergue[];
  /** ruta dibujada en el mapa hasta un albergue */
  ruta: RutaAlbergue | null;
  /** ventana de inicio para activar ubicación y notificaciones (features/pwa/permisos) */
  permisos: boolean;
  /** confirmación antes de llamar al ECU 911 (app/Llamar911.tsx) */
  llamar911: boolean;
  /** guía para instalar en iPhone (app/GuiaIos.tsx) */
  guiaIos: boolean;
  /** globo que señala la barra de Safari después de la guía */
  pistaIos: boolean;
  rep: Asistente;
  cuenta: Cuenta;
  /** pantalla de ingreso (features/cuenta/Ingreso.tsx), null = cerrada */
  ingreso: Ingreso | null;
  /** hoja «Mi cuenta» de la cabecera */
  menuCuenta: boolean;
  /** sube al cambiar la foto de perfil (la URL de la foto lleva ?v= para no mostrar la vieja) */
  fotoV: number;
  /** la pantalla se tapa: la app salió de primer plano, se intentó capturar o imprimir (features/seguridad) */
  tapada: null | "fuera" | "captura";
  /** notificaciones: no pedidas, solo locales (app abierta) o push (también con la app cerrada) */
  notif: "no" | "local" | "push";
}

/** Quién usa la app (spec 018): sin elegir todavía, invitado (solo mira) o vecino con cuenta (reporta y comparte). */
export type Cuenta = { modo: "ninguna" } | { modo: "invitado" } | { modo: "ciudadano"; ciudadano: Ciudadano };
/** Por qué se abrió la pantalla de ingreso: al abrir la app, al tocar algo que exige cuenta o para editar los datos. */
export type MotivoIngreso = "inicio" | "reportar" | "compartir" | "vencida" | "editar";
/** Qué formulario muestra: iniciar sesión, crear cuenta o editar los datos de la cuenta. */
export type Pestana = "ingreso" | "registro" | "perfil";
/** La pantalla de ingreso abierta: con qué formulario, por qué y un mensaje (clave i18n) si lo hay. */
export interface Ingreso { motivo: MotivoIngreso; pestana: Pestana; mensaje?: string | null }

export interface FotosAbiertas { titulo: string; urls: string[]; i: number }

type Cambio<T> = Partial<T> | ((s: T) => Partial<T>);

export function crearStore<T extends object>(inicial: T) {
  let estado = inicial;
  const subs = new Set<() => void>();
  return {
    get: () => estado,
    set(cambio: Cambio<T>) {
      const p = typeof cambio === "function" ? cambio(estado) : cambio;
      estado = { ...estado, ...p };
      subs.forEach((f) => f());
    },
    subscribe(f: () => void) {
      subs.add(f);
      return () => { subs.delete(f); };
    },
  };
}

export const store = crearStore<EstadoApp>({
  vista: "inicio",
  arranque: "cargando",
  mapaVisitado: false,
  tormentasVisitado: false,
  versionLista: false,
  avisoDestacado: null,
  terr: null,
  estado: null,
  sinRed: false,
  enLinea: typeof navigator === "undefined" ? true : navigator.onLine,
  reportes: [],
  reportesCarga: "cargando",
  lugar: almacen.get<Lugar | null>("lugar", null),
  lugarDet: null,
  lugarError: false,
  buscandoUbic: false,
  avisos: null,
  avisosError: false,
  avisosNuevos: 0,
  avisoCookies: false,
  modoMapa: null,
  filtroMuro: almacen.get<FiltroMuro>("muro_filtro", "cerca"),
  destacado: null,
  toast: null,
  instalable: false,
  colaPendiente: 0,
  sincronizando: false,
  enviandoReporte: false,
  fotoAbierta: null,
  albergues: almacen.get<Albergue[]>("albergues", []),
  ruta: null,
  permisos: false,
  llamar911: false,
  guiaIos: false,
  pistaIos: false,
  rep: ASISTENTE_VACIO,
  cuenta: almacen.get<Cuenta>("cuenta", { modo: "ninguna" }),
  ingreso: null,
  menuCuenta: false,
  fotoV: 0,
  tapada: null,
  notif: estadoNotif(),
});

function estadoNotif(): EstadoApp["notif"] {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return "no";
  return almacen.get<unknown>("push", null) ? "push" : "local";
}

/** Lee una parte del estado. El selector debe devolver algo que ya esté en el estado (o un primitivo). */
export function useApp<S>(sel: (s: EstadoApp) => S): S {
  return useSyncExternalStore(store.subscribe, () => sel(store.get()), () => sel(store.get()));
}

export const setRep = (p: Partial<Asistente> | ((r: Asistente) => Partial<Asistente>)) =>
  store.set((s) => ({ rep: { ...s.rep, ...(typeof p === "function" ? p(s.rep) : p) } }));

let nToast = 0;
export function toast(msg: string, ms = 3800) {
  store.set({ toast: { msg, ms, n: ++nToast } });
}
