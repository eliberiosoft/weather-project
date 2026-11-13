/* ¿La pantalla es ancha? Para elegir entre tabla (escritorio, tablet acostada) y tarjetas apiladas (celular)
   sin montar las dos: los controles de cada fila llevan su propio estado e ids únicos. */
import { useSyncExternalStore } from "react";

/** md de Tailwind: desde 48rem (768 px) caben las tablas sin desplazarse de lado. */
export const CONSULTA_ANCHO = "(min-width: 48rem)";

export function useAncho(consulta = CONSULTA_ANCHO): boolean {
  return useSyncExternalStore(
    (avisar) => {
      if (typeof matchMedia === "undefined") return () => {};
      const m = matchMedia(consulta);
      m.addEventListener("change", avisar);
      return () => m.removeEventListener("change", avisar);
    },
    () => (typeof matchMedia === "undefined" ? true : matchMedia(consulta).matches),
    () => true,
  );
}
