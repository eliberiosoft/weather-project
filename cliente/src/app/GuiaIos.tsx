/* Guía para instalar la app en iPhone: un paso a la vez, con un dibujo de lo que muestra Safari y el botón que hay que
   tocar resaltado (una frase por paso). iOS 26: ⋯ → Compartir → Agregar a pantalla de inicio → Agregar (con «Abrir
   como app web»). Antes: Compartir → Agregar a pantalla de inicio → Agregar. Dentro de WhatsApp, Facebook o Instagram
   no se puede instalar: se ofrece abrir en Safari y copiar el enlace. Los dibujos son esquemas, no capturas. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icono, type IdIcono } from "../shared/componentes/Icono";
import { useI18n } from "../shared/i18n";
import { store, toast, useApp } from "../shared/store";
import { casoIos, equipoActual, menuDePagina, type MenuPagina } from "../features/pwa/ios";

export const abrirGuiaIos = () => store.set({ guiaIos: true, pistaIos: false });
const cerrar = () => store.set({ guiaIos: false });
/** Al terminar: se cierra la guía y queda un globo que señala dónde tocar en la barra de Safari. */
const hacerloAhora = () => store.set({ guiaIos: false, pistaIos: true });

/** Resalte del botón que hay que tocar: anillo celeste fijo y, por fuera, otro que late en su lugar (el contenido no parpadea). */
const RESALTE = "relative ring-4 ring-cielo";
const Pulso = () => <span aria-hidden="true" className="pointer-events-none absolute -inset-1 rounded-[inherit] ring-4 ring-cielo/50 motion-safe:animate-pulse" />;

interface PasoGuia { frase: string; dibujo: ReactNode }

export function GuiaIos() {
  const { t } = useI18n();
  const abierta = useApp((s) => s.guiaIos);
  const dlg = useRef<HTMLDialogElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (abierta && !d.open) { setN(0); d.showModal(); }
    if (!abierta && d.open) d.close();
  }, [abierta]);

  const equipo = equipoActual();
  const caso = abierta ? casoIos(equipo) : "instalar";
  const menu = menuDePagina(equipo.ua);

  const pasos: PasoGuia[] = caso !== "instalar" ? [] : menu ? [
    { frase: t(menu === "lineas" ? "app.ios.s_lineas" : "app.ios.s_puntos"), dibujo: <Barra resaltar={menu} /> },
    { frase: t("app.ios.s_compartir"), dibujo: <Menu filas={[["i-compartir", t("app.ios.u_compartir")], ["i-agregar", t("app.ios.u_favorito")], ["i-buscar", t("app.ios.u_buscar")]]} resaltar={0} /> },
    { frase: t("app.ios.s_agregar"), dibujo: <Menu filas={[["i-enlace", t("app.ios.u_copiar")], ["i-muro", t("app.ios.u_lectura")], ["i-agregar", t("app.ios.u_inicio")]]} resaltar={2} /> },
    { frase: t("app.ios.s_confirmar26"), dibujo: <Confirmar webApp /> },
  ] : [
    { frase: t("app.ios.s_compartir_barra"), dibujo: <Barra resaltar="compartir" /> },
    { frase: t("app.ios.s_agregar"), dibujo: <Menu filas={[["i-enlace", t("app.ios.u_copiar")], ["i-muro", t("app.ios.u_lectura")], ["i-agregar", t("app.ios.u_inicio")]]} resaltar={2} /> },
    { frase: t("app.ios.s_confirmar"), dibujo: <Confirmar /> },
  ];
  const ultimo = n >= pasos.length - 1;

  return (
    <dialog ref={dlg} aria-labelledby="ios-titulo" onCancel={(e) => { e.preventDefault(); cerrar(); }}
      onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}
      className="mx-auto mt-auto mb-0 w-full max-w-lg animate-hoja rounded-t-ficha bg-papel p-0 text-texto shadow-hoja backdrop:bg-negro/50">
      <div className="px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-regla" aria-hidden="true" />
        <div className="flex items-center gap-3">
          <img src="icono-192.png" alt="" width="40" height="40" className="size-10 shrink-0 rounded-xl shadow-ficha" />
          <h2 id="ios-titulo" className="min-w-0 flex-1 text-lg leading-tight font-bold">{t(caso === "instalar" ? "app.ios.titulo_corto" : "app.ios.titulo_safari")}</h2>
          <button type="button" onClick={cerrar} aria-label={t("app.cerrar")} className="grid size-10 shrink-0 place-items-center rounded-full bg-suelo text-gris"><Icono id="i-x" className="size-5" /></button>
        </div>

        {caso === "instalar" ? (
          <>
            {/* un paso a la vez: el dibujo y una sola frase */}
            <div key={n} className="mt-4 animate-entra">
              <div className="rounded-ficha bg-suelo p-4" aria-hidden="true">{pasos[n]?.dibujo}</div>
              <p role="status" className="mt-3 text-center text-lg leading-snug font-bold text-balance">
                <span className="mr-1.5 text-tinta tabular-nums">{n + 1}.</span>{pasos[n]?.frase}
              </p>
            </div>
            <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
              {pasos.map((_, i) => <span key={i} className={`h-2 rounded-full transition-all ${i === n ? "w-6 bg-tinta" : "w-2 bg-regla"}`} />)}
            </div>
            <div className="mt-4 flex gap-2">
              {n > 0 && (
                <button type="button" onClick={() => setN(n - 1)} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-suelo px-4 font-semibold text-tinta active:scale-[.98]">
                  <Icono id="i-atras" className="size-5" /><span className="sr-only">{t("app.wiz.atras")}</span>
                </button>
              )}
              <button type="button" onClick={ultimo ? hacerloAhora : () => setN(n + 1)}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-tinta px-4 font-semibold text-white active:scale-[.98]">
                {t(ultimo ? "app.ios.listo" : "app.wiz.siguiente")}{!ultimo && <Icono id="i-adelante" className="size-5" />}
              </button>
            </div>
          </>
        ) : (
          <AbrirEnSafari appAjena={caso === "app_ajena"} />
        )}
      </div>
    </dialog>
  );
}

