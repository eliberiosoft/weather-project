/* Ventana de inicio con los dos permisos: cada botón dispara la alerta del sistema desde el toque de la persona. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icono, type IdIcono } from "../shared/componentes/Icono";
import { useI18n } from "../shared/i18n";
import { useApp } from "../shared/store";
import { conectarPush, pedirPermisoNotificaciones, type Resultado } from "../features/avisos/push";
import { activarUbicacion, estadoUbicacion, type EstadoPermiso } from "../features/lugar/miUbicacion";
import { cerrarPermisos, estadoNotificaciones } from "../features/pwa/permisos";
import { casoIos, equipoActual } from "../features/pwa/ios";
import { abrirGuiaIos } from "./GuiaIos";

export function Permisos() {
  const { t } = useI18n();
  const abierta = useApp((s) => s.permisos);
  const dlg = useRef<HTMLDialogElement>(null);
  const [ubic, setUbic] = useState<EstadoPermiso>("preguntar");
  const [notif, setNotif] = useState<EstadoPermiso>("preguntar");
  const [ocupado, setOcupado] = useState<"" | "ubic" | "notif">("");
  /** después del permiso: suscripción al push en curso o cómo terminó */
  const [push, setPush] = useState<"" | "conectando" | Resultado>("");

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (abierta && !d.open) {
      void estadoUbicacion().then(setUbic);
      setNotif(estadoNotificaciones());
      d.showModal();
    }
    if (!abierta && d.open) d.close();
  }, [abierta]);

  async function pedirUbicacion() {
    setOcupado("ubic");
    setUbic(await activarUbicacion());
    setOcupado("");
  }
  async function pedirNotificaciones() {
    setOcupado("notif");
    const p = await pedirPermisoNotificaciones();
    setNotif(p === "granted" ? "concedido" : p === "denied" ? "negado" : p === "no_disponible" ? "no_disponible" : "preguntar");
    setOcupado("");
    if (p !== "granted") return;
    // el permiso ya está: la suscripción al push tarda unos segundos (Firebase y el service worker), se muestra
    setPush("conectando");
    setPush(await conectarPush());
  }

  const iphone = casoIos(equipoActual()) !== "no";
  const listos = (ubic === "concedido" || ubic === "no_disponible") && (notif === "concedido" || notif === "no_disponible") && push !== "conectando";
  return (
    <dialog ref={dlg} aria-labelledby="perm-titulo" onCancel={(e) => { e.preventDefault(); cerrarPermisos(); }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-ficha bg-papel p-0 text-texto shadow-flota backdrop:bg-negro/50">
      <div className="p-5">
        <h2 id="perm-titulo" className="text-xl leading-tight font-bold">{t("app.perm.titulo")}</h2>
        <p className="mt-1.5 text-sm text-gris text-pretty">{t("app.perm.texto")}</p>
        <div className="mt-4 grid gap-2.5">
          <Fila icono="i-gps" titulo={t("app.perm.ubic")} nota={t("app.perm.ubic_nota")} estado={ubic}
            boton={t(ocupado === "ubic" ? "app.perm.buscando" : "app.perm.activar")} ocupado={ocupado === "ubic"} alTocar={() => void pedirUbicacion()} />
          {iphone && (
            <div className="rounded-2xl bg-suelo p-3.5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-papel text-tinta"><Icono id="i-campana" className="size-5" /></span>
                <div className="min-w-0 flex-1"><p className="font-bold leading-tight">{t("app.perm.notif")}</p><p className="mt-0.5 text-xs text-gris">{t("app.ios.perm_nota")}</p></div>
                <button type="button" onClick={abrirGuiaIos} className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-tinta px-4 text-sm font-semibold text-white active:scale-[.98]">{t("app.ios.perm_boton")}</button>
              </div>
            </div>
          )}
          {!iphone && notif !== "no_disponible" && (
            <Fila icono="i-campana" titulo={t("app.perm.notif")} nota={t("app.perm.notif_nota")} estado={notif}
              boton={t(ocupado === "notif" ? "app.perm.activando" : "app.perm.activar")} ocupado={ocupado === "notif"} alTocar={() => void pedirNotificaciones()}
              extra={push === "conectando" ? <><Girando oscuro />{t("app.perm.conectando")}</>
                : push === "push" ? <>{t("app.perm.push_ok")}</>
                : push === "local" || push === "error" ? <>{t("app.perm.push_luego")}</> : null} />
          )}
        </div>
        <button type="button" onClick={cerrarPermisos}
          className={`mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-4 font-semibold transition active:scale-[.98] ${listos ? "bg-tinta text-white" : "bg-suelo text-tinta"}`}>
          {t(listos ? "app.perm.listo" : "app.perm.ahora_no")}
        </button>
      </div>
    </dialog>
  );
}

/** Rueda de carga (con movimiento reducido queda quieta). */
function Girando({ oscuro = false }: { oscuro?: boolean }) {
  return <span aria-hidden="true" className={`inline-block size-4 shrink-0 rounded-full border-2 motion-safe:animate-spin ${oscuro ? "border-tinta/25 border-t-tinta" : "border-white/40 border-t-white"}`} />;
}

function Fila({ icono, titulo, nota, estado, boton, ocupado, alTocar, extra }: {
  icono: IdIcono; titulo: string; nota: string; estado: EstadoPermiso; boton: string; ocupado: boolean; alTocar: () => void; extra?: ReactNode;
}) {
  const { t } = useI18n();
  let accion: ReactNode;
  if (estado === "concedido") accion = <span className="inline-flex items-center gap-1 text-sm font-bold text-tinta"><Icono id="i-check" className="size-4.5" />{t("app.perm.activo")}</span>;
  else if (estado === "negado") accion = null;
  else accion = (
    <button type="button" onClick={alTocar} disabled={ocupado}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-tinta px-4 text-sm font-semibold text-white transition active:scale-[.98] disabled:opacity-80">
      {ocupado && <Girando />}{boton}
    </button>
  );
  return (
    <div className="rounded-2xl bg-suelo p-3.5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-papel text-tinta"><Icono id={icono} className="size-5" /></span>
        <div className="min-w-0 flex-1"><p className="font-bold leading-tight">{titulo}</p><p className="mt-0.5 text-xs text-gris">{nota}</p></div>
        {accion}
      </div>
      {estado === "negado" && <p className="mt-2 text-xs font-semibold text-texto">{t("app.perm.bloqueado")}</p>}
      {extra && <p role="status" className="mt-2 flex items-center gap-2 text-xs font-semibold text-texto">{extra}</p>}
    </div>
  );
}
