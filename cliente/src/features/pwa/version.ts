/* Versiones de la app: cada build tiene un id único (__BUILD__, vite.config.ts) y el servidor publica el suyo en
   /version.json (sin caché). La app lo pregunta al abrir, al volver a primer plano y cada 10 min; si cambió:
     1. pide al service worker que se actualice (el nuevo se activa solo: skipWaiting + clients.claim);
     2. el service worker nuevo, al activarse, le dice a cada pestaña su build; si no es el de la pestaña, recarga si
        no se pierde nada (la app en segundo plano o recién abierta, y
        nadie a mitad de un reporte o escribiendo); si no, muestra «Hay una versión nueva · Actualizar» y recarga
        sola apenas la app pase a segundo plano.
   Si una pantalla diferida no carga (el archivo de la versión vieja ya no está), recarga una vez. Nunca en bucle:
   si tras recargar sigue el mismo build, queda el aviso. */
import { store, type EstadoApp } from "../../shared/store";

export const BUILD = __BUILD__;
const CADA_MS = 10 * 60_000;          // con la app a la vista
const ENTRE_MS = 5 * 60_000;          // al volver a primer plano, como mucho una vez cada 5 min
const ARRANQUE_MS = 15_000;           // «recién abierta»: recargar ahora no interrumpe nada
const ESPERA_SW_MS = 30_000;          // si el service worker no toma el control en este tiempo, igual se avisa
const CLAVE = "ay_recargado_desde";

/** ¿Hay algo a medio hacer que una recarga perdería? (un reporte empezado o un campo con el cursor) */
export function ocupado(s: Pick<EstadoApp, "rep">, activo: Element | null): boolean {
  const a = s.rep;
  const reporte = (a.paso !== 1 && a.paso !== "ok") || !!a.descripcion.trim() || a.fotos.length > 0;
  return reporte || (!!activo && /^(INPUT|TEXTAREA|SELECT)$/.test(activo.tagName));
}

/** Con la versión nueva lista: recargar ya, o avisar y esperar a que la app pase a segundo plano. */
export function decidir(o: { ocupado: boolean; oculta: boolean; recienAbierta: boolean }): "recargar" | "avisar" {
  if (o.ocupado) return "avisar";
  return o.oculta || o.recienAbierta ? "recargar" : "avisar";
}

let ultima = 0;
let lista = false;

/** Recarga, salvo que ya se haya recargado desde este mismo build (el servidor o una caché siguen dando lo viejo). */
function recargar(): void {
  try {
    if (sessionStorage.getItem(CLAVE) === BUILD) { store.set({ versionLista: true }); return; }
    sessionStorage.setItem(CLAVE, BUILD);
  } catch { /* sin sessionStorage: igual recarga */ }
  location.reload();
}

function versionLista(): void {
  if (lista) return;
  lista = true;
  const d = decidir({ ocupado: ocupado(store.get(), document.activeElement), oculta: document.hidden, recienAbierta: performance.now() < ARRANQUE_MS });
  if (d === "recargar") recargar();
  else store.set({ versionLista: true });
}

/** Pregunta al servidor qué build está publicado. `ya`: sin esperar los 5 min entre consultas. */
export async function comprobarVersion(ya = false): Promise<void> {
  if (!import.meta.env.PROD || lista || (!ya && Date.now() - ultima < ENTRE_MS)) return;
  ultima = Date.now();
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    const { build } = (await r.json()) as { build?: string };
    if (!build || build === BUILD) return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) return versionLista();
    await reg.update();
    setTimeout(versionLista, ESPERA_SW_MS);       // si el service worker no avisa (bloqueado, roto), igual se avisa
  } catch { /* sin señal: se pregunta la próxima vez */ }
}

/** «Actualizar» del aviso: la persona lo pidió, recarga aunque ya se haya intentado. */
export function actualizarAhora(): void {
  try { sessionStorage.setItem(CLAVE, BUILD); } catch { /* sin sessionStorage */ }
  location.reload();
}

export function iniciarVersiones(): void {
  if (!import.meta.env.PROD) return;
  // una pantalla diferida de la versión vieja ya no está en el servidor: se recarga (una vez) para tomar la nueva
  window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); recargar(); });
  // el service worker nuevo avisa su build al activarse (también cuando el navegador lo actualizó por su cuenta)
  navigator.serviceWorker?.addEventListener("message", (e: MessageEvent<{ build?: string }>) => {
    if (e.data?.build && e.data.build !== BUILD) versionLista();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return void comprobarVersion();
    if (store.get().versionLista && !ocupado(store.get(), null)) recargar();
  });
  setInterval(() => { if (!document.hidden) void comprobarVersion(true); }, CADA_MS);
  setTimeout(() => void comprobarVersion(true), 3000);
}
