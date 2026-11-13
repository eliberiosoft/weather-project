/* «Avisos»: lo que publica el equipo para tu zona, con el nivel escrito sobre su color, el flyer si lo tiene y
   compartir (enlace /a/<id>), y las notificaciones. */
import { useEffect, useRef } from "react";
import { ErrorCarga } from "../../shared/componentes/ErrorCarga";
import { Icono } from "../../shared/componentes/Icono";
import { abrirGuiaIos } from "../../app/GuiaIos";
import { casoIos, equipoActual } from "../pwa/ios";
import { Vista } from "../../shared/componentes/Vista";
import { fondoNivel, K } from "../../shared/estilo";
import { urlAviso } from "../../shared/dominio";
import { hace, hora, sinMovimiento } from "../../shared/formato";
import { verFotos } from "../../shared/componentes/VisorFoto";
import { registrarVista, useVista } from "../../shared/vistas";
import { useI18n } from "../../shared/i18n";
import { pendientes } from "../../shared/pendientes";
import { store, toast, useApp } from "../../shared/store";
import type { Aviso, Avisos as DatosAvisos } from "../../shared/tipos";
import { instalar } from "../pwa/pwa";
import { cargarAvisos } from "./cargaAvisos";
import { EsqueletoAvisos } from "./EsqueletoAvisos";
import { activarNotificaciones } from "./push";

/** Un aviso: el nivel escrito sobre su color, el flyer (si hay; se toca para verlo entero), el texto, hasta cuándo
    vale y compartir. Cuenta para el alcance cuando estuvo a la vista (spec 021). */
function Tarjeta({ a, destacado }: { a: Aviso; destacado: boolean }) {
  const { t } = useI18n();
  const terr = useApp((s) => s.terr);
  const activa = useApp((s) => s.vista === "avisos");
  const ref = useRef<HTMLElement>(null);
  useVista(ref, "aviso", a.id, activa);
  const url = urlAviso(a, terr);
  const texto = `${t("nivel." + a.nivel_cod)} · ${a.titulo}`;
  const share = typeof navigator !== "undefined" && !!navigator.share;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); toast(t("app.muro.copiado")); }
    catch { toast(url, 9000); }
  };
  return (
    <article ref={ref} id={"aviso-" + a.id} className={`scroll-mt-24 overflow-hidden rounded-ficha bg-vidrio shadow-ficha ring-1 ring-white/70 transition-shadow [&.destacado]:ring-4 [&.destacado]:ring-tinta/40 ${destacado ? "destacado" : ""}`}>
      <div className={`flex items-center justify-between gap-3 px-5 py-3 ${fondoNivel(a.nivel_cod)}`}>
        <span className="text-sm font-extrabold tracking-wide">{t("nivel." + a.nivel_cod)}</span>
        <span className="min-w-0 truncate text-xs font-semibold opacity-90">{a.ambito_nombre || t("app.av.canton")}</span>
      </div>
      {a.flyer ? (
        <button type="button" onClick={() => verFotos({ titulo: a.titulo, urls: [a.flyer!], i: 0 })} aria-label={t("app.av.ver_flyer")}
          className="block w-full bg-white">
          <img src={a.flyer} alt={t("app.av.flyer_alt", { titulo: a.titulo })} loading="lazy" decoding="async" className="mx-auto max-h-[26rem] w-full object-contain" />
        </button>
      ) : null}
      <div className="px-5 pt-4 pb-5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-gris">
          <span className="inline-flex items-center gap-1"><Icono id="i-campana" className="size-3.5" />{t("app.av.publicado", { hace: hace(a.creado) })}</span>
          <span aria-hidden="true">·</span>
          <span>{t("app.av.vigente", { hora: hora(a.vigente_hasta) })}</span>
        </p>
        <h2 className="mt-2 text-xl leading-snug font-bold text-balance">{a.titulo}</h2>
        <p className="mt-2 leading-relaxed whitespace-pre-line text-pretty">{a.texto}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          <a href={`https://wa.me/?text=${encodeURIComponent(texto + " " + url)}`} target="_blank" rel="noopener" className={`${RED} no-underline`}><Icono id="i-chat" className="size-5" />WhatsApp</a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener" className={`${RED} no-underline`}><Icono id="i-compartir" className="size-5" />Facebook</a>
          <button type="button" onClick={() => void copiar()} className={RED}><Icono id="i-enlace" className="size-5" />{t("app.muro.copiar")}</button>
          {share ? <button type="button" onClick={() => navigator.share({ title: texto, text: a.texto.slice(0, 200), url }).catch(() => {})} className={`${RED} col-span-3 sm:col-span-1`}><Icono id="i-mas" className="size-5" />{t("app.av.compartir")}</button> : null}
        </div>
      </div>
    </article>
  );
}

const RED = "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white/80 text-xs font-semibold text-tinta ring-1 ring-regla active:scale-95";

