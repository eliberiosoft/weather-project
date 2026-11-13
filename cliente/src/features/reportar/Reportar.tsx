/* «Reportar»: asistente paso a paso. Cada paso entra desde el lado hacia el que se avanza; en los pasos 1 y 2
   elegir una opción ya avanza. El minimapa (Leaflet) se carga solo al tener una ubicación. */
import { lazy, Suspense, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Icono } from "../../shared/componentes/Icono";
import { Html } from "../../shared/componentes/Html";
import { Vista } from "../../shared/componentes/Vista";
import { etiquetaTipo } from "../../shared/dominio";
import { K } from "../../shared/estilo";
import { sinMovimiento, textoConSentido } from "../../shared/formato";
import { useI18n } from "../../shared/i18n";
import { irA } from "../../shared/navegacion";
import { setRep, store, toast, useApp } from "../../shared/store";
import { pedirLlamada911 } from "../../app/Llamar911";
import { ubicar } from "../../shared/ubicacion";
import { modoReporte, verEnMapa } from "../mapa/acciones";
import { MAX_FOTOS, reducirFoto } from "./foto";
import { conCuenta, pedirCuenta, primerNombre } from "../cuenta/cuenta";
import { avanzar, CALLE, elegirTipo, enviarReporte, fijarUbicacionReporte, irPaso, PASOS, pasoListo, pasosDe, pasoVecino, reiniciarReporte, textoDonde } from "./asistente";

const MiniMapa = lazy(() => import("./MiniMapa"));
const URGENTES = ["aislados", "desborde", "vivienda_inundada", "robo"];
const SECCION = "rounded-ficha bg-vidrio p-5 shadow-ficha ring-1 ring-white/70";
const BTN_OK = "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/80 px-4 font-semibold text-tinta ring-1 ring-regla active:scale-[.98]";

