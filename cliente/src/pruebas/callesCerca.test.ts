/* «Calles inundadas cerca» en «Mi lugar»: de la más cercana a la más lejana. */
import { describe, expect, it } from "vitest";
import { ordenarPorDistancia } from "../features/lugar/CallesCerca";
import type { Reporte } from "../shared/tipos";

const calle = (id: string, lat: number, lon: number) => ({ id, lat, lon, tipo: "calle_inundada" }) as unknown as Reporte;

describe("calles inundadas cerca", () => {
  it("se ordenan por distancia al lugar y la traen calculada", () => {
    const centro = { lat: -2.09, lon: -79.69 };
    const l = ordenarPorDistancia([calle("lejos", -2.1, -79.69), calle("cerca", -2.091, -79.69), calle("medio", -2.095, -79.69)], centro);
    expect(l.map((x) => x.r.id)).toEqual(["cerca", "medio", "lejos"]);
    expect(l[0]!.dist).toBeGreaterThan(100);
    expect(l[0]!.dist).toBeLessThan(120);
  });
});
