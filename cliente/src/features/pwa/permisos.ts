/* Ventana de inicio «Activa tu ubicación y los avisos».
   Los navegadores no dejan pedir notificaciones sin un toque (iPhone lo prohíbe; Chrome silencia el pedido), y en
   Android la app instalada comparte los datos con Chrome: si la persona ya había abierto la web, la app instalada no
   volvía a preguntar nada. Por eso al abrir se muestra esta ventana, con un botón por permiso que dispara la alerta
   del sistema, una vez en la web y otra vez al abrir la app instalada. Si los dos ya están concedidos, no sale. */
import { almacen } from "../../shared/almacen";
import { store } from "../../shared/store";
import { casoIos, equipoActual } from "./ios";
import { activarUbicacion, estadoUbicacion, type EstadoPermiso } from "../lugar/miUbicacion";

export type Modo = "web" | "instalada";

export function modoActual(): Modo {
  const standalone = typeof matchMedia !== "undefined" && matchMedia("(display-mode: standalone)").matches;
  return standalone || (navigator as Navigator & { standalone?: boolean }).standalone ? "instalada" : "web";
}

export function estadoNotificaciones(): EstadoPermiso {
  // iPhone sin instalar: no hay notificaciones hasta instalar la app; cuenta como pendiente (la ventana lo explica)
  if (casoIos(equipoActual()) !== "no") return "preguntar";
  if (typeof Notification === "undefined") return "no_disponible";
  return Notification.permission === "granted" ? "concedido" : Notification.permission === "denied" ? "negado" : "preguntar";
}

const clave = (m: Modo) => "permisos_vistos_" + m;
const falta = (e: EstadoPermiso) => e === "preguntar" || e === "negado";

/** ¿Se muestra la ventana? No se vio todavía en este modo y falta al menos un permiso que el teléfono puede dar. */
export function debeMostrar(visto: boolean, ubicacion: EstadoPermiso, notificaciones: EstadoPermiso): boolean {
  return !visto && (falta(ubicacion) || falta(notificaciones));
}

/** Al abrir la app (después de cargar lo básico): decide si se muestra la ventana de permisos. */
export async function ofrecerPermisos(): Promise<void> {
  if (store.get().vista === "privacidad") return;
  const ubicacion = await estadoUbicacion();
  // ya hay permiso pero ningún lugar elegido: se usa el GPS sin preguntar nada
  if (ubicacion === "concedido" && !store.get().lugar) void activarUbicacion();
  const m = modoActual();
  if (debeMostrar(almacen.get(clave(m), false), ubicacion, estadoNotificaciones())) store.set({ permisos: true });
}

/** Cerrar la ventana («Listo» o «Ahora no»): no vuelve a salir sola en este modo. Los permisos se pueden dar luego
    desde el botón de ubicación de «Mi lugar» y el de notificaciones de «Avisos». */
export function cerrarPermisos(): void {
  almacen.set(clave(modoActual()), true);
  store.set({ permisos: false });
}