export function Reportar() {
  const { t } = useI18n();
  const rep = useApp((s) => s.rep);
  const { paso, atras } = rep;
  const ok = paso === "ok";
  const wiz = useRef<HTMLDivElement>(null);
  const primera = useRef(true);

  // al cambiar de paso: animación de entrada, foco en el título y arriba del todo
  useLayoutEffect(() => {
    const sec = wiz.current?.querySelector<HTMLElement>(`[data-paso="${paso}"]`);
    if (!sec) return;
    sec.classList.remove("animate-paso", "animate-paso-atras");
    void sec.offsetWidth;
    sec.classList.add(atras ? "animate-paso-atras" : "animate-paso");
    if (primera.current) { primera.current = false; return; }
    sec.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
    document.querySelector("main")?.scrollTo({ top: 0, behavior: sinMovimiento() ? "auto" : "smooth" });
  }, [paso, atras]);

  const listo = pasoListo(rep);
  const enviando = useApp((s) => s.enviandoReporte);
  const txtSiguiente = t(paso === PASOS ? (rep.consent ? "app.rep.enviar" : "app.wiz.marca") : "app.wiz.siguiente");
  // en los pasos 1 y 2 elegir una opción ya avanza; el botón solo aparece si vuelves a un paso ya respondido
  const ocultarAcciones = ok || ((paso === 1 || paso === 2) && !listo);
  const siguiente = () => {
    if (!pasoListo(store.get().rep) || typeof paso !== "number") return;
    if (paso < PASOS) irPaso(pasoVecino(paso, rep.tipo, 1)); else void enviarReporte();
  };

  return (
    <Vista id="reportar" etiqueta="app.sec.reportar" className="vista mx-auto hidden max-w-lg px-4 pt-4 [&.activa]:block [&.activa]:animate-entra">
      <div className="flex items-center gap-3">
        <button type="button" disabled={ok || paso === 1} onClick={() => typeof paso === "number" && paso > 1 && irPaso(pasoVecino(paso, rep.tipo, -1), true)}
          aria-label={t("app.wiz.atras")} title={t("app.wiz.atras")} className="grid size-10 shrink-0 place-items-center rounded-full bg-vidrio text-tinta shadow-ficha ring-1 ring-white/70 transition active:scale-95 disabled:hidden">
          <Icono id="i-atras" className="size-5" />
        </button>
        <h1 className="text-lg font-bold">{t("app.rep.titulo")}</h1>
        <span className="ml-auto text-sm font-semibold text-gris">{ok ? "" : t("app.wiz.paso", { n: typeof paso === "number" ? pasosDe(rep.tipo).indexOf(paso) + 1 : 0, total: pasosDe(rep.tipo).length })}</span>
      </div>
      <ol aria-hidden="true" className="mt-3 grid list-none grid-cols-5 gap-1.5 p-0">
        {pasosDe(rep.tipo).map((p) => <li key={p} className={`h-1.5 rounded-full bg-white/70 transition-colors duration-300 [&.hecho]:bg-tinta ${ok || (typeof paso === "number" && p <= paso) ? "hecho" : ""}`}></li>)}
      </ol>
      <div hidden={!URGENTES.includes(rep.tipo || "")} className="mt-3 flex items-start gap-3 rounded-ficha bg-negro p-4 font-semibold text-white">
        <Icono id="i-alerta" className="size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <Html clave="app.rep.911" />
          <button type="button" onClick={pedirLlamada911} aria-haspopup="dialog" className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-negro active:scale-95">
            <Icono id="i-tel" className="size-4.5" />{t("app.emerg.llamar")}
          </button>
        </div>
      </div>

      <div ref={wiz} className="mt-4">
        <Paso n={1} actual={paso}><Paso1 /></Paso>
        <Paso n={2} actual={paso}><Paso2 /></Paso>
        <Paso n={3} actual={paso}><Paso3 /></Paso>
        <Paso n={4} actual={paso}><Paso4 /></Paso>
        <Paso n={5} actual={paso}><Paso5 /></Paso>
        <Paso n="ok" actual={paso} className="text-center"><Gracias /></Paso>
      </div>

      <div hidden={ocultarAcciones} className="mt-3">
        <button type="button" disabled={!listo || enviando} onClick={siguiente} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-tinta px-4 text-lg font-semibold text-white shadow-flota transition hover:bg-tinta-2 active:scale-[.98] disabled:bg-white/85 disabled:text-gris disabled:shadow-none">
          <span>{txtSiguiente}</span><Icono id="i-adelante" className="size-5" />
        </button>
      </div>

      <button type="button" hidden={!(paso === 1 || ok)} onClick={() => { store.set({ filtroMuro: "mios" }); irA("muro"); }}
        className="mt-3 mb-2 flex w-full items-center gap-3 rounded-ficha bg-vidrio p-4 text-left font-semibold text-tinta shadow-ficha ring-1 ring-white/70 active:scale-[.99]">
        <span className="grid size-10 place-items-center rounded-full bg-tinta-suave"><Icono id="i-muro" className="size-5" /></span>
        <span className="flex-1">{t("app.rep.ver_muro")}</span><Icono id="i-adelante" className="size-5" />
      </button>
    </Vista>
  );
}

function Paso({ n, actual, className = "", children }: { n: number | "ok"; actual: number | "ok"; className?: string; children: ReactNode }) {
  return <section data-paso={n} hidden={n !== actual} className={`${SECCION} ${className}`.trim()}>{children}</section>;
}

function Titulo({ clave }: { clave: string }) {
  const { t } = useI18n();
  return <h2 tabIndex={-1} className={K.h2Paso}>{t(clave)}</h2>;
}

const pausa = () => (sinMovimiento() ? 0 : 260);

function Paso1() {
  const { t } = useI18n();
  const terr = useApp((s) => s.terr);
  const tipo = useApp((s) => s.rep.tipo);
  return (
    <>
      <Titulo clave="app.rep.p1" />
      <p className={K.ayuda}>{t("app.wiz.p1.ayuda")}</p>
      <div role="radiogroup" aria-label={t("app.rep.tipo.etq")} className="mt-4 grid grid-cols-3 gap-2">
        {Object.entries(terr?.tipos || {}).map(([k, tp]) => (
          <button key={k} type="button" role="radio" aria-checked={k === tipo} onClick={() => { elegirTipo(k); avanzar(pausa()); }} className={K.eleccion}>
            <Icono id={"t-" + k} className="size-7 text-tinta [[aria-checked=true]_&]:text-white" />{etiquetaTipo({ tipo: k, etiqueta: tp.etiqueta })}
          </button>
        ))}
      </div>
    </>
  );
}

