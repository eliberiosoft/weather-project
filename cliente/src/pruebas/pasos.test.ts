import { describe, expect, it } from "vitest";
import { pasosDe, pasoVecino, pasoListo } from "../features/reportar/asistente";
import { ASISTENTE_VACIO } from "../shared/store";

describe("pasos del asistente de reporte", () => {
  it("la calle inundada pregunta cuánta agua; los demás tipos no piden gravedad", () => {
    expect(pasosDe("calle_inundada")).toEqual([1, 2, 3, 4, 5]);
    expect(pasosDe("otro")).toEqual([1, 3, 4, 5]);
    expect(pasosDe("robo")).toEqual([1, 3, 4, 5]);
  });
  it("avanza y retrocede saltando el paso 2 fuera de la calle", () => {
    expect(pasoVecino(1, "otro", 1)).toBe(3);
    expect(pasoVecino(3, "otro", -1)).toBe(1);
    expect(pasoVecino(1, "calle_inundada", 1)).toBe(2);
    expect(pasoVecino(5, "bache", 1)).toBe(5);
    // si quedó en el 2 y cambió a un tipo sin ese paso
    expect(pasoVecino(2, "basura", 1)).toBe(3);
    expect(pasoVecino(2, "basura", -1)).toBe(1);
  });
  it("el paso 2 solo exige la altura en la calle", () => {
    expect(pasoListo({ ...ASISTENTE_VACIO, tipo: "otro" }, 2)).toBe(true);
    expect(pasoListo({ ...ASISTENTE_VACIO, tipo: "calle_inundada" }, 2)).toBe(false);
  });
});
