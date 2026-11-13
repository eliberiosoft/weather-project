/* Carga de «Tormentas»: la API sirve todo desde su caché (Redis), así que pedir seguido no le cuesta a nadie;
   aun así se refresca cada 5 min (la imagen nueva llega cada 10) y solo con la vista a la vista. */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../shared/api";
import type { Carga } from "../../shared/store";
import type { ResumenTormentas, Tormentas } from "./tipos";

const CADA_MS = 5 * 60_000;
const REINTENTO_MS = 15_000;
const MAX_REINTENTOS = 12;

/** Si una parte llega vacía (la fuente falló y la API no tenía copia), se queda la que ya se veía: mejor la última
    imagen que «sin datos». Lo nuevo manda en todo lo demás. */
export function conservar<T extends ResumenTormentas>(antes: T | null, nuevo: T): T {
  if (!antes) return nuevo;
  const viejo = antes as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...(nuevo as unknown as Record<string, unknown>) };
  for (const k of ["cerca", "rayos", "lluvia", "radar", "movimiento"]) if (out[k] == null && viejo[k] != null) out[k] = viejo[k];
  return out as unknown as T;
}

/** Datos de una ruta de tormentas mientras `activa`: primera carga, refresco periódico y, si el servidor todavía
    está leyendo los rayos o armando imágenes de la animación, un reintento corto hasta que estén. */
export function useTormentas<T extends ResumenTormentas>(ruta: string, activa: boolean, fondo: boolean) {
  const [datos, setDatos] = useState<T | null>(null);
  const [carga, setCarga] = useState<Carga>("cargando");
  const reintentos = useRef(0);

  const pedir = useCallback(async () => {
    try {
      const j = await api<T>(ruta, {}, { fondo });
      setDatos((antes) => conservar(antes, j));
      setCarga("ok");
      return j;
    } catch {
      setCarga((c) => (c === "ok" ? c : "error"));   // con datos ya mostrados, se quedan
      return null;
    }
  }, [ruta, fondo]);

  useEffect(() => {
    if (!activa) return;
    let vivo = true;
    let h: ReturnType<typeof setTimeout> | undefined;
    const ciclo = async () => {
      const j = await pedir();
      if (!vivo) return;
      const preparando = !!j?.rayos?.calculando || !!(j as Partial<Tormentas> | null)?.mosaico?.preparando;
      const calculando = preparando && reintentos.current < MAX_REINTENTOS;
      reintentos.current = calculando ? reintentos.current + 1 : 0;
      h = setTimeout(() => void ciclo(), calculando ? REINTENTO_MS : CADA_MS);
    };
    void ciclo();
    return () => { vivo = false; clearTimeout(h); };
  }, [activa, pedir]);

  const reintentar = useCallback(() => { setCarga("cargando"); void pedir(); }, [pedir]);
  return { datos, carga, reintentar };
}

export const useVistaTormentas = (activa: boolean) => useTormentas<Tormentas>("/api/tormentas", activa, false);
export const useResumenTormentas = (activa: boolean) => useTormentas<ResumenTormentas>("/api/tormentas/resumen", activa, true);
