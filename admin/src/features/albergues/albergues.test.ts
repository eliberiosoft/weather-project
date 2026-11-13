import { describe, expect, it } from "vitest";
import { cuerpoAlbergue, faltaAlbergue, formDe, urlFotoAlbergue, type FormAlbergue } from "./formulario";

const A = { id: "abcdef123456", nombre: "Coliseo", descripcion: null, lat: -2.1, lon: -79.7, fotos: 2, actualizado: "2026-11-10T10:00:00-05:00" };
const listo = (x: Partial<FormAlbergue> = {}): FormAlbergue => ({ ...formDe(null), nombre: "Escuela Rocafuerte", lat: -2.1, lon: -79.7, ...x });

describe("formulario de albergue", () => {
  it("al editar, las fotos que ya tiene van por número", () => {
    expect(formDe(A).fotos).toEqual([{ n: 1 }, { n: 2 }]);
    expect(formDe(A).descripcion).toBe("");
  });
  it("pide título con sentido, ubicación y dentro del cantón", () => {
    expect(faltaAlbergue(listo())).toBeNull();
    expect(faltaAlbergue(listo({ nombre: " .. " }))).toBe("albergues.nombre");
    expect(faltaAlbergue(listo({ lat: null }))).toBe("albergues.ubicacion");
    expect(faltaAlbergue(listo({ dentro: false }))).toBe("albergues.fuera");
    expect(faltaAlbergue(listo({ descripcion: "x".repeat(281) }))).toBe("albergues.descripcion");
  });
  it("el cuerpo manda las fotos en orden: número si ya estaba, data URL si es nueva", () => {
    const c = cuerpoAlbergue(listo({ nombre: "  Coliseo  ", fotos: [{ n: 2 }, { nueva: "data:image/jpeg;base64,AA" }] }));
    expect(c.nombre).toBe("Coliseo");
    expect(c.fotos).toEqual([2, "data:image/jpeg;base64,AA"]);
  });
  it("la URL de la foto cambia al editar el albergue", () => {
    expect(urlFotoAlbergue(A, 2)).toBe("/api/albergues/abcdef123456/foto/2?v=2026-11-10T10%3A00%3A00-05%3A00");
  });
});
