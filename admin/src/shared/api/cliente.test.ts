import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ErrorApi, escucharApi, mensajeError, SIN_RED } from "./cliente";

function responder(status: number, cuerpo: unknown) {
  const f = vi.fn(async () => new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", f);
  return f;
}
afterEach(() => vi.unstubAllGlobals());

describe("cliente API", () => {
  it("manda la cabecera anti-CSRF, la cookie same-origin y el cuerpo JSON", async () => {
    const f = responder(200, { ok: true });
    await api("/api/panel/aviso", { a: 1 });
    const [ruta, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(ruta).toBe("/api/panel/aviso");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect((init.headers as Record<string, string>)["X-Requested-With"]).toBe("yaguachi");
    expect(init.body).toBe('{"a":1}');
  });

  it("un 401 avisa a la sesión y lanza ErrorApi", async () => {
    const sinSesion = vi.fn();
    const quitar = escucharApi({ sinSesion });
    responder(401, { error: "sin sesión", k: "auth.sesion" });
    await expect(api("/api/panel/estado")).rejects.toMatchObject({ status: 401, k: "auth.sesion" });
    expect(sinSesion).toHaveBeenCalledOnce();
    quitar();
  });

  it("el ingreso maneja su propio 401 (no redirige)", async () => {
    const sinSesion = vi.fn();
    const quitar = escucharApi({ sinSesion });
    responder(401, { error: "Usuario o clave incorrectos", k: "auth.credenciales" });
    await expect(api("/api/auth/login", {}, { sinRedirigir: true })).rejects.toBeInstanceOf(ErrorApi);
    expect(sinSesion).not.toHaveBeenCalled();
    quitar();
  });

  it("un 403 por clave temporal pide el cambio de clave; uno por permiso no", async () => {
    const cambiarClave = vi.fn();
    const quitar = escucharApi({ cambiarClave });
    responder(403, { k: "auth.cambiar_clave" });
    await expect(api("/api/panel/estado")).rejects.toMatchObject({ status: 403 });
    responder(403, { k: "auth.permiso" });
    await expect(api("/api/panel/usuarios")).rejects.toMatchObject({ k: "auth.permiso" });
    expect(cambiarClave).toHaveBeenCalledOnce();
    quitar();
  });

  it("sin red lanza el estado 0", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(api("/api/panel/estado")).rejects.toMatchObject({ status: SIN_RED });
  });
});

describe("mensajeError", () => {
  const t = (k: string, v?: Record<string, string | number>) => (v ? `${k}:${JSON.stringify(v)}` : `T(${k})`);
  const existe = (k: string) => k.startsWith("auth.") || k.startsWith("panel.");
  it("usa la clave k si existe", () => expect(mensajeError(new ErrorApi(401, "auth.credenciales", "x"), t, existe)).toBe("T(auth.credenciales)"));
  it("si la k no existe, el texto de la API", () => expect(mensajeError(new ErrorApi(409, "otra.cosa", "ya existe"), t, existe)).toBe("ya existe"));
  it("sin texto, uno genérico con el código", () => expect(mensajeError(new ErrorApi(500), t, existe)).toBe('panel.error.generico:{"codigo":500}'));
  it("sin red", () => expect(mensajeError(new ErrorApi(0), t, existe)).toBe("T(panel.error.red)"));
});
