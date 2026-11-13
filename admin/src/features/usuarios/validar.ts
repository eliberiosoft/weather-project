/* Reglas de validación de usuarios (contrato §3). La API las vuelve a comprobar. */
import { ROLES, type Rol } from "../../shared/api/tipos";

export const PATRON_USUARIO = /^[a-z0-9._-]{3,32}$/;

export function validarNombre(nombre: string): string | null {
  const n = nombre.trim().length;
  return n >= 2 && n <= 80 ? null : "panel.us.nombre_mal";
}

export function validarNuevoUsuario(usuario: string, nombre: string, rol: string): string | null {
  if (!PATRON_USUARIO.test(usuario.trim())) return "panel.us.usuario_mal";
  const n = validarNombre(nombre);
  if (n) return n;
  if (!ROLES.includes(rol as Rol)) return "panel.us.rol_mal";
  return null;
}

/** Un usuario escrito con mayúsculas o espacios se normaliza antes de validar. */
export const normalizarUsuario = (s: string) => s.trim().toLowerCase();
