/* Lógica del asistente «Reportar»: qué pasa → (cuánta agua, solo en calles) → dónde → foto y detalles → revisar y enviar.
   El vecino no tipifica la gravedad (pedido del dueño): describe y sube la evidencia; la gravedad la fija el equipo. */
import { almacen } from "../../shared/almacen";
import { DISP, postJSON } from "../../shared/api";
import { nombreVia, tramoCercano } from "../../shared/calles";
import { refrescarReportes } from "../../shared/datos";
import { recintoMasCercano } from "../../shared/dominio";
import { textoConSentido } from "../../shared/formato";
import { t } from "../../shared/i18n";
import { irA } from "../../shared/navegacion";
import { ASISTENTE_VACIO, setRep, store, toast, type Asistente, type OrigenUbic } from "../../shared/store";
import type { CuerpoReporte } from "../../shared/tipos";
import { conCuenta } from "../cuenta/cuenta";
import { avisoCola, encolar, esTemporal, guardado } from "./cola";

export const PASOS = 5;
export const CALLE = "calle_inundada";

/** Pasos que recorre cada tipo: el 2 (cuánta agua) solo existe en la calle inundada. */
export const pasosDe = (tipo: string | null): number[] => (tipo === CALLE ? [1, 2, 3, 4, 5] : [1, 3, 4, 5]);
/** El paso que sigue o el anterior, saltando los que el tipo no tiene. */
export function pasoVecino(paso: number, tipo: string | null, dir: 1 | -1): number {
  const ps = pasosDe(tipo);
  const i = ps.indexOf(paso);
  if (i < 0) return (dir > 0 ? ps.find((p) => p > paso) : [...ps].reverse().find((p) => p < paso)) ?? paso;
  return ps[Math.min(ps.length - 1, Math.max(0, i + dir))] ?? paso;
}

/** ¿Se puede pasar del paso n? */
export function pasoListo(r: Asistente, n = r.paso): boolean {
  if (n === 1) return !!r.tipo;
  if (n === 2) return r.tipo === CALLE ? !!r.altura : true;
  if (n === 3) return !!r.ubic;
  if (n === 4) return textoConSentido(r.descripcion);     // nada se envía sin decir qué pasa
  if (n === 5) return r.consent;
  return true;
}

export function irPaso(paso: number | "ok", atras = false): void {
  setRep({ paso, atras });
}

/** Al elegir una opción se pasa solo al siguiente paso, con una pausa corta para ver la selección. */
export function avanzar(demora: number): void {
  setTimeout(() => {
    const r = store.get().rep;
    if (typeof r.paso === "number" && r.paso < PASOS && pasoListo(r)) irPaso(pasoVecino(r.paso, r.tipo, 1));
  }, demora);
}

/** La ubicación del reporte (GPS, tocada en el mapa o ajustada en el minimapa). En calles se busca la calle más cercana. */
export function fijarUbicacionReporte(lat: number, lon: number, origen: OrigenUbic, prec: number | null = null): void {
  setRep({ ubic: { lat, lon, origen, prec } });
  store.set({ modoMapa: null });
  if (store.get().rep.tipo === CALLE) {
    tramoCercano(lat, lon).then((tr) => {
      const u = store.get().rep.ubic;
      if (u && u.lat === lat && u.lon === lon) setRep({ ubic: { ...u, calle: tr ? nombreVia(tr, recintoMasCercano(store.get().terr, lat, lon)) : false } });
    }).catch(() => {});
  }
  if (origen === "mapa") irA("reportar");
}

/** Elegir el tipo: si cambia, se borra la altura; si ya había ubicación y ahora es calle, se busca la calle. */
export function elegirTipo(tipo: string): void {
  const r = store.get().rep;
  setRep({ tipo, altura: r.tipo !== tipo ? null : r.altura });
  if (r.ubic && tipo === CALLE && r.ubic.calle === undefined) fijarUbicacionReporte(r.ubic.lat, r.ubic.lon, r.ubic.origen, r.ubic.prec);
}

