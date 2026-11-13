/* Alcance (spec 021): la app avisa qué avisos e incidentes del equipo abrió este teléfono, para que el panel muestre
   a cuántos teléfonos llegaron. No va nada de la persona: el id del teléfono viaja en la cabecera (como siempre) y el
   servidor guarda solo una firma de una sola vía; cada teléfono cuenta una vez por aviso o incidente.
   - «app»: lo vio en la app (la tarjeta estuvo a la vista 1 s, o abrió su hoja en el mapa);
   - «push»: llegó tocando la notificación.
   Se juntan unos segundos y se mandan en un solo pedido, en segundo plano; lo ya contado no se vuelve a mandar. */
import { useEffect, type RefObject } from "react";
import { almacen } from "./almacen";
import { api } from "./api";

export type TipoVista = "aviso" | "incidente";
export type ViaVista = "app" | "push";

const ESPERA_MS = 2000;
const VISIBLE_MS = 1000;
const MAX_RECORDAR = 400;
const LOTE = 30;

const enviadas = new Set<string>(almacen.get<string[]>("vistas_enviadas", []));
const cola = new Map<string, { tipo: TipoVista; via: ViaVista; ids: Set<string> }>();
let reloj: ReturnType<typeof setTimeout> | undefined;

export const claveVista = (tipo: TipoVista, id: string | number, via: ViaVista) => `${tipo}:${via}:${id}`;

/** Anota que este teléfono abrió el aviso o incidente (una vez; se manda en el próximo lote). */
export function registrarVista(tipo: TipoVista, id: string | number, via: ViaVista = "app"): void {
  const k = claveVista(tipo, id, via);
  if (enviadas.has(k)) return;
  enviadas.add(k);
  const g = cola.get(tipo + via) ?? { tipo, via, ids: new Set<string>() };
  g.ids.add(String(id));
  cola.set(tipo + via, g);
  clearTimeout(reloj);
  reloj = setTimeout(() => void enviar(), ESPERA_MS);
}

async function enviar(): Promise<void> {
  const grupos = [...cola.values()];
  cola.clear();
  almacen.set("vistas_enviadas", [...enviadas].slice(-MAX_RECORDAR));
  for (const { tipo, via, ids } of grupos) {
    const lista = [...ids];
    for (let i = 0; i < lista.length; i += LOTE) {
      const parte = lista.slice(i, i + LOTE);
      try {
        await api("/api/vistas", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo, via, ids: tipo === "aviso" ? parte.map(Number) : parte }) });
      } catch {
        // sin señal: se intenta la próxima vez que se vea (se olvida que se mandó)
        for (const id of parte) enviadas.delete(claveVista(tipo, id, via));
      }
    }
  }
}

/** Cuenta la vista cuando el elemento estuvo a la vista (60 %) un segundo. `activo` false: no cuenta. */
export function useVista(ref: RefObject<Element | null>, tipo: TipoVista, id: string | number, activo = true): void {
  useEffect(() => {
    const el = ref.current;
    if (!activo || !el || typeof IntersectionObserver === "undefined" || enviadas.has(claveVista(tipo, id, "app"))) return;
    let h: ReturnType<typeof setTimeout> | undefined;
    const ob = new IntersectionObserver(([e]) => {
      clearTimeout(h);
      if (e?.isIntersecting) h = setTimeout(() => { registrarVista(tipo, id); ob.disconnect(); }, VISIBLE_MS);
    }, { threshold: 0.6 });
    ob.observe(el);
    return () => { clearTimeout(h); ob.disconnect(); };
  }, [ref, tipo, id, activo]);
}

/** Para las hojas del mapa: abrir la hoja ya es abrir el incidente. */
export function ContarVista({ tipo, id, si = true }: { tipo: TipoVista; id: string | number; si?: boolean }) {
  useEffect(() => { if (si) registrarVista(tipo, id); }, [tipo, id, si]);
  return null;
}