/** Llegó a un aviso por un enlace o tocando la notificación: se lleva a la vista, se resalta y, si hay flyer y vino de
    la notificación, se abre a pantalla completa. Si ya no está vigente, se dice. */
function useAvisoDestacado(avisos: DatosAvisos | null) {
  const { t } = useI18n();
  const d = useApp((s) => s.avisoDestacado);
  const activa = useApp((s) => s.vista === "avisos");
  useEffect(() => {
    if (!d || !avisos || !activa) return;
    const a = avisos.vigentes.find((x) => x.id === d.id);
    if (d.push) registrarVista("aviso", d.id, "push");
    if (!a) { toast(t("app.av.ya_no")); store.set({ avisoDestacado: null }); return; }
    requestAnimationFrame(() => document.getElementById("aviso-" + a.id)?.scrollIntoView({ block: "start", behavior: sinMovimiento() ? "auto" : "smooth" }));
    if (d.push && a.flyer) verFotos({ titulo: a.titulo, urls: [a.flyer], i: 0 });
    const h = setTimeout(() => store.set({ avisoDestacado: null }), 6000);
    return () => clearTimeout(h);
  }, [d, avisos, activa, t]);
  return d?.id ?? null;
}

export function Avisos() {
  const { t } = useI18n();
  const avisos = useApp((s) => s.avisos);
  const det = useApp((s) => s.lugarDet);
  const notif = useApp((s) => s.notif);
  const instalable = useApp((s) => s.instalable);
  const iphone = casoIos(equipoActual()) !== "no";
  const arranque = useApp((s) => s.arranque);
  const error = useApp((s) => s.avisosError || s.arranque === "error");
  const reintentar = () => (arranque === "ok" ? void cargarAvisos(true) : pendientes.reintentar());
  const r = det?.recinto;
  const destacado = useAvisoDestacado(avisos);
  return (
    <Vista id="avisos" etiqueta="app.sec.avisos" className={K.vista}>
      <h1 className={K.h1}>{t("app.av.titulo")}</h1>
      <p className="mt-0.5 text-sm text-gris">{r ? t("app.av.para", { lugar: r.nombre + (r.parroquia ? ` (${r.parroquia})` : "") }) : t("app.av.para_todo")}</p>
      <div className="mt-4 grid gap-3">
        {!avisos ? (error ? <ErrorCarga onReintentar={reintentar} /> : <EsqueletoAvisos />)
          : avisos.vigentes.length ? avisos.vigentes.map((a) => <Tarjeta key={a.id} a={a} destacado={a.id === destacado} />)
          : <p className="rounded-ficha bg-vidrio p-5 text-sm text-gris shadow-ficha ring-1 ring-white/70">{t("app.av.vacio")}</p>}
      </div>
      {/* lo de abajo aparece con los avisos: así el cambio de los placeholders a las tarjetas no empuja nada (CLS) */}
      <section hidden={!avisos && !error} className={`mt-3 ${K.ficha}`}>
        <button type="button" onClick={() => void activarNotificaciones()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-tinta-suave px-4 font-semibold text-tinta active:scale-[.98]">
          <Icono id="i-campana" className="size-5" /><span>{t("app.av.notif")}</span>
        </button>
        {notif !== "no" ? (
          <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-texto"><Icono id="i-check" className="mt-0.5 size-4.5 text-tinta" />{t(notif === "push" ? "app.av.push.activo" : "app.av.push.local")}</p>
        ) : null}
        <p className="mt-3 text-sm text-gris">{t("app.av.notif.nota")}</p>
        <button type="button" hidden={!instalable} onClick={() => void instalar()} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-tinta px-4 font-semibold text-white active:scale-[.98]">
          <Icono id="i-instalar" className="size-5" /><span>{t("app.instalar")}</span>
        </button>
        <p hidden={!instalable} className="mt-2 text-sm text-gris">{t("app.instalar.nota")}</p>
        {/* iPhone: no hay instalador automático; se explica cómo hacerlo desde Safari */}
        {iphone && <>
          <button type="button" onClick={abrirGuiaIos} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-tinta px-4 font-semibold text-white active:scale-[.98]">
            <Icono id="i-instalar" className="size-5" /><span>{t("app.ios.boton")}</span>
          </button>
          <p className="mt-2 text-sm text-gris">{t("app.ios.boton_nota")}</p>
        </>}
      </section>
      <section hidden={!avisos && !error} className={`mt-3 mb-2 ${K.ficha}`}>
        <h2 className="text-lg font-bold">{t("app.av.anteriores")}</h2>
        <div className="mt-1">
          {avisos?.anteriores.length ? avisos.anteriores.map((a) => (
            <p key={a.id} className="border-b border-regla py-3 text-[.9rem] last:border-0">{hora(a.creado)} · <b>{a.titulo}</b> ({t("nivel." + a.nivel_cod)})</p>
          )) : <p className={K.vacio}>{t("app.av.anteriores.vacio")}</p>}
        </div>
      </section>
    </Vista>
  );
}
