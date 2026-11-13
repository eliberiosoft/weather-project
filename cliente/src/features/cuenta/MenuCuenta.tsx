/* «Mi cuenta» (botón de la cabecera): con cuenta, la foto (se cambia o se quita aquí), los datos, editarlos,
   cerrar sesión y eliminar la cuenta (dos toques, sin ventana del navegador); como invitado, qué le falta y los botones
   para entrar o crear la cuenta. */
import { useEffect, useRef, useState } from "react";
import { Icono } from "../../shared/componentes/Icono";
import { K } from "../../shared/estilo";
import { useI18n } from "../../shared/i18n";
import { store, useApp } from "../../shared/store";
import { cambiarFoto, conCuenta, eliminarCuenta, pedirCuenta, primerNombre, salir, urlFotoPerfil } from "./cuenta";
import { Avatar, ElegirFoto } from "./Formularios";

const cerrar = () => store.set({ menuCuenta: false });
/** Cédula a medias: 0912345678 → 09•••••678 (por si alguien mira la pantalla por encima del hombro). */
export const cedulaOculta = (c: string) => c.slice(0, 2) + "•".repeat(5) + c.slice(7);

/** Botón redondo de la cabecera: la foto, la inicial del vecino con cuenta o el ícono de persona. */
export function BotonCuenta() {
  const { t } = useI18n();
  const cuenta = useApp((s) => s.cuenta);
  const fotoV = useApp((s) => s.fotoV);
  const con = conCuenta(cuenta);
  return (
    <button type="button" onClick={() => store.set({ menuCuenta: true })} aria-haspopup="dialog" aria-label={t("app.cuenta.menu.etq")} title={t("app.cuenta.menu.etq")}
      className={`grid size-9 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-bold active:scale-95 ${con ? "" : "bg-white/70 text-tinta"}`}>
      {con ? <Avatar src={cuenta.ciudadano.foto ? urlFotoPerfil(fotoV) : null} inicial={cuenta.ciudadano.nombre.charAt(0).toUpperCase()} className="size-9 text-sm" />
        : <Icono id="i-usuario" className="size-5" />}
    </button>
  );
}

export function MenuCuenta() {
  const { t } = useI18n();
  const abierto = useApp((s) => s.menuCuenta);
  const cuenta = useApp((s) => s.cuenta);
  const fotoV = useApp((s) => s.fotoV);
  const dlg = useRef<HTMLDialogElement>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (abierto && !d.open) { setConfirmar(false); d.showModal(); }
    if (!abierto && d.open) d.close();
  }, [abierto]);
  // el primer toque en «Eliminar» pide confirmar; a los 5 s vuelve solo
  useEffect(() => {
    if (!confirmar) return;
    const h = setTimeout(() => setConfirmar(false), 5000);
    return () => clearTimeout(h);
  }, [confirmar]);

  async function eliminar() {
    if (!confirmar) { setConfirmar(true); return; }
    setOcupado(true);
    await eliminarCuenta();
    setOcupado(false);
    setConfirmar(false);
  }
  async function foto(f: string | null) {
    setOcupado(true);
    await cambiarFoto(f);
    setOcupado(false);
  }

  return (
    <dialog ref={dlg} aria-labelledby="cta-titulo" onCancel={(e) => { e.preventDefault(); cerrar(); }}
      onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-ficha bg-papel p-0 text-texto shadow-flota backdrop:bg-negro/50">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <h2 id="cta-titulo" className="text-xl leading-tight font-bold">{t("app.cuenta.menu.etq")}</h2>
          <button type="button" onClick={cerrar} aria-label={t("app.cerrar")} title={t("app.cerrar")} className="-mt-1 -mr-1 ml-auto grid size-10 place-items-center rounded-full text-gris active:scale-95">
            <Icono id="i-x" className="size-5" />
          </button>
        </div>

        {conCuenta(cuenta) ? (
          <>
            <div className="mt-3 rounded-2xl bg-suelo p-3.5" aria-busy={ocupado}>
              <ElegirFoto foto={cuenta.ciudadano.foto ? urlFotoPerfil(fotoV) : null} alCambiar={(f) => void foto(f)} inicial={cuenta.ciudadano.nombre.charAt(0).toUpperCase()} />
            </div>
            <dl className="mt-3 text-sm">
              <div className={K.dato}><dt className="text-gris">{t("app.cuenta.campo.nombre")}</dt><dd className="min-w-0 truncate text-right font-semibold">{cuenta.ciudadano.nombre}</dd></div>
              <div className={K.dato}><dt className="text-gris">{t("app.cuenta.campo.cedula")}</dt><dd className="font-semibold tabular-nums">{cuenta.ciudadano.cedula ? cedulaOculta(cuenta.ciudadano.cedula) : ""}</dd></div>
              <div className={K.dato}><dt className="text-gris">{t("app.cuenta.campo.email")}</dt><dd className="min-w-0 truncate text-right font-semibold">{cuenta.ciudadano.email}</dd></div>
            </dl>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => pedirCuenta("editar", "perfil")} className={K.btnSec}>{t("app.cuenta.editar")}</button>
              <button type="button" onClick={() => void salir()} className={K.btnSec}>{t("app.cuenta.menu.salir")}</button>
              <button type="button" onClick={() => void eliminar()} disabled={ocupado}
                className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 font-semibold transition active:scale-[.98] disabled:opacity-60 ${confirmar ? "bg-negro text-white" : "bg-papel text-tinta ring-1 ring-regla"}`}>
                <Icono id="i-x" className="size-5" />{t(confirmar ? "app.cuenta.menu.eliminar_ok" : "app.cuenta.menu.eliminar")}
              </button>
            </div>
            <p className={K.nota}>{t("app.cuenta.menu.privado", { nombre: primerNombre(cuenta.ciudadano) })}</p>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-gris text-pretty">{t("app.cuenta.menu.invitado")}</p>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => pedirCuenta("reportar")} className={K.btn}>{t("app.cuenta.modo.ingreso")}</button>
              <button type="button" onClick={() => pedirCuenta("reportar", "registro")} className={K.btnSec}>{t("app.cuenta.modo.registro")}</button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
