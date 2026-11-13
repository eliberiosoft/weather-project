import { describe, expect, it } from "vitest";
import { hashMapa, hashRecinto, leerRuta } from "../shared/ruta";

describe("leerRuta (navegación por hash)", () => {
  it("sin hash es «Mi lugar»", () => {
    expect(leerRuta("")).toEqual({ vista: "inicio", muroId: null, mapa: null, aviso: null });
  });
  it("reconoce las vistas y descarta las desconocidas", () => {
    expect(leerRuta("#avisos").vista).toBe("avisos");
    expect(leerRuta("#privacidad").vista).toBe("privacidad");
    expect(leerRuta("#panel").vista).toBeNull();
  });
  it("#muro/<id> de 12 hex es un enlace compartido (/r/<id>)", () => {
    expect(leerRuta("#muro/17c9ca3fb978")).toMatchObject({ vista: "muro", muroId: "17c9ca3fb978" });
    expect(leerRuta("#muro/no-es-id").muroId).toBeNull();
  });
  it("#mapa/z/lat/lon y #mapa/recinto/<id>", () => {
    expect(leerRuta("#mapa/15/-2.0921/-79.6013").mapa).toEqual({ z: 15, lat: -2.0921, lon: -79.6013 });
    expect(leerRuta("#mapa/recinto/19").mapa).toEqual({ recinto: "19" });
    expect(leerRuta("#mapa").mapa).toEqual({});
    expect(leerRuta("#mapa/x/1/2").mapa).toEqual({});
  });
  it("arma el hash del mapa con 4 decimales", () => {
    expect(hashMapa(14, -2.123456, -79.654321)).toBe("#mapa/14/-2.1235/-79.6543");
    expect(hashRecinto(7)).toBe("#mapa/recinto/7");
  });
  it("#avisos/<id> (enlace compartido) y #avisos/<id>/push (se tocó la notificación)", () => {
    expect(leerRuta("#avisos/12").aviso).toEqual({ id: 12, push: false });
    expect(leerRuta("#avisos/12/push").aviso).toEqual({ id: 12, push: true });
    expect(leerRuta("#avisos").aviso).toBeNull();
    expect(leerRuta("#avisos/x1").aviso).toBeNull();
  });
});
