import { describe, expect, it } from "vitest";
import { leerWhatsApp } from "../features/reglas/whatsapp";
import { validarCambioClave, validarIngreso } from "../features/auth/validar";
import { normalizarUsuario, validarNuevoUsuario } from "../features/usuarios/validar";
import { trocear } from "./i18n/rico";
import { aLocal, deLocal } from "./formato";

describe("mensaje de WhatsApp del vigía", () => {
  it("lee todos los campos", () => {
    expect(leerWhatsApp("p05 | 21-oct 06:00 | 3,45 m | subiendo | lluvia sí", new Date(2026, 0, 1)))
      .toEqual({ punto: "P05", hora: "2026-10-21T06:00", lectura: "3,45", tendencia: "sube", lluvia: true });
  });
  it("campos opcionales y tendencia desconocida", () => {
    expect(leerWhatsApp("P01 | ayer | 2.1")).toMatchObject({ punto: "P01", hora: null, lectura: "2.1", tendencia: "", lluvia: false });
  });
  it("rechaza un formato incompleto", () => expect(leerWhatsApp("P05 3,45")).toBeNull());
});

describe("validaciones de ingreso y clave", () => {
  it("ingreso", () => {
    expect(validarIngreso("", "x", "tk")).toBe("panel.login.faltan");
    expect(validarIngreso("ana", "clave", null)).toBe("panel.login.captcha_falta");
    expect(validarIngreso("ana", "clave", "tk")).toBeNull();
  });
  it("cambio de clave", () => {
    expect(validarCambioClave("", "unaclavelarga!", "unaclavelarga!")).toBe("panel.clave.falta_actual");
    expect(validarCambioClave("vieja", "corta", "corta")).toBe("panel.clave.corta");
    expect(validarCambioClave("igualigualigual", "igualigualigual", "igualigualigual")).toBe("panel.clave.igual");
    expect(validarCambioClave("vieja", "unaclavelarga!", "otra")).toBe("panel.clave.no_coinciden");
    expect(validarCambioClave("vieja", "unaclavelarga!", "unaclavelarga!")).toBeNull();
  });
  it("usuarios", () => {
    expect(validarNuevoUsuario("ml", "María", "analista")).toBe("panel.us.usuario_mal");
    expect(validarNuevoUsuario("María", "María", "analista")).toBe("panel.us.usuario_mal");
    expect(validarNuevoUsuario(normalizarUsuario(" MLopez "), "María López", "analista")).toBeNull();
    expect(validarNuevoUsuario("mlopez", "M", "analista")).toBe("panel.us.nombre_mal");
    expect(validarNuevoUsuario("mlopez", "María", "jefe")).toBe("panel.us.rol_mal");
  });
});

describe("formato", () => {
  it("textos ricos solo con <b> y <code>", () => {
    expect(trocear("El <b>estimado</b> y <code>P05</code> <i>x</i>")).toEqual([
      { tipo: "texto", texto: "El " }, { tipo: "b", texto: "estimado" }, { tipo: "texto", texto: " y " },
      { tipo: "code", texto: "P05" }, { tipo: "texto", texto: " <i>x</i>" }]);
  });
  it("fechas locales de ida y vuelta", () => {
    expect(aLocal(null)).toBe("");
    expect(deLocal("")).toBeNull();
    const iso = deLocal("2026-11-09T14:05")!;
    expect(aLocal(iso)).toBe("2026-11-09T14:05");
  });
});
