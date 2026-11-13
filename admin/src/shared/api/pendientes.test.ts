import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./cliente";
import { crearPendientes, DEMORA_BARRA, DEMORA_LENTA, pendientes } from "./pendientes";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("pendientes", () => {
  it("una respuesta antes de 400 ms no muestra la barra (no parpadea)", () => {
    const p = crearPendientes();
    const oyente = vi.fn();
    p.suscribir(oyente);
    const fin = p.empezar();
    vi.advanceTimersByTime(DEMORA_BARRA - 1);
    expect(p.leer()).toEqual({ pendientes: 1, barra: false, lenta: false });
    fin();
    vi.advanceTimersByTime(DEMORA_LENTA * 2);
    expect(p.leer()).toEqual({ pendientes: 0, barra: false, lenta: false });
    // solo cambió la cuenta (1 y 0): la barra nunca se encendió
    expect(oyente).toHaveBeenCalledTimes(2);
  });

  it("pasados 400 ms aparece la barra y a los 8 s el aviso de conexión lenta", () => {
    const p = crearPendientes();
    const fin = p.empezar();
    vi.advanceTimersByTime(DEMORA_BARRA);
    expect(p.leer()).toMatchObject({ barra: true, lenta: false });
    vi.advanceTimersByTime(DEMORA_LENTA - DEMORA_BARRA - 1);
    expect(p.leer().lenta).toBe(false);
    vi.advanceTimersByTime(1);
    expect(p.leer()).toMatchObject({ barra: true, lenta: true });
    fin();
    expect(p.leer()).toEqual({ pendientes: 0, barra: false, lenta: false });
  });

  it("varias peticiones: una sola barra que sigue mientras quede alguna", () => {
    const p = crearPendientes();
    const a = p.empezar();
    vi.advanceTimersByTime(300);
    const b = p.empezar();                       // no reinicia el reloj de la barra
    vi.advanceTimersByTime(100);
    expect(p.leer()).toMatchObject({ pendientes: 2, barra: true });
    a();
    a();                                          // descontar dos veces no cuenta doble
    expect(p.leer()).toMatchObject({ pendientes: 1, barra: true });
    vi.advanceTimersByTime(DEMORA_LENTA);
    expect(p.leer().lenta).toBe(true);
    b();
    expect(p.leer()).toEqual({ pendientes: 0, barra: false, lenta: false });
  });

  it("reintentar relanza las lecturas, apaga el aviso y vuelve a contar los 8 s", () => {
    const p = crearPendientes();
    p.empezar();
    const relanzar = vi.fn();
    const quitar = p.alReintentar(relanzar);
    vi.advanceTimersByTime(DEMORA_LENTA);
    expect(p.leer().lenta).toBe(true);
    p.reintentar();
    expect(relanzar).toHaveBeenCalledOnce();
    expect(p.leer()).toMatchObject({ barra: true, lenta: false });
    vi.advanceTimersByTime(DEMORA_LENTA - 1);
    expect(p.leer().lenta).toBe(false);
    vi.advanceTimersByTime(1);
    expect(p.leer().lenta).toBe(true);
    quitar();
    p.reintentar();
    expect(relanzar).toHaveBeenCalledOnce();
  });
});

describe("api() y la cuenta de pendientes", () => {
  it("cuenta la petición mientras espera y la descuenta al responder o fallar", async () => {
    let responder!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((ok) => { responder = ok; })));
    const promesa = api("/api/panel/estado");
    expect(pendientes.leer().pendientes).toBe(1);
    responder(new Response("{}", { status: 200 }));
    await promesa;
    expect(pendientes.leer().pendientes).toBe(0);

    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(api("/api/panel/estado")).rejects.toMatchObject({ status: 0 });
    expect(pendientes.leer().pendientes).toBe(0);
  });

  it("«Reintentar» relanza una lectura pendiente, pero no una escritura", async () => {
    let terminarEscritura!: (r: Response) => void;
    const f = vi.fn((ruta: string, init: RequestInit) => new Promise<Response>((ok, mal) => {
      init.signal?.addEventListener("abort", () => mal(init.signal?.reason));
      if (ruta === "/api/panel/aviso") terminarEscritura = ok;
      else if (f.mock.calls.length === 3) ok(new Response('{"ok":true}', { status: 200 }));
    }));
    vi.stubGlobal("fetch", f);
    const lectura = api<{ ok: boolean }>("/api/panel/ajustes");
    const escritura = api("/api/panel/aviso", { a: 1 });
    expect(f).toHaveBeenCalledTimes(2);
    pendientes.reintentar();
    await expect(lectura).resolves.toEqual({ ok: true });
    // la lectura se pidió dos veces; la escritura, una sola
    expect(f.mock.calls.map((c) => c[0])).toEqual(["/api/panel/ajustes", "/api/panel/aviso", "/api/panel/ajustes"]);
    expect(pendientes.leer().pendientes).toBe(1);
    terminarEscritura(new Response("{}", { status: 200 }));
    await escritura;
    expect(pendientes.leer().pendientes).toBe(0);
  });

  it("si quien pidió cancela, no se relanza", async () => {
    vi.stubGlobal("fetch", vi.fn((_r: string, init: RequestInit) => new Promise<Response>((_ok, mal) => {
      init.signal?.addEventListener("abort", () => mal(new DOMException("cortado", "AbortError")));
    })));
    const corte = new AbortController();
    const p = api("/api/panel/usuarios", undefined, { signal: corte.signal });
    corte.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(pendientes.leer().pendientes).toBe(0);
  });
});
