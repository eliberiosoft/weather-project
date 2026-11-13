import { describe, expect, it } from "vitest";
import { aLocal, desdeLocal, fechaValida, FILTROS_INICIALES, rutaReportes } from "./consulta";

describe("Reportes: filtros, paginación y fechas", () => {
  it("arma la ruta solo con los filtros que restringen", () => {
    expect(rutaReportes(FILTROS_INICIALES, 1)).toBe("/api/panel/reportes?estado=pendiente&pagina=1&n=20");
    const r = rutaReportes({ estado: "todos", origen: "equipo", tipo: "bache", vigencia: "vencidos", q: "  escuela  " }, 3);
    expect(r).toBe("/api/panel/reportes?estado=todos&pagina=3&n=20&origen=equipo&tipo=bache&vigencia=vencidos&q=escuela");
  });
  it("convierte entre datetime-local e ISO sin perder la hora", () => {
    const iso = desdeLocal("2026-11-20T18:30");
    expect(iso).not.toBeNull();
    expect(aLocal(iso as string)).toBe("2026-11-20T18:30");
    expect(desdeLocal("")).toBeNull();
    expect(desdeLocal("20/11/2026")).toBeNull();
  });
  it("acepta fechas de 5 minutos a 90 días desde ahora", () => {
    const ahora = Date.parse("2026-11-11T12:00:00Z");
    expect(fechaValida("2026-11-11T12:10:00Z", ahora)).toBe(true);
    expect(fechaValida("2026-11-11T12:01:00Z", ahora)).toBe(false);
    expect(fechaValida("2027-03-01T12:00:00Z", ahora)).toBe(false);
    expect(fechaValida(null, ahora)).toBe(false);
  });
});
