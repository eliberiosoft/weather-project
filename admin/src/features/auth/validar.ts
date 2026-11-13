/* Validaciones del ingreso y del cambio de clave (devuelven la clave i18n del error o null). */

export const CLAVE_MINIMA = 12;

export function validarIngreso(usuario: string, clave: string, captcha: string | null): string | null {
  if (!usuario.trim() || !clave) return "panel.login.faltan";
  if (!captcha) return "panel.login.captcha_falta";
  return null;
}

export function validarCambioClave(actual: string, nueva: string, repetir: string): string | null {
  if (!actual) return "panel.clave.falta_actual";
  if ([...nueva].length < CLAVE_MINIMA) return "panel.clave.corta";
  if (nueva === actual) return "panel.clave.igual";
  if (nueva !== repetir) return "panel.clave.no_coinciden";
  return null;
}
