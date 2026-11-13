import { describe, expect, it } from "vitest";
import { debeMostrarSplash, esperaCierre, esperaTope, leerEntorno, SPLASH_MAX, SPLASH_MIN } from "../app/splash";

const ventana = (standalone: boolean, iosStandalone?: boolean, search = "") => ({
  matchMedia: (q: string) => ({ matches: q === "(display-mode: standalone)" && standalone }),
  navigator: (iosStandalone === undefined ? {} : { standalone: iosStandalone }) as Navigator & { standalone?: boolean },
  location: { search },
});

describe("splash de la app instalada", () => {
  it("se ve solo cuando la app corre instalada", () => {
    expect(debeMostrarSplash(leerEntorno(ventana(true), false))).toBe(true);           // Android, escritorio
    expect(debeMostrarSplash(leerEntorno(ventana(false, true), false))).toBe(true);    // iPhone desde la pantalla de inicio
    expect(debeMostrarSplash(leerEntorno(ventana(false), false))).toBe(false);         // pestaña del navegador
    expect(debeMostrarSplash(leerEntorno(ventana(false, false), false))).toBe(false);  // Safari en pestaña
  });

  it("?splash lo fuerza solo en desarrollo (no llega a producción)", () => {
    expect(debeMostrarSplash(leerEntorno(ventana(false, undefined, "?splash"), true))).toBe(true);
    expect(debeMostrarSplash(leerEntorno(ventana(false, undefined, "?splash"), false))).toBe(false);
  });

  it("dura 900 ms como mínimo y termina el fundido antes de los 4 s", () => {
    expect(esperaCierre(200)).toBe(SPLASH_MIN - 200);
    expect(esperaCierre(1500)).toBe(0);
    expect(esperaTope(100, SPLASH_MAX, 320)).toBe(SPLASH_MAX - 320 - 100);
    expect(esperaTope(5000)).toBe(0);
    expect(esperaTope(0)).toBeGreaterThanOrEqual(SPLASH_MIN);
  });
});
