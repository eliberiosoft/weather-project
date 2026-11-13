/* Incidentes guardados sin señal (yw_panel_cola): el operador en terreno publica aunque no haya red; el incidente
   queda en este equipo y se publica solo cuando vuelve la conexión:
   - al entrar al panel, al volver la red, al volver a la pestaña y cada 30 s mientras quede algo;
   - un solo envío a la vez, y cada incidente con su id local (lo que se guarda durante un envío no se pierde);
   - cada incidente es de quien lo escribió: solo se envía con la sesión de esa misma persona;
   - sin red, servidor caído o límite: se reintenta; sesión vencida (401): espera a que vuelva a ingresar;
     un rechazo definitivo (otro 4xx) se avisa y se suelta.
   Solo se guarda lo que la persona escribió (nunca respuestas de la API: ver sw.js). */
import { useEffect, useSyncExternalStore } from "react";
import { api, ErrorApi, SIN_RED } from "../../shared/api/cliente";
import type { NuevoIncidente } from "../../shared/api/tipos";
import { distM } from "./geo";

const CLAVE = "yw_panel_cola";
const CADA = 30 * 1000;
/** Lo mismo que la API considera repetido: misma persona y tipo a menos de 150 m (api/servidor.py, incidentes.duplicado). */
export const RADIO_REPETIDO = 150;
/** Como mucho tantos esperando señal por persona (que no se acumulen). */
export const MAX_COLA = 20;

export interface IncidenteEnCola { id: string; usuarioId: number; creado: string; cuerpo: NuevoIncidente }

interface EstadoCola { items: IncidenteEnCola[]; enviando: boolean; /** sube con cada envío logrado: la lista se recarga */ enviados: number }

function leer(): IncidenteEnCola[] {
  try { return JSON.parse(localStorage.getItem(CLAVE) || "[]") as IncidenteEnCola[]; } catch { return []; }
}

let estado: EstadoCola = { items: leer(), enviando: false, enviados: 0 };
const oyentes = new Set<() => void>();
function poner(p: Partial<EstadoCola>) { estado = { ...estado, ...p }; oyentes.forEach((o) => o()); }

function guardar(items: IncidenteEnCola[]): boolean {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(items));
  } catch {
    return false;   // sin espacio o almacenamiento bloqueado
  }
  poner({ items });
  return true;
}

const nuevoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export type ResultadoCola = "ok" | "sin_foto" | "repetido" | "tope" | "";
export const guardado = (r: ResultadoCola) => r === "ok" || r === "sin_foto";

/** Guarda el incidente para publicarlo luego. Si no cabe con la foto, lo guarda sin ella. */
export function encolar(usuarioId: number, cuerpo: NuevoIncidente, ahora = new Date()): ResultadoCola {
  const item: IncidenteEnCola = { id: nuevoId(), usuarioId, creado: ahora.toISOString(), cuerpo };
  const items = leer();
  const mios = items.filter((i) => i.usuarioId === usuarioId);
  if (mios.some((i) => i.cuerpo.tipo === cuerpo.tipo && distM(i.cuerpo.lon, i.cuerpo.lat, cuerpo.lon, cuerpo.lat) < RADIO_REPETIDO)) return "repetido";
  if (mios.length >= MAX_COLA) return "tope";
  if (guardar([...items, item])) return "ok";
  if (cuerpo.foto) {
    const sinFoto: NuevoIncidente = { ...cuerpo };
    delete sinFoto.foto;
    if (guardar([...items, { ...item, cuerpo: sinFoto }])) return "sin_foto";
  }
  return "";
}

/** ¿Conviene guardarlo para después? Sin red, servidor caído o saturado (5xx) o límite de envíos (429). */
export const sinConexion = (e: unknown) => !navigator.onLine || destino(e) === "reintentar";

/** Qué hacer con un incidente según cómo terminó su envío. */
export function destino(e: unknown): "reintentar" | "esperar_sesion" | "soltar" {
  const st = e instanceof ErrorApi ? e.status : SIN_RED;
  if (st === 401) return "esperar_sesion";
  if (st === SIN_RED || st === 429 || st >= 500) return "reintentar";
  return "soltar";
}

export interface Resumen { enviados: number; rechazos: string[] }

let enCurso: Promise<Resumen> | null = null;

/** Publica los incidentes guardados por esta persona (uno a la vez; si ya hay un envío en marcha, espera a ese). */
export function enviarCola(usuarioId: number): Promise<Resumen> {
  enCurso ??= enviar(usuarioId).finally(() => { enCurso = null; });
  return enCurso;
}

async function enviar(usuarioId: number): Promise<Resumen> {
  const mios = leer().filter((i) => i.usuarioId === usuarioId);
  const resumen: Resumen = { enviados: 0, rechazos: [] };
  if (!mios.length || !navigator.onLine) return resumen;
  poner({ enviando: true });
  const fuera = new Set<string>();
  try {
    for (const it of mios) {
      try {
        await api("/api/panel/incidentes", it.cuerpo);
        fuera.add(it.id);
        resumen.enviados++;
      } catch (e) {
        const d = destino(e);
        if (d === "soltar") { fuera.add(it.id); resumen.rechazos.push(e instanceof Error ? e.message : String(e)); }
        else break;   // sin red o sin sesión: los siguientes tampoco van a pasar ahora
      }
    }
  } finally {
    guardar(leer().filter((i) => !fuera.has(i.id)));   // relee: lo guardado durante el envío se queda
    poner({ enviando: false, enviados: estado.enviados + resumen.enviados });
  }
  return resumen;
}

/** Al salir en un equipo compartido: quita de este equipo lo que esa persona dejó sin enviar (fotos y ubicación). */
export function borrarMios(usuarioId: number): void {
  guardar(leer().filter((i) => i.usuarioId !== usuarioId));
}

export const pendientesDe = (usuarioId: number) => leer().filter((i) => i.usuarioId === usuarioId).length;

export function useCola(usuarioId: number): { items: IncidenteEnCola[]; enviando: boolean; enviados: number } {
  const e = useSyncExternalStore((o) => { oyentes.add(o); return () => { oyentes.delete(o); }; }, () => estado);
  return { items: e.items.filter((i) => i.usuarioId === usuarioId), enviando: e.enviando, enviados: e.enviados };
}

/** Mientras el panel está abierto: publica lo guardado sin que la persona haga nada. `alTerminar` avisa el resultado. */
export function useSincronizarCola(usuarioId: number, alTerminar: (r: Resumen) => void): void {
  useEffect(() => {
    const intentar = () => {
      if (!navigator.onLine || !leer().some((i) => i.usuarioId === usuarioId)) return;
      void enviarCola(usuarioId).then((r) => { if (r.enviados || r.rechazos.length) alTerminar(r); });
    };
    const visible = () => { if (document.visibilityState === "visible") intentar(); };
    window.addEventListener("online", intentar);
    document.addEventListener("visibilitychange", visible);
    const h = setInterval(intentar, CADA);
    intentar();
    return () => {
      window.removeEventListener("online", intentar);
      document.removeEventListener("visibilitychange", visible);
      clearInterval(h);
    };
  }, [usuarioId, alTerminar]);
}
