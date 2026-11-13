/* Llamadas a la API. Todas llevan X-Requested-With (las rutas de la cuenta lo exigen contra el CSRF; la sesión del
   vecino va en una cookie HttpOnly que el navegador manda solo). El identificador del teléfono va en una cabecera, no en la dirección
   (las direcciones quedan en registros). Los errores traen una clave «k» que se traduce (app.error.<k>);
   si la clave no se conoce, se muestra el texto en español que manda la API. */
import { idDispositivo } from "./almacen";
import { I18N } from "./i18n";
import { pendientes } from "./pendientes";

export const DISP = idDispositivo();

export class ErrorApi extends Error {
  constructor(mensaje: string, readonly status: number, readonly k?: string) { super(mensaje); }
}

/** Mensaje del error en el idioma activo. */
export function mensajeError(j: { error?: string; k?: string }, status: number): string {
  if (j.k && I18N.existe("app.error." + j.k)) return I18N.t("app.error." + j.k);
  return j.error || `Error ${status}`;
}

/** Petición a la API. Las lecturas (GET) cuentan para la barra de carga global y el aviso de conexión lenta,
    salvo las de fondo ({ fondo: true }); los envíos tienen su propio estado en cada pantalla. */
export async function api<T>(ruta: string, opciones: RequestInit = {}, { fondo = false } = {}): Promise<T> {
  const lectura = !opciones.method || opciones.method === "GET";
  const fin = lectura && !fondo ? pendientes.empezar() : null;
  try {
    // no-store: la API ya responde no-store; además, sin esto el navegador hace esperar a «Reintentar» detrás de la
    // misma petición que sigue colgada (bloqueo de la caché HTTP por URL)
    const r = await fetch(ruta, { cache: "no-store", ...opciones, headers: { "X-Dispositivo": DISP, "X-Requested-With": "yaguachi", ...(opciones.headers || {}) } });
    const j = (await r.json().catch(() => ({}))) as T & { error?: string; k?: string };
    if (!r.ok) throw new ErrorApi(mensajeError(j, r.status), r.status, j.k);
    return j;
  } finally {
    fin?.();
  }
}

export const postJSON = <T>(ruta: string, cuerpo: unknown) =>
  api<T>(ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });

/** ¿Falló por la red (sin señal o señal débil) y no porque la API lo rechazó? fetch lanza TypeError. */
export const falloDeRed = (e: unknown, enLinea = navigator.onLine) => !enLinea || e instanceof TypeError;
