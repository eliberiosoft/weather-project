import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearPendientes, UMBRAL_BARRA, UMBRAL_LENTO } from "../shared/pendientes";

describe("cargas pendientes (barra global y conexión lenta)", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("una petición que responde antes de 400 ms no muestra la barra (sin parpadeo)", () => {
    const p = crearPendientes();
    const fin = p.empezar();
    vi.advanceTimersByTime(UMBRAL_BARRA - 1);
    expect(p.get()).toEqual({ n: 1, barra: false, lento: false });
    fin();
    vi.advanceTimersByTime(UMBRAL_LENTO);
    expect(p.get()).toEqual({ n: 0, barra: false, lento: false });
  });

  it("pasados 400 ms aparece la barra y se va al terminar", () => {
    const p = crearPendientes();
    const fin = p.empezar();
    vi.advanceTimersByTime(UMBRAL_BARRA);
    expect(p.get().barra).toBe(true);
    fin();
    expect(p.get().barra).toBe(false);
  });

  it("a los 8 s con algo pendiente aparece el aviso de conexión lenta", () => {
    const p = crearPendientes();
    p.empezar();
    vi.advanceTimersByTime(UMBRAL_LENTO - 1);
    expect(p.get().lento).toBe(false);
    vi.advanceTimersByTime(1);
    expect(p.get()).toMatchObject({ barra: true, lento: true });
  });

  it("varias peticiones forman una sola racha: la barra sigue mientras quede alguna", () => {
    const p = crearPendientes();
    const a = p.empezar();
    vi.advanceTimersByTime(300);
    const b = p.empezar();
    const c = p.empezar();
    expect(p.get().n).toBe(3);
    vi.advanceTimersByTime(100);   // 400 ms desde la primera: no se reinicia con las nuevas
    expect(p.get().barra).toBe(true);
    a(); b();
    expect(p.get()).toMatchObject({ n: 1, barra: true });
    b();   // terminar dos veces la misma no descuenta otra
    expect(p.get().n).toBe(1);
    vi.advanceTimersByTime(UMBRAL_LENTO);
    expect(p.get().lento).toBe(true);
    c();
    expect(p.get()).toEqual({ n: 0, barra: false, lento: false });
  });

  it("seguir() cuenta una promesa hasta que se resuelve o falla", async () => {
    const p = crearPendientes();
    let soltar!: () => void;
    const promesa = p.seguir(new Promise<void>((ok) => { soltar = ok; }));
    expect(p.get().n).toBe(1);
    soltar();
    await promesa;
    expect(p.get().n).toBe(0);
    await p.seguir(Promise.reject(new Error("x"))).catch(() => {});
    expect(p.get().n).toBe(0);
  });

  it("«Reintentar» oculta el aviso, recarga la vista y lo vuelve a mostrar si a los 8 s sigue lento", () => {
    const p = crearPendientes();
    const recargar = vi.fn();
    p.alReintentar(recargar);
    p.empezar();
    vi.advanceTimersByTime(UMBRAL_LENTO);
    p.reintentar();
    expect(recargar).toHaveBeenCalledOnce();
    expect(p.get().lento).toBe(false);
    vi.advanceTimersByTime(UMBRAL_LENTO);
    expect(p.get().lento).toBe(true);
    p.descartarLento();   // cerrar: no vuelve en esta racha
    vi.advanceTimersByTime(UMBRAL_LENTO * 2);
    expect(p.get()).toMatchObject({ n: 1, barra: true, lento: false });
  });

  it("avisa a los suscriptores en cada cambio", () => {
    const p = crearPendientes();
    const f = vi.fn();
    const quitar = p.subscribe(f);
    const fin = p.empezar();
    vi.advanceTimersByTime(UMBRAL_BARRA);
    fin();
    expect(f).toHaveBeenCalledTimes(3);   // +1, barra, fin
    quitar();
    p.empezar();
    expect(f).toHaveBeenCalledTimes(3);
  });
});
