/* Arranque: territorio, estado, lugar guardado, avisos, cola sin conexión, enlace del hash y refresco cada 5 minutos.
   Si la primera carga falla sin nada guardado, «Reintentar» la repite (spec 015). */
import { almacen } from "../shared/almacen";
import { api } from "../shared/api";
import { cargarAlbergues, cargarEstado, cargarLugar, refrescarReportes } from "../shared/datos";
import { I18N, t } from "../shared/i18n";
import { escucharHash, irA } from "../shared/navegacion";
import { leerRuta } from "../shared/ruta";
import { store, toast } from "../shared/store";
import type { Lugar, Territorio } from "../shared/tipos";
import { cargarAvisos } from "../features/avisos/cargaAvisos";
import { resuscribir } from "../features/avisos/push";
import { enviarCola, sincronizarCola } from "../features/reportar/cola";
import { buscarVersionNueva, escucharInstalacion, guardarPrefsSW, registrarSW } from "../features/pwa/pwa";
import { comprobarVersion, iniciarVersiones } from "../features/pwa/version";
import { iniciarActividad } from "../features/pwa/actividad";
import { ofrecerPermisos } from "../features/pwa/permisos";
import { iniciarCuenta } from "../features/cuenta/cuenta";
import { protegerPantalla } from "../features/seguridad/proteccion";
import { pendientes } from "../shared/pendientes";
import { cerrarSplash } from "./splash";

const CINCO_MIN = 5 * 60 * 1000;

export async function iniciar(): Promise<void> {
  I18N.aplicar();   // idioma del documento, título y descripción
  protegerPantalla();   // tapa la app al salir de primer plano o ante un atajo de captura (spec 018)
  void iniciarCuenta();   // la cuenta es opcional: si hay una guardada, se comprueba la sesión
  escucharHash();
  escucharInstalacion();
  registrarSW();
  iniciarVersiones();
  iniciarActividad();
  window.addEventListener("online", () => {
    store.set({ enLinea: true });
    if (store.get().arranque === "error") void recargarVista();
    else void cargarEstado();
  });
  window.addEventListener("offline", () => store.set({ enLinea: false }));
  window.addEventListener("idioma", () => { guardarPrefsSW(); void resuscribir(); });
  pendientes.alReintentar(recargarVista);
  sincronizarCola();   // reportes guardados sin señal: se mandan solos (al volver la red, al volver a la app y cada 30 s)

  const ruta = leerRuta(location.hash);
  // el aviso de una vez se muestra aunque falle la primera carga del territorio
  if (!almacen.get("aviso_cookies", false) && ruta.vista !== "privacidad") store.set({ avisoCookies: true });

  // la vista del enlace se ve desde ya, con sus placeholders; sus cargas se piden al tener el territorio (aplicarRuta)
  if (ruta.vista && ruta.vista !== "inicio") store.set({ vista: ruta.vista, mapaVisitado: ruta.vista === "mapa", tormentasVisitado: ruta.vista === "tormentas" });
  if (await cargarInicio()) aplicarRuta();
  // al abrir: ventana para activar ubicación y notificaciones (con un toque, que es lo que los teléfonos exigen),
  // después de la pantalla de ingreso si está abierta
  despuesDelIngreso(() => void ofrecerPermisos());

  // al cambiar de lugar se renueva la suscripción push (el recinto decide qué avisos llegan)
  let lugarPrevio = store.get().lugar;
  store.subscribe(() => {
    const l = store.get().lugar;
    if (l !== lugarPrevio) { lugarPrevio = l; void resuscribir(); }
  });
  guardarPrefsSW();
  setTimeout(() => { if (store.get().arranque === "ok") void resuscribir(); }, 4000);

  setInterval(async () => {
    if (store.get().arranque !== "ok") return void recargarVista();
    await cargarEstado();
    const { lugar: l, mapaVisitado } = store.get();
    if (l) void cargarLugar(l);
    void cargarAvisos(store.get().vista === "avisos");
    void cargarAlbergues();
    if (mapaVisitado) void refrescarReportes();
  }, CINCO_MIN);
}

