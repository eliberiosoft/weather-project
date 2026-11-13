/* Pestaña «Dispositivos»: la app avisa su uso como mucho cada 6 h. */
import { describe, expect, it } from "vitest";
import { toca } from "../features/pwa/actividad";

describe("aviso de uso", () => {
  it("la primera vez y después de 6 h, no antes", () => {
    const ahora = Date.parse("2026-11-12T12:00:00Z");
    expect(toca(0, ahora)).toBe(true);
    expect(toca(ahora - 5 * 3600_000, ahora)).toBe(false);
    expect(toca(ahora - 6 * 3600_000, ahora)).toBe(true);
  });
});
