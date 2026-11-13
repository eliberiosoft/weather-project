/* «Jalar para refrescar»: instalada como app (pantalla completa) no hay el gesto del navegador, y el contenedor
   con scroll propio (main) lo bloquea también en una pestaña. Aquí va la cuenta del gesto, sin DOM:
   - solo se arma si el toque empieza con la lista arriba del todo;
   - el indicador baja la mitad de lo que baja el dedo, con un tope;
   - al soltar pasado el umbral, refresca y el indicador se queda girando al menos un momento (sin parpadeo);
   - si el dedo sube en vez de bajar, el gesto se suelta y el scroll sigue normal. */

export const UMBRAL_JALAR = 64;   // px que baja el indicador para que al soltar se refresque
export const TOPE_JALAR = 96;
/** Movimiento mínimo antes de tomar el gesto: un toque o un temblor no bloquea el scroll ni los clics. */
export const ZONA_MUERTA = 8;
export const GIRO_MINIMO = 600;

export interface EstadoJalar {
  /** cuánto bajó el indicador (px) */
  dist: number;
  refrescando: boolean;
}

export const resistencia = (dy: number) => Math.min(TOPE_JALAR, Math.max(0, dy) * 0.5);

export function crearJalar(alRefrescar: () => Promise<unknown>, alCambiar: (e: EstadoJalar) => void, giroMinimo = GIRO_MINIMO) {
  let estado: EstadoJalar = { dist: 0, refrescando: false };
  let y0: number | null = null;
  const emitir = (p: Partial<EstadoJalar>) => {
    estado = { ...estado, ...p };
    alCambiar(estado);
  };

  return {
    get: () => estado,
    /** Comienzo del toque. `arriba`: la lista está en su tope. */
    empezar(y: number, arriba: boolean) {
      y0 = arriba && !estado.refrescando ? y : null;
    },
    /** El dedo se movió. Devuelve true si el gesto es nuestro (hay que frenar el scroll del navegador). */
    mover(y: number): boolean {
      if (y0 === null) return false;
      const dy = y - y0;
      if (dy < 0) {   // sube: es scroll normal
        y0 = null;
        if (estado.dist) emitir({ dist: 0 });
        return false;
      }
      if (dy < ZONA_MUERTA) return false;
      emitir({ dist: resistencia(dy - ZONA_MUERTA) });
      return true;
    },
    /** El dedo se levantó (o el sistema canceló el toque). */
    soltar() {
      const armado = y0 !== null && estado.dist >= UMBRAL_JALAR;
      y0 = null;
      if (!armado) {
        if (estado.dist) emitir({ dist: 0 });
        return;
      }
      emitir({ dist: UMBRAL_JALAR, refrescando: true });
      const espera = new Promise((ok) => setTimeout(ok, giroMinimo));
      void Promise.allSettled([alRefrescar(), espera]).then(() => emitir({ dist: 0, refrescando: false }));
    },
  };
}
