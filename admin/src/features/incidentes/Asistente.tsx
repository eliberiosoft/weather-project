/* «Publicar un incidente del equipo» como asistente paso a paso, igual que «Reportar» en la app ciudadana:
   qué pasa → cuánta agua / qué tan grave → dónde → detalles y foto → revisar y publicar.
   - Cada paso entra desde el lado hacia el que se avanza; en los pasos 1 y 2 elegir una opción ya avanza.
   - El mapa se monta desde el inicio (oculto): el GPS se pide al entrar y en «Dónde» ya está centrado en el teléfono.
   - Sin señal, el incidente queda guardado en el equipo y se publica solo (cola.ts); el final lo dice. */
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { api, mensajeError } from "../../shared/api/cliente";
import type { RespuestaMe, Usuario } from "../../shared/api/tipos";
import { useI18n } from "../../shared/i18n/useI18n";
import { Icono } from "../../shared/ui/Icono";
import { K } from "../../shared/ui/clases";
import { toast } from "../../shared/ui/avisos";
import { usePanelDatos } from "../datos/PanelDatos";
import { encolar, guardado, MAX_COLA, sinConexion } from "./cola";
import { reducirFoto } from "./foto";
import { cuerpoIncidente, esCalle, formVacio, HORAS_TIPO, MAX_DESCRIPCION, PASOS, pasoListo, TIPOS, validarIncidente, type FormIncidente } from "./formulario";
import type { Eleccion } from "./MapaUbicacion";

const MapaUbicacion = lazy(() => import("./MapaUbicacion"));

/** Opción grande del asistente (tipo, altura, gravedad): seleccionada en tinta. */
const ELECCION = "flex min-h-22 flex-col items-center justify-center gap-1.5 rounded-2xl bg-suelo px-1.5 py-2.5 text-center text-xs leading-tight font-semibold text-texto transition hover:bg-tinta-suave active:scale-[.98] aria-checked:bg-tinta aria-checked:text-white";
const pausa = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260);

/** ¿Cómo saldrá lo que publique? (anónimo o con nombre; validado o pendiente). Lo dice /api/auth/me para cualquier
    rol; null mientras carga o si falla. */
function usePublicacion(usuario: Usuario): RespuestaMe["publicacion"] | null {
  const [pub, setPub] = useState<RespuestaMe["publicacion"] | null>(null);
  useEffect(() => {
    let vivo = true;
    api<RespuestaMe>("/api/auth/me")
      .then((r) => vivo && setPub(r.publicacion ?? null))
      .catch(() => vivo && setPub(null));
    return () => { vivo = false; };
  }, [usuario.id]);
  return pub;
}

type Paso = number | "ok";