/** Solo en la calle inundada: cuánta agua hay (es lo que se ve, no una gravedad que elija el vecino). */
function Paso2() {
  const { t } = useI18n();
  const altura = useApp((s) => s.rep.altura);
  return (
    <>
      <Titulo clave="app.rep.altura" />
      <p className={K.ayuda}>{t("app.rep.altura.nota")}</p>
      <div role="radiogroup" aria-label={t("app.alturas.etq")} className="mt-4 grid grid-cols-3 gap-2">
        {[1, 2, 3].map((a) => (
          <button key={a} type="button" role="radio" aria-checked={altura === a} onClick={() => { setRep({ altura: a }); avanzar(pausa()); }} className={K.eleccion}>
            <Icono id={"a-" + a} className="size-8" /><span>{t(`app.altura.${a}.boton`)}</span><small className="text-xs font-medium opacity-75">{t(`app.altura.${a}.nota`)}</small>
          </button>
        ))}
      </div>
    </>
  );
}

function Paso3() {
  const { t } = useI18n();
  const rep = useApp((s) => s.rep);
  const visible = rep.paso === 3;
  const gps = async () => {
    try { const u = await ubicar(); fijarUbicacionReporte(u.lat, u.lon, "gps", u.prec); } catch (e) { toast((e as Error).message, 5000); }
  };
  return (
    <>
      <Titulo clave="app.rep.p3" />
      <p className={K.ayuda}>{t("app.wiz.p3.ayuda")}</p>
      <div className="mt-4 grid gap-2">
        <button type="button" onClick={gps} className="flex min-h-16 items-center gap-3 rounded-2xl bg-tinta px-4 text-left font-semibold text-white transition hover:bg-tinta-2 active:scale-[.98]">
          <span className="grid size-10 place-items-center rounded-full bg-white/15"><Icono id="i-gps" className="size-5" /></span><span>{t("app.rep.gps")}</span>
        </button>
        <button type="button" onClick={() => void modoReporte()} className="flex min-h-16 items-center gap-3 rounded-2xl bg-white/80 px-4 text-left font-semibold text-tinta ring-1 ring-regla active:scale-[.98]">
          <span className="grid size-10 place-items-center rounded-full bg-tinta-suave"><Icono id="i-mapa" className="size-5" /></span><span>{t("app.rep.mapa")}</span>
        </button>
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-2xl bg-white/70 p-3 text-sm text-texto">
        <Icono id={rep.ubic ? "i-check" : "i-pin"} className={rep.ubic ? "mt-0.5 size-4.5 text-n1" : "mt-0.5 size-4.5 text-gris"} /><span>{textoDonde(rep)}</span>
      </p>
      {rep.ubic ? (
        <>
          <Suspense fallback={<div className="mt-3 h-56 rounded-2xl ring-1 ring-regla"></div>}>
            <MiniMapa ubic={rep.ubic} visible={visible} />
          </Suspense>
          <p className="mt-2 text-[.85rem] text-gris">{t("app.wiz.mueve")}</p>
        </>
      ) : null}
    </>
  );
}

