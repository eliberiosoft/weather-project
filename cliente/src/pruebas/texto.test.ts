import { describe, expect, it } from "vitest";
import { pasoListo } from "../features/reportar/asistente";
import { ASISTENTE_VACIO } from "../shared/store";
import { textoConSentido } from "../shared/formato";

describe("nada se publica vacío", () => {
  it("pide al menos 5 caracteres y 3 letras o números", () => {
    for (const vacio of ["", "    ", "...", "ok", "!!!!!!!", "  a b  "]) expect(textoConSentido(vacio), vacio).toBe(false);
    for (const bien of ["Árbol caído", "agua 30cm", "  Calle 5 cerrada  "]) expect(textoConSentido(bien), bien).toBe(true);
  });
  it("el asistente no pasa del paso 4 sin decir qué pasa (antes se podía saltar)", () => {
    expect(pasoListo({ ...ASISTENTE_VACIO, descripcion: "" }, 4)).toBe(false);
    expect(pasoListo({ ...ASISTENTE_VACIO, descripcion: "..." }, 4)).toBe(false);
    expect(pasoListo({ ...ASISTENTE_VACIO, descripcion: "Se cayó un árbol" }, 4)).toBe(true);
  });
});
