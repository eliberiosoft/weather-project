import { describe, expect, it } from "vitest";
import { falloDeRed, mensajeError } from "../shared/api";
import { I18N } from "../shared/i18n";

describe("errores de la API", () => {
  it("traduce las claves conocidas y cae al texto en español si no la conoce", () => {
    expect(mensajeError({ error: "Foto inválida", k: "foto.invalida" }, 400)).toBe(I18N.t("app.error.foto.invalida"));
    expect(mensajeError({ error: "Algo nuevo", k: "otra.cosa" }, 400)).toBe("Algo nuevo");
    expect(mensajeError({}, 502)).toBe("Error 502");
  });
  it("las claves de push y de fotos existen en es y en", () => {
    for (const k of ["push.token", "push.recinto", "push.idioma", "push.limite", "foto.formato", "foto.invalida", "foto.espacio", "dispositivo.invalido"]) {
      expect(I18N.existe("app.error." + k)).toBe(true);
    }
  });
  it("distingue la falta de red de un rechazo", () => {
    expect(falloDeRed(new TypeError("Failed to fetch"), true)).toBe(true);
    expect(falloDeRed(new Error("400"), false)).toBe(true);
    expect(falloDeRed(new Error("400"), true)).toBe(false);
  });
});