export function AsistenteIncidente({ usuario, alPublicar, irALista }: { usuario: Usuario; alPublicar: () => Promise<void>; irALista: () => void }) {
  const { t, existe } = useI18n();
  const { recargarEstado } = usePanelDatos();
  const pub = usePublicacion(usuario);
  const anonimo = pub ? !!pub.incidentes_anonimos : null;
  // el operador puede publicar «pendiente» si el superadmin así lo configuró
  const pendiente = pub?.validado_directo === false;
  const [f, setF] = useState<FormIncidente>(formVacio);
  const [paso, setPaso] = useState<Paso>(1);
  const [atras, setAtras] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [deGps, setDeGps] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [final, setFinal] = useState<{ guardadoSinSenal: boolean; texto: string } | null>(null);
  const [rondaGps, setRondaGps] = useState(0);   // «Publicar otro»: el mapa vuelve a proponer la ubicación del teléfono
  const caja = useRef<HTMLDivElement>(null);
  const primera = useRef(true);
  const enviandoRef = useRef(false);
  const poner = (p: Partial<FormIncidente>) => setF((x) => ({ ...x, ...p }));
  const calle = esCalle(f);
  const ir = (p: Paso, haciaAtras = false) => { setAtras(haciaAtras); setPaso(p); };

  // al cambiar de paso: animación de entrada, foco en el título y la ficha a la vista
  useLayoutEffect(() => {
    const sec = caja.current?.querySelector<HTMLElement>(`[data-paso="${paso}"]`);
    if (!sec) return;
    sec.classList.remove("animate-paso", "animate-paso-atras");
    void sec.offsetWidth;
    sec.classList.add(atras ? "animate-paso-atras" : "animate-paso");
    if (primera.current) { primera.current = false; return; }
    sec.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
    const arriba = caja.current?.closest("form")?.getBoundingClientRect().top ?? 0;
    if (arriba < 64) window.scrollBy({ top: arriba - 80, behavior: pausa() ? "smooth" : "auto" });
  }, [paso, atras]);

  /** Al elegir una opción se pasa solo al siguiente paso, con una pausa corta para ver la selección. */
  const avanzarSolo = (desde: number) => setTimeout(() => setPaso((p) => { if (p === desde) { setAtras(false); return desde + 1; } return p; }), pausa());

  function elegirTipo(tipo: string) {
    // la vigencia vuelve al valor del tipo; el tramo y la altura solo tienen sentido para calles
    setF((x) => ({ ...x, tipo, horas: String(HORAS_TIPO[tipo] ?? ""), ...(tipo === "calle_inundada" ? {} : { tramo: null, altura: null }) }));
    avanzarSolo(1);
  }

  const alElegir = useCallback((e: Eleccion) => {
    setF((x) => ({ ...x, lat: e.lat, lon: e.lon, dentro: e.dentro, tramo: e.tramo, via: e.via ?? x.via }));
    setDeGps(!!e.gps);
    setAviso(!e.dentro ? "panel.inc.fuera" : e.sinCalle ? "panel.inc.sin_calle" : null);
  }, []);

  async function elegirFoto(ev: ChangeEvent<HTMLInputElement>) {
    const archivo = ev.target.files?.[0];
    ev.target.value = "";
    if (!archivo) return;
    try { poner({ foto: await reducirFoto(archivo) }); } catch { toast(t("panel.inc.foto_error")); }
  }

  /** Publica; sin señal lo guarda en el equipo. Un segundo toque mientras tanto no hace nada (no sale dos veces). */
  async function publicar() {
    if (enviandoRef.current) return;
    const falta = validarIncidente(f);
    if (falta) { toast(t(falta)); return; }
    enviandoRef.current = true;
    setEnviando(true);
    const cuerpo = cuerpoIncidente(f);
    try {
      const r = await api<{ id: string; estado?: string }>("/api/panel/incidentes", cuerpo);
      setFinal({ guardadoSinSenal: false, texto: t(r.estado === "pendiente" ? "panel.inc.publicado_pendiente" : "panel.inc.publicado") });
      ir("ok");
      void alPublicar();
      recargarEstado(true).catch(() => {});
    } catch (e) {
      if (!sinConexion(e)) { toast(mensajeError(e, t, existe), 7000); return; }
      const r = encolar(usuario.id, cuerpo);
      if (!guardado(r)) { toast(t(r === "repetido" ? "panel.cola.repetido" : r === "tope" ? "panel.cola.tope" : "panel.cola.llena", { n: MAX_COLA }), 8000); return; }
      setFinal({ guardadoSinSenal: true, texto: t(r === "ok" ? "panel.cola.guardado" : "panel.cola.guardado_sin_foto") });
      ir("ok");
    } finally { enviandoRef.current = false; setEnviando(false); }
  }

  function otro() {
    setF(formVacio()); setAviso(null); setDeGps(false); setFinal(null);
    setRondaGps((x) => x + 1);
    ir(1, true);
  }

  const ok = paso === "ok";
  const n = typeof paso === "number" ? paso : PASOS;
  const listo = !ok && pasoListo(f, n);
  // en los pasos 1 y 2 elegir una opción ya avanza; el botón solo aparece al volver a un paso ya respondido
  const ocultarBoton = ok || ((n === 1 || n === 2) && !listo);
  const siguiente = () => { if (!listo) return; if (n < PASOS) ir(n + 1); else void publicar(); };
  const firma = anonimo === null ? t("panel.inc.firma_desconocida")
    : anonimo ? t("panel.inc.firma_anonimo") : t("panel.inc.firma_nombre", { nombre: usuario.nombre, rol: t("rol." + usuario.rol) });

  return (
    <form onSubmit={(e) => { e.preventDefault(); siguiente(); }} noValidate className={K.ficha} aria-labelledby="inc-titulo">
      <div className="flex items-center gap-3">
        <button type="button" hidden={ok || n === 1} onClick={() => ir(n - 1, true)} aria-label={t("panel.wiz.atras")} title={t("panel.wiz.atras")}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-suelo text-tinta transition active:scale-95">
          <Icono id="atras" className="size-5" />
        </button>
        <h2 id="inc-titulo" className={K.h2}>{t("panel.inc.titulo")}</h2>
        <span className="ml-auto shrink-0 text-sm font-semibold text-gris">{ok ? "" : t("panel.wiz.paso", { n, total: PASOS })}</span>
      </div>
      <ol aria-hidden="true" className="mt-3 grid list-none grid-cols-5 gap-1.5 p-0">
        {[1, 2, 3, 4, 5].map((i) => <li key={i} className={`h-1.5 rounded-full transition-colors duration-300 ${ok || i <= n ? "bg-tinta" : "bg-suelo"}`} />)}
      </ol>
      {n === 1 && !ok && <p className="mt-3 text-sm text-gris">{t("panel.inc.explica")}</p>}

      <div ref={caja} className="mt-4">
        <PasoUI n={1} actual={paso} titulo={t("panel.inc.tipo")} ayuda={t("panel.wiz.p1_ayuda")}>
          <div role="radiogroup" aria-label={t("panel.inc.tipo")} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {TIPOS.map((x) => (
              <button key={x} type="button" role="radio" aria-checked={f.tipo === x} onClick={() => elegirTipo(x)} className={ELECCION}>
                <Icono id={"t-" + x} className="size-6" /><span className="text-balance">{t("tipo." + x)}</span>
              </button>
            ))}
          </div>
        </PasoUI>

        <PasoUI n={2} actual={paso} titulo={t(calle ? "panel.inc.altura" : "panel.inc.gravedad")} ayuda={t(calle ? "panel.inc.altura_explica" : "panel.wiz.p2_ayuda")}>
          {calle ? (
            <div role="radiogroup" aria-label={t("panel.inc.altura")} className="grid gap-2">
              {([1, 2, 3] as const).map((a) => (
                <button key={a} type="button" role="radio" aria-checked={f.altura === a} onClick={() => { poner({ altura: a }); avanzarSolo(2); }}
                  className="flex min-h-14 items-center gap-3 rounded-2xl bg-suelo px-4 text-left text-sm font-semibold text-texto transition hover:bg-tinta-suave active:scale-[.98] aria-checked:bg-tinta aria-checked:text-white">
                  <span className={`h-2.5 w-10 shrink-0 rounded-full ring-2 ring-white ${a === 1 ? "bg-a1" : a === 2 ? "bg-a2" : "bg-a3"}`} aria-hidden="true" />
                  {t(`altura.${a}.larga`)}
                </button>
              ))}
            </div>
          ) : (
            <div role="radiogroup" aria-label={t("panel.inc.gravedad")} className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((g) => (
                <button key={g} type="button" role="radio" aria-checked={f.gravedad === g} onClick={() => { poner({ gravedad: g }); avanzarSolo(2); }}
                  className={`${ELECCION} min-h-16 text-sm`}>{t("gravedad." + g)}</button>
              ))}
            </div>
          )}
        </PasoUI>

        {/* el mapa queda montado en todos los pasos: el GPS ya está listo al llegar a «Dónde» */}
        <PasoUI n={3} actual={paso} titulo={t("panel.inc.ubicacion")} ayuda={t(calle ? "panel.inc.ubicacion_ayuda_calle" : "panel.inc.ubicacion_ayuda")} montado>
          <Suspense fallback={<div className="grid h-80 place-items-center rounded-2xl bg-suelo text-sm text-gris lg:h-96">{t("panel.inc.mapa_cargando")}</div>}>
            <MapaUbicacion modoCalle={calle} altura={f.altura} punto={f.lat !== null && f.lon !== null ? [f.lat, f.lon] : null} tramo={f.tramo} alElegir={alElegir} rondaGps={rondaGps} />
          </Suspense>
          <p role="status" className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-texto empty:hidden">
            {f.lat !== null && f.lon !== null && <>
              <Icono id={deGps ? "gps" : "pin"} className="mt-0.5 size-4.5 shrink-0 text-tinta" />
              <span>{textoDonde(f, deGps, t)}</span>
            </>}
          </p>
          {aviso && <p role="alert" className={`${K.nota} mt-2`}><Icono id="alerta" className="size-5 text-tinta" />{t(aviso)}</p>}
        </PasoUI>

        <PasoUI n={4} actual={paso} titulo={t("panel.inc.detalles")} ayuda={t("panel.wiz.p4_ayuda")}>
          <label htmlFor="inc-desc" className={K.etiqueta}>{t("panel.inc.descripcion")}</label>
          <textarea id="inc-desc" rows={4} maxLength={MAX_DESCRIPCION} value={f.descripcion} onChange={(e) => poner({ descripcion: e.target.value })}
            placeholder={t("panel.inc.descripcion_ph")} className={`${K.campo} resize-y`} />
          {calle && (
            <>
              <label htmlFor="inc-via" className={`mt-4 ${K.etiqueta}`}>{t("panel.inc.via")}</label>
              <input id="inc-via" value={f.via} maxLength={120} onChange={(e) => poner({ via: e.target.value })} placeholder={t("panel.inc.via_ph")} className={K.campo} />
            </>
          )}
          <div className="mt-4 grid gap-x-3 sm:grid-cols-[10rem_1fr]">
            <label htmlFor="inc-horas" className={`${K.etiqueta} sm:col-span-2`}>{t("panel.inc.horas")}</label>
            <input id="inc-horas" type="number" min={1} max={168} inputMode="numeric" value={f.horas} onChange={(e) => poner({ horas: e.target.value })}
              aria-describedby="inc-horas-ayuda" className={`${K.campo} tabular-nums`} />
            <p id="inc-horas-ayuda" className={`${K.mini} mt-1.5 sm:mt-0 sm:self-center`}>{t("panel.inc.horas_ayuda")}</p>
          </div>
          <p className={`mt-5 ${K.etiqueta}`}>{t("panel.inc.foto")}</p>
          <div className="flex flex-wrap items-center gap-3">
            {f.foto && <img src={f.foto} alt={t("panel.inc.foto_alt")} className="h-24 w-auto max-w-40 rounded-xl object-cover" />}
            <label className={`${K.btnChico} cursor-pointer has-focus-visible:ring-4 has-focus-visible:ring-tinta/25`}>
              <Icono id="foto" className="size-4.5" />{t(f.foto ? "panel.inc.foto_cambiar" : "panel.inc.foto_elegir")}
              <input type="file" accept="image/*" onChange={elegirFoto} className="sr-only" />
            </label>
            {f.foto && <button type="button" onClick={() => poner({ foto: null })} className={K.btnNeutro}>{t("panel.inc.foto_quitar")}</button>}
          </div>
          <p className={`${K.mini} mt-1.5`}>{t("panel.inc.foto_ayuda")}</p>
        </PasoUI>

        <PasoUI n={5} actual={paso} titulo={t("panel.wiz.p5")} ayuda={t("panel.wiz.p5_ayuda")}>
          {f.tipo && (
            <dl className="rounded-2xl bg-suelo px-4">
              <Fila icono={"t-" + f.tipo} etiqueta={t("panel.wiz.r_que")} cambiar={() => ir(1, true)}>{t("tipo." + f.tipo)}</Fila>
              <Fila icono="alerta" etiqueta={t(calle ? "panel.inc.altura" : "panel.inc.gravedad")} cambiar={() => ir(2, true)}>
                {calle ? (f.altura ? t(`altura.${f.altura}.larga`) : "—") : t("gravedad." + f.gravedad)}
              </Fila>
              <Fila icono="pin" etiqueta={t("panel.wiz.r_donde")} cambiar={() => ir(3, true)}>{f.lat !== null ? textoDonde(f, deGps, t, false) : "—"}</Fila>
              <Fila icono="t-otro" etiqueta={t("panel.wiz.r_detalle")} cambiar={() => ir(4, true)}>
                <span className="line-clamp-3 break-words">{f.descripcion.trim()}</span>
                <span className={`${K.mini} block`}>{t("panel.wiz.r_visible", { h: f.horas || HORAS_TIPO[f.tipo] || "" })}</span>
              </Fila>
              <Fila icono="foto" etiqueta={t("panel.inc.foto")} cambiar={() => ir(4, true)}>
                {f.foto ? <img src={f.foto} alt={t("panel.inc.foto_alt")} className="mt-1 h-16 rounded-xl" /> : t("panel.wiz.sin_foto")}
              </Fila>
            </dl>
          )}
          <p className={`${K.nota} mt-4 font-normal`}><Icono id="usuario" className="mt-0.5 size-5 text-tinta" />{firma}</p>
          {pendiente && <p className={`${K.nota} mt-2 font-normal`}><Icono id="alerta" className="mt-0.5 size-5 text-tinta" />{t("panel.inc.pendiente_aviso")}</p>}
        </PasoUI>

        <section data-paso="ok" hidden={!ok} className="py-2 text-center">
          <span className={`mx-auto grid size-20 place-items-center rounded-full shadow-flota ${final?.guardadoSinSenal ? "bg-negro" : "bg-tinta"} text-white`}>
            <Icono id={final?.guardadoSinSenal ? "nube" : "check"} className="size-10" />
          </span>
          <h3 tabIndex={-1} className="mt-4 text-xl font-bold text-texto">{t(final?.guardadoSinSenal ? "panel.wiz.ok_guardado" : "panel.wiz.ok_titulo")}</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gris">{final?.texto}</p>
          <div className="mx-auto mt-5 grid max-w-sm gap-2">
            <button type="button" onClick={otro} className={K.btnPrimario}><Icono id="mas" className="size-5" />{t("panel.wiz.ok_otro")}</button>
            <button type="button" onClick={irALista} className={K.btnSecundario}>{t("panel.wiz.ok_lista")}</button>
          </div>
        </section>
      </div>

      <button type="submit" hidden={ocultarBoton} disabled={!listo || enviando}
        className="mt-4 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-tinta px-4 text-base font-semibold text-white transition hover:bg-tinta-2 active:scale-[.98] disabled:cursor-not-allowed disabled:bg-suelo disabled:text-gris">
        {t(n === PASOS ? (enviando ? "panel.inc.publicando" : "panel.inc.publicar") : "panel.wiz.siguiente")}
        {n < PASOS && <Icono id="adelante" className="size-5" />}
      </button>
    </form>
  );
}

