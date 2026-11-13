import { describe, expect, it } from "vitest";
import { ErrorApi } from "../shared/api";
import { store } from "../shared/store";
import type { Ciudadano } from "../shared/tipos";
import { conCuenta, mensajeError, primerNombre } from "../features/cuenta/cuenta";
import { armarCuerpo } from "../features/reportar/asistente";
import { ASISTENTE_VACIO } from "../shared/store";
import { cedulaOculta } from "../features/cuenta/MenuCuenta";
import { cedulaValida, errorClave, errorEmail, errorNombre, limpiar } from "../features/cuenta/validacion";
import { esTemporal } from "../features/reportar/cola";
import { esAtajoCaptura } from "../features/seguridad/proteccion";

const ana: Ciudadano = { nombre: "Ana María Pérez Vera", cedula: "0926687856", email: "ana@gmail.com", foto: false, creado: "2026-11-10T10:00:00-05:00" };
const vecino = { modo: "ciudadano", ciudadano: ana } as const;

describe("validación de la cuenta", () => {
  it("acepta cédulas ecuatorianas válidas (módulo 10)", () => {
    for (const c of ["0926687856", "1710034065", "1713175071", "0102030400"]) expect(cedulaValida(c), c).toBe(true);
  });
  it("rechaza cédulas con dígito verificador, provincia o largo malos", () => {
    for (const c of ["0926687855", "2510034065", "1760034065", "171003406", "17100340650", "abcdefghij", ""]) expect(cedulaValida(c), c).toBe(false);
  });
  it("nombres y apellidos en un solo campo: letras y al menos dos palabras", () => {
    expect(errorNombre("  Ana   María  Pérez ")).toBeNull();
    expect(errorNombre("José Núñez-O'Connor")).toBeNull();
    expect(errorNombre("Ana")).toBe("app.error.cuenta.nombre");
    expect(errorNombre("Ana2 Pérez")).toBe("app.error.cuenta.nombre");
    expect(errorNombre("Ana -")).toBe("app.error.cuenta.nombre");
    expect(limpiar("  Ana   María ")).toBe("Ana María");
  });
  it("correo y contraseña", () => {
    expect(errorEmail("ana@gmail.com")).toBeNull();
    expect(errorEmail("ana@gmail")).toBe("app.error.cuenta.email");
    expect(errorClave("12345")).toBe("app.error.cuenta.clave");
    expect(errorClave("123456")).toBeNull();
  });
});

describe("cuenta del vecino", () => {
  it("reportar y compartir exigen cuenta", () => {
    expect(conCuenta(vecino)).toBe(true);
    expect(conCuenta({ modo: "invitado" })).toBe(false);
    expect(conCuenta({ modo: "ninguna" })).toBe(false);
  });
  it("sin cuenta el reporte va anónimo; con cuenta, el vecino elige", async () => {
    const rep = { ...ASISTENTE_VACIO, tipo: "otro", descripcion: "Algo pasa aquí", ubic: { lat: -2.09, lon: -79.69, origen: "mapa" as const } };
    store.set({ cuenta: { modo: "ninguna" } });
    expect((await armarCuerpo(rep)).anonimo).toBe(true);
    store.set({ cuenta: vecino });
    expect((await armarCuerpo(rep)).anonimo).toBe(false);
    expect((await armarCuerpo({ ...rep, anonimo: true })).anonimo).toBe(true);
    expect((await armarCuerpo(rep)).gravedad).toBeUndefined();
  });
  it("traduce los errores de la API", () => {
    expect(mensajeError(new ErrorApi("x", 409, "cuenta.cedula_existe"))).toBe("app.error.cuenta.cedula_existe");
    expect(mensajeError(new ErrorApi("x", 500))).toBe("app.cuenta.err.general");
    expect(mensajeError(new TypeError("fetch"))).toBe("app.cuenta.err.red");
  });
  it("un rechazo de la API no se reintenta; sin red o con el servidor caído, sí", () => {
    expect(esTemporal(new ErrorApi("tipo", 400), true)).toBe(false);
    expect(esTemporal(new ErrorApi("caído", 503), true)).toBe(true);
  });
  it("muestra el primer nombre y la cédula a medias", () => {
    expect(primerNombre(ana)).toBe("Ana");
    expect(cedulaOculta("0926687856")).toBe("09•••••856");
  });
});

describe("protección de pantalla", () => {
  const tecla = (key: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; code: string }> = {}) =>
    ({ key, metaKey: false, ctrlKey: false, shiftKey: false, ...mods });
  it("reconoce los atajos de captura e impresión", () => {
    expect(esAtajoCaptura(tecla("PrintScreen"))).toBe(true);
    expect(esAtajoCaptura(tecla("4", { metaKey: true, shiftKey: true }))).toBe(true);
    expect(esAtajoCaptura(tecla("$", { metaKey: true, shiftKey: true, code: "Digit4" }))).toBe(true);
    expect(esAtajoCaptura(tecla("S", { metaKey: true, shiftKey: true }))).toBe(true);
    expect(esAtajoCaptura(tecla("p", { ctrlKey: true }))).toBe(true);
  });
  it("no se mete con lo que la persona escribe", () => {
    expect(esAtajoCaptura(tecla("p"))).toBe(false);
    expect(esAtajoCaptura(tecla("4", { shiftKey: true }))).toBe(false);
    expect(esAtajoCaptura(tecla("c", { ctrlKey: true }))).toBe(false);
  });
});
