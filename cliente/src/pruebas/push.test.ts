import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("suscripción al push", () => {
  const api = vi.fn();
  beforeEach(() => {
    vi.resetModules();
    api.mockReset().mockResolvedValue({ habilitado: false });
    vi.stubGlobal("Notification", { permission: "granted" });
    vi.doMock("../shared/api", async (orig) => ({ ...(await orig<typeof import("../shared/api")>()), api, postJSON: vi.fn() }));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock("../shared/api"); });

  it("con el permiso dado pero sin suscripción guardada, al abrir la completa (antes no hacía nada)", async () => {
    const { resuscribir } = await import("../features/avisos/push");
    await resuscribir();
    expect(api).toHaveBeenCalledWith("/api/push/config", {}, { fondo: true });
  });

  it("sin permiso no intenta nada", async () => {
    vi.stubGlobal("Notification", { permission: "default" });
    const { resuscribir } = await import("../features/avisos/push");
    await resuscribir();
    expect(api).not.toHaveBeenCalled();
  });
});
