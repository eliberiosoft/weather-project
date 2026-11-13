/* PWA: registro del service worker, preferencias que el service worker necesita para armar las notificaciones
   push (idioma y nombres de los niveles) y el botón de instalar. */
import { t, I18N } from "../../shared/i18n";
import { store, toast } from "../../shared/store";
import { cargarAvisos } from "../avisos/cargaAvisos";

/** El service worker no lee localStorage: el idioma y los nombres de los niveles se le dejan en una caché propia. */
export const CACHE_PREFS = "ay-prefs", URL_PREFS = "/_ay/prefs.json";

export function guardarPrefsSW(): void {
  if (typeof caches === "undefined") return;
  const prefs = { idioma: I18N.idioma, niveles: Object.fromEntries([0, 1, 2, 3, 4].map((n) => [n, t("nivel." + n)])) };
  caches.open(CACHE_PREFS)
    .then((c) => c.put(URL_PREFS, new Response(JSON.stringify(prefs), { headers: { "Content-Type": "application/json" } })))
    .catch(() => { /* sin caché (modo privado) */ });
}

export function registrarSW(): void {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("message", (e: MessageEvent<{ ir?: string; actualizar?: string }>) => {
    // al tocar una notificación con la app abierta, el service worker pide ir al aviso (#avisos/<id>/push)
    if (e.data?.ir === "avisos") location.hash = "#avisos";
    else if (e.data?.ir?.startsWith("#avisos")) location.hash = e.data.ir;
    // llegó un push con la app abierta: se recargan los avisos
    if (e.data?.actualizar === "avisos") void cargarAvisos(store.get().vista === "avisos");
  });
  // en desarrollo no hay service worker (Vite sirve los módulos sin hash); se prueba con «vite preview» o Docker
  // ?v=BUILD: cada despliegue registra otra URL, así ninguna caché (ni Cloudflare) puede dar un sw.js viejo
  if (import.meta.env.PROD) navigator.serviceWorker.register(`sw.js?v=${__BUILD__}`).catch(() => {});
}

/** Pide al navegador que revise si hay una versión nueva del service worker (se activa sola al bajarla). */
export function buscarVersionNueva(): void {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => { /* sin red */ });
}

interface EventoInstalar extends Event { prompt(): Promise<void>; userChoice: Promise<unknown> }
let promptInstalar: EventoInstalar | null = null;

/** Instalar la app (Android y escritorio; en iPhone se instala desde «Compartir → Agregar a inicio»). */
export function escucharInstalacion(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    promptInstalar = e as EventoInstalar;
    store.set({ instalable: true });
  });
  window.addEventListener("appinstalled", () => {
    promptInstalar = null;
    store.set({ instalable: false });
    toast(t("app.instalar.ok"));
  });
}

export async function instalar(): Promise<void> {
  if (!promptInstalar) return;
  await promptInstalar.prompt();
  await promptInstalar.userChoice.catch(() => null);
  promptInstalar = null;
  store.set({ instalable: false });
}
