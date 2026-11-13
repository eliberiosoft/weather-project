/* Cargas pendientes (spec 015): cuenta las peticiones de la API que siguen en camino y alimenta la barra de carga
   global y el aviso de conexión lenta.
   - La barra aparece solo si alguna petición pasa de 400 ms (las rápidas no hacen parpadear nada).
   - Si la racha de carga pasa de 8 s, aparece el aviso de «conexión lenta» con «Reintentar».
   - Varias peticiones a la vez forman una sola racha: la barra sigue mientras quede alguna pendiente.
   - «Reintentar» llama a la recarga de la vista actual que registró el arranque (alReintentar). */
import { useSyncExternalStore } from "react";

export const UMBRAL_BARRA = 400;
export const UMBRAL_LENTO = 8000;

export interface EstadoPendientes {
  /** peticiones en camino */
  n: number;
  /** la barra de carga se ve (pasaron 400 ms con alguna pendiente) */
  barra: boolean;
  /** el aviso de conexión lenta se ve (pasaron 8 s) */
  lento: boolean;
}

export function crearPendientes(umbrales = { barra: UMBRAL_BARRA, lento: UMBRAL_LENTO }) {
  let estado: EstadoPendientes = { n: 0, barra: false, lento: false };
  let hBarra: ReturnType<typeof setTimeout> | undefined;
  let hLento: ReturnType<typeof setTimeout> | undefined;
  let recargar: (() => void) | null = null;
  const subs = new Set<() => void>();

  const emitir = (p: Partial<EstadoPendientes>) => {
    estado = { ...estado, ...p };
    subs.forEach((f) => f());
  };
  const armarLento = () => {
    clearTimeout(hLento);
    hLento = setTimeout(() => emitir({ lento: true }), umbrales.lento);
  };

  /** Marca el comienzo de una petición. Devuelve la función que la da por terminada (se puede llamar varias veces). */
  function empezar(): () => void {
    if (estado.n === 0) {
      hBarra = setTimeout(() => emitir({ barra: true }), umbrales.barra);
      armarLento();
    }
    emitir({ n: estado.n + 1 });
    let hecho = false;
    return () => {
      if (hecho) return;
      hecho = true;
      const n = estado.n - 1;
      if (n > 0) return emitir({ n });
      clearTimeout(hBarra);
      clearTimeout(hLento);
      emitir({ n: 0, barra: false, lento: false });
    };
  }

  return {
    get: () => estado,
    subscribe(f: () => void) {
      subs.add(f);
      return () => { subs.delete(f); };
    },
    empezar,
    /** Cuenta una promesa como petición pendiente mientras no se resuelva. */
    seguir<T>(p: Promise<T>): Promise<T> {
      const fin = empezar();
      return p.finally(fin);
    },
    /** El arranque registra cómo se recargan los datos de la vista actual. */
    alReintentar(f: () => void) { recargar = f; },
    /** «Reintentar»: vuelve a pedir lo de la vista actual; el aviso se oculta y vuelve si a los 8 s sigue lento. */
    reintentar() {
      if (estado.n > 0) armarLento();
      emitir({ lento: false });
      recargar?.();
    },
    /** Cierra el aviso de conexión lenta hasta la próxima racha (la barra sigue). */
    descartarLento() {
      clearTimeout(hLento);
      emitir({ lento: false });
    },
  };
}

export const pendientes = crearPendientes();

/** Lee una parte del estado de las cargas (un primitivo, para no repintar con cada petición). */
export function usePendientes<S>(sel: (s: EstadoPendientes) => S): S {
  return useSyncExternalStore(pendientes.subscribe, () => sel(pendientes.get()), () => sel(pendientes.get()));
}
