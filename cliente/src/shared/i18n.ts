/* i18n de la app: el motor compartido (compartido/i18n/motor.js) + los textos de la app ciudadana.
   useI18n() repinta el componente al cambiar de idioma (evento «idioma» de window). */
import { useMemo, useSyncExternalStore } from "react";
import { I18N, type Vars } from "@compartido/i18n/motor.js";
import { textosApp } from "../i18n/textos";
import type { ConMotivos } from "@compartido/i18n/motor.js";

I18N.agregar(textosApp);

export { I18N };
export type { Vars };

export function suscribirIdioma(alCambiar: () => void): () => void {
  window.addEventListener("idioma", alCambiar);
  return () => window.removeEventListener("idioma", alCambiar);
}
export const leerIdioma = () => I18N.idioma;

export function useI18n() {
  const idioma = useSyncExternalStore(suscribirIdioma, leerIdioma, leerIdioma);
  return useMemo(() => ({ idioma, t: I18N.t, existe: I18N.existe, lista: I18N.lista }), [idioma]);
}

export const t = I18N.t;

/** Escapa un texto para HTML (los textos de la API y de los usuarios nunca van crudos a innerHTML). */
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c] as string);

/** Texto con HTML del diccionario (negritas, listas, enlaces) con las variables escapadas. */
export function tHtml(clave: string, vars?: Vars): string {
  if (!vars) return I18N.t(clave);
  return I18N.t(clave, Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, esc(v)])));
}

/** Motivo del nivel en frases de vecino. El motor recibe el objeto entero ({motivos, motivo}). */
export const motivoVecino = (obj: ConMotivos | null | undefined): string => I18N.motivo(obj, { vecino: true });
