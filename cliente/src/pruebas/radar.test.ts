/* Radar de «Mi lugar» (spec 020): la escala de raíz cuadrada y la orientación (norte arriba, este a la derecha). */
import { describe, expect, it } from "vitest";
import { escala, punto, R_SVG } from "../features/tormentas/radar";

describe("radar de tormentas", () => {
  it("la escala de raíz cuadrada da lugar al anillo de 10 km", () => {
    expect(escala(150, 150)).toBe(R_SVG);
    expect(escala(0, 150)).toBe(0);
    expect(escala(10, 150)).toBeCloseTo(25.8, 1);
    expect(escala(40, 150)).toBeCloseTo(51.6, 1);
    expect(escala(400, 150)).toBe(R_SVG);          // fuera del radio queda en el borde
  });
  it("norte arriba, este a la derecha", () => {
    const [nx, ny] = punto(0, 40, 150);
    expect(nx).toBeCloseTo(0);
    expect(ny).toBeLessThan(0);
    const [ex, ey] = punto(40, 0, 150);
    expect(ex).toBeGreaterThan(0);
    expect(ey).toBeCloseTo(0);
    expect(punto(0, 0, 150)).toEqual([0, 0]);
  });
});

describe("flechas de movimiento", () => {
  it("el rumbo en grados: norte 0, este 90, sur 180, oeste 270", async () => {
    const { grados } = await import("../features/tormentas/radar");
    expect(grados([0, 0], [1, 0])).toBeCloseTo(0);
    expect(grados([0, 0], [0, 1])).toBeCloseTo(90);
    expect(grados([0, 0], [-1, 0])).toBeCloseTo(180);
    expect(grados([0, 0], [0, -1])).toBeCloseTo(270);
  });
  it("más rápida, más larga, con tope", async () => {
    const { largoFlecha } = await import("../features/tormentas/radar");
    expect(largoFlecha(10)).toBeLessThan(largoFlecha(30));
    expect(largoFlecha(500)).toBe(44);
  });
});
