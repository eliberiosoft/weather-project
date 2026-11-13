/* Cliente HTTP del panel.
   - La sesión es una cookie HttpOnly (`__Host-yw_sesion` con HTTPS, `yw_sesion` en desarrollo): el front nunca guarda tokens.
   - Toda petición va con credentials "same-origin" y la cabecera anti-CSRF X-Requested-With: yaguachi.
   - 401 → avisa a la sesión (vuelve al ingreso). 403 con k "auth.cambiar_clave" → pantalla de cambio de clave.
   - Cada petición cuenta en `pendientes` (barra global y aviso de conexión lenta); «Reintentar» relanza las lecturas. */
import { pendientes } from "./pendientes";

export class ErrorApi extends Error {
  readonly status: number;
  readonly k: string | undefined;
  constructor(status: number, k?: string, mensaje?: string) {
    super(mensaje || k || `HTTP ${status}`);
    this.name = "ErrorApi";
    this.status = status;
    this.k = k;
  }
}

/** Estado 0: no hubo respuesta (sin red o servidor caído). */
export const SIN_RED = 0;

interface Oyentes {
  sinSesion?: () => void;
  cambiarClave?: () => void;
}
const oyentes: Oyentes = {};

/** La sesión se registra aquí para enterarse de un 401 o de una clave temporal sin acoplar el cliente a React. */
export function escucharApi(o: Oyentes): () => void {
  Object.assign(oyentes, o);
  return () => { oyentes.sinSesion = undefined; oyentes.cambiarClave = undefined; };
}

export interface OpcionesApi {
  /** No dispara el regreso al ingreso ante un 401 (el ingreso y /api/auth/me lo manejan solos). */
  sinRedirigir?: boolean;
  /** Para cancelar la petición al desmontar. */
  signal?: AbortSignal;
}

/** Motivo con el que «Reintentar» corta una lectura para relanzarla. */
const REINTENTO = "yw-reintentar";

/** fetch que «Reintentar» puede relanzar (solo lecturas: una escritura repetida podría duplicarse). */
async function pedir(ruta: string, init: RequestInit, externa: AbortSignal | undefined): Promise<Response> {
  for (;;) {
    const corte = new AbortController();
    const seguirExterna = () => corte.abort(externa?.reason);
    if (externa?.aborted) seguirExterna();
    externa?.addEventListener("abort", seguirExterna);
    const quitar = init.method ? undefined : pendientes.alReintentar(() => corte.abort(REINTENTO));
    try {
      return await fetch(ruta, { ...init, signal: corte.signal });
    } catch (e) {
      if (corte.signal.reason === REINTENTO && !externa?.aborted) continue;
      throw e;
    } finally {
      externa?.removeEventListener("abort", seguirExterna);
      quitar?.();
    }
  }
}

export async function api<T>(ruta: string, cuerpo?: unknown, op: OpcionesApi = {}): Promise<T> {
  const headers: Record<string, string> = { "X-Requested-With": "yaguachi", Accept: "application/json" };
  const init: RequestInit = { credentials: "same-origin", headers, cache: "no-store" };
  if (cuerpo !== undefined) {
    init.method = "POST";
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(cuerpo);
  }
  const terminar = pendientes.empezar();
  let r: Response;
  let j: { error?: string; k?: string } & Record<string, unknown>;
  try {
    try {
      r = await pedir(ruta, init, op.signal);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      throw new ErrorApi(SIN_RED, "panel.error.red");
    }
    j = (await r.json().catch(() => ({}))) as typeof j;
  } finally {
    terminar();
  }
  if (r.status === 401 && !op.sinRedirigir) oyentes.sinSesion?.();
  if (r.status === 403 && j.k === "auth.cambiar_clave") oyentes.cambiarClave?.();
  if (!r.ok) throw new ErrorApi(r.status, typeof j.k === "string" ? j.k : undefined, typeof j.error === "string" ? j.error : undefined);
  return j as T;
}

/** Texto para la persona: la clave i18n `k` si existe; si no, el texto de la API; si no, uno genérico. */
export function mensajeError(e: unknown, t: (k: string, v?: Record<string, string | number>) => string,
  existe: (k: string) => boolean): string {
  if (e instanceof ErrorApi) {
    if (e.k && existe(e.k)) return t(e.k);
    if (e.status === SIN_RED) return t("panel.error.red");
    if (e.message && e.message !== `HTTP ${e.status}` && e.message !== e.k) return e.message;
    return t("panel.error.generico", { codigo: e.status });
  }
  return t("panel.error.generico", { codigo: "?" });
}
