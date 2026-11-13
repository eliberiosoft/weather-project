/* Splash del panel instalado (spec 015).
   El splash vive en index.html para verse antes que React; el CSS lo muestra solo con
   @media (display-mode: standalone) (variante `standalone:` de estilos.css), sin script en línea por la CSP.
   React lo cierra con un fundido cuando se sabe si hay sesión y llegaron los primeros datos:
   nunca antes de 600 ms (que no parpadee) ni después de 4 s. Al cerrarse se quita del DOM: no queda un velo invisible. */
import { useEffect } from "react";

export const SPLASH_MIN = 600;
export const SPLASH_MAX = 4000;
/** Lo que dura el fundido (duration-200 en index.html) antes de quitar el nodo. */
const FUNDIDO = 220;

/** ¿Corre como app instalada? Igual que la media query que lo muestra; iOS antiguo usa navigator.standalone. */
export function esInstalada(media: (q: string) => boolean, standaloneIos?: boolean): boolean {
  return media("(display-mode: standalone)") || standaloneIos === true;
}

/** Milisegundos que faltan para cerrar el splash, contados desde que abrió la página.
    Con todo listo, se espera al mínimo; si no, al máximo (que siempre cierra). */
export function msParaCerrar(transcurrido: number, listo: boolean): number {
  return Math.max(0, (listo ? SPLASH_MIN : SPLASH_MAX) - transcurrido);
}

let cerrado = false;

function cerrar(nodo: HTMLElement) {
  if (cerrado) return;
  cerrado = true;
  nodo.classList.add("opacity-0", "pointer-events-none");
  setTimeout(() => nodo.remove(), FUNDIDO);
}

/** Cierra el splash cuando `listo` (sesión conocida y primeros datos), respetando los 600 ms y los 4 s. */
export function useSplash(listo: boolean, etiqueta: string): void {
  useEffect(() => {
    const nodo = document.getElementById("splash");
    if (!nodo || cerrado) return;
    const instalada = esInstalada((q) => window.matchMedia(q).matches, (navigator as Navigator & { standalone?: boolean }).standalone);
    if (!instalada) { cerrado = true; nodo.remove(); return; }
    const barra = document.getElementById("splash-barra");
    if (barra) {
      barra.setAttribute("role", "progressbar");
      barra.setAttribute("aria-label", etiqueta);
    }
    nodo.removeAttribute("aria-hidden");
    const reloj = setTimeout(() => cerrar(nodo), msParaCerrar(performance.now(), listo));
    return () => clearTimeout(reloj);
  }, [listo, etiqueta]);
}
