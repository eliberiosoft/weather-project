/* Versiones (despliegues): cuándo recargar sola y cuándo avisar. */
import { describe, expect, it } from "vitest";
import { decidir, ocupado } from "../features/pwa/version";
import { ASISTENTE_VACIO } from "../shared/store";

describe("versión nueva lista", () => {
  it("recarga sola si no se pierde nada: en segundo plano o recién abierta", () => {
    expect(decidir({ ocupado: false, oculta: true, recienAbierta: false })).toBe("recargar");
    expect(decidir({ ocupado: false, oculta: false, recienAbierta: true })).toBe("recargar");
  });
  it("avisa si la persona está usando la app o tiene algo a medias", () => {
    expect(decidir({ ocupado: false, oculta: false, recienAbierta: false })).toBe("avisar");
    expect(decidir({ ocupado: true, oculta: true, recienAbierta: true })).toBe("avisar");
  });
  it("un reporte empezado o un campo con el cursor cuentan como ocupado", () => {
    expect(ocupado({ rep: ASISTENTE_VACIO }, null)).toBe(false);
    expect(ocupado({ rep: { ...ASISTENTE_VACIO, paso: 3 } }, null)).toBe(true);
    expect(ocupado({ rep: { ...ASISTENTE_VACIO, descripcion: "árbol caído" } }, null)).toBe(true);
    expect(ocupado({ rep: { ...ASISTENTE_VACIO, paso: "ok" } }, null)).toBe(false);
    expect(ocupado({ rep: ASISTENTE_VACIO }, { tagName: "TEXTAREA" } as Element)).toBe(true);
  });
});
