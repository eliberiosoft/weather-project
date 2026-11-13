/* Splash animado (spec 015): solo cuando la app corre instalada (display-mode standalone o navigator.standalone en iOS).
   El marcado vive en index.html para verse antes de que cargue React; el CSS lo muestra con la variante «instalada»
   (@media (display-mode: standalone)) o con la clase «ver-splash» que pone este módulo (iOS antiguo y pruebas).
   En una pestaña del navegador se quita del DOM de inmediato: nunca queda un overlay invisible.
   Se cierra con un fundido cuando llegan los primeros datos (o la copia guardada): 900 ms como mínimo y 4 s como máximo. */

export const SPLASH_MIN = 900;
export const SPLASH_MAX = 4000;
export const FUNDIDO = 320;
export const FUNDIDO_REDUCIDO = 150;

export interface Entorno {
  /** matchMedia("(display-mode: standalone)") */
  standalone: boolean;
  /** navigator.standalone (Safari en iOS, app agregada a la pantalla de inicio) */
  iosStandalone: boolean;
  /** solo en desarrollo: ?splash en la dirección, para probarlo en una pestaña */
  forzado: boolean;
}

export const debeMostrarSplash = (e: Entorno): boolean => e.standalone || e.iosStandalone || e.forzado;

/** Lo que falta para cerrar sin bajar del mínimo (t: ms desde que empezó a cargar la página). */
export const esperaCierre = (t: number, min = SPLASH_MIN): number => Math.max(0, min - t);

/** El tope: el fundido empieza a tiempo para terminar a los 4 s. */
export const esperaTope = (t: number, max = SPLASH_MAX, fundido = FUNDIDO): number => Math.max(0, max - fundido - t);

interface Ventana {
  matchMedia(q: string): { matches: boolean };
  navigator: Navigator & { standalone?: boolean };
  location: { search: string };
}

export function leerEntorno(w: Ventana, dev = import.meta.env.DEV): Entorno {
  return {
    standalone: w.matchMedia("(display-mode: standalone)").matches,
    iosStandalone: w.navigator.standalone === true,
    // en el build de producción import.meta.env.DEV es false y esta rama desaparece
    forzado: dev && new URLSearchParams(w.location.search).has("splash"),
  };
}

let splash: HTMLElement | null = null;
let cerrando = false;

/** Se llama al empezar main.tsx, antes de pintar React. */
export function prepararSplash(): void {
  splash = document.getElementById("splash");
  if (!splash) return;
  if (!debeMostrarSplash(leerEntorno(window))) {
    splash.remove();
    splash = null;
    return;
  }
  document.documentElement.classList.add("ver-splash");
  // el tope de 4 s, lleguen o no los datos (con 100 ms de margen para que el fundido acabe antes)
  setTimeout(quitar, esperaTope(performance.now() + 100));
}

/** Cierra el splash con un fundido cuando ya pasó el mínimo. Se puede llamar varias veces. */
export function cerrarSplash(): void {
  if (!splash || cerrando) return;
  setTimeout(quitar, esperaCierre(performance.now()));
}

function quitar(): void {
  const el = splash;
  if (!el || cerrando) return;
  cerrando = true;
  el.classList.add("pointer-events-none");   // desde ya no recibe toques
  const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fin = () => {
    el.remove();
    splash = null;
    document.documentElement.classList.remove("ver-splash");
  };
  // Web Animations: el fundido corto se ve también con movimiento reducido (la hoja apaga solo las animaciones CSS)
  const anim = typeof el.animate === "function"
    ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reducido ? FUNDIDO_REDUCIDO : FUNDIDO, easing: "ease-out", fill: "forwards" })
    : null;
  if (!anim) return fin();
  anim.onfinish = fin;
  setTimeout(fin, FUNDIDO + 200);   // por si el navegador no termina la animación (pestaña en segundo plano)
}
