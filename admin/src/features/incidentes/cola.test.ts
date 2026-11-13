import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NuevoIncidente } from "../../shared/api/tipos";

const cuerpo = (extra: Partial<NuevoIncidente> = {}): NuevoIncidente =>
  ({ tipo: "via_cerrada", gravedad: 2, descripcion: "árbol caído", lat: -2.09, lon: -79.69, horas: 24, ...extra });

/** localStorage de mentira (jsdom no siempre lo trae) con un tope de tamaño opcional. */
function almacen(tope = Infinity) {
  const d = new Map<string, string>();
  return {
    getItem: (k: string) => d.get(k) ?? null,
    setItem: (k: string, v: string) => { if (v.length > tope) throw new Error("QuotaExceeded"); d.set(k, v); },
    removeItem: (k: string) => { d.delete(k); },
  };
}

describe("incidentes guardados sin señal", () => {
  let api: ReturnType<typeof vi.fn>;
  // tras resetModules, el ErrorApi que usa la cola es otra clase: se toma de la misma carga de módulos
  let ErrorApi: typeof import("../../shared/api/cliente").ErrorApi;
  let SIN_RED: number;
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("localStorage", almacen());
    vi.stubGlobal("navigator", { onLine: true });
    api = vi.fn();
    vi.doMock("../../shared/api/cliente", async (orig) => ({ ...(await orig<typeof import("../../shared/api/cliente")>()), api }));
    ({ ErrorApi, SIN_RED } = await import("../../shared/api/cliente"));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock("../../shared/api/cliente"); });

  it("qué hacer según el error: red, 429 y 5xx se reintentan; 401 espera la sesión; otro 4xx se suelta", async () => {
    const { destino } = await import("./cola");
    expect(destino(new ErrorApi(SIN_RED))).toBe("reintentar");
    expect(destino(new ErrorApi(429))).toBe("reintentar");
    expect(destino(new ErrorApi(503))).toBe("reintentar");
    expect(destino(new ErrorApi(401))).toBe("esperar_sesion");
    expect(destino(new ErrorApi(400, "fuera"))).toBe("soltar");
  });

  it("publica solo los de esa persona y los saca de la cola", async () => {
    const { encolar, enviarCola } = await import("./cola");
    encolar(7, cuerpo());
    encolar(9, cuerpo({ tipo: "socavon" }));
    api.mockResolvedValue({});
    const r = await enviarCola(7);
    expect(r.enviados).toBe(1);
    expect(api).toHaveBeenCalledTimes(1);
    const quedan = JSON.parse(localStorage.getItem("yw_panel_cola")!);
    expect(quedan.map((i: { usuarioId: number }) => i.usuarioId)).toEqual([9]);
  });

  it("sin red se detiene y no pierde nada; dos envíos a la vez no publican dos veces", async () => {
    const { encolar, enviarCola } = await import("./cola");
    encolar(7, cuerpo());
    encolar(7, cuerpo({ lat: -2.2 }));
    api.mockRejectedValueOnce(new ErrorApi(SIN_RED));
    expect((await enviarCola(7)).enviados).toBe(0);
    expect(JSON.parse(localStorage.getItem("yw_panel_cola")!)).toHaveLength(2);
    api.mockResolvedValue({});
    const [a, b] = await Promise.all([enviarCola(7), enviarCola(7)]);
    expect(a).toBe(b);
    expect(api).toHaveBeenCalledTimes(3);   // 1 fallido + 2 publicados
  });

  it("si no cabe con la foto, se guarda sin ella", async () => {
    vi.stubGlobal("localStorage", almacen(600));
    const { encolar } = await import("./cola");
    expect(encolar(7, cuerpo({ foto: "data:image/jpeg;base64," + "A".repeat(2000) }))).toBe("sin_foto");
    expect(JSON.parse(localStorage.getItem("yw_panel_cola")!)[0].cuerpo).not.toHaveProperty("foto");
  });
});

describe("sin acumular repetidos", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("localStorage", almacen());
    vi.stubGlobal("navigator", { onLine: false });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("el mismo incidente (misma persona, tipo y lugar) no se guarda dos veces; otro tipo u otra persona sí", async () => {
    const { encolar } = await import("./cola");
    expect(encolar(7, cuerpo())).toBe("ok");
    expect(encolar(7, cuerpo({ lat: -2.0904 }))).toBe("repetido");   // ~45 m
    expect(encolar(7, cuerpo({ tipo: "socavon" }))).toBe("ok");
    expect(encolar(8, cuerpo())).toBe("ok");
  });

  it("no deja acumular más del tope por persona", async () => {
    const { encolar, MAX_COLA } = await import("./cola");
    for (let i = 0; i < MAX_COLA; i++) expect(encolar(7, cuerpo({ lat: -2.0 - i * 0.01 }))).toBe("ok");
    expect(encolar(7, cuerpo({ lat: -1.5 }))).toBe("tope");
    expect(encolar(8, cuerpo({ lat: -1.5 }))).toBe("ok");
  });
});

describe("salir en un equipo compartido", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("localStorage", almacen());
    vi.stubGlobal("navigator", { onLine: false });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("borra solo lo que dejó esa persona", async () => {
    const { borrarMios, encolar, pendientesDe } = await import("./cola");
    encolar(7, cuerpo());
    encolar(7, cuerpo({ lat: -2.3 }));
    encolar(8, cuerpo());
    expect(pendientesDe(7)).toBe(2);
    borrarMios(7);
    expect(pendientesDe(7)).toBe(0);
    expect(pendientesDe(8)).toBe(1);
  });
});
