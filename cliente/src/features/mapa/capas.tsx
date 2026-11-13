/* Definición de las capas del mapa (grupos «Ahora · Riesgo base · Referencia») con su leyenda en palabras de vecino. */
import type { CSSProperties, ReactNode } from "react";
import { almacen } from "../../shared/almacen";
import { Icono } from "../../shared/componentes/Icono";
import { categoria } from "../../shared/dominio";
import { AGUA, AGUA_W, COL, ESCENARIO, NEGRO, TINTA } from "../../shared/estilo";
import { t } from "../../shared/i18n";
import type { ClaveCapa } from "./motor";

const swLinea = (c: string, w = 5, disc = false) => <i className="inline-block w-5 rounded-full" style={{ borderTop: `${w}px ${disc ? "dotted" : "solid"} ${c}` }}></i>;
const swCaja = (estilo: CSSProperties) => <i className="inline-block h-3 w-5 rounded-[4px] ring-1 ring-negro/20" style={estilo}></i>;
const swPunto = (c: string, borde = 1.5) => <i className="inline-block size-3.5 rounded-full" style={{ background: c, boxShadow: `0 0 0 ${borde}px ${NEGRO} inset` }}></i>;
const muestra = (sw: ReactNode, txt: string, k: string | number) => <span key={k} className="inline-flex items-center gap-1.5">{sw}{txt}</span>;

export interface ItemCapa { k: ClaveCapa; on: boolean; ley: ReactNode }
export interface GrupoCapas { grupo: string; nota?: string; items: ItemCapa[] }

export function capasDef(): GrupoCapas[] {
  return [
    { grupo: t("app.capa.grupo.ahora"), items: [
      { k: "callesAgua", on: true, ley: <>{[1, 2, 3].map((a) => muestra(swLinea(AGUA[a] as string, (AGUA_W[a] as number) - 1), t("altura." + a), a))}{muestra(swLinea(TINTA, 4, true), t("app.ley.sin_verificar"), "sv")}</> },
      { k: "rios", on: true, ley: <>{[1, 2, 3, 4].map((k) => muestra(swLinea(COL[k] as string), t("nivel." + k), k))}{muestra(swCaja({ background: NEGRO }), t("app.ley.borde_negro"), "bn")}</> },
      { k: "recintos", on: true, ley: <>{muestra(swPunto(COL[3] as string), t("app.ley.color_nivel"), 1)}{muestra(swPunto(COL[1] as string, 3), t("app.ley.borde_grueso"), 2)}</> },
      { k: "reportes", on: true, ley: <>{muestra(swCaja({ background: TINTA }), t("app.ley.verificado"), 1)}{muestra(swCaja({ borderStyle: "dashed" }), t("app.ley.tuyo"), 2)}{muestra(swCaja({ background: NEGRO }), t("app.ley.equipo"), 3)}</> },
      // dónde ir: encendidos siempre por defecto
      { k: "albergues", on: true, ley: <>{muestra(<i className="grid size-5 place-items-center rounded-md border-2 border-tinta bg-white text-tinta"><Icono id="i-albergue" className="size-3.5" /></i>, t("app.ley.albergue"), 1)}{muestra(swLinea(TINTA, 4), t("app.ley.ruta"), 2)}</> },
    ] },
    { grupo: t("app.capa.grupo.base"), nota: t("app.capa.grupo.base.nota"), items: [
      { k: "tramos", on: false, ley: muestra(swLinea(NEGRO, 5, true), t("app.ley.orilla"), 1) },
      { k: "muyAlto", on: false, ley: muestra(swCaja({ background: ESCENARIO, opacity: 0.35 }), t("app.ley.zona_baja"), 1) },
      { k: "zonas", on: false, ley: muestra(swCaja({ border: `2px dashed ${ESCENARIO}`, background: "none" }), t("app.ley.zona_critica"), 1) },
      { k: "huellas", on: false, ley: muestra(swCaja({ background: AGUA[1], opacity: 0.6 }), t("app.ley.escenario"), 1) },
    ] },
    { grupo: t("app.capa.grupo.ref"), items: [
      { k: "puntos", on: true, ley: muestra(swCaja({ background: "#fff" }), t("app.ley.mide"), 1) },
      { k: "equip", on: false, ley: <>{["Salud", "Seguridad", "Educación"].map((c) => muestra(<Icono id={"e-" + c} className="size-4.5" />, categoria(c), c))}</> },
      { k: "parroquias", on: false, ley: muestra(swLinea(TINTA, 2, true), t("app.ley.parroquia"), 1) },
    ] },
  ];
}

/** Capas encendidas: las de fábrica más lo que la persona eligió (ay_capas_on). */
export function capasEncendidas(): Record<ClaveCapa, boolean> {
  const def = Object.fromEntries(capasDef().flatMap((g) => g.items).map((i) => [i.k, i.on])) as Record<ClaveCapa, boolean>;
  return { ...def, ...almacen.get<Partial<Record<ClaveCapa, boolean>>>("capas_on", {}) };
}

export function guardarCapa(k: ClaveCapa, on: boolean): void {
  const g = almacen.get<Partial<Record<ClaveCapa, boolean>>>("capas_on", {});
  g[k] = on;
  almacen.set("capas_on", g);
}
