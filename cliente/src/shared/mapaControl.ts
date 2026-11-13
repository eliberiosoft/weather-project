/* Puente con el mapa (que se carga perezosamente con Leaflet). Otras vistas piden cosas al mapa sin importar Leaflet:
   irA("mapa") y luego (await mapaListo()).irAlPunto(…). */
import type { Albergue, LatLon, Reporte } from "./tipos";

export type InfoMapa = { tipo: "recinto"; id: number } | { tipo: "reporte"; r: Reporte } | { tipo: "albergue"; a: Albergue };

export interface ControlMapa {
  irAlPunto(ll: LatLon, z: number, luego?: InfoMapa): void;
  cerrarHojas(): void;
  zoom(): number;
}

let actual: ControlMapa | null = null;
let resolver: (c: ControlMapa) => void = () => {};
const listo = new Promise<ControlMapa>((ok) => { resolver = ok; });

export function registrarMapa(c: ControlMapa): void {
  actual = c;
  resolver(c);
}
export const mapaListo = () => listo;
export const mapaActual = () => actual;