/** Dentro de WhatsApp, Facebook o Instagram (o Chrome antes de iOS 16.4): abrir en Safari o copiar el enlace. */
function AbrirEnSafari({ appAjena }: { appAjena: boolean }) {
  const { t } = useI18n();
  const url = location.origin + "/";
  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); toast(t("app.ios.copiado")); } catch { toast(url, 8000); }
  };
  return (
    <>
      <p className="mt-3 text-sm text-gris text-pretty">{t(appAjena ? "app.ios.texto_app" : "app.ios.texto_viejo")}</p>
      {appAjena && <div className="mt-3 rounded-ficha bg-suelo p-4" aria-hidden="true"><Barra resaltar="puntos" ajena /></div>}
      <div className="mt-4 grid gap-2">
        {/* iOS 17+: este enlace abre la página en Safari desde el navegador interno de otras apps */}
        {appAjena && (
          <a href={"x-safari-" + url} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-tinta px-4 font-semibold text-white no-underline active:scale-[.98]">
            <Icono id="i-enlace" className="size-5" />{t("app.ios.abrir_safari")}
          </a>
        )}
        <button type="button" onClick={() => void copiar()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-suelo px-4 font-semibold text-tinta active:scale-[.98]">
          {t("app.ios.copiar")}
        </button>
      </div>
      <p className="mt-2 text-xs text-gris">{t(appAjena ? "app.ios.si_no_abre" : "app.ios.pega_en_safari")}</p>
    </>
  );
}

/* ---- dibujos (esquemas) ---- */

/** La parte de abajo de Safari: la página (líneas grises) y la barra con la dirección. En el navegador interno de
    WhatsApp, Facebook o Instagram (`ajena`) la barra con ⋯ está arriba. */
function Barra({ resaltar, ajena = false }: { resaltar: NonNullable<MenuPagina> | "compartir"; ajena?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={`mx-auto flex max-w-72 overflow-hidden rounded-2xl bg-papel shadow-ficha ${ajena ? "flex-col-reverse" : "flex-col"}`}>
      <div className="grid gap-1.5 p-3">
        <span className="h-2 w-3/4 rounded-full bg-regla" /><span className="h-2 w-1/2 rounded-full bg-regla" /><span className="h-2 w-2/3 rounded-full bg-regla" />
      </div>
      {resaltar === "lineas" ? (
        <div className="flex items-center gap-2 border-t border-regla p-2.5">
          <span className={`grid size-9 shrink-0 place-items-center rounded-full bg-suelo text-texto ${RESALTE}`}><Icono id="i-lineas" className="size-5" /><Pulso /></span>
          <span className="min-w-0 flex-1 truncate rounded-full bg-suelo px-3 py-2 text-xs text-gris">yaguachiweather…</span>
        </div>
      ) : resaltar === "puntos" ? (
        <div className={`flex items-center gap-2 border-regla p-2.5 ${ajena ? "border-b" : "border-t"}`}>
          <span className="min-w-0 flex-1 truncate rounded-full bg-suelo px-3 py-2 text-xs text-gris">{ajena ? "WhatsApp" : "yaguachiweather…"}</span>
          <span className={`grid size-9 shrink-0 place-items-center rounded-full bg-suelo text-texto ${RESALTE}`}><Icono id="i-puntos" className="size-5" /><Pulso /></span>
        </div>
      ) : (
        <div className="border-t border-regla p-2.5">
          <span className="block truncate rounded-full bg-suelo px-3 py-1.5 text-center text-xs text-gris">yaguachiweather…</span>
          <div className="mt-2 flex items-center justify-around text-gris">
            <Icono id="i-atras" className="size-5" /><Icono id="i-adelante" className="size-5" />
            <span className={`grid size-9 place-items-center rounded-full bg-suelo text-texto ${RESALTE}`}><Icono id="i-compartir" className="size-5" /><Pulso /></span>
            <Icono id="i-muro" className="size-5" /><Icono id="i-capas" className="size-5" />
          </div>
        </div>
      )}
      <p className="sr-only">{t(resaltar === "lineas" ? "app.ios.s_lineas" : resaltar === "puntos" ? "app.ios.s_puntos" : "app.ios.s_compartir_barra")}</p>
    </div>
  );
}