/** Corre `f` cuando no está abierta la pantalla de ingreso (enseguida, o al cerrarse). */
function despuesDelIngreso(f: () => void): void {
  if (!store.get().ingreso) return f();
  const quitar = store.subscribe(() => {
    if (store.get().ingreso) return;
    quitar();
    f();
  });
}

/** El enlace con el que se abrió la app (#avisos, #muro/<id>…), una vez que hay territorio. */
function aplicarRuta(): void {
  const ruta = leerRuta(location.hash);
  if (ruta.muroId) store.set({ destacado: ruta.muroId, filtroMuro: "todos" });   // enlace compartido
  if (ruta.aviso) store.set({ avisoDestacado: ruta.aviso });                     // aviso compartido o notificación
  // (si mientras tanto la persona se fue a otra vista, se respeta)
  if (ruta.vista && ruta.vista !== "inicio" && ruta.vista === store.get().vista) irA(ruta.vista);
}

/** Territorio, estado, lugar guardado, avisos y cola. Devuelve false si no hubo territorio (ni de la red ni guardado):
    las vistas muestran el error con «Reintentar», que vuelve a llamar aquí. El splash se cierra con los primeros datos.
    Con «Reintentar» puede haber dos intentos a la vez: el que falla no pisa al que ya trajo el territorio. */
async function cargarInicio(): Promise<boolean> {
  if (store.get().arranque === "error") store.set({ arranque: "cargando" });
  let terr: Territorio | null;
  try {
    terr = await api<Territorio>("/api/territorio");
    almacen.set("territorio", terr);
  } catch {
    terr = almacen.get<Territorio | null>("territorio", null);
  }
  if (!terr) {
    if (store.get().terr) return true;
    store.set({ arranque: "error" });
    toast(t("app.toast.sin_servidor"));
    cerrarSplash();
    return false;
  }
  store.set({ terr });

  const viejo = almacen.get<number | null>("recinto", null);   // versión anterior: guardaba solo el id
  if (!store.get().lugar && viejo) {
    const l: Lugar = { tipo: "recinto", id: viejo };
    almacen.set("lugar", l);
    store.set({ lugar: l });
  }
  await cargarEstado();
  store.set({ arranque: "ok" });
  const { lugar } = store.get();
  // el splash espera también al lugar guardado (o a su copia), con el tope de 4 s de splash.ts
  void (lugar ? cargarLugar(lugar) : Promise.resolve()).finally(cerrarSplash);
  void cargarAvisos(store.get().vista === "avisos");
  void cargarAlbergues();   // «Mi lugar» los muestra por cercanía (y el mapa los dibuja)
  return true;
}

/** «Reintentar» (aviso de conexión lenta y estados de error): vuelve a pedir lo que muestra la vista actual. */
async function recargarVista(): Promise<void> {
  const s = store.get();
  if (s.arranque !== "ok") {
    if (await cargarInicio()) aplicarRuta();
    return;
  }
  void cargarEstado();
  if (s.vista === "inicio" && s.lugar) void cargarLugar(s.lugar);
  if (s.vista === "avisos") void cargarAvisos(true);
  if (s.vista === "muro" || s.vista === "mapa") void refrescarReportes();
}

/** «Jalar para refrescar»: vuelve a pedir todo lo que se ve (estado, lugar, avisos y reportes) y, de paso,
    busca una versión nueva de la app. Termina cuando llegó todo (o falló: queda lo guardado). */
export async function refrescarTodo(): Promise<void> {
  buscarVersionNueva();
  void comprobarVersion(true);
  if (store.get().arranque !== "ok") {
    if (await cargarInicio()) aplicarRuta();
    return;
  }
  const { lugar, vista, mapaVisitado } = store.get();
  await Promise.all([
    enviarCola(),
    cargarEstado(),
    lugar ? cargarLugar(lugar) : null,
    cargarAvisos(vista === "avisos"),
    cargarAlbergues(),
    vista === "muro" || mapaVisitado ? refrescarReportes() : null,
  ]);
  if (store.get().sinRed) toast(t("app.toast.sin_servidor"));
}
