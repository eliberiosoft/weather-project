/* «Mi lugar» desde el GPS: el botón de ubicación del buscador y el pedido automático de la primera vez. */
import { tramoCercano } from "../../shared/calles";
import { cargarLugar } from "../../shared/datos";
import { t } from "../../shared/i18n";
import { store } from "../../shared/store";
import { ubicar } from "../../shared/ubicacion";

/** Toma la ubicación del teléfono y la deja como lugar (con el nombre de la calle más cercana si la hay).
    `soloSiVacio`: no pisa un lugar que la persona eligió mientras el GPS respondía. Falla con el mensaje para el usuario. */
export async function lugarPorGps(soloSiVacio = false): Promise<void> {
  const u = await ubicar();
  const tr = await tramoCercano(u.lat, u.lon, 60).catch(() => null);
  if (soloSiVacio && store.get().lugar) return;
  const nombre = tr?.nombre || t("app.tu_ubicacion");
  await cargarLugar({ tipo: "punto", lat: +u.lat.toFixed(6), lon: +u.lon.toFixed(6), nombre, texto: nombre, gps: true });
}

export type EstadoPermiso = "concedido" | "negado" | "preguntar" | "no_disponible";

/** Estado del permiso de ubicación sin preguntar (Safari viejo sin Permissions API: «preguntar»). */
export async function estadoUbicacion(): Promise<EstadoPermiso> {
  if (!("geolocation" in navigator)) return "no_disponible";
  try {
    const p = await navigator.permissions?.query({ name: "geolocation" });
    return p?.state === "granted" ? "concedido" : p?.state === "denied" ? "negado" : "preguntar";
  } catch {
    return "preguntar";
  }
}

/** Desde un toque de la persona (la alerta del sistema sale así en Android y en iPhone): pide la ubicación y, si
    todavía no hay lugar elegido, deja el GPS como «Mi lugar». Devuelve cómo quedó el permiso. */
export async function activarUbicacion(): Promise<EstadoPermiso> {
  store.set({ buscandoUbic: true });
  try {
    await lugarPorGps(true);
    return "concedido";
  } catch {
    const e = await estadoUbicacion();
    return e === "concedido" ? "preguntar" : e;    // concedido pero sin señal: se puede reintentar
  } finally {
    store.set({ buscandoUbic: false });
  }
}
