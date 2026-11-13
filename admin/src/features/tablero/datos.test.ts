import { describe, expect, it } from "vitest";
import type { EventoMapa } from "../../shared/api/tipos";
import { contar, distancia, duracion, leerRuta, nuevos, pasaFiltro, urlRuta } from "./datos";

const ev = (id: string, estado: string, origen: "vecino" | "equipo" = "vecino") => ({ id, estado, origen } as unknown as EventoMapa);
const t = (k: string, v?: Record<string, string | number>) => k + (v ? JSON.stringify(v) : "");

describe("tablero", () => {
  const lista = [ev("a", "pendiente"), ev("b", "validado"), ev("c", "validado", "equipo"), ev("d", "pendiente")];

  it("cuenta por revisar, verificados y del equipo (el equipo no se cuenta como verificado)", () => {
    expect(contar(lista)).toEqual({ todos: 4, pendiente: 2, validado: 1, equipo: 1 });
  });
  it("filtra igual que cuenta", () => {
    expect(lista.filter((e) => pasaFiltro(e, "validado")).map((e) => e.id)).toEqual(["b"]);
    expect(lista.filter((e) => pasaFiltro(e, "equipo")).map((e) => e.id)).toEqual(["c"]);
    expect(lista.filter((e) => pasaFiltro(e, "todos"))).toHaveLength(4);
  });
  it("marca como nuevos solo los que no estaban en el refresco anterior", () => {
    expect(nuevos(null, lista).size).toBe(0);
    expect([...nuevos(new Set(["a", "b"]), lista)]).toEqual(["c", "d"]);
  });
  it("arma la ruta en lon,lat y la lee como lat,lon", () => {
    expect(urlRuta("auto", [-2.1, -79.7], [-2.2, -79.6])).toBe(
      "https://routing.openstreetmap.de/routed-car/route/v1/driving/-79.700000,-2.100000;-79.600000,-2.200000?overview=full&geometries=geojson");
    expect(urlRuta("pie", [-2.1, -79.7], [-2.2, -79.6])).toContain("/routed-foot/");
    const r = leerRuta({ code: "Ok", routes: [{ distance: 2610, duration: 236, geometry: { coordinates: [[-79.7, -2.1], [-79.6, -2.2]] } }] });
    expect(r).toEqual({ linea: [[-2.1, -79.7], [-2.2, -79.6]], metros: 2610, segundos: 236 });
    expect(leerRuta({ code: "NoRoute", routes: [] })).toBeNull();
    expect(leerRuta(null)).toBeNull();
  });
  it("escribe tiempo y distancia", () => {
    expect(duracion(20, t)).toBe("panel.mv.ruta_menos_min");
    expect(duracion(236, t)).toBe('panel.mv.ruta_min{"m":4}');
    expect(duracion(3900, t)).toBe('panel.mv.ruta_h{"h":1,"m":"05"}');
    expect(distancia(234)).toBe("230 m");
    expect(distancia(2610)).toBe("2,6 km");
  });
});
