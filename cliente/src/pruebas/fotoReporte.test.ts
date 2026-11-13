import { describe, expect, it } from "vitest";
import { bytesDataUrl, escala, OBJETIVO_BYTES, reducirHasta } from "../features/reportar/foto";

const de = (bytes: number) => "data:image/jpeg;base64," + "A".repeat(Math.ceil((bytes * 4) / 3));

describe("fotos del reporte", () => {
  it("reduce al lado mayor pedido sin agrandar", () => {
    expect(escala(4000, 3000, 1024)).toEqual({ ancho: 1024, alto: 768 });
    expect(escala(600, 800, 1024)).toEqual({ ancho: 600, alto: 800 });
  });
  it("se queda con la primera versión que pesa menos de 300 KB", async () => {
    const pedidos: [number, number][] = [];
    const r = await reducirHasta((lado, calidad) => { pedidos.push([lado, calidad]); return de(pedidos.length < 3 ? 500_000 : 200_000); });
    expect(bytesDataUrl(r)).toBeLessThanOrEqual(OBJETIVO_BYTES);
    expect(pedidos).toEqual([[1024, 0.6], [1024, 0.45], [800, 0.45]]);
  });
  it("si ninguna llega, devuelve la más liviana (la última)", async () => {
    let n = 0;
    const r = await reducirHasta(() => de(900_000 - 100_000 * n++));
    expect(n).toBe(4);
    expect(bytesDataUrl(r)).toBeLessThan(700_000);
  });
});
