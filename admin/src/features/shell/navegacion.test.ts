import { describe, expect, it } from "vitest";
import { pestanasVisibles } from "../auth/permisos";
import { repartir } from "./Navegacion";

describe("barra inferior del panel", () => {
  it("el operador ve sus cuatro secciones en la barra, sin «Más»", () => {
    expect(repartir(pestanasVisibles(["panel.ver", "incidentes.crear"]))).toEqual({
      barra: ["situacion", "reportes", "incidentes", "avisos"], mas: [],
    });
  });
  it("con más de cinco, las cuatro primeras en la barra y el resto en «Más»", () => {
    const todas = pestanasVisibles(["panel.ver", "niveles.fijar", "reportes.revisar", "avisos.publicar", "reglas.editar",
      "ajustes.editar", "incidentes.crear", "incidentes.gestionar", "usuarios.gestionar", "config.editar", "dashboard.ver", "avisos.eliminar"]);
    expect(repartir(todas)).toEqual({
      barra: ["mapa", "situacion", "reportes", "incidentes"], mas: ["avisos", "analisis", "reglas", "ajustes", "usuarios", "config"],
    });
  });
  it("con cinco caben todas", () => {
    expect(repartir(["situacion", "reportes", "incidentes", "avisos", "reglas"]).mas).toEqual([]);
  });
});
