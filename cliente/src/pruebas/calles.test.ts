import { describe, expect, it } from "vitest";
import { tramoEnCalles, type Calles } from "../shared/calles";

// una calle recta de oeste a este de unos 1,1 km
const calles: Calles = { features: [{ properties: { nombre: "Calle Recta" }, geometry: { type: "LineString", coordinates: [[-79.61, -2.1], [-79.6, -2.1]] } }] };

describe("tramo de calle (±120 m)", () => {
  it("encaja el toque a la calle y devuelve un tramo de unos 240 m", () => {
    const t = tramoEnCalles(calles, -2.1003, -79.605);
    expect(t?.nombre).toBe("Calle Recta");
    expect(t?.punto[0]).toBeCloseTo(-2.1, 6);
    const [a, b] = [t?.coords[0], t?.coords.at(-1)];
    const largo = Math.abs(((b?.[1] ?? 0) - (a?.[1] ?? 0)) * 111320 * Math.cos((2.1 * Math.PI) / 180));
    expect(largo).toBeGreaterThan(230);
    expect(largo).toBeLessThan(250);
  });
  it("no encaja si la calle está a más de 70 m", () => {
    expect(tramoEnCalles(calles, -2.102, -79.605)).toBeNull();
  });
});
