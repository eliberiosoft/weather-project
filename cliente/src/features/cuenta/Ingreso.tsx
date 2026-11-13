/* Pantalla de ingreso (spec 018): iniciar sesión (correo o cédula y contraseña), crear la cuenta (nombres y
   apellidos en un solo campo, cédula, correo, contraseña y foto opcional) o editar los datos. La cuenta es opcional:
   la pantalla solo se abre desde «Mi cuenta» o desde «Reportar», y siempre se puede seguir sin cuenta. Los mensajes
   van dentro: el aviso flotante de la app queda debajo del modal. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Html } from "../../shared/componentes/Html";
import { Icono } from "../../shared/componentes/Icono";
import { K } from "../../shared/estilo";
import { useI18n } from "../../shared/i18n";
import { store, useApp, type Pestana } from "../../shared/store";
import type { Ciudadano, DatosCuenta } from "../../shared/tipos";
import { pedirLlamada911 } from "../../app/Llamar911";
import { cerrarIngreso, conCuenta, guardarPerfil, ingresar, registrar } from "./cuenta";
import { Campo, CampoClave, ElegirFoto } from "./Formularios";
import { errorCedula, errorClave, errorEmail, errorNombre } from "./validacion";

const VACIO: DatosCuenta = { nombre: "", cedula: "", email: "", clave: "", foto: null };
type Errores = Partial<Record<keyof DatosCuenta | "usuario" | "acepto", string | null>>;

export function Ingreso() {
  const { t } = useI18n();
  const ingreso = useApp((s) => s.ingreso);
  const cuenta = useApp((s) => s.cuenta);
  const dlg = useRef<HTMLDialogElement>(null);
  const [pestana, setPestana] = useState<Pestana>("ingreso");
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (ingreso && !d.open) {
      setPestana(ingreso.pestana);
      setMensaje(ingreso.mensaje ?? null);
      d.showModal();
    }
    if (!ingreso && d.open) d.close();
  }, [ingreso]);

  const motivo = ingreso?.motivo ?? "inicio";
  const cambiar = (p: Pestana) => { setPestana(p); setMensaje(null); };
  const perfil = pestana === "perfil" && conCuenta(cuenta);

  return (
    <dialog ref={dlg} aria-labelledby="ing-titulo" onCancel={(e) => { e.preventDefault(); cerrarIngreso(); }}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto bg-linear-to-b from-cielo-1 via-cielo-2 to-cielo-3 p-0 text-texto backdrop:bg-cielo-2">
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-3 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <div className="flex items-center gap-2">
          <img src="icono.svg" alt="" width="36" height="36" className="size-9 rounded-xl shadow-ficha" />
          <span className="min-w-0 truncate text-lg font-bold tracking-tight">{t("app.marca")}</span>
          <button type="button" onClick={cerrarIngreso} aria-label={t("app.cerrar")} title={t("app.cerrar")}
            className="ml-auto grid size-10 place-items-center rounded-full bg-vidrio text-tinta shadow-ficha ring-1 ring-white/70 active:scale-95">
            <Icono id="i-x" className="size-5" />
          </button>
        </div>

        <section className={K.ficha}>
          <h1 id="ing-titulo" className={K.h1}>{t("app.cuenta.titulo." + motivo)}</h1>
          <p className="mt-2 text-sm text-gris text-pretty">{t("app.cuenta.texto." + motivo)}</p>

          {!perfil && (
            <div role="radiogroup" aria-label={t("app.cuenta.modo.etq")} className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-suelo p-1">
              {(["ingreso", "registro"] as const).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={pestana === p} className={K.segmento} onClick={() => cambiar(p)}>
                  {t("app.cuenta.modo." + p)}
                </button>
              ))}
            </div>
          )}

          {mensaje && <p role="alert" className="mt-4 rounded-2xl bg-negro p-3.5 text-sm font-semibold text-white text-pretty">{t(mensaje)}</p>}

          {perfil ? <FormPerfil key={"p" + (ingreso?.motivo ?? "")} ciudadano={cuenta.ciudadano} alError={setMensaje} />
            : pestana === "registro" ? <FormRegistro alError={setMensaje} />
            : <FormIngreso alError={setMensaje} />}
        </section>

        {!perfil && (
          <section className={K.ficha}>
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-tinta-suave text-tinta"><Icono id="i-usuario" className="size-5.5" /></span>
              <div className="min-w-0">
                <h2 className="text-lg leading-tight font-bold">{t("app.cuenta.invitado.titulo")}</h2>
                <p className="mt-1 text-sm text-gris text-pretty">{t("app.cuenta.invitado.texto")}</p>
              </div>
            </div>
            <button type="button" onClick={cerrarIngreso} className={`mt-4 ${K.btnSec}`}>{t("app.cuenta.invitado.btn")}</button>
          </section>
        )}

        <button type="button" onClick={pedirLlamada911} aria-haspopup="dialog"
          className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 self-center rounded-full bg-negro px-5 text-sm font-bold text-white active:scale-95">
          <Icono id="i-tel" className="size-4.5" />{t("app.cuenta.911")}
        </button>
      </div>
    </dialog>
  );
}

function Enviar({ ocupado, texto }: { ocupado: boolean; texto: string }) {
  return (
    <button type="submit" disabled={ocupado} aria-busy={ocupado} className={`${K.btn} disabled:opacity-70`}>
      {ocupado && <span aria-hidden="true" className="inline-block size-5 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin" />}
      {texto}
    </button>
  );
}

function FormIngreso({ alError }: { alError: (k: string | null) => void }) {
  const { t } = useI18n();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [err, setErr] = useState<Errores>({});
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    const u = usuario.trim();
    const e2: Errores = {
      usuario: u.includes("@") ? errorEmail(u) : u ? errorCedula(u) : "app.cuenta.err.usuario",
      clave: clave ? null : "app.cuenta.err.clave_vacia",
    };
    setErr(e2);
    if (e2.usuario || e2.clave) return;
    setOcupado(true);
    alError(null);
    const r = await ingresar(u, clave);
    setOcupado(false);
    if (r) alError(r);
  }
  return (
    <>
      <form onSubmit={(e) => void enviar(e)} noValidate className="mt-4 grid gap-3">
        <Campo etiqueta={t("app.cuenta.campo.usuario")} value={usuario} onChange={(e) => { setUsuario(e.target.value); setErr((x) => ({ ...x, usuario: null })); }} error={err.usuario}
          autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} />
        <CampoClave etiqueta={t("app.cuenta.campo.clave")} value={clave} onChange={(e) => { setClave(e.target.value); setErr((x) => ({ ...x, clave: null })); }} error={err.clave} autoComplete="current-password" />
        <Enviar ocupado={ocupado} texto={t("app.cuenta.entrar")} />
      </form>
    </>
  );
}

function FormRegistro({ alError }: { alError: (k: string | null) => void }) {
  const { t } = useI18n();
  const [d, setD] = useState<DatosCuenta>(VACIO);
  const [acepto, setAcepto] = useState(false);
  const [err, setErr] = useState<Errores>({});
  const [ocupado, setOcupado] = useState(false);
  // al escribir en un campo se borra su error (los demás quedan hasta el próximo envío)
  const poner = (k: keyof DatosCuenta) => (e: { target: { value: string } }) => { setD((x) => ({ ...x, [k]: e.target.value })); setErr((x) => ({ ...x, [k]: null })); };
  async function enviar(e: FormEvent) {
    e.preventDefault();
    const e2: Errores = {
      nombre: errorNombre(d.nombre), cedula: errorCedula(d.cedula),
      email: errorEmail(d.email), clave: errorClave(d.clave ?? ""), acepto: acepto ? null : "app.error.cuenta.consentimiento",
    };
    setErr(e2);
    if (Object.values(e2).some(Boolean)) { alError(null); return; }
    setOcupado(true);
    alError(null);
    const r = await registrar(d);
    setOcupado(false);
    if (r) alError(r);
  }
  const inicial = d.nombre.trim().charAt(0).toUpperCase();
  return (
    <>
      <form onSubmit={(e) => void enviar(e)} noValidate className="mt-4 grid gap-3">
        <ElegirFoto foto={d.foto ?? null} alCambiar={(f) => setD((x) => ({ ...x, foto: f }))} inicial={inicial} />
        {/* nombres y apellidos en una sola caja (pedido del dueño) */}
        <Campo etiqueta={t("app.cuenta.campo.nombre")} value={d.nombre} onChange={poner("nombre")} error={err.nombre} autoComplete="name" autoCapitalize="words" />
        <Campo etiqueta={t("app.cuenta.campo.cedula")} value={d.cedula} onChange={(e) => poner("cedula")({ target: { value: e.target.value.replace(/\D/g, "").slice(0, 10) } })}
          error={err.cedula} inputMode="numeric" autoComplete="off" maxLength={10} />
        <Campo etiqueta={t("app.cuenta.campo.email")} value={d.email} onChange={poner("email")} error={err.email} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} />
        <CampoClave etiqueta={t("app.cuenta.campo.clave_nueva")} value={d.clave ?? ""} onChange={poner("clave")} error={err.clave} autoComplete="new-password" />
        <label className="flex items-start gap-3 rounded-2xl bg-suelo p-3.5 text-sm">
          <input type="checkbox" checked={acepto} onChange={(e) => { setAcepto(e.target.checked); setErr((x) => ({ ...x, acepto: null })); }} aria-invalid={err.acepto ? true : undefined} className="mt-0.5 size-5 shrink-0" />
          <Html clave="app.cuenta.acepto" className="text-pretty [&_a]:font-semibold" />
        </label>
        {err.acepto && <p className="-mt-1 text-sm font-semibold">{t(err.acepto)}</p>}
        <p className="text-xs text-gris text-pretty">{t("app.cuenta.nota.registro")}</p>
        <Enviar ocupado={ocupado} texto={t("app.cuenta.crear")} />
      </form>
    </>
  );
}

