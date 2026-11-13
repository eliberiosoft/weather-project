/* Lee el mensaje de WhatsApp de un vigía: «P05 | 21-oct 06:00 | 3,45 m | sube | lluvia sí». */
import { fechaLocal } from "../../shared/formato";

export type Tendencia = "" | "sube" | "igual" | "baja";
export interface LecturaLeida { punto: string; hora: string | null; lectura: string; tendencia: Tendencia; lluvia: boolean }

const MESES: Record<string, number> = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11 };

export function leerWhatsApp(texto: string, hoy: Date = new Date()): LecturaLeida | null {
  const partes = texto.split("|").map((s) => s.trim());
  if (partes.length < 3 || !partes[0]) return null;
  let hora: string | null = null;
  const m = (partes[1] ?? "").match(/(\d{1,2})-([a-zá]{3})\.?\s+(\d{1,2}):(\d{2})/i);
  const mes = m ? MESES[(m[2] ?? "").toLowerCase()] : undefined;
  if (m && mes !== undefined) hora = fechaLocal(new Date(hoy.getFullYear(), mes, Number(m[1]), Number(m[3]), Number(m[4])));
  const crudo = (partes[3] ?? "").toLowerCase().replace("subiendo", "sube").replace("bajando", "baja").replace("estable", "igual");
  const tendencia: Tendencia = crudo === "sube" || crudo === "igual" || crudo === "baja" ? crudo : "";
  return {
    punto: (partes[0] ?? "").toUpperCase(),
    hora,
    lectura: ((partes[2] ?? "").match(/[\d.,]+/) ?? [""])[0] ?? "",
    tendencia,
    lluvia: /s[ií]/i.test(partes[4] ?? ""),
  };
}