export function reiniciarReporte(): void {
  setRep({ ...ASISTENTE_VACIO, ultimo: store.get().rep.ultimo });
}

/** Texto de «Dónde»: origen, coordenadas y la calle encontrada (si es calle). */
export function textoDonde(r: Asistente): string {
  const u = r.ubic;
  if (!u) return t("app.rep.donde.nada");
  const c = `${u.lat.toFixed(5)}, ${u.lon.toFixed(5)}`;
  let txt = t(u.origen === "gps" ? "app.rep.donde.gps" : u.origen === "ajustada" ? "app.rep.donde.ajustada" : "app.rep.donde.mapa", { c });
  if (u.calle) txt += ` · ${u.calle}`;
  else if (u.calle === false) txt += t("app.rep.donde.sin_calle");
  return txt;
}

/** Arma el cuerpo de POST /api/reportes. En calles: la vía, el tramo de ±120 m y el punto encajado a la calle. */
export async function armarCuerpo(r: Asistente): Promise<CuerpoReporte> {
  const u = r.ubic as NonNullable<Asistente["ubic"]>;
  const cuerpo: CuerpoReporte = { dispositivo: DISP, tipo: r.tipo as string, descripcion: r.descripcion, lat: u.lat, lon: u.lon, fotos: r.fotos, consentimiento: true,
    // la cuenta es opcional: sin sesión es anónimo; con sesión, el vecino elige
    anonimo: !conCuenta(store.get().cuenta) || r.anonimo };
  if (r.tipo === CALLE) {
    const tr = await tramoCercano(u.lat, u.lon).catch(() => null);
    Object.assign(cuerpo, { altura_agua: r.altura, gravedad: r.altura, via: nombreVia(tr, recintoMasCercano(store.get().terr, u.lat, u.lon)), tramo: tr ? tr.coords : null });
    if (tr) { cuerpo.lat = tr.punto[0]; cuerpo.lon = tr.punto[1]; }
  }
  return cuerpo;
}

let enviandoReporte = false;

/** Envía; sin señal lo deja en la cola. Devuelve false si no se envió ni se guardó.
    Un segundo toque mientras se envía no hace nada: el mismo reporte no sale (ni se guarda) dos veces. */
export async function enviarReporte(): Promise<boolean> {
  if (enviandoReporte) return false;
  enviandoReporte = true;
  store.set({ enviandoReporte: true });
  try { return await enviarUnaVez(); } finally { enviandoReporte = false; store.set({ enviandoReporte: false }); }
}

async function enviarUnaVez(): Promise<boolean> {
  const r = store.get().rep;
  for (const n of [1, 2, 3]) if (!pasoListo(r, n)) { irPaso(n, true); return false; }
  if (!r.consent) { toast(t("app.val.consent")); return false; }
  const cuerpo = await armarCuerpo(r);
  let mensaje: string, nuevoId: string | null = null;
  try {
    const res = await postJSON<{ id: string; estado?: string; vecinos_n?: number }>("/api/reportes", cuerpo);
    nuevoId = res.id;
    almacen.set("consent_ok", true);
    // con este reporte ya son varios vecinos en el sector: quedó publicado sin esperar al equipo
    mensaje = res.estado === "validado" && res.vecinos_n ? t("app.toast.rep_vecinos", { n: res.vecinos_n })
      : t(cuerpo.tipo === CALLE ? "app.toast.calle_ok" : "app.toast.rep_ok");
  } catch (e) {
    if (!esTemporal(e)) { toast((e as Error).message, 5000); return false; }
    const c = encolar(cuerpo);
    if (!guardado(c)) { toast(avisoCola(c), 7000); return false; }
    mensaje = avisoCola(c);
  }
  setRep({ ...ASISTENTE_VACIO, paso: "ok", okTexto: mensaje, ultimo: { lat: cuerpo.lat, lon: cuerpo.lon, id: nuevoId } });
  void refrescarReportes();
  return true;
}