/** Corregir los datos. La cédula no cambia; la foto se cambia en «Mi cuenta». */
function FormPerfil({ ciudadano, alError }: { ciudadano: Ciudadano; alError: (k: string | null) => void }) {
  const { t } = useI18n();
  const [d, setD] = useState<DatosCuenta>({ nombre: ciudadano.nombre, cedula: ciudadano.cedula, email: ciudadano.email });
  const [err, setErr] = useState<Errores>({});
  const [ocupado, setOcupado] = useState(false);
  // al escribir en un campo se borra su error (los demás quedan hasta el próximo envío)
  const poner = (k: keyof DatosCuenta) => (e: { target: { value: string } }) => { setD((x) => ({ ...x, [k]: e.target.value })); setErr((x) => ({ ...x, [k]: null })); };
  async function enviar(e: FormEvent) {
    e.preventDefault();
    const e2: Errores = {
      nombre: errorNombre(d.nombre),
      email: errorEmail(d.email),
    };
    setErr(e2);
    if (Object.values(e2).some(Boolean)) { alError(null); return; }
    setOcupado(true);
    alError(null);
    const r = await guardarPerfil(d);
    setOcupado(false);
    if (r) alError(r);
  }
  return (
    <form onSubmit={(e) => void enviar(e)} noValidate className="mt-4 grid gap-3">
      <Campo etiqueta={t("app.cuenta.campo.nombre")} value={d.nombre} onChange={poner("nombre")} error={err.nombre} autoComplete="name" autoCapitalize="words" />
      <Campo etiqueta={t("app.cuenta.campo.cedula")} value={d.cedula} readOnly nota={t("app.cuenta.cedula_fija")} inputMode="numeric" autoComplete="off" />
      <Campo etiqueta={t("app.cuenta.campo.email")} value={d.email} onChange={poner("email")} error={err.email} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} />
      <Enviar ocupado={ocupado} texto={t("app.cuenta.guardar")} />
      <button type="button" onClick={() => store.set({ ingreso: null })} className={K.btnSec}>{t("app.cancelar")}</button>
    </form>
  );
}
