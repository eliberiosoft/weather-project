/* Estado de la sesión (fuera de React para que el cliente API pueda avisar de un 401).
   Fases: cargando → ingreso | clave (cambio obligatorio) | panel. */
import { useSyncExternalStore } from "react";
import { api, ErrorApi, escucharApi } from "../../shared/api/cliente";
import type { Usuario } from "../../shared/api/tipos";

export type Fase =
  | { fase: "cargando" }
  | { fase: "ingreso"; aviso?: string }           // aviso: clave i18n que se muestra arriba del formulario
  | { fase: "clave"; usuario: Usuario; obligatoria: boolean }
  | { fase: "panel"; usuario: Usuario };

let actual: Fase = { fase: "cargando" };
const oyentes = new Set<() => void>();
function poner(f: Fase) { actual = f; oyentes.forEach((o) => o()); }

export const leerSesion = (): Fase => actual;
export function useSesion(): Fase {
  return useSyncExternalStore((o) => { oyentes.add(o); return () => { oyentes.delete(o); }; }, leerSesion);
}

/* Sin señal: el panel abre con el último usuario que ingresó en este equipo para poder guardar incidentes
   (se publican solos al volver la red, ver incidentes/cola.ts). Solo se guarda su perfil público, nunca la clave
   ni datos del panel; la API sigue decidiendo con la cookie de sesión. Salir lo borra. */
const PERFIL = "yw_panel_perfil";
function recordar(u: Usuario | null): void {
  try { if (u) localStorage.setItem(PERFIL, JSON.stringify(u)); else localStorage.removeItem(PERFIL); } catch { /* bloqueado */ }
}
function recordado(): Usuario | null {
  try { return JSON.parse(localStorage.getItem(PERFIL) || "null") as Usuario | null; } catch { return null; }
}

/** Lo que sigue después de tener un usuario: el panel, o el cambio de clave si es temporal. */
export function conUsuario(u: Usuario): void {
  recordar(u.debe_cambiar_clave ? null : u);
  poner(u.debe_cambiar_clave ? { fase: "clave", usuario: u, obligatoria: true } : { fase: "panel", usuario: u });
}

export async function iniciarSesion(): Promise<void> {
  try {
    const { usuario } = await api<{ usuario: Usuario }>("/api/auth/me", undefined, { sinRedirigir: true });
    conUsuario(usuario);
  } catch (e) {
    const st = e instanceof ErrorApi ? e.status : -1;
    // sin red (0) o servidor caído (5xx): no es que la sesión no valga, es que no se pudo preguntar
    const perfil = st === 0 || st >= 500 ? recordado() : null;
    if (perfil) {
      // sin red y con alguien que ya ingresó aquí: se trabaja sin conexión y se revalida al volver la señal
      poner({ fase: "panel", usuario: perfil });
      window.addEventListener("online", () => void iniciarSesion(), { once: true });
      return;
    }
    poner({ fase: "ingreso", aviso: st === 404 ? "panel.login.no_disponible" : st === 0 ? "panel.error.red" : undefined });
  }
}

export function sesionTerminada(aviso = "panel.login.expirada"): void {
  if (actual.fase === "ingreso") return;
  poner({ fase: "ingreso", aviso });
}

export async function cerrarSesion(): Promise<void> {
  recordar(null);
  try { await api("/api/auth/logout", {}, { sinRedirigir: true }); } catch { /* la cookie vence sola */ }
  poner({ fase: "ingreso", aviso: "panel.login.salio" });
}

export function pedirCambioClave(obligatoria: boolean): void {
  if (actual.fase === "panel" || actual.fase === "clave") poner({ fase: "clave", usuario: actual.usuario, obligatoria });
}

export function volverAlPanel(): void {
  if (actual.fase === "clave" && !actual.obligatoria) poner({ fase: "panel", usuario: actual.usuario });
}

/** Tras cambiar la clave la API invalida las sesiones: si la cookie sigue viva se sigue, si no, al ingreso. */
export async function claveCambiada(): Promise<void> {
  try {
    const { usuario } = await api<{ usuario: Usuario }>("/api/auth/me", undefined, { sinRedirigir: true });
    conUsuario({ ...usuario, debe_cambiar_clave: false });
  } catch {
    poner({ fase: "ingreso", aviso: "panel.login.clave_cambiada" });
  }
}

escucharApi({
  sinSesion: () => sesionTerminada(),
  cambiarClave: () => pedirCambioClave(true),
});
