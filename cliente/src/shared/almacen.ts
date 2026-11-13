/* Estado local (solo en este teléfono): localStorage con el prefijo «ay_», siempre envuelto en try/catch
   (modo privado o almacenamiento lleno). Solo guarda preferencias y lo último descargado (constitución, principio V). */
export const PREFIJO = "ay_";

export const almacen = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(PREFIJO + k);
      return v === null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown): boolean {
    try {
      localStorage.setItem(PREFIJO + k, JSON.stringify(v));
      return true;
    } catch {
      return false;   // modo privado o sin espacio
    }
  },
  quitar(k: string): void {
    try { localStorage.removeItem(PREFIJO + k); } catch { /* modo privado */ }
  },
};

/** Identificador al azar del teléfono: siempre con el generador seguro del navegador (no Math.random),
    porque es la llave de tus reportes. Viaja en la cabecera X-Dispositivo, nunca en la URL. */
export function idDispositivo(): string {
  let d = almacen.get<string | null>("dispositivo", null);
  if (!d) {
    d = "d" + (crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, "0")).join(""));
    almacen.set("dispositivo", d);
  }
  return d;
}
