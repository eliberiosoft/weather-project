/* Cuenta del vecino (spec 018): registro propio (nombres y apellidos, cédula, correo, contraseña y foto opcional),
   ingreso con correo o cédula, y modo invitado. Contrato: specs/018-cuentas-ciudadanas/contracts/api.md.
   - El modo elegido se guarda en el teléfono para no preguntarlo en cada apertura; la sesión de verdad es la cookie
     HttpOnly de la API, que se comprueba al abrir con GET /api/cuenta/yo.
   - La cuenta es OPCIONAL (pedido del dueño, 2026-11-10): sin cuenta se ve todo, se comparte y se reporta de forma
     anónima. Con cuenta, el reporte queda ligado a ella (nunca se publica) salvo que el vecino elija «anónimo». */
import { almacen } from "../../shared/almacen";
import { api, ErrorApi, postJSON } from "../../shared/api";
import { I18N, t } from "../../shared/i18n";
import { store, toast, type Cuenta, type MotivoIngreso, type Pestana } from "../../shared/store";
import type { Ciudadano, DatosCuenta } from "../../shared/tipos";
import { limpiar } from "./validacion";

/** ¿Inició sesión con su cuenta? */
export const conCuenta = (c: Cuenta): c is Extract<Cuenta, { modo: "ciudadano" }> => c.modo === "ciudadano";
/** Nombre para mostrar: el primer nombre y el primer apellido. */
/** Primer nombre de «Ana María Pérez Vera» → «Ana». */
export const primerNombre = (c: Ciudadano) => c.nombre.split(" ")[0] ?? "";
export const urlFotoPerfil = (v: number) => `/api/cuenta/foto?v=${v}`;

/** Lo que se guarda en el teléfono: el modo y, con cuenta, el nombre (sin cédula ni correo). */
function fijarCuenta(c: Cuenta): void {
  if (c.modo === "ninguna") almacen.quitar("cuenta");
  else almacen.set("cuenta", c.modo === "ciudadano" ? { modo: "ciudadano", ciudadano: { ...c.ciudadano, cedula: "", email: "" } } : c);
  store.set((s) => ({ cuenta: c, fotoV: s.fotoV + 1 }));
}

/** Abre la pantalla de ingreso con el formulario que corresponde. */
export function pedirCuenta(motivo: MotivoIngreso, pestana: Pestana = "ingreso", mensaje: string | null = null): void {
  store.set({ ingreso: { motivo, pestana, mensaje }, menuCuenta: false });
}

/** Cierra la pantalla de ingreso («Seguir sin cuenta» hace lo mismo: la cuenta es opcional). */
export function cerrarIngreso(): void {
  store.set({ ingreso: null });
}

/** Clave i18n del error de un envío del formulario. */
export function mensajeError(e: unknown): string {
  if (e instanceof ErrorApi && e.k && I18N.existe("app.error." + e.k)) return "app.error." + e.k;
  if (e instanceof ErrorApi) return "app.cuenta.err.general";
  return "app.cuenta.err.red";
}

const entro = (c: Ciudadano, clave: string) => {
  fijarCuenta({ modo: "ciudadano", ciudadano: c });
  store.set({ ingreso: null });
  toast(t(clave, { nombre: primerNombre(c) }));
};

const datosLimpios = (d: DatosCuenta) => ({
  nombre: limpiar(d.nombre), cedula: d.cedula.trim(), email: d.email.trim().toLowerCase(),
});

/** Crea la cuenta con el registro propio. Devuelve null si salió bien, o la clave del error. */
export async function registrar(d: DatosCuenta): Promise<string | null> {
  try {
    const r = await postJSON<{ ciudadano: Ciudadano }>("/api/cuenta/registro", { ...datosLimpios(d), clave: d.clave, foto: d.foto || undefined, consentimiento: true });
    entro(r.ciudadano, "app.cuenta.toast.creada");
    return null;
  } catch (e) {
    return mensajeError(e);
  }
}

/** Ingreso con correo o cédula y contraseña. */
export async function ingresar(usuario: string, clave: string): Promise<string | null> {
  try {
    const r = await postJSON<{ ciudadano: Ciudadano }>("/api/cuenta/ingresar", { usuario: usuario.trim().toLowerCase(), clave });
    entro(r.ciudadano, "app.cuenta.toast.hola");
    return null;
  } catch (e) {
    return mensajeError(e);
  }
}

/** Corrige el nombre o el correo (la cédula no cambia nunca). */
export async function guardarPerfil(d: DatosCuenta): Promise<string | null> {
  try {
    const cuerpo = { nombre: limpiar(d.nombre), email: d.email.trim().toLowerCase() };
    const r = await postJSON<{ ciudadano: Ciudadano }>("/api/cuenta/perfil", cuerpo);
    fijarCuenta({ modo: "ciudadano", ciudadano: r.ciudadano });
    store.set({ ingreso: null });
    toast(t("app.cuenta.toast.guardado"));
    return null;
  } catch (e) {
    return mensajeError(e);
  }
}

/** Cambia (data URL JPEG) o quita (null) la foto de perfil. */
export async function cambiarFoto(foto: string | null): Promise<boolean> {
  try {
    const r = await postJSON<{ ciudadano: Ciudadano }>("/api/cuenta/foto", { foto });
    fijarCuenta({ modo: "ciudadano", ciudadano: r.ciudadano });
    return true;
  } catch (e) {
    toast(t(mensajeError(e)), 6000);
    return false;
  }
}

/** Cerrar sesión: la API borra la sesión y la cookie; el teléfono vuelve a preguntar cómo entrar. */
export async function salir(): Promise<void> {
  try { await postJSON("/api/cuenta/salir", {}); } catch { /* sin red: la cookie vence sola */ }
  fijarCuenta({ modo: "ninguna" });
  store.set({ menuCuenta: false, ingreso: null });
  toast(t("app.cuenta.toast.salio"));
}

/** Eliminar la cuenta en el servidor (sus reportes quedan sin autor). Con error, la cuenta sigue y se avisa. */
export async function eliminarCuenta(): Promise<boolean> {
  try {
    await postJSON("/api/cuenta/eliminar", {});
  } catch (e) {
    toast(t(mensajeError(e)), 6000);
    return false;
  }
  fijarCuenta({ modo: "ninguna" });
  store.set({ menuCuenta: false, ingreso: null });
  toast(t("app.cuenta.toast.eliminada"), 6000);
  return true;
}

async function pedirYo(): Promise<void> {
  try {
    const r = await api<{ ciudadano: Ciudadano }>("/api/cuenta/yo", {}, { fondo: true });
    fijarCuenta({ modo: "ciudadano", ciudadano: r.ciudadano });
  } catch (e) {
    // la sesión venció en el servidor: se sigue sin cuenta (es opcional), sin interrumpir
    if (e instanceof ErrorApi && e.status === 401) fijarCuenta({ modo: "ninguna" });
  }
}

/** Al abrir la app no se pide nada (la cuenta es opcional); si hay una guardada, se comprueba la sesión. */
export async function iniciarCuenta(): Promise<void> {
  if (store.get().cuenta.modo === "ciudadano") void pedirYo();
}
