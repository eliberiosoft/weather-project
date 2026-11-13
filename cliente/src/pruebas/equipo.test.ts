/* Tipo de equipo sin el modelo (pestaña «Dispositivos»). */
import { describe, expect, it } from "vitest";
import { formatoDe, marcaDe, versionSo } from "../features/pwa/equipo";

const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

describe("tipo de equipo", () => {
  it("la marca sale del modelo (que no se envía) o del sistema", () => {
    expect(marcaDe("SM-A146M", CHROME_ANDROID)).toBe("Samsung");
    expect(marcaDe("23053RN02L", CHROME_ANDROID)).toBe("Xiaomi");
    expect(marcaDe("moto g54 5G", CHROME_ANDROID)).toBe("Motorola");
    expect(marcaDe("RMX3710", CHROME_ANDROID)).toBe("realme");
    expect(marcaDe("Pixel 8", CHROME_ANDROID)).toBe("Google");
    expect(marcaDe("ALGO-RARO", CHROME_ANDROID)).toBe("Otra");
    expect(marcaDe(null, CHROME_ANDROID)).toBeNull();
    expect(marcaDe(null, IPHONE)).toBe("Apple");
  });
  it("versión del sistema: Client Hints en Android (el User-Agent dice siempre 10), iOS del User-Agent", () => {
    expect(versionSo(CHROME_ANDROID, "14.0.0")).toBe(14);
    expect(versionSo(CHROME_ANDROID)).toBeNull();
    expect(versionSo("Mozilla/5.0 (Android 13; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0")).toBe(13);
    expect(versionSo(IPHONE)).toBe(18);
  });
  it("teléfono, tablet o computadora", () => {
    expect(formatoDe(CHROME_ANDROID, true, 5, 412)).toBe("telefono");
    expect(formatoDe(IPHONE, undefined, 5, 390)).toBe("telefono");
    expect(formatoDe("Mozilla/5.0 (Linux; Android 10; K) Chrome/130.0 Safari/537.36", false, 5, 800)).toBe("tablet");
    expect(formatoDe("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.1 Safari/605.1.15", undefined, 5, 820)).toBe("tablet");
    expect(formatoDe("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36", false, 0, 1080)).toBe("computadora");
  });
});
