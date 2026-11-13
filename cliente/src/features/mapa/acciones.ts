/* Lo que otras vistas le piden al mapa (sin importar Leaflet: el mapa se carga aparte). */
import { cargarCalles } from "../../shared/calles";
import { t } from "../../shared/i18n";
import { mapaListo, type InfoMapa } from "../../shared/mapaControl";
import { irA } from "../../shared/navegacion";
import { store, toast } from "../../shared/store";
import type { LatLon } from "../../shared/tipos";

async function abrirMapa() {
  if (store.get().vista !== "mapa") irA("mapa");
  return mapaListo();
}

/** «Avisar de una calle inundada»: el mapa pide tocar la calle. */
export async function modoCalle(): Promise<void> {
  const ctl = await abrirMapa();
  store.set({ modoMapa: "calle" });
  cargarCalles().catch(() => { /* se reintenta al tocar */ });
  if (ctl.zoom() < 15) toast(t("app.toast.acerca"), 4000);
}

/** «Otro reporte» o «En el mapa» del asistente: el mapa pide tocar el lugar del problema. */
export async function modoReporte(): Promise<void> {
  await abrirMapa();
  store.set({ modoMapa: "reporte" });
}

export async function verEnMapa(ll: LatLon, z: number, luego?: InfoMapa): Promise<void> {
  const ctl = await abrirMapa();
  ctl.irAlPunto(ll, z, luego);
}
