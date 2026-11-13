// @vitest-environment jsdom
/* «Tormentas» (spec 020): las frases salen de los datos de la API sin prometer más de lo que hay. */
import { afterEach, describe, expect, it } from "vitest";
import { I18N } from "../shared/i18n";
import { hayQueMirar, horaSatelite, minutosDesde, tendencia, textoLluvia, textoRayos, titular, urlMarco } from "../features/tormentas/texto";
import type { Cerca } from "../features/tormentas/tipos";

const cerca = (x: Partial<Cerca>): Cerca => ({ dist_km: 25, rumbo: "e", intensidad: 2, estado: "cerca", tendencia: "acercandose", t: "2026-11-12T02:30:00Z", ...x });

describe("tormentas en palabras de vecino", () => {
  afterEach(() => I18N.cambiar("es"));

  it("dice qué hay, a cuántos km y hacia dónde", () => {
    I18N.cambiar("es");
    expect(titular(cerca({}))).toBe("Hay una tormenta fuerte a 25 km al este del cantón.");
    expect(titular(cerca({ estado: "lejos", dist_km: 80, rumbo: "no", intensidad: 0 }))).toBe("Lo más cercano es una nube de tormenta, a 80 km al noroeste del cantón.");
    expect(titular(cerca({ estado: "encima", dist_km: 3, intensidad: 3 }))).toBe("Hay una tormenta muy fuerte sobre el cantón o muy cerca.");
    expect(titular(cerca({ estado: "sin", dist_km: null, rumbo: null, intensidad: 0 }))).toMatch(/No se ven nubes de tormenta/);
    expect(titular(null)).toBe("Sin datos del satélite por ahora.");
    I18N.cambiar("en");
    expect(titular(cerca({}))).toBe("There is a strong storm 25 km east of the canton.");
  });

  it("la tendencia solo si hay tormenta", () => {
    I18N.cambiar("es");
    expect(tendencia(cerca({}))).toMatch(/acercando/);
    expect(tendencia(cerca({ estado: "sin", tendencia: "quieta" }))).toBe("");
    expect(tendencia(cerca({ tendencia: null }))).toBe("");
    expect(tendencia(null)).toBe("");
  });

  it("rayos y lluvia: buscando, cerca, lejos o nada; la lluvia siempre dice que es modelo", () => {
    I18N.cambiar("es");
    expect(textoRayos({ calculando: true })).toBe("Buscando…");
    expect(textoRayos({ cerca_n: 4, cerca_km: 8 })).toBe("4 a menos de 30 km");
    expect(textoRayos({ cerca_n: 0, cerca_km: 82.4 })).toBe("El más cercano, a 82 km");
    expect(textoRayos({ cerca_n: 0, cerca_km: null })).toBe("Ninguno cerca");
    expect(textoRayos(null)).toBe("Sin datos");
    expect(textoLluvia({ proxima_hora_mm: 2.4, max_15_mm: 1.2, serie: [], viejo: false })).toBe("2,4 mm (modelo)");
    expect(textoLluvia({ proxima_hora_mm: 0, max_15_mm: 0, serie: [], viejo: false })).toBe("Nada (modelo)");
  });

  it("se destaca solo con tormenta a 40 km o menos, o rayos cerca", () => {
    expect(hayQueMirar(cerca({}), null)).toBe(true);
    expect(hayQueMirar(cerca({ estado: "lejos" }), { cerca_n: 0 })).toBe(false);
    expect(hayQueMirar(cerca({ estado: "lejos" }), { cerca_n: 2 })).toBe(true);
    expect(hayQueMirar(null, null)).toBe(false);
  });

  it("imagen y edad", () => {
    expect(urlMarco("20261112T0230")).toBe("/api/tormentas/marco/20261112T0230.png");
    expect(minutosDesde("2026-11-12T02:30:00Z", Date.parse("2026-11-12T02:55:00Z"))).toBe(25);
  });
});

describe("si una parte llega vacía, queda la que se veía", () => {
  it("conserva cerca y radar anteriores; lo nuevo manda en lo demás", async () => {
    const { conservar } = await import("../features/tormentas/datos");
    const antes = { cerca: cerca({}), rayos: null, lluvia: null, radar: { radio_km: 150, t: "x", nubes: [], rayos: null }, centro: [0, 0], radios: { encima: 10, cerca: 40, lejos: 150, rayos: 30 } } as never;
    const nuevo = { cerca: null, rayos: { cerca_n: 2 }, lluvia: null, radar: null, centro: [0, 0], radios: { encima: 10, cerca: 40, lejos: 150, rayos: 30 } } as never;
    const r = conservar(antes, nuevo) as { cerca: Cerca | null; rayos: { cerca_n: number }; radar: unknown };
    expect(r.cerca?.dist_km).toBe(25);
    expect(r.rayos.cerca_n).toBe(2);
    expect(r.radar).not.toBeNull();
  });
  it("dice la hora del satélite y si es la última que llegó", () => {
    I18N.cambiar("es");
    const h = () => "22:50";
    expect(horaSatelite(cerca({}), h)).toBe("Satélite de las 22:50");
    expect(horaSatelite(cerca({ viejo: true }), h)).toBe("Satélite de las 22:50 · la última que llegó");
    expect(horaSatelite(null, h)).toBe("");
  });
});
