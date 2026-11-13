/* Geometría del radar de «Mi lugar» (funciones puras). La escala es de raíz cuadrada: así el anillo de 10 km no queda
   como un punto al lado del de 150 km. Los anillos llevan su distancia escrita, que es lo que se lee. */

/** Radio del dibujo (viewBox de -R a R). */
export const R_SVG = 100;

/** Distancia en km → radio en el dibujo (0 en el centro, R_SVG en el borde). */
export const escala = (km: number, radioKm: number) => R_SVG * Math.sqrt(Math.max(0, Math.min(km, radioKm)) / radioKm);

/** (x al este, y al norte) en km → punto del SVG (y crece hacia abajo). */
export function punto(x: number, y: number, radioKm: number): [number, number] {
  const d = Math.hypot(x, y);
  if (!d) return [0, 0];
  const r = escala(d, radioKm);
  return [(r * x) / d, (-r * y) / d];
}

/** Rumbo en grados (0 = norte, 90 = este) de un punto a otro, para girar la flecha de movimiento. */
export function grados(desde: [number, number], hacia: [number, number]): number {
  const dx = (hacia[1] - desde[1]) * Math.cos((desde[0] * Math.PI) / 180);
  const dy = hacia[0] - desde[0];
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

/** Largo de la flecha en px: legible a cualquier zoom y más larga cuanto más rápido va. */
export const largoFlecha = (kmH: number) => Math.round(Math.min(44, 18 + kmH * 0.6));
