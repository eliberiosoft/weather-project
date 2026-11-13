import { describe, expect, it } from "vitest";
import { casoIos, conMenuPuntos, menuDePagina, versionIos } from "../features/pwa/ios";

const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME_VIEJO = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/109.0 Mobile/15E148 Safari/604.1";
const CHROME_NUEVO = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1";
const WHATSAPP = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/23.24.73";
const FACEBOOK = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0]";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";

const caso = (ua: string, tactil = 5, instalada = false) => casoIos({ ua, tactil, instalada });

describe("instalar en iPhone", () => {
  it("Safari en iPhone: muestra los pasos para instalar", () => expect(caso(SAFARI)).toBe("instalar"));
  it("ya instalada: no muestra nada", () => expect(caso(SAFARI, 5, true)).toBe("no"));
  it("dentro de WhatsApp o Facebook: pide abrir en Safari", () => {
    expect(caso(WHATSAPP)).toBe("app_ajena");
    expect(caso(FACEBOOK)).toBe("app_ajena");
  });
  it("Chrome antes de iOS 16.4 no puede instalar; después sí", () => {
    expect(caso(CHROME_VIEJO)).toBe("abrir_en_safari");
    expect(caso(CHROME_NUEVO)).toBe("instalar");
  });
  it("el iPad moderno se presenta como Mac pero es táctil", () => {
    expect(caso(IPAD, 5)).toBe("instalar");
    expect(caso(IPAD, 0)).toBe("no");          // un Mac de verdad
  });
  it("Android no usa esta guía (tiene su propio instalador)", () => expect(caso(ANDROID)).toBe("no"));
  it("lee la versión de iOS", () => {
    expect(versionIos(SAFARI)).toBe(17.5);
    expect(versionIos(ANDROID)).toBeNull();
  });
  it("iOS 26: Safari congela «iPhone OS 18_6» pero dice Version/26: los pasos van por el menú ⋯", () => {
    const SAFARI_26 = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
    expect(conMenuPuntos(SAFARI_26)).toBe(true);
    expect(caso(SAFARI_26)).toBe("instalar");
    expect(conMenuPuntos(SAFARI)).toBe(false);          // iOS 17: Compartir a la vista
  });
  it("el botón del menú de la página: ⋯ en Safari 26, ≡ desde Safari 27, en la barra antes", () => {
    const SAFARI_27 = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1";
    const SAFARI_26 = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
    expect(menuDePagina(SAFARI_27)).toBe("lineas");
    expect(menuDePagina(SAFARI_26)).toBe("puntos");
    expect(menuDePagina(SAFARI)).toBeNull();
  });
});
