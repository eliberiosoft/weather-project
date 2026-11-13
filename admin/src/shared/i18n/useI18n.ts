/* Hook de idioma: repinta el componente cuando el motor compartido dispara el evento «idioma». */
import { useSyncExternalStore } from "react";
import { I18N } from "@compartido/i18n/motor.js";
import "../../i18n/textos";
import type { ConMotivos } from "../api/tipos";

function suscribir(aviso: () => void): () => void {
  window.addEventListener("idioma", aviso);
  return () => window.removeEventListener("idioma", aviso);
}
const leer = (): string => I18N.idioma;

export interface Traductor {
  idioma: string;
  t: typeof I18N.t;
  existe: typeof I18N.existe;
  /** Motivos del servidor ({motivos:[{k,v,pid,src}], motivo}) armados en el idioma activo. */
  motivo: (obj: ConMotivos, opciones?: { vecino?: boolean }) => string;
  /** Fecha corta del panel: «9 nov, 14:05». */
  hora: (iso: string | null | undefined) => string;
}

// motor.d.ts declara motivo(m: Motivo) pero el motor recibe el objeto con su lista «motivos»
const motivo = (obj: ConMotivos, opciones?: { vecino?: boolean }): string => I18N.motivo(obj as never, opciones);

const hora = (iso: string | null | undefined): string =>
  iso ? I18N.fecha(iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export function useI18n(): Traductor {
  const idioma = useSyncExternalStore(suscribir, leer);
  return { idioma, t: I18N.t, existe: I18N.existe, motivo, hora };
}

export { I18N };
