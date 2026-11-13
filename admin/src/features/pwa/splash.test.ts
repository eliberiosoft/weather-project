import { describe, expect, it } from "vitest";
import { esInstalada, msParaCerrar, SPLASH_MAX, SPLASH_MIN } from "./splash";

describe("splash: cuándo se ve", () => {
  const media = (standalone: boolean) => (q: string) => q === "(display-mode: standalone)" && standalone;
  it("solo en el panel instalado", () => {
    expect(esInstalada(media(true))).toBe(true);
    expect(esInstalada(media(false))).toBe(false);
  });
  it("en iOS antiguo vale navigator.standalone", () => {
    expect(esInstalada(media(false), true)).toBe(true);
    expect(esInstalada(media(false), false)).toBe(false);
  });
});

describe("splash: cuándo se cierra", () => {
  it("con todo listo pronto, espera al mínimo de 600 ms", () => {
    expect(msParaCerrar(100, true)).toBe(SPLASH_MIN - 100);
  });
  it("con todo listo pasado el mínimo, cierra ya", () => {
    expect(msParaCerrar(1500, true)).toBe(0);
  });
  it("sin sesión ni datos, espera como mucho hasta los 4 s", () => {
    expect(msParaCerrar(100, false)).toBe(SPLASH_MAX - 100);
    expect(msParaCerrar(3999, false)).toBe(1);
  });
  it("pasados los 4 s cierra siempre, aunque no haya llegado nada", () => {
    expect(msParaCerrar(SPLASH_MAX, false)).toBe(0);
    expect(msParaCerrar(9000, false)).toBe(0);
  });
});