/** Bajo el mapa, `ayuda` explica cómo corregir; en la revisión va corto, con las coordenadas. */
function textoDonde(f: FormIncidente, deGps: boolean, t: (k: string, v?: Record<string, string | number>) => string, ayuda = true): string {
  if (f.lat === null || f.lon === null) return "";
  const c = { lat: f.lat.toFixed(5), lon: f.lon.toFixed(5) };
  const base = deGps ? t(ayuda ? "panel.inc.ubicacion_gps" : "panel.wiz.r_gps", c) : t("panel.inc.ubicacion_elegida", c);
  return f.tramo ? `${base} · ${t("panel.inc.tramo", { via: f.via || t("panel.inc.calle_sin_nombre") })}` : base;
}

/** Un paso: solo el actual se ve. `montado`: el contenido se queda aunque no se vea (el mapa y su GPS). */
function PasoUI({ n, actual, titulo, ayuda, montado = false, children }: {
  n: number; actual: Paso; titulo: string; ayuda?: string; montado?: boolean; children: ReactNode;
}) {
  const visible = n === actual;
  if (!visible && !montado) return null;
  return (
    <section data-paso={n} hidden={!visible}>
      <h3 tabIndex={-1} className="text-xl leading-tight font-bold text-texto outline-none">{titulo}</h3>
      {ayuda && <p className="mt-1 mb-4 text-sm text-gris">{ayuda}</p>}
      {children}
    </section>
  );
}

function Fila({ icono, etiqueta, cambiar, children }: { icono: string; etiqueta: string; cambiar: () => void; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex items-start gap-3 border-b border-regla py-3 last:border-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-papel text-tinta"><Icono id={icono} className="size-5" /></span>
      <div className="min-w-0 flex-1"><dt className="text-xs text-gris">{etiqueta}</dt><dd className="text-sm font-semibold leading-snug">{children}</dd></div>
      <button type="button" onClick={cambiar} className="shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold text-tinta hover:bg-papel">{t("panel.wiz.cambiar")}</button>
    </div>
  );
}
