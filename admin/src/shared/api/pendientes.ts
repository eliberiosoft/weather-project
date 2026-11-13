/* Peticiones pendientes a la API (spec 015): una sola cuenta para todo el panel.
   - La barra global aparece si hay algo pendiente desde hace más de 400 ms (antes no, para que no parpadee).
   - A los 8 s con algo pendiente se marca «conexión lenta»; «Reintentar» relanza las lecturas pendientes
     (las escrituras no se repiten: podrían haber llegado) y vuelve a contar los 8 s.
   - Los tiempos cuentan desde que la cuenta pasa de 0 a 1: cambiar de pestaña con algo pendiente no reinicia la barra. */
import { useSyncExternalStore } from "react";

export const DEMORA_BARRA = 400;
export const DEMORA_LENTA = 8000;

export interface EstadoCarga {
  /** Peticiones en curso. */
  pendientes: number;
  /** Se muestra la barra global (pendientes desde hace más de DEMORA_BARRA). */
  barra: boolean;
  /** Se muestra el aviso de conexión lenta (pendientes desde hace más de DEMORA_LENTA). */
  lenta: boolean;
}

export interface Pendientes {
  /** Cuenta una petición; devuelve la función que la descuenta (se puede llamar más de una vez sin efecto). */
  empezar(): () => void;
  /** Registra cómo relanzar una lectura pendiente; devuelve la función que la quita. */
  alReintentar(relanzar: () => void): () => void;
  /** Relanza las lecturas pendientes y vuelve a contar los 8 s de «conexión lenta». */
  reintentar(): void;
  leer(): EstadoCarga;
  suscribir(oyente: () => void): () => void;
}

const QUIETO: EstadoCarga = { pendientes: 0, barra: false, lenta: false };

export function crearPendientes(demoraBarra = DEMORA_BARRA, demoraLenta = DEMORA_LENTA): Pendientes {
  let estado = QUIETO;
  let relojBarra: ReturnType<typeof setTimeout> | undefined;
  let relojLenta: ReturnType<typeof setTimeout> | undefined;
  const oyentes = new Set<() => void>();
  const relanzadores = new Set<() => void>();

  function poner(cambio: Partial<EstadoCarga>) {
    const nuevo = { ...estado, ...cambio };
    if (nuevo.pendientes === estado.pendientes && nuevo.barra === estado.barra && nuevo.lenta === estado.lenta) return;
    estado = nuevo;
    oyentes.forEach((o) => o());
  }
  const contarLenta = () => {
    clearTimeout(relojLenta);
    relojLenta = setTimeout(() => poner({ lenta: true }), demoraLenta);
  };

  return {
    empezar() {
      if (estado.pendientes === 0) {
        relojBarra = setTimeout(() => poner({ barra: true }), demoraBarra);
        contarLenta();
      }
      poner({ pendientes: estado.pendientes + 1 });
      let hecho = false;
      return () => {
        if (hecho) return;
        hecho = true;
        if (estado.pendientes <= 1) {
          clearTimeout(relojBarra);
          clearTimeout(relojLenta);
          estado = QUIETO;
          oyentes.forEach((o) => o());
        } else {
          poner({ pendientes: estado.pendientes - 1 });
        }
      };
    },
    alReintentar(relanzar) {
      relanzadores.add(relanzar);
      return () => { relanzadores.delete(relanzar); };
    },
    reintentar() {
      [...relanzadores].forEach((r) => r());
      if (estado.pendientes > 0) contarLenta();
      poner({ lenta: false });
    },
    leer: () => estado,
    suscribir(oyente) {
      oyentes.add(oyente);
      return () => { oyentes.delete(oyente); };
    },
  };
}

/** La cuenta del panel: la alimenta `api()` y la leen la barra global y el aviso de conexión lenta. */
export const pendientes = crearPendientes();

export function usePendientes(): EstadoCarga {
  return useSyncExternalStore(pendientes.suscribir, pendientes.leer);
}
