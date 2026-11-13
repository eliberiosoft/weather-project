/* «Este teléfono usa la app» (pestaña «Dispositivos» del panel, solo superadmin; spec 021): como mucho cada 6 h,
   al abrir la app o al volver a ella, en segundo plano. Va lo mínimo: si está instalada, el idioma, la versión de la app
   y el tipo de equipo (marca, versión del sistema, formato; nunca el modelo, ver equipo.ts). El id del teléfono viaja en
   la cabecera, como siempre, y el servidor guarda solo su firma (nunca el id). */
import { almacen } from "../../shared/almacen";
import { api } from "../../shared/api";
import { I18N } from "../../shared/i18n";
import { leerEquipo } from "./equipo";

const CADA_MS = 6 * 3600_000;

/** ¿Hace falta avisar? (pura: se prueba sin navegador) */
export const toca = (ultima: number, ahora = Date.now()) => !ultima || ahora - ultima >= CADA_MS;

export const instalada = () => typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches
  || !!(navigator as Navigator & { standalone?: boolean }).standalone;

export async function avisarActividad(): Promise<void> {
  if (!toca(almacen.get<number>("actividad_ultima", 0))) return;
  try {
    await api("/api/actividad", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instalada: instalada(), idioma: I18N.idioma, version: __BUILD__, ...(await leerEquipo()) }) });
    almacen.set("actividad_ultima", Date.now());
  } catch { /* sin señal: la próxima vez */ }
}

export function iniciarActividad(): void {
  setTimeout(() => void avisarActividad(), 4000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void avisarActividad(); });
}
