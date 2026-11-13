import { describe, expect, it } from "vitest";
import { ErrorApi } from "../shared/api";
import type { CuerpoReporte } from "../shared/tipos";
import { encolar, MAX_COLA, procesarCola, quitarProcesados, type EnCola } from "../features/reportar/cola";

const rep = (extra: Partial<CuerpoReporte> = {}): CuerpoReporte =>
  ({ dispositivo: "d1", tipo: "calle_inundada", gravedad: 2, lat: -2.1, lon: -79.6, consentimiento: true, ...extra });

describe("cola sin conexión", () => {
  it("guarda el reporte con foto si cabe", () => {
    let guardado: CuerpoReporte[] = [];
    const r = encolar(rep({ foto: "data:x" }), { leer: () => [], guardar: (c) => { guardado = c; return true; } });
    expect(r).toBe("ok");
    expect(guardado[0]?.foto).toBe("data:x");
  });
  it("si no cabe con la foto, lo guarda sin ella", () => {
    let guardado: CuerpoReporte[] = [];
    const r = encolar(rep({ foto: "data:x" }), { leer: () => [], guardar: (c) => { if (c[0]?.foto) return false; guardado = c; return true; } });
    expect(r).toBe("sin_foto");
    expect(guardado[0]).not.toHaveProperty("foto");
  });
  it("si no cabe con las 3 fotos, lo guarda sin ninguna", () => {
    let guardado: CuerpoReporte[] = [];
    const r = encolar(rep({ fotos: ["data:a", "data:b", "data:c"] }), { leer: () => [], guardar: (c) => { if (c[0]?.fotos) return false; guardado = c; return true; } });
    expect(r).toBe("sin_foto");
    expect(guardado[0]).not.toHaveProperty("fotos");
  });
  it("sin espacio ni sin foto, no lo guarda", () => {
    expect(encolar(rep(), { leer: () => [], guardar: () => false })).toBe("");
  });
  it("reintenta lo que falla por red, 429 o 5xx y suelta los rechazos definitivos", async () => {
    const cola = [rep({ tipo: "a" }), rep({ tipo: "b" }), rep({ tipo: "c" }), rep({ tipo: "d" }), rep({ tipo: "e" })];
    const r = await procesarCola(cola, async (c) => {
      if (c.tipo === "a") return { ok: true };
      if (c.tipo === "b") throw new TypeError("Failed to fetch");
      if (c.tipo === "c") throw new ErrorApi("límite", 429);
      if (c.tipo === "d") throw new ErrorApi("caído", 503);
      throw new ErrorApi("fuera del cantón", 400);
    }, true);
    expect(r.enviados).toBe(1);
    expect(r.quedan.map((c) => c.tipo)).toEqual(["b", "c", "d"]);
    expect(r.rechazos).toEqual(["fuera del cantón"]);
  });
  it("sin red todo queda en la cola", async () => {
    const r = await procesarCola([rep()], async () => { throw new ErrorApi("x", 400); }, false);
    expect(r.quedan).toHaveLength(1);
  });
  it("cada reporte guardado lleva un id local distinto", () => {
    let guardado: EnCola[] = [];
    const d = { leer: () => guardado, guardar: (c: EnCola[]) => { guardado = c; return true; } };
    encolar(rep(), d);
    encolar(rep({ lat: -2.2 }), d);
    expect(guardado.map((c) => c._id)).toHaveLength(2);
    expect(guardado[0]?._id).not.toBe(guardado[1]?._id);
  });
  it("al limpiar, no se pierde un reporte guardado mientras se enviaban los otros", () => {
    const a = { ...rep(), _id: "a" }, b = { ...rep(), _id: "b" }, nuevo = { ...rep(), _id: "n" };
    // se procesaron a (enviado) y b (sin red: queda); mientras tanto llegó «nuevo»
    expect(quitarProcesados([a, b, nuevo], [a, b], [b]).map((c) => c._id)).toEqual(["b", "n"]);
  });
  it("no guarda dos veces el mismo reporte (mismo tipo a menos de 150 m)", () => {
    let guardado: EnCola[] = [];
    const d = { leer: () => guardado, guardar: (c: EnCola[]) => { guardado = c; return true; } };
    expect(encolar(rep(), d)).toBe("ok");
    expect(encolar(rep({ lat: -2.1005 }), d)).toBe("repetido");          // ~55 m: el mismo
    expect(encolar(rep({ tipo: "via_cerrada" }), d)).toBe("ok");        // otro tipo, sí
    expect(encolar(rep({ lat: -2.11 }), d)).toBe("ok");                 // ~1,1 km: otro lugar, sí
    expect(guardado).toHaveLength(3);
  });
  it("no deja acumular más que el tope de la API", () => {
    let guardado: EnCola[] = [];
    const d = { leer: () => guardado, guardar: (c: EnCola[]) => { guardado = c; return true; } };
    for (let i = 0; i < MAX_COLA; i++) expect(encolar(rep({ lat: -2.1 - i * 0.01 }), d)).toBe("ok");
    expect(encolar(rep({ lat: -2.5 }), d)).toBe("tope");
    expect(guardado).toHaveLength(MAX_COLA);
  });
});
