/* Carga de datos de la API con respaldo en localStorage (la app sigue útil sin señal). */
import { almacen } from "./almacen";
import { api, DISP, postJSON } from "./api";
import { hora } from "./formato";
import { t } from "./i18n";
import { store, toast } from "./store";
import type { Albergue, EstadoApi, Lugar, LugarDetalle, Reporte } from "./tipos";

export async function cargarEstado(): Promise<void> {
  try {
    const estado = await api<EstadoApi>("/api/estado");
    almacen.set("estado_cache", estado);
    store.set({ estado, sinRed: false });
  } catch {
    store.set({ estado: almacen.get<EstadoApi | null>("estado_cache", null), sinRed: true });
  }
}

/** Lista de reportes. Si falla, lo que ya había se queda; sin nada cargado, la vista muestra el error con «Reintentar». */
export async function cargarReportes(): Promise<Reporte[]> {
  if (store.get().reportesCarga === "error") store.set({ reportesCarga: "cargando" });   // otro intento: placeholder
  try {
    const j = await api<{ reportes: Reporte[] }>("/api/reportes");
    store.set({ reportes: j.reportes, reportesCarga: "ok" });
    return j.reportes;
  } catch (e) {
    store.set((s) => (s.reportesCarga === "ok" ? {} : { reportesCarga: "error" }));
    throw e;
  }
}

/** Recarga la lista de reportes; sin conexión queda lo último que había. */
export const refrescarReportes = () => cargarReportes().catch(() => store.get().reportes);

export async function cargarLugar(l: Lugar): Promise<void> {
  store.set({ lugar: l, lugarError: false });
  almacen.set("lugar", l);
  try {
    const det = l.tipo === "recinto"
      ? await api<LugarDetalle>(`/api/recinto?id=${encodeURIComponent(l.id)}`)
      : await api<LugarDetalle>(`/api/lugar?lat=${l.lat}&lon=${l.lon}&nombre=${encodeURIComponent(l.nombre || "")}`);
    almacen.set("ultimo_lugar_det", det);
    store.set({ lugarDet: det });
  } catch (e) {
    const viejo = almacen.get<LugarDetalle | null>("ultimo_lugar_det", null);
    if (viejo) {
      store.set({ lugarDet: viejo });
      toast(t("app.toast.offline_lugar", { hora: hora(viejo.generado) }));
    } else {
      // sin copia: «Mi lugar» muestra el error con «Reintentar» (el aviso solo si ya había otro lugar en pantalla)
      store.set({ lugarError: true });
      if (store.get().lugarDet) toast((e as Error).message);
    }
  }
}

/** Voto de un vecino: «sigue así» o «ya pasó». */
export async function confirmar(id: string, sigue: boolean, despues?: () => void): Promise<void> {
  try {
    const r = await postJSON<{ resuelto?: boolean }>(`/api/reportes/${encodeURIComponent(id)}/confirmar`, { dispositivo: DISP, sigue });
    toast(t(r.resuelto ? "app.toast.bajo" : "app.toast.gracias"));
    await refrescarReportes();
    const { lugar } = store.get();
    if (lugar) void cargarLugar(lugar);
    despues?.();
  } catch (e) {
    toast((e as Error).message);
  }
}

/** Albergues del equipo (se ven en el mapa). Sin señal quedan los últimos guardados en el teléfono. */
export async function cargarAlbergues(): Promise<void> {
  try {
    const j = await api<{ albergues: Albergue[] }>("/api/albergues", {}, { fondo: true });
    almacen.set("albergues", j.albergues);
    store.set({ albergues: j.albergues });
  } catch { /* se queda lo guardado */ }
}
