/* Cómo se dice en palabras de vecino lo que llega de la API de tormentas. Funciones puras (se prueban sin navegador).
   Nunca se usan los colores ni los nombres del semáforo: esto no es un nivel de alerta. */
import { num } from "../../shared/formato";
import { t } from "../../shared/i18n";
import type { Cerca, Lluvia, Rayos } from "./tipos";

/** La frase principal: dónde está la tormenta más cercana. */
export function titular(c: Cerca | null): string {
  if (!c) return t("app.torm.cerca.sin_datos");
  if (c.estado === "sin" || c.dist_km == null) return t("app.torm.cerca.sin");
  const fuerza = t("app.torm.fuerza." + Math.max(1, c.intensidad));
  if (c.estado === "encima") return t("app.torm.cerca.encima", { fuerza });
  return t("app.torm.cerca." + c.estado, { fuerza, dist: num(c.dist_km), rumbo: c.rumbo ? t("app.torm.rumbo." + c.rumbo) : "" });
}

/** «Se acerca», «se aleja»… (vacío si no se sabe o no hay tormenta). */
export function tendencia(c: Cerca | null): string {
  return c && c.tendencia && c.estado !== "sin" ? t("app.torm.tend." + c.tendencia) : "";
}

export function textoRayos(r: Rayos | null): string {
  if (!r) return t("app.torm.rayos.sin_datos");
  if (r.calculando) return t("app.torm.rayos.buscando");
  if (r.cerca_n) return t("app.torm.rayos.cerca", { n: num(r.cerca_n) });
  if (r.cerca_km != null) return t("app.torm.rayos.lejos", { km: num(r.cerca_km) });
  return t("app.torm.rayos.ninguno");
}

export function textoLluvia(l: Lluvia | null): string {
  if (!l) return t("app.torm.lluvia.sin_datos");
  return l.proxima_hora_mm >= 0.1 ? t("app.torm.lluvia.mm", { mm: num(l.proxima_hora_mm, 1) }) : t("app.torm.lluvia.nada");
}

/** ¿Hay algo que mirar ya? (tormenta a menos de 40 km o rayos cerca): la ficha de «Mi lugar» lo destaca. */
export const hayQueMirar = (c: Cerca | null, r: Rayos | null) =>
  !!(c && (c.estado === "cerca" || c.estado === "encima")) || !!r?.cerca_n;

/** «Satélite de las 22:50» (y si es la última que llegó porque el satélite no respondió, lo dice). */
export const horaSatelite = (c: Cerca | null, hora: (iso: string) => string) =>
  c ? t(c.viejo ? "app.torm.sat.vieja" : "app.torm.sat.hora", { hora: hora(c.t) }) : "";

export const urlMarco = (id: string) => `/api/tormentas/marco/${id}.png`;

/** Minutos entre la hora de la imagen y ahora. */
export const minutosDesde = (iso: string, ahora = Date.now()) => Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60000));
