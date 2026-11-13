import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearJalar, TOPE_JALAR, UMBRAL_JALAR, ZONA_MUERTA } from "../shared/jalar";

/** dy del dedo para que el indicador baje `d` px (la mitad, después de la zona muerta) */
const dedo = (d: number) => ZONA_MUERTA + d * 2;

describe("jalar para refrescar", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("con la lista arriba y pasado el umbral, al soltar refresca y gira al menos un momento", async () => {
    const refrescar = vi.fn(() => Promise.resolve());
    const cambios = vi.fn();
    const j = crearJalar(refrescar, cambios, 600);
    j.empezar(100, true);
    expect(j.mover(100 + dedo(UMBRAL_JALAR))).toBe(true);
    j.soltar();
    expect(refrescar).toHaveBeenCalledOnce();
    expect(j.get()).toEqual({ dist: UMBRAL_JALAR, refrescando: true });
    await vi.advanceTimersByTimeAsync(599);
    expect(j.get().refrescando).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(j.get()).toEqual({ dist: 0, refrescando: false });
  });

  it("sin llegar al umbral vuelve a su sitio sin refrescar", () => {
    const refrescar = vi.fn(() => Promise.resolve());
    const j = crearJalar(refrescar, () => {});
    j.empezar(100, true);
    j.mover(100 + dedo(UMBRAL_JALAR - 1));
    j.soltar();
    expect(refrescar).not.toHaveBeenCalled();
    expect(j.get().dist).toBe(0);
  });

  it("si la lista no está arriba, el gesto es scroll normal", () => {
    const refrescar = vi.fn(() => Promise.resolve());
    const j = crearJalar(refrescar, () => {});
    j.empezar(100, false);
    expect(j.mover(400)).toBe(false);
    j.soltar();
    expect(refrescar).not.toHaveBeenCalled();
  });

  it("un toque o un temblor no bloquea el scroll ni los clics", () => {
    const j = crearJalar(() => Promise.resolve(), () => {});
    j.empezar(100, true);
    expect(j.mover(100 + ZONA_MUERTA - 1)).toBe(false);
    expect(j.get().dist).toBe(0);
  });

  it("si el dedo sube, suelta el gesto aunque luego baje", () => {
    const refrescar = vi.fn(() => Promise.resolve());
    const j = crearJalar(refrescar, () => {});
    j.empezar(100, true);
    j.mover(90);
    expect(j.mover(100 + dedo(UMBRAL_JALAR))).toBe(false);
    j.soltar();
    expect(refrescar).not.toHaveBeenCalled();
  });

  it("el indicador tiene un tope y no se arma otro refresco mientras gira", () => {
    const refrescar = vi.fn(() => new Promise<void>(() => {}));
    const j = crearJalar(refrescar, () => {});
    j.empezar(0, true);
    j.mover(5000);
    expect(j.get().dist).toBe(TOPE_JALAR);
    j.soltar();
    j.empezar(0, true);
    expect(j.mover(dedo(UMBRAL_JALAR))).toBe(false);
    j.soltar();
    expect(refrescar).toHaveBeenCalledOnce();
  });

  it("si la recarga falla, el indicador se va igual", async () => {
    const j = crearJalar(() => Promise.reject(new Error("sin red")), () => {}, 10);
    j.empezar(0, true);
    j.mover(dedo(UMBRAL_JALAR));
    j.soltar();
    await vi.advanceTimersByTimeAsync(10);
    expect(j.get()).toEqual({ dist: 0, refrescando: false });
  });
});
