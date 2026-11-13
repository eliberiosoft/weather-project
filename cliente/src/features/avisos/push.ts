/* Notificaciones: se pide permiso; si la API tiene el push habilitado (GET /api/push/config) se carga Firebase,
   se obtiene el token con la registración del service worker propio y se suscribe con el recinto elegido y el idioma.
   Si el push no está habilitado o falla, siguen las notificaciones locales (con la app abierta o en segundo plano). */
import { almacen } from "../../shared/almacen";
import { api, postJSON } from "../../shared/api";
import { recintoDeLugar } from "../../shared/dominio";
import { I18N, t } from "../../shared/i18n";
import { store, toast } from "../../shared/store";
import type { PushConfig } from "../../shared/tipos";
import { guardarPrefsSW } from "../pwa/pwa";

interface Suscripcion { token: string; recinto_id: number | null; idioma: string }
export type Resultado = "push" | "local" | "error";

const permitido = () => typeof Notification !== "undefined" && Notification.permission === "granted";

/** La registración activa del service worker. La primera vez que se abre la app instalada todavía se está
    instalando (guarda la app para usarla sin señal) y puede tardar: se espera hasta `ms`. Sin service worker
    (desarrollo) responde null enseguida. */
async function registroSW(ms = 25000): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  if (!import.meta.env.PROD && !(await navigator.serviceWorker.getRegistration())) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((ok) => setTimeout(() => ok(null), ms))]);
}

/** Si el push no se pudo completar porque el service worker no estaba listo, se termina solo cuando lo esté. */
let reintentoPendiente = false;
function reintentarCuandoEsteListo(): void {
  if (reintentoPendiente || !("serviceWorker" in navigator)) return;
  reintentoPendiente = true;
  void navigator.serviceWorker.ready.then(() => { reintentoPendiente = false; void resuscribir(); });
}

/** Datos de la suscripción para el lugar y el idioma actuales (sin token). */
export function datosSuscripcion(): Omit<Suscripcion, "token"> {
  const { lugar, terr } = store.get();
  return { recinto_id: recintoDeLugar(lugar, terr), idioma: I18N.idioma };
}

async function suscribir(forzar: boolean): Promise<Resultado> {
  const cfg = await api<PushConfig>("/api/push/config", {}, { fondo: true }).catch(() => null);
  const reg = cfg?.habilitado ? await registroSW() : null;
  if (!cfg?.habilitado || !reg) {
    store.set({ notif: "local" });
    if (cfg?.habilitado) reintentarCuandoEsteListo();
    return "local";
  }
  try {
    const { pedirToken } = await import("./firebase");
    const token = await pedirToken(cfg, reg);
    if (!token) throw new Error("sin token");
    const nueva: Suscripcion = { token, ...datosSuscripcion() };
    const previa = almacen.get<Suscripcion | null>("push", null);
    const igual = previa && previa.token === nueva.token && previa.recinto_id === nueva.recinto_id && previa.idioma === nueva.idioma;
    if (forzar || !igual) await postJSON("/api/push/suscribir", nueva);
    if (previa?.token && previa.token !== token) void postJSON("/api/push/baja", { token: previa.token }).catch(() => {});
    almacen.set("push", nueva);
    store.set({ notif: "push" });
    return "push";
  } catch {
    store.set({ notif: "local" });
    return "error";
  }
}

/** Pide el permiso (desde un toque: sin toque los navegadores lo bloquean o lo silencian). */
export async function pedirPermisoNotificaciones(): Promise<NotificationPermission | "no_disponible"> {
  if (typeof Notification === "undefined") { toast(t("app.toast.no_notif")); return "no_disponible"; }
  const p = await Notification.requestPermission();
  if (p !== "granted") {
    store.set({ notif: "no" });
    toast(t("app.toast.notif_no"));
  }
  return p;
}

/** Con el permiso dado: suscribe el teléfono al push (puede tardar unos segundos: carga Firebase y pide el token). */
export async function conectarPush(): Promise<Resultado> {
  guardarPrefsSW();
  const r = await suscribir(true);
  toast(t(r === "push" ? "app.toast.push_ok" : r === "error" ? "app.toast.push_error" : "app.toast.notif_ok"), 5000);
  return r;
}

/** Pide permiso y suscribe (botón de «Avisos»). Devuelve el permiso. */
export async function activarNotificaciones(): Promise<NotificationPermission | "no_disponible"> {
  const p = await pedirPermisoNotificaciones();
  if (p === "granted") await conectarPush();
  return p;
}

/** Al abrir la app y al cambiar de lugar o de idioma: renueva el token (FCM lo rota) y actualiza recinto e idioma.
    Con el permiso dado pero sin suscripción guardada (no se llegó a completar), la completa. */
export async function resuscribir(): Promise<void> {
  if (!permitido()) return;
  await suscribir(false);
}

/** «Borrar los datos de este teléfono»: da de baja el token en la API (si lo hay). */
export async function bajaPush(): Promise<void> {
  const previa = almacen.get<Suscripcion | null>("push", null);
  if (previa?.token) await postJSON("/api/push/baja", { token: previa.token }).catch(() => {});
}
