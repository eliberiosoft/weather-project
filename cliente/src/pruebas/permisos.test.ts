import { describe, expect, it } from "vitest";
import { debeMostrar } from "../features/pwa/permisos";

describe("ventana de permisos al abrir", () => {
  it("sale la primera vez si falta la ubicación o las notificaciones", () => {
    expect(debeMostrar(false, "preguntar", "preguntar")).toBe(true);
    expect(debeMostrar(false, "concedido", "preguntar")).toBe(true);
    expect(debeMostrar(false, "preguntar", "concedido")).toBe(true);
  });
  it("no sale si ya se vio en este modo (web o instalada)", () => {
    expect(debeMostrar(true, "preguntar", "preguntar")).toBe(false);
  });
  it("no sale si todo está concedido o el teléfono no lo ofrece", () => {
    expect(debeMostrar(false, "concedido", "concedido")).toBe(false);
    expect(debeMostrar(false, "concedido", "no_disponible")).toBe(false);   // p. ej. Safari en una pestaña
  });
  it("si algo está bloqueado, sale para explicar cómo activarlo", () => {
    expect(debeMostrar(false, "negado", "concedido")).toBe(true);
  });
});
