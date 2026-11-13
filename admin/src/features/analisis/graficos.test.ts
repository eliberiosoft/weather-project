import { describe, expect, it } from "vitest";
import { escalon, horasTexto } from "./graficos";

const t = (k: string, v?: Record<string, string | number>) => `${k.split(".").pop()}:${v?.n}`;

describe("análisis", () => {
  it("escala secuencial: 0 sin color, el máximo en el escalón más oscuro", () => {
    expect(escalon(0, 10)).toBe(0);
    expect(escalon(1, 10)).toBe(1);
    expect(escalon(10, 10)).toBe(5);
    expect(escalon(5, 10)).toBe(3);
    expect(escalon(3, 0)).toBe(0);
  });
  it("horas de espera en palabras cortas", () => {
    expect(horasTexto(0.2, t)).toBe("u_min:12");
    expect(horasTexto(4.46, t)).toBe("u_h:4,5");
    expect(horasTexto(72, t)).toBe("u_d:3");
  });
});
