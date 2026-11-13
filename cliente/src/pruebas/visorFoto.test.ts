// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { cerrarFoto, verFoto } from "../shared/componentes/VisorFoto";
import { store } from "../shared/store";
import type { Reporte } from "../shared/tipos";

const rep = { id: "r1", tipo: "via_cerrada", foto: true } as unknown as Reporte;
/** history.back() avisa con «popstate» de forma asíncrona */
const trasAtras = () => new Promise<void>((ok) => window.addEventListener("popstate", () => setTimeout(ok, 0), { once: true }));

describe("visor de fotos y el botón Atrás", () => {
  it("Atrás cierra la foto (no sale de la app) y deja el historial como estaba", async () => {
    const antes = history.length;
    verFoto(rep);
    expect(store.get().fotoAbierta).toEqual({ titulo: expect.any(String), urls: ["/api/foto/r1"], i: 0 });
    expect(history.length).toBe(antes + 1);
    const p = trasAtras();
    history.back();          // el botón Atrás del teléfono
    await p;
    expect(store.get().fotoAbierta).toBeNull();
  });

  it("cerrar con el botón deshace el paso del historial", async () => {
    verFoto(rep);
    const p = trasAtras();
    cerrarFoto();
    await p;
    expect(store.get().fotoAbierta).toBeNull();
    expect(history.state).toBeNull();
  });

  it("abrir otra foto sin cerrar no apila más pasos", async () => {
    verFoto(rep);
    const conUna = history.length;
    verFoto({ ...rep, id: "r2" } as Reporte);
    expect(history.length).toBe(conUna);
    expect(store.get().fotoAbierta?.urls).toEqual(["/api/foto/r2"]);
    const p = trasAtras();
    cerrarFoto();
    await p;
    expect(store.get().fotoAbierta).toBeNull();
  });
});

describe("varias fotos", () => {
  it("un reporte con 3 fotos abre las tres, empezando por la pedida", async () => {
    verFoto({ ...rep, id: "r3", n_fotos: 3 } as Reporte, 2);
    expect(store.get().fotoAbierta?.urls).toEqual(["/api/foto/r3", "/api/foto/r3/2", "/api/foto/r3/3"]);
    expect(store.get().fotoAbierta?.i).toBe(2);
    const p = trasAtras();
    cerrarFoto();
    await p;
    expect(store.get().fotoAbierta).toBeNull();
  });
});
