/* Filtro del muro «Vecinos» (puro: se prueba sin navegador). */
import { etiquetaTipo, tituloReporte } from "../../shared/dominio";
import { distM, normalizar } from "../../shared/formato";
import type { FiltroMuro } from "../../shared/store";
import type { Reporte } from "../../shared/tipos";

export const CERCA_M = 5000;

/** Filtra la lista del muro (función pura, se prueba). */
export function filtrarMuro(reportes: Reporte[], filtro: FiltroMuro, centro: { lat: number; lon: number } | null, texto: string): Reporte[] {
  const q = normalizar(texto.trim());
  let lista = reportes.filter((r) => r.mio || r.estado !== "descartado");
  if (filtro === "mios") lista = lista.filter((r) => r.mio);
  if (filtro === "cerca" && centro) lista = lista.filter((r) => distM(centro.lon, centro.lat, r.lon, r.lat) <= CERCA_M);
  if (q) lista = lista.filter((r) => normalizar([tituloReporte(r), etiquetaTipo({ tipo: r.tipo, etiqueta: r.etiqueta }), r.via, r.recinto, r.descripcion, r.nota_ugr, r.autor?.nombre].join(" ")).includes(q));
  return lista;
}


/** Scroll infinito del muro: se dibujan de a tantas (la lista ya está en el teléfono; en uno de gama baja, cientos de
    publicaciones con fotos de una vez pesan). */
export const TANDA = 15;

/** Cuántas publicaciones dibujar: las pedidas hasta ahora y, si hay una destacada (enlace compartido #muro/<id>),
    al menos hasta ella, para que se vea y se pueda centrar. */
export function cuantasMostrar(lista: Reporte[], pedidas: number, destacado: string | null): number {
  const i = destacado ? lista.findIndex((r) => r.id === destacado) : -1;
  return Math.min(lista.length, Math.max(pedidas, i + 1));
}
