import { describe, expect, it } from "vitest";
import { cruzaNoCruces, distanciaALinea, urlNavegar } from "../features/mapa/rutaAlbergue";
import type { LatLon, Reporte } from "../shared/tipos";

const linea: LatLon[] = [[-2.1, -79.7], [-2.1, -79.69]];          // ~1,1 km hacia el este
const calle = (x: Partial<Reporte>) => ({ id: "c1", tipo: "calle_inundada", gravedad: 3, altura_agua: 3, estado: "pendiente",
  lat: -2.1, lon: -79.695, creado: "2026-11-10T10:00:00-05:00", expira: "2099-01-01T00:00:00-05:00", ...x }) as Reporte;

describe("ruta hasta un albergue", () => {
  it("mide la distancia de un punto a la línea", () => {
    expect(distanciaALinea([-2.1, -79.695], linea)).toBeLessThan(1);
    expect(distanciaALinea([-2.1003, -79.695], linea)).toBeGreaterThan(30);
  });
  it("avisa si cruza una calle «no cruces» vigente", () => {
    expect(cruzaNoCruces(linea, [calle({})])).toBe(true);
    expect(cruzaNoCruces(linea, [calle({ tramo: [[-2.0999, -79.6955], [-2.1001, -79.6955]] })])).toBe(true);
  });
  it("no avisa por agua más baja, lejana, vencida o descartada", () => {
    expect(cruzaNoCruces(linea, [calle({ altura_agua: 2 })])).toBe(false);
    expect(cruzaNoCruces(linea, [calle({ lat: -2.11 })])).toBe(false);
    expect(cruzaNoCruces(linea, [calle({ expira: "2020-01-01T00:00:00-05:00" })])).toBe(false);
    expect(cruzaNoCruces(linea, [calle({ estado: "descartado" })])).toBe(false);
    expect(cruzaNoCruces(linea, [calle({ tipo: "via_cerrada" })])).toBe(false);
  });
  it("Google Maps con el destino y el modo", () => {
    expect(urlNavegar({ lat: -2.1, lon: -79.7 }, "pie")).toBe("https://www.google.com/maps/dir/?api=1&destination=-2.100000,-79.700000&travelmode=walking");
    expect(urlNavegar({ lat: -2.1, lon: -79.7 }, "auto")).toContain("travelmode=driving");
  });
});
