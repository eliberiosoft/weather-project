import { describe, expect, it } from "vitest";
import { sugerirLugares, type Lugares } from "../shared/lugares";

const L: Lugares = {
  mapa: new Map([
    ["san jacinto de yaguachi (cabecera)", { tipo: "recinto", id: 1, texto: "San Jacinto de Yaguachi (cabecera)", lat: -2.09, lon: -79.69 }],
    ["los ángeles", { tipo: "recinto", id: 2, texto: "Los Ángeles", lat: -2.14, lon: -79.68 }],
    ["av. ángel cárdenas · yaguachi", { tipo: "punto", lat: -2.1, lon: -79.69, nombre: "Av. Ángel Cárdenas (Yaguachi)", texto: "Av. Ángel Cárdenas · Yaguachi", calle: true }],
    ["virgen de fátima", { tipo: "recinto", id: 3, texto: "Virgen de Fátima", lat: -2.2, lon: -79.6 }],
  ]),
  opciones: [
    { valor: "San Jacinto de Yaguachi (cabecera)", etiqueta: "Cabecera · Yaguachi" },
    { valor: "Los Ángeles", etiqueta: "Recinto · Yaguachi" },
    { valor: "Av. Ángel Cárdenas · Yaguachi", etiqueta: "Calle" },
    { valor: "Virgen de Fátima", etiqueta: "Recinto · Virgen de Fátima" },
  ],
};

describe("buscador de lugares", () => {
  it("no distingue tildes ni mayúsculas", () => {
    expect(sugerirLugares(L, "FATIMA").map((s) => s.titulo)).toEqual(["Virgen de Fátima"]);
    expect(sugerirLugares(L, "angel").map((s) => s.titulo)).toEqual(["Los Ángeles", "Av. Ángel Cárdenas · Yaguachi"]);
  });
  it("primero lo que empieza con lo escrito; marca las calles", () => {
    const r = sugerirLugares(L, "yaguachi");
    expect(r[0]?.titulo).toBe("San Jacinto de Yaguachi (cabecera)");
    expect(r.find((s) => s.calle)?.lugar.tipo).toBe("punto");
  });
  it("vacío o sin coincidencias: nada; respeta el tope", () => {
    expect(sugerirLugares(L, "  ")).toEqual([]);
    expect(sugerirLugares(L, "zzz")).toEqual([]);
    expect(sugerirLugares(L, "a", 2)).toHaveLength(2);
  });
});
