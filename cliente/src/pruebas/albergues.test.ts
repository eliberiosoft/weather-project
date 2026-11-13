import { describe, expect, it } from "vitest";
import { alberguesCercanos } from "../features/lugar/albergues";
import type { Albergue } from "../shared/tipos";

const alb = (id: string, lat: number, lon: number): Albergue => ({ id, nombre: "Albergue " + id, descripcion: null, lat, lon, fotos: 0, actualizado: "" });

describe("albergues en «Mi lugar»", () => {
  const lista = [alb("lejos", -2.30, -79.60), alb("cerca", -2.10, -79.69), alb("medio", -2.15, -79.69), alb("otro", -2.20, -79.69)];
  it("ordena por cercanía al lugar y se queda con los 3 primeros", () => {
    const r = alberguesCercanos(lista, { lat: -2.10, lon: -79.69 });
    expect(r.map((x) => x.a.id)).toEqual(["cerca", "medio", "otro"]);
    expect(r[0]?.dist).toBeLessThan(1);
  });
  it("sin lugar, los deja en el orden en que llegaron", () => {
    expect(alberguesCercanos(lista, null, 2).map((x) => x.a.id)).toEqual(["lejos", "cerca"]);
  });
  it("sin albergues cargados, nada", () => {
    expect(alberguesCercanos([], { lat: -2.1, lon: -79.69 })).toEqual([]);
  });
});
