import { describe, expect, it } from "vitest";
import { describir, rutaDispositivos, versionCorta } from "./Dispositivos";

describe("pestaña Dispositivos", () => {
  it("la página y los filtros van a la API", () => {
    expect(rutaDispositivos("30d", 1, false, "")).toBe("/api/panel/dispositivos?periodo=30d&pagina=1&n=25");
    expect(rutaDispositivos("hoy", 3, true, " 7f3a ")).toBe("/api/panel/dispositivos?periodo=hoy&pagina=3&n=25&push=1&codigo=7F3A");
    expect(rutaDispositivos("todos", 1, false, "<x>")).toBe("/api/panel/dispositivos?periodo=todos&pagina=1&n=25");
  });
  it("la versión es la fecha del build", () => {
    expect(versionCorta("20261112-1552-24912ed3")).toBe("12/11 15:52");
    expect(versionCorta(null)).toBe("—");
  });
  it("marca y sistema arriba, navegador abajo; sin datos, vacío", () => {
    expect(describir({ plataforma: "Android · Chrome", marca: "Samsung", so_version: 14 })).toEqual({ titulo: "Samsung · Android 14", navegador: "Chrome" });
    expect(describir({ plataforma: "iPhone · Safari", marca: "Apple", so_version: 18 })).toEqual({ titulo: "Apple · iOS 18", navegador: "Safari" });
    expect(describir({ plataforma: "Android · Chrome", marca: "Otra", so_version: null }).titulo).toBe("Android");
    expect(describir({ plataforma: null, marca: null, so_version: null })).toEqual({ titulo: "", navegador: null });
  });
});
