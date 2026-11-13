import { describe, expect, it } from "vitest";
import { cuantasMostrar, filtrarMuro, TANDA } from "../features/vecinos/muro";
import type { Reporte } from "../shared/tipos";

const r = (id: string, extra: Partial<Reporte>): Reporte => ({ id, tipo: "otro", gravedad: 1, lat: -2.1, lon: -79.6, creado: "", estado: "validado", ...extra });
const lista = [
  r("1", { mio: true, estado: "descartado", descripcion: "Mi casa" }),
  r("2", { estado: "descartado" }),
  r("3", { lat: -2.5, descripcion: "Lejos, Puerto Inca" }),
  r("4", { tipo: "calle_inundada", via: "Calle Bolívar", origen: "equipo", autor: { nombre: "María López" } }),
];

describe("filtro de «Vecinos»", () => {
  it("oculta los descartados de otros pero no los propios", () => {
    expect(filtrarMuro(lista, "todos", null, "").map((x) => x.id)).toEqual(["1", "3", "4"]);
  });
  it("«Míos» y «Cerca de ti» (5 km)", () => {
    expect(filtrarMuro(lista, "mios", null, "").map((x) => x.id)).toEqual(["1"]);
    expect(filtrarMuro(lista, "cerca", { lat: -2.1, lon: -79.6 }, "").map((x) => x.id)).toEqual(["1", "4"]);
  });
  it("busca sin tildes ni mayúsculas, también por autor del equipo", () => {
    expect(filtrarMuro(lista, "todos", null, "bolivar").map((x) => x.id)).toEqual(["4"]);
    expect(filtrarMuro(lista, "todos", null, "maria").map((x) => x.id)).toEqual(["4"]);
  });
  it("scroll infinito: de a tandas, y hasta la publicación de un enlace compartido", () => {
    const muchas = Array.from({ length: 40 }, (_, i) => r(String(i), {}));
    expect(cuantasMostrar(muchas, TANDA, null)).toBe(15);
    expect(cuantasMostrar(muchas, TANDA * 3, null)).toBe(40);
    expect(cuantasMostrar(muchas, TANDA, "29")).toBe(30);
    expect(cuantasMostrar(muchas, TANDA, "no-esta")).toBe(15);
    expect(cuantasMostrar([], TANDA, null)).toBe(0);
  });
});
