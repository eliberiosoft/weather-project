/* Cola de reportes sin conexión (ay_cola_reportes): si el envío falla por la red, el reporte queda guardado en el
   teléfono y se manda solo, sin que la persona haga nada:
   - al abrir la app, al volver la señal, al volver a la app (visibilitychange) y cada 30 s mientras quede algo;
   - un solo envío a la vez (el aviso de «online» y el reintento periódico no lo mandan dos veces);
   - cada reporte lleva un id local: si se guarda otro mientras se envía, no se pierde al limpiar la cola.
   La cabecera muestra cuántos quedan y cuándo se están enviando (store: colaPendiente, sincronizando). */
import { almacen } from "../../shared/almacen";
import { ErrorApi, falloDeRed, postJSON } from "../../shared/api";
import { distM } from "../../shared/formato";
import { t } from "../../shared/i18n";
import { store, toast } from "../../shared/store";
import type { CuerpoReporte } from "../../shared/tipos";

const CLAVE = "cola_reportes";
const CADA = 30 * 1000;
/** Lo mismo que la API considera repetido: mismo tipo a menos de 150 m (ver crear_reporte en api/servidor.py). */
export const RADIO_REPETIDO = 150;
/** Como mucho tantos esperando señal: es el tope de reportes por hora y teléfono de la API (max_reportes_hora_dispositivo). */
export const MAX_COLA = 6;
export type ResultadoCola = "ok" | "sin_foto" | "repetido" | "tope" | "";

/** ¿Ya hay en la cola uno igual? (doble toque o el mismo reporte enviado otra vez sin señal) */
export const repetido = (cola: CuerpoReporte[], c: CuerpoReporte) =>
  cola.some((x) => x.tipo === c.tipo && distM(x.lon, x.lat, c.lon, c.lat) < RADIO_REPETIDO);

/** Un reporte guardado: el cuerpo que va a la API más su id local (no se envía). */
export type EnCola = CuerpoReporte & { _id?: string };

interface Deposito { leer(): EnCola[]; guardar(cola: EnCola[]): boolean }
const deposito: Deposito = {
  leer: () => almacen.get<EnCola[]>(CLAVE, []),
  guardar: (cola) => {
    const ok = almacen.set(CLAVE, cola);
    if (ok) store.set({ colaPendiente: cola.length });
    return ok;
  },
};

const nuevoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
/** Los guardados por versiones anteriores no tienen id: se les pone uno al leerlos. */
const conId = (c: EnCola): EnCola => (c._id ? c : { ...c, _id: nuevoId() });

/** Guarda el reporte para mandarlo luego. Si no cabe con las fotos, lo guarda sin ellas. */
export function encolar(cuerpo: CuerpoReporte, d: Deposito = deposito): ResultadoCola {
  const cola = d.leer();
  if (repetido(cola, cuerpo)) return "repetido";
  if (cola.length >= MAX_COLA) return "tope";
  const item: EnCola = { ...cuerpo, _id: nuevoId() };
  if (d.guardar([...cola, item])) return "ok";
  if (item.foto || item.fotos?.length) {
    const { foto: _foto, fotos: _fotos, ...sinFoto } = item;
    if (d.guardar([...cola, sinFoto])) return "sin_foto";
  }
  return "";
}

export const avisoCola = (r: ResultadoCola) =>
  t(r === "ok" ? "app.toast.cola" : r === "sin_foto" ? "app.toast.cola_sin_foto" : r === "repetido" ? "app.toast.cola_repetido"
    : r === "tope" ? "app.toast.cola_tope" : "app.toast.cola_llena", { n: MAX_COLA });
/** ¿Quedó guardado? */
export const guardado = (r: ResultadoCola) => r === "ok" || r === "sin_foto";

export interface Resultado<T = CuerpoReporte> { quedan: T[]; enviados: number; rechazos: string[] }

/** ¿Conviene guardarlo y reintentar? Sin red, servidor caído o saturado (5xx) o límite de envíos (429). */
export function esTemporal(e: unknown, enLinea = navigator.onLine): boolean {
  const status = e instanceof ErrorApi ? e.status : 0;
  return falloDeRed(e, enLinea) || status === 429 || status >= 500;
}

/** Manda cada reporte de la cola. Sin red, servidor caído (5xx) o límite (429): se reintenta luego;
    un rechazo definitivo (4xx) se avisa y se suelta. */
export async function procesarCola<T extends CuerpoReporte>(cola: T[], enviar: (c: T) => Promise<unknown>, enLinea: boolean): Promise<Resultado<T>> {
  const quedan: T[] = [], rechazos: string[] = [];
  for (const c of cola) {
    try {
      await enviar(c);
    } catch (e) {
      if (esTemporal(e, enLinea)) quedan.push(c);
      else rechazos.push((e as Error).message);
    }
  }
  return { quedan, enviados: cola.length - quedan.length - rechazos.length, rechazos };
}

/** Saca de la cola actual los que ya se procesaron (enviados o rechazados), sin tocar los que llegaron mientras tanto. */
export function quitarProcesados(actual: EnCola[], procesados: EnCola[], quedan: EnCola[]): EnCola[] {
  const fuera = new Set(procesados.map((c) => c._id));
  quedan.forEach((c) => fuera.delete(c._id));
  return actual.filter((c) => !fuera.has(c._id));
}

let enCurso: Promise<void> | null = null;

/** Manda lo que haya en la cola (uno a la vez; si ya hay un envío en marcha, espera a ese). */
export function enviarCola(): Promise<void> {
  enCurso ??= enviar().finally(() => { enCurso = null; });
  return enCurso;
}

async function enviar(): Promise<void> {
  const cola = deposito.leer().map(conId);
  store.set({ colaPendiente: cola.length });
  if (!cola.length || !navigator.onLine) return;
  store.set({ sincronizando: true });
  try {
    const r = await procesarCola(cola, ({ _id, ...cuerpo }) => postJSON("/api/reportes", cuerpo), navigator.onLine);
    deposito.guardar(quitarProcesados(deposito.leer().map(conId), cola, r.quedan));
    if (r.enviados) toast(t("app.toast.cola_enviados", { n: r.enviados }));
    if (r.rechazos.length) toast(t("app.toast.cola_rechazados", { n: r.rechazos.length, motivo: r.rechazos[0] }), 7000);
  } finally {
    store.set({ sincronizando: false });
  }
}

/** Arranque: cuenta lo guardado y deja programados los reintentos automáticos. */
export function sincronizarCola(): void {
  store.set({ colaPendiente: deposito.leer().length });
  const intentar = () => { if (store.get().colaPendiente && navigator.onLine) void enviarCola(); };
  window.addEventListener("online", intentar);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") intentar(); });
  setInterval(intentar, CADA);
  intentar();
}
