import { describe, expect, it } from "vitest";
import { pestanaDelRol, pestanaInicial, pestanasVisibles, puedeGestionarIncidente } from "./permisos";

const SUPER = ["panel.ver", "niveles.fijar", "reportes.revisar", "avisos.publicar", "reglas.editar", "ajustes.editar",
  "incidentes.crear", "incidentes.gestionar", "usuarios.gestionar", "config.editar", "dashboard.ver", "avisos.eliminar",
  "incidentes.eliminar", "incidentes.reactivar", "albergues.gestionar", "alcance.detalle"];
const ANALISTA = SUPER.filter((p) => !["usuarios.gestionar", "config.editar", "dashboard.ver", "avisos.eliminar",
  "incidentes.eliminar", "incidentes.reactivar", "alcance.detalle"].includes(p));
const OPERADOR = ["panel.ver", "incidentes.crear"];

describe("pestañas según permisos", () => {
  it("superadmin ve todo, en orden", () => {
    expect(pestanasVisibles(SUPER)).toEqual(["mapa", "situacion", "reportes", "incidentes", "albergues", "avisos", "analisis", "dispositivos", "reglas", "ajustes", "usuarios", "config"]);
  });
  it("analista no ve usuarios, configuración, el mapa en vivo ni el análisis; sí los albergues", () => {
    expect(pestanasVisibles(ANALISTA)).toEqual(["situacion", "reportes", "incidentes", "albergues", "avisos", "reglas", "ajustes"]);
  });
  it("operador ve situación, reportes, incidentes y avisos", () => {
    expect(pestanasVisibles(OPERADOR)).toEqual(["situacion", "reportes", "incidentes", "avisos"]);
  });
  it("sin permisos no hay pestañas", () => {
    expect(pestanasVisibles([])).toEqual([]);
    expect(pestanaInicial("#usuarios", [])).toBeNull();
  });
  it("el hash solo abre una pestaña permitida", () => {
    expect(pestanaInicial("#avisos", pestanasVisibles(OPERADOR))).toBe("avisos");
    expect(pestanaInicial("#usuarios", pestanasVisibles(OPERADOR))).toBe("situacion");
    expect(pestanaInicial("", pestanasVisibles(SUPER))).toBe("mapa");          // el superadmin abre en el mapa en vivo
    expect(pestanaInicial("#analisis", pestanasVisibles(ANALISTA))).toBe("situacion");
  });
  it("el operador abre en incidentes; con un enlace, manda el enlace", () => {
    const ops = pestanasVisibles(OPERADOR);
    expect(pestanaInicial("", ops, pestanaDelRol("operador"))).toBe("incidentes");
    expect(pestanaInicial("#avisos", ops, pestanaDelRol("operador"))).toBe("avisos");
    expect(pestanaInicial("", pestanasVisibles(ANALISTA), pestanaDelRol("analista"))).toBe("situacion");
    expect(pestanaInicial("", ["situacion"], "incidentes")).toBe("situacion");
  });
});

describe("gestionar incidentes", () => {
  it("manda el campo editable de la API", () => {
    expect(puedeGestionarIncidente({ rol: "analista", permisos: ANALISTA }, { editable: false })).toBe(false);
    expect(puedeGestionarIncidente({ rol: "operador", permisos: OPERADOR }, { editable: true })).toBe(true);
  });
  it("sin el campo: gestionar sí; el operador solo con los suyos (los únicos que recibe)", () => {
    expect(puedeGestionarIncidente({ rol: "analista", permisos: ANALISTA }, {})).toBe(true);
    expect(puedeGestionarIncidente({ rol: "operador", permisos: OPERADOR }, {})).toBe(true);
    expect(puedeGestionarIncidente({ rol: "operador", permisos: ["panel.ver"] }, {})).toBe(false);
  });
});
