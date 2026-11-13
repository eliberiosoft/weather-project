/* Validación de los datos de la cuenta (spec 018, contrato §2): la misma que hace la API, para avisar antes de enviar.
   Cada función devuelve la clave i18n del error o null si está bien. */

const LETRAS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/u;

/** Quita espacios de más: «  Ana   María » → «Ana María». */
export const limpiar = (s: string) => s.trim().replace(/\s+/g, " ");

/** Nombres y apellidos en un solo campo: de 5 a 120 letras y al menos dos palabras (nombre y apellido). */
export function errorNombre(v: string): string | null {
  const s = limpiar(v);
  // solo cuentan las palabras con letras: «Ana -» no tiene apellido
  const palabras = s.split(" ").filter((p) => /\p{L}/u.test(p)).length;
  return s.length >= 5 && s.length <= 120 && LETRAS.test(s) && palabras >= 2 ? null : "app.error.cuenta.nombre";
}

/** Cédula ecuatoriana: 10 dígitos, provincia 01–24 o 30, tercer dígito < 6 y dígito verificador (módulo 10). */
export function cedulaValida(c: string): boolean {
  if (!/^\d{10}$/.test(c)) return false;
  const prov = Number(c.slice(0, 2));
  if (!((prov >= 1 && prov <= 24) || prov === 30) || Number(c[2]) >= 6) return false;
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(c[i]) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    suma += d;
  }
  return (10 - (suma % 10)) % 10 === Number(c[9]);
}

export const errorCedula = (v: string) => (cedulaValida(v.trim()) ? null : "app.error.cuenta.cedula");

export const errorEmail = (v: string) => {
  const s = v.trim();
  return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? null : "app.error.cuenta.email";
};

/** Contraseña de 6 a 128 caracteres (pedido del dueño: la fuerza de la clave es responsabilidad de cada vecino). */
export const errorClave = (v: string) => (v.length >= 6 && v.length <= 128 ? null : "app.error.cuenta.clave");
