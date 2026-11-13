import { describe, expect, it } from "vitest";
import { autoria, enSilencio, nivelEfectivo, recintoDeLugar, textoAutoria, tituloReporte, vigente } from "../shared/dominio";
import { I18N } from "../shared/i18n";
import type { Reporte, Territorio } from "../shared/tipos";

const base: Reporte = { id: "abc123abc123", tipo: "vivienda_inundada", gravedad: 2, lat: -2.1, lon: -79.6, creado: "2026-11-09T10:00:00-05:00", estado: "validado" };

describe("autoría de los reportes (contrato v2 §5)", () => {
  it("vecino y tú siguen anónimos", () => {
    expect(autoria(base)).toEqual({ tipo: "vecino" });
    expect(autoria({ ...base, mio: true })).toEqual({ tipo: "tu" });
    expect(autoria({ ...base, origen: "vecino", autor: null })).toEqual({ tipo: "vecino" });
  });
  it("el equipo con autor muestra «Publicado por <nombre>»", () => {
    const a = autoria({ ...base, origen: "equipo", autor: { nombre: "María López", rol: "analista" } });
    expect(a).toEqual({ tipo: "equipo", nombre: "María López" });
    expect(textoAutoria(a)).toBe(I18N.t("app.autor.publicado", { nombre: "María López" }));
    expect(textoAutoria(a)).toContain("María López");
  });
  it("el equipo anónimo (autor null) muestra «Equipo de riesgo»", () => {
    const a = autoria({ ...base, origen: "equipo", autor: null });
    expect(a).toEqual({ tipo: "equipo", nombre: null });
    expect(textoAutoria(a)).toBe(I18N.t("app.autor.equipo"));
  });
});

describe("formato de reportes", () => {
  it("las calles se titulan con la vía y la altura del agua", () => {
    const t = tituloReporte({ ...base, tipo: "calle_inundada", via: "Av. Principal", altura_agua: 2 });
    expect(t).toBe(`Av. Principal · ${I18N.t("altura.2")}`);
  });
  it("lo demás con el tipo traducido", () => {
    expect(tituloReporte(base)).toBe(I18N.t("tipo.vivienda_inundada"));
  });
  it("vigencia según «expira»", () => {
    const ahora = Date.parse("2026-11-09T12:00:00-05:00");
    expect(vigente({ expira: null }, ahora)).toBe(true);
    expect(vigente({ expira: "2026-11-09T13:00:00-05:00" }, ahora)).toBe(true);
    expect(vigente({ expira: "2026-11-09T11:00:00-05:00" }, ahora)).toBe(false);
  });
});

describe("nivel efectivo", () => {
  it("el verificado manda sobre el estimado", () => {
    expect(nivelEfectivo({ sugerido: 1, oficial: 3, oficial_motivo: "COE" })).toMatchObject({ n: 3, oficial: true, motivo: "COE" });
  });
  it("sin verificado, el sugerido con su motivo", () => {
    expect(nivelEfectivo({ sugerido: 2, motivo: "texto", motivos: [] })).toMatchObject({ n: 2, oficial: false, motivo: "texto" });
    expect(nivelEfectivo(null)).toEqual({ n: null, oficial: false });
  });
});

describe("avisos", () => {
  const terr = { recintos: { 1: { id: 1, nombre: "A", lat: -2.1, lon: -79.6 }, 2: { id: 2, nombre: "B", lat: -2.3, lon: -79.8 } }, tipos: {} } as unknown as Territorio;
  it("recinto elegido o el más cercano a 3 km como máximo", () => {
    expect(recintoDeLugar({ tipo: "recinto", id: 9 }, terr)).toBe(9);
    expect(recintoDeLugar({ tipo: "punto", lat: -2.101, lon: -79.601 }, terr)).toBe(1);
    expect(recintoDeLugar({ tipo: "punto", lat: -2.2, lon: -79.7 }, terr)).toBeNull();
    expect(recintoDeLugar(null, terr)).toBeNull();
  });
  it("horas de silencio en hora de Ecuador (UTC−5)", () => {
    expect(enSilencio([22, 6], new Date("2026-11-10T04:00:00Z"))).toBe(true);    // 23:00 en Ecuador
    expect(enSilencio([22, 6], new Date("2026-11-09T17:00:00Z"))).toBe(false);   // 12:00 en Ecuador
  });
});