/** Un menú de Safari (el de ⋯ o la hoja de Compartir) con una fila resaltada. */
function Menu({ filas, resaltar }: { filas: [IdIcono, string][]; resaltar: number }) {
  return (
    <ul className="mx-auto grid max-w-72 gap-1 rounded-2xl bg-papel p-2 shadow-ficha">
      {filas.map(([icono, texto], i) => (
        <li key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${i === resaltar ? `bg-tinta-suave text-texto ${RESALTE}` : "text-gris"}`}>
          <span className="min-w-0 flex-1 truncate">{texto}</span><Icono id={icono} className="size-5 shrink-0" />{i === resaltar && <Pulso />}
        </li>
      ))}
    </ul>
  );
}

/** La pantalla final de «Agregar a pantalla de inicio»: el ícono, el nombre y el botón «Agregar». */
function Confirmar({ webApp = false }: { webApp?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-72 rounded-2xl bg-papel p-3 shadow-ficha">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gris">{t("app.cancelar")}</span>
        <span className={`rounded-full bg-tinta-suave px-3 py-1 font-bold text-tinta ${RESALTE}`}>{t("app.ios.u_agregar")}<Pulso /></span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <img src="icono-192.png" alt="" width="44" height="44" className="size-11 rounded-xl" />
        <span className="font-semibold">Yaguachi Weather</span>
      </div>
      {webApp && (
        <div className="mt-3 flex items-center justify-between border-t border-regla pt-3 text-sm">
          <span>{t("app.ios.u_webapp")}</span>
          <span className="flex h-6 w-10 items-center justify-end rounded-full bg-tinta p-0.5"><span className="size-5 rounded-full bg-white shadow" /></span>
        </div>
      )}
    </div>
  );
}

/** Después de la guía: un globo sobre la barra de navegación que apunta hacia abajo, a la barra de Safari (al centro,
    donde está Compartir; a la derecha, donde está ⋯ en Safari 26; a la izquierda, donde está ≡ desde Safari 27).
    Se va solo a los 20 s o al tocarlo. */
export function PistaIos() {
  const { t } = useI18n();
  const ver = useApp((s) => s.pistaIos);
  useEffect(() => {
    if (!ver) return;
    const h = setTimeout(() => store.set({ pistaIos: false }), 20000);
    return () => clearTimeout(h);
  }, [ver]);
  if (!ver) return null;
  const menu = menuDePagina(equipoActual().ua);
  const lado = menu === "lineas" ? "left-4" : menu === "puntos" ? "right-4" : "left-1/2 -translate-x-1/2";
  const punta = menu === "lineas" ? "left-6" : menu === "puntos" ? "right-6" : "left-1/2 -translate-x-1/2";
  return (
    <button type="button" onClick={() => store.set({ pistaIos: false })} aria-label={t("app.cerrar")}
      className={`fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom)+.75rem)] z-1600 w-[min(17rem,calc(100vw-2rem))] animate-entra rounded-2xl bg-negro p-3.5 text-left text-sm font-semibold text-white shadow-flota ${lado}`}>
      <span role="status">{t(menu === "lineas" ? "app.ios.pista_27" : menu === "puntos" ? "app.ios.pista_26" : "app.ios.pista")}</span>
      <span aria-hidden="true" className={`absolute -bottom-2 size-4 rotate-45 bg-negro ${punta}`} />
    </button>
  );
}
