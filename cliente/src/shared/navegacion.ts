/* Cambiar de vista. Fuera del mapa se guarda la vista en el hash (#avisos, #reportar…) y se salen los modos del mapa. */
import { almacen } from "./almacen";
import { refrescarReportes } from "./datos";
import { leerRuta } from "./ruta";
import { store, type EstadoApp, type Vista } from "./store";
import { cargarAvisos } from "../features/avisos/cargaAvisos";

export function irA(v: Vista): void {
  const cambios: Partial<EstadoApp> = { vista: v };
  if (v === "mapa") cambios.mapaVisitado = true;
  else {
    if (v === "tormentas") cambios.tormentasVisitado = true;
    cambios.modoMapa = null;   // salir de «toca la calle» o «toca el lugar» (también cierra la hoja de calle)
    history.replaceState(null, "", "#" + v);
  }
  if (v === "privacidad") {
    almacen.set("aviso_cookies", true);
    cambios.avisoCookies = false;
  }
  store.set(cambios);
  if (v === "avisos") void cargarAvisos(true);
  if (v === "muro") void refrescarReportes();
}

/** Enlaces con #mapa, #reportar, #muro/<id>… (y el botón Atrás) llevan a su vista. */
export function escucharHash(): void {
  window.addEventListener("hashchange", () => {
    const r = leerRuta(location.hash);
    if (r.muroId) store.set({ destacado: r.muroId, filtroMuro: "todos" });
    if (r.aviso) store.set({ avisoDestacado: r.aviso });
    if (r.vista && r.vista !== store.get().vista) irA(r.vista);
  });
}
