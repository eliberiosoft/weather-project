import { describe, expect, it } from "vitest";
import { bytesDataUrl, escala } from "./foto";
import { cuerpoIncidente, formVacio, pasoListo, validarIncidente, type FormIncidente } from "./formulario";
import { dentroDe, distM, tramoCercano, type Calles } from "./geo";

const listo = (p: Partial<FormIncidente> = {}): FormIncidente =>
  ({ ...formVacio(), tipo: "via_cerrada", descripcion: "Árbol sobre la vía", horas: "24", lat: -2.07, lon: -79.6, ...p });

describe("validación del formulario de incidentes", () => {
  it("pide tipo, descripción y ubicación", () => {
    expect(validarIncidente(formVacio())).toBe("panel.inc.falta_tipo");
    expect(validarIncidente(listo({ descripcion: "  " }))).toBe("panel.inc.falta_descripcion");
    expect(validarIncidente(listo({ lat: null }))).toBe("panel.inc.ubicacion_falta");
    expect(validarIncidente(listo())).toBeNull();
  });
  it("horas de 1 a 168; vacías toma las del tipo", () => {
    expect(validarIncidente(listo({ horas: "0" }))).toBe("panel.inc.horas_mal");
    expect(validarIncidente(listo({ horas: "169" }))).toBe("panel.inc.horas_mal");
    expect(validarIncidente(listo({ horas: "2.5" }))).toBe("panel.inc.horas_mal");
    expect(cuerpoIncidente(listo({ horas: "" })).horas).toBe(24);
  });
  it("fuera del cantón no se envía", () => expect(validarIncidente(listo({ dentro: false }))).toBe("panel.inc.fuera"));
  it("calle inundada exige altura y la gravedad sale de ella", () => {
    const f = listo({ tipo: "calle_inundada", gravedad: 1, via: " Av. Olmedo ", tramo: [[-2.07, -79.6], [-2.071, -79.6]] });
    expect(validarIncidente(f)).toBe("panel.inc.falta_altura");
    const c = cuerpoIncidente({ ...f, altura: 3 });
    expect(c).toMatchObject({ tipo: "calle_inundada", gravedad: 3, altura_agua: 3, via: "Av. Olmedo" });
    expect(c.tramo).toHaveLength(2);
  });
  it("otros tipos no mandan altura ni tramo", () => {
    const c = cuerpoIncidente(listo({ altura: 2, via: "x", tramo: [[0, 0], [1, 1]] }));
    expect(c.altura_agua).toBeUndefined();
    expect(c.tramo).toBeUndefined();
    expect(c.via).toBeUndefined();
  });
  it("una foto demasiado pesada se rechaza", () => {
    const grande = "data:image/jpeg;base64," + "A".repeat(2_100_000);
    expect(validarIncidente(listo({ foto: grande }))).toBe("panel.inc.foto_grande");
  });
});

describe("pasos del asistente", () => {
  it("cada paso pide solo lo suyo", () => {
    const f = formVacio();
    expect(pasoListo(f, 1)).toBe(false);
    expect(pasoListo({ ...f, tipo: "via_cerrada" }, 1)).toBe(true);
    expect(pasoListo({ ...f, tipo: "via_cerrada" }, 2)).toBe(true);               // gravedad 2 por defecto
    expect(pasoListo({ ...f, tipo: "calle_inundada" }, 2)).toBe(false);           // falta cuánta agua
    expect(pasoListo({ ...f, tipo: "calle_inundada", altura: 2 }, 2)).toBe(true);
    expect(pasoListo({ ...f, lat: -2.1, lon: -79.7 }, 3)).toBe(true);
    expect(pasoListo({ ...f, lat: -2.1, lon: -79.7, dentro: false }, 3)).toBe(false);
    expect(pasoListo({ ...f, tipo: "via_cerrada", descripcion: "  " }, 4)).toBe(false);
    expect(pasoListo({ ...f, tipo: "via_cerrada", descripcion: "..." }, 4)).toBe(false);
    expect(validarIncidente(listo({ descripcion: "ok" }))).toBe("panel.inc.falta_descripcion");
    expect(pasoListo({ ...f, tipo: "via_cerrada", descripcion: "Puente cerrado", horas: "200" }, 4)).toBe(false);
    expect(pasoListo({ ...f, tipo: "via_cerrada", descripcion: "Puente cerrado" }, 4)).toBe(true);
    expect(pasoListo(listo(), 5)).toBe(true);
  });
});

describe("foto", () => {
  it("reduce al lado mayor de 1280 px sin agrandar", () => {
    expect(escala(4000, 3000)).toEqual({ ancho: 1280, alto: 960 });
    expect(escala(800, 1600)).toEqual({ ancho: 640, alto: 1280 });
    expect(escala(640, 480)).toEqual({ ancho: 640, alto: 480 });
  });
  it("cuenta los bytes reales del base64", () => {
    expect(bytesDataUrl("data:image/jpeg;base64,QUJD")).toBe(3);
    expect(bytesDataUrl("data:image/jpeg;base64,QUI=")).toBe(2);
  });
});

describe("geometría", () => {
  const cuadro = { type: "Polygon", coordinates: [[[-80, -3], [-79, -3], [-79, -2], [-80, -2], [-80, -3]], [[-79.6, -2.6], [-79.4, -2.6], [-79.4, -2.4], [-79.6, -2.4], [-79.6, -2.6]]] };
  it("punto en polígono con hueco", () => {
    expect(dentroDe(-79.8, -2.8, cuadro)).toBe(true);
    expect(dentroDe(-79.5, -2.5, cuadro)).toBe(false);
    expect(dentroDe(-78, -2.5, cuadro)).toBe(false);
    expect(dentroDe(-79.8, -2.8, { features: [{ geometry: cuadro }] })).toBe(true);
  });
  it("distancia aproximada", () => expect(Math.round(distM(-79.6, -2.07, -79.6, -2.071))).toBe(111));
  it("tramo de ±120 m sobre la calle más cercana", () => {
    const calles: Calles = { features: [{ type: "Feature", properties: { nombre: "Calle Larga" },
      geometry: { type: "LineString", coordinates: [[-79.61, -2.07], [-79.59, -2.07]] } }] };
    const tr = tramoCercano(-2.0702, -79.6, calles)!;
    expect(tr.nombre).toBe("Calle Larga");
    expect(tr.punto).toEqual([-2.07, -79.6]);
    const [a, b] = [tr.coords[0]!, tr.coords[tr.coords.length - 1]!];
    expect(Math.round(distM(a[1], a[0], b[1], b[0]))).toBe(240);
    expect(tramoCercano(-2.075, -79.6, calles)).toBeNull();      // a ~550 m: muy lejos
  });
});