function Paso4() {
  const { t } = useI18n();
  const { fotos, descripcion } = useApp((s) => s.rep);
  const [leyendo, setLeyendo] = useState(false);
  const libres = MAX_FOTOS - fotos.length;
  /** Una o varias a la vez (la galería deja elegir varias); cada una se reduce antes de guardarla. */
  const agregar = async (lista: FileList | null) => {
    const archivos = Array.from(lista ?? []);
    if (!archivos.length) return;
    if (archivos.length > libres) toast(t("app.rep.fotos.tope", { n: MAX_FOTOS }));
    setLeyendo(true);
    try {
      for (const f of archivos.slice(0, Math.max(0, libres))) {
        try {
          const d = await reducirFoto(f);
          setRep((r) => ({ fotos: [...r.fotos, d].slice(0, MAX_FOTOS) }));
        } catch { toast(t("app.err.foto")); }
      }
    } finally { setLeyendo(false); }
  };
  const quitar = (i: number) => setRep((r) => ({ fotos: r.fotos.filter((_, j) => j !== i) }));
  const boton = "relative flex min-h-16 w-full cursor-pointer items-center gap-3 overflow-hidden rounded-2xl bg-white/80 px-4 font-semibold text-tinta ring-1 ring-regla focus-within:ring-4 focus-within:ring-tinta/25";
  return (
    <>
      <Titulo clave="app.wiz.p4" />
      <p className={K.ayuda}>{t("app.wiz.p4.ayuda")}</p>
      {fotos.length ? (
        <ul aria-label={t("app.rep.fotos.etq")} className="mt-4 grid grid-cols-3 gap-2">
          {fotos.map((f, i) => (
            <li key={i + "-" + f.length} className="relative">
              <img src={f} alt={t("app.rep.foto.alt_n", { n: i + 1 })} className="aspect-square w-full rounded-2xl bg-suelo object-cover" />
              <button type="button" onClick={() => quitar(i)} aria-label={t("app.rep.foto.quitar", { n: i + 1 })}
                className="absolute top-1.5 right-1.5 grid size-9 place-items-center rounded-full bg-papel text-texto shadow-flota active:scale-95">
                <Icono id="i-x" className="size-4.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {libres > 0 ? (
        <div className="mt-3 grid gap-2">
          {/* cámara directa (una foto) o galería (varias a la vez) */}
          <label className={boton}>
            <span className="grid size-10 place-items-center rounded-full bg-tinta-suave"><Icono id="i-camara" className={`size-5 ${leyendo ? "animate-pulse" : ""}`} /></span>
            <span className="flex-1">{t(leyendo ? "app.rep.fotos.leyendo" : fotos.length ? "app.rep.foto.otra" : "app.rep.foto.tomar")}</span>
            <input type="file" accept="image/*" capture="environment" disabled={leyendo} onChange={(e) => { void agregar(e.target.files); e.target.value = ""; }} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
          <label className={boton}>
            <span className="grid size-10 place-items-center rounded-full bg-tinta-suave"><Icono id="i-galeria" className="size-5" /></span>
            <span className="flex-1">{t("app.rep.foto.galeria")}</span>
            <input type="file" accept="image/*" multiple disabled={leyendo} onChange={(e) => { void agregar(e.target.files); e.target.value = ""; }} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-gris">{t("app.rep.fotos.nota", { n: MAX_FOTOS })}</p>
      <label htmlFor="descripcion" className="mt-5 mb-1.5 block text-sm font-semibold">{t("app.rep.detalles")}</label>
      <textarea id="descripcion" rows={3} maxLength={500} required aria-describedby="descripcion-nota" value={descripcion}
        onChange={(e) => setRep({ descripcion: e.target.value })} placeholder={t("app.rep.detalles.ph")}
        className="w-full resize-y rounded-2xl border border-regla bg-white/80 p-3.5 focus:border-tinta focus:bg-papel focus:ring-4 focus:ring-tinta/15 focus:outline-none"></textarea>
      <p id="descripcion-nota" className={`mt-1.5 text-xs ${descripcion && !textoConSentido(descripcion) ? "font-semibold text-texto" : "text-gris"}`}>{t("app.rep.detalles.nota")}</p>
    </>
  );
}

function Paso5() {
  const { t } = useI18n();
  const rep = useApp((s) => s.rep);
  const calle = rep.tipo === CALLE;
  const fila = (n: number, icono: string, etiqueta: string, valor: ReactNode) => (
    <div className="flex items-start gap-3 border-b border-regla py-3 last:border-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-tinta-suave text-tinta"><Icono id={icono} className="size-5" /></span>
      <div className="min-w-0 flex-1"><dt className="text-xs text-gris">{etiqueta}</dt><dd className="font-semibold leading-snug">{valor}</dd></div>
      <button type="button" onClick={() => irPaso(n, true)} className="shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold text-tinta hover:bg-tinta-suave">{t("app.wiz.cambiar")}</button>
    </div>
  );
  const detalle = rep.descripcion.trim();
  return (
    <>
      <Titulo clave="app.wiz.p5" />
      <p className={K.ayuda}>{t("app.wiz.p5.ayuda")}</p>
      {rep.tipo ? (
        <dl className="mt-4 rounded-2xl bg-white/80 px-4 ring-1 ring-regla">
          {fila(1, "t-" + rep.tipo, t("app.wiz.r.que"), etiquetaTipo({ tipo: rep.tipo }))}
          {calle && fila(2, "a-" + rep.altura, t("app.wiz.r.cuanta"), t("altura." + rep.altura + ".larga"))}
          {fila(3, "i-pin", t("app.wiz.r.donde"), textoDonde(rep))}
          {fila(4, "i-camara", t(rep.fotos.length > 1 ? "app.wiz.r.fotos" : "app.wiz.r.foto"), rep.fotos.length
            ? <span className="mt-1 flex gap-1.5">{rep.fotos.map((f, i) => <img key={i} src={f} alt={t("app.rep.foto.alt_n", { n: i + 1 })} className="size-16 rounded-xl object-cover" />)}</span>
            : t("app.wiz.sin_foto"))}
          {detalle ? fila(4, "t-otro", t("app.wiz.r.detalle"), detalle) : null}
        </dl>
      ) : <dl className="mt-4 rounded-2xl bg-white/80 px-4 ring-1 ring-regla"></dl>}
      <ComoSeEnvia />
      <label className="mt-4 flex items-start gap-3 text-[.85rem] leading-snug text-gris">
        <input type="checkbox" checked={rep.consent} onChange={(e) => setRep({ consent: e.target.checked })} className="mt-0.5 size-5 shrink-0" />
        <span><span>{t("app.rep.consent")}</span> <a href="#privacidad" className="font-semibold">{t("app.priv.ver")}</a></span>
      </label>
    </>
  );
}

/** La cuenta es opcional: sin cuenta el reporte va anónimo (y se ofrece entrar); con cuenta, el vecino elige. */
function ComoSeEnvia() {
  const { t } = useI18n();
  const cuenta = useApp((s) => s.cuenta);
  const anonimo = useApp((s) => s.rep.anonimo);
  if (!conCuenta(cuenta)) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/80 p-3.5 ring-1 ring-regla">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-tinta-suave text-tinta"><Icono id="i-usuario" className="size-5" /></span>
        <p className="min-w-0 flex-1 text-sm"><b>{t("app.rep.anon.titulo")}</b><br /><span className="text-gris">{t("app.rep.anon.texto")}</span></p>
        <button type="button" onClick={() => pedirCuenta("reportar")} className="shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold text-tinta hover:bg-tinta-suave">{t("app.rep.anon.entrar")}</button>
      </div>
    );
  }
  return (
    <div className="mt-4">
      <p id="como-envia" className="text-sm font-semibold">{t("app.rep.como")}</p>
      <div role="radiogroup" aria-labelledby="como-envia" className="mt-1.5 grid grid-cols-2 gap-1 rounded-2xl bg-suelo p-1">
        <button type="button" role="radio" aria-checked={!anonimo} onClick={() => setRep({ anonimo: false })} className={K.segmento}>
          {t("app.rep.con_cuenta", { nombre: primerNombre(cuenta.ciudadano) })}
        </button>
        <button type="button" role="radio" aria-checked={anonimo} onClick={() => setRep({ anonimo: true })} className={K.segmento}>{t("app.rep.anonimo")}</button>
      </div>
      <p className="mt-1.5 text-xs text-gris">{t(anonimo ? "app.rep.anonimo.nota" : "app.rep.con_cuenta.nota")}</p>
    </div>
  );
}

function Gracias() {
  const { t } = useI18n();
  const { okTexto, ultimo } = useApp((s) => s.rep);
  return (
    <>
      <span className="mx-auto grid size-20 place-items-center rounded-full bg-tinta text-white shadow-flota">
        <Icono id="i-check" className="size-10 [stroke-dasharray:1] [stroke-dashoffset:0] animate-dibujar" pathLength={1} />
      </span>
      <h2 tabIndex={-1} className={`mt-4 ${K.h2Paso}`}>{t("app.wiz.ok.titulo")}</h2>
      <p className="mx-auto mt-2 max-w-xs text-gris">{okTexto}</p>
      <div className="mt-5 grid gap-2">
        <button type="button" onClick={() => { store.set({ filtroMuro: "mios", destacado: ultimo?.id || null }); irA("muro"); }}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-tinta px-4 font-semibold text-white transition hover:bg-tinta-2 active:scale-[.98]">
          <Icono id="i-muro" className="size-5" /><span>{t("app.wiz.ok.ver_muro")}</span>
        </button>
        <button type="button" onClick={() => { if (ultimo) void verEnMapa([ultimo.lat, ultimo.lon], 17); else irA("mapa"); }} className={BTN_OK}>
          <Icono id="i-mapa" className="size-5" /><span>{t("app.wiz.ok.ver_mapa")}</span>
        </button>
        <button type="button" onClick={() => { reiniciarReporte(); irPaso(1, true); }} className={BTN_OK}>
          <Icono id="i-mas" className="size-5" /><span>{t("app.wiz.ok.otro")}</span>
        </button>
      </div>
    </>
  );
}
