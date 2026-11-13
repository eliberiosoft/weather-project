/* «Tormentas» (spec 020): dónde están las nubes de tormenta y los rayos alrededor del cantón, con las últimas 2 h
   en animación. Es satélite, no radar, y no es un nivel de alerta: la vista lo dice sin rodeos. */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { EsqueletoBloque, EsqueletoLineas } from "../../shared/componentes/Esqueleto";
import { ErrorCarga } from "../../shared/componentes/ErrorCarga";
import { Html } from "../../shared/componentes/Html";
import { Icono } from "../../shared/componentes/Icono";
import { Vista } from "../../shared/componentes/Vista";
import { K, NEGRO, TINTA } from "../../shared/estilo";
import { hace, horaCorta } from "../../shared/formato";
import { useI18n } from "../../shared/i18n";
import { useApp } from "../../shared/store";
import { useVistaTormentas } from "./datos";
import { MapaTormentas } from "./MapaTormentas";
import { horaSatelite, tendencia, textoLluvia, textoRayos, titular, urlMarco } from "./texto";
import type { Tormentas as DatosTormentas, Marco } from "./tipos";

const PASO_MS = 700;
const PAUSA_FINAL_MS = 1600;

export default function Tormentas() {
  const { t } = useI18n();
  const activa = useApp((s) => s.vista === "tormentas");
  const { datos, carga, reintentar } = useVistaTormentas(activa);
  return (
    <Vista id="tormentas" etiqueta="app.torm.titulo" className={`${K.vista} lg:max-w-3xl`}>
      <h1 className={K.h1}>{t("app.torm.titulo")}</h1>
      <p className="mt-1 text-sm text-pretty text-gris">{t("app.torm.bajada")}</p>
      {datos ? <Contenido datos={datos} activa={activa} />
        : carga === "error" ? <ErrorCarga className="mt-4" onReintentar={reintentar} />
        : <Esqueleto />}
    </Vista>
  );
}

function Esqueleto() {
  const { t } = useI18n();
  return (
    <div aria-busy="true" className="mt-4 flex flex-col gap-3">
      <span className="sr-only">{t("app.carga.etq")}</span>
      <div className={K.ficha}><EsqueletoLineas n={3} /></div>
      <EsqueletoBloque className="h-[min(62vh,26rem)] rounded-ficha" />
    </div>
  );
}

function Contenido({ datos, activa }: { datos: DatosTormentas; activa: boolean }) {
  const { t } = useI18n();
  const { marcos } = datos.mosaico;
  const { indice, setIndice, reproduciendo, alternar, preparando } = useAnimacion(marcos, activa);
  return (
    <div className="mt-4 flex flex-col gap-3">
      <Aviso datos={datos} />
      <MapaTormentas datos={datos} indice={indice} activa={activa} />
      {marcos.length ? (
        <Controles marcos={marcos} faltan={datos.mosaico.preparando} indice={indice} setIndice={setIndice} reproduciendo={reproduciendo} alternar={alternar} preparando={preparando} />
      ) : <p className={`${K.ficha} text-sm`}>{t("app.torm.sin_satelite")}</p>}
      <Leyenda datos={datos} />
      <QueEs />
    </div>
  );
}

function Aviso({ datos }: { datos: DatosTormentas }) {
  const { t } = useI18n();
  const { cerca, rayos, lluvia } = datos;
  const tend = tendencia(cerca);
  return (
    <section aria-labelledby="torm-aviso" className={K.ficha}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-tinta-suave text-tinta"><Icono id="i-tormenta" className="size-6" /></span>
        <div className="min-w-0">
          <h2 id="torm-aviso" className="text-lg leading-snug font-bold text-balance">{titular(cerca)}</h2>
          {tend ? <p className="mt-0.5 text-sm font-semibold text-tinta">{tend}</p> : null}
          {cerca ? <p className="mt-0.5 text-xs text-gris">{horaSatelite(cerca, horaCorta)}</p> : null}
        </div>
      </div>
      <dl className="mt-3">
        <div className={K.dato}><dt className="flex items-center gap-2 text-gris"><Icono id="i-rayo" className="size-4.5" />{t("app.torm.rayos.etq")}</dt><dd className="text-right font-semibold">{textoRayos(rayos)}</dd></div>
        <div className={K.dato}><dt className="flex items-center gap-2 text-gris"><Icono id="i-lluvia" className="size-4.5" />{t("app.torm.lluvia.etq")}</dt><dd className="text-right font-semibold">{textoLluvia(lluvia)}</dd></div>
      </dl>
      <p className={K.nota}>{t("app.torm.no_es_nivel")}</p>
    </section>
  );
}

function Controles({ marcos, faltan, indice, setIndice, reproduciendo, alternar, preparando }: {
  marcos: Marco[]; faltan: number; indice: number; setIndice: (i: number) => void; reproduciendo: boolean; alternar: () => void; preparando: boolean;
}) {
  const { t } = useI18n();
  const m = marcos[indice] ?? marcos[marcos.length - 1]!;
  const etiqueta = t("app.torm.hora", { hora: horaCorta(m.t), hace: hace(m.t) });
  return (
    <div className={`${K.ficha} flex items-center gap-3 py-3`}>
      <button type="button" onClick={alternar} disabled={preparando || marcos.length < 2} aria-pressed={reproduciendo}
        aria-label={t(reproduciendo ? "app.torm.pausa" : "app.torm.play")} title={t(reproduciendo ? "app.torm.pausa" : "app.torm.play")}
        className="grid size-12 shrink-0 place-items-center rounded-full bg-tinta text-white active:scale-95 disabled:opacity-60">
        <Icono id={reproduciendo ? "i-pausa" : "i-play"} className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p aria-live="polite" className="text-sm font-semibold">{preparando ? t("app.torm.preparando") : etiqueta}</p>
        <input type="range" min={0} max={marcos.length - 1} step={1} value={indice} aria-label={t("app.torm.linea")} aria-valuetext={etiqueta}
          onChange={(e) => setIndice(Number(e.target.value))} className="mt-1 h-8 w-full cursor-pointer accent-tinta" />
        <div className="flex justify-between text-xs text-gris"><span>{t("app.torm.hace2h")}</span><span>{t("app.torm.ahora")}</span></div>
        {faltan ? <p className="mt-1 text-xs text-gris">{t("app.torm.armando", { n: faltan })}</p> : null}
      </div>
    </div>
  );
}

function Leyenda({ datos }: { datos: DatosTormentas }) {
  const { t } = useI18n();
  const caja = (estilo: CSSProperties) => <i aria-hidden="true" className="inline-block h-4 w-6 shrink-0 rounded-md ring-1 ring-negro/15" style={estilo}></i>;
  const fila = (sw: ReactNode, txt: string, meta: string | null, k: string | number) => (
    <li key={k} className="flex items-center gap-3 py-1.5">{sw}<span className="flex-1 text-sm">{txt}</span>{meta ? <span className="text-xs text-gris">{meta}</span> : null}</li>
  );
  return (
    <section aria-labelledby="torm-leyenda" className={K.ficha}>
      <h2 id="torm-leyenda" className="text-lg font-bold">{t("app.torm.leyenda")}</h2>
      <ul className="mt-2">
        {datos.mosaico.clases.map((c) => fila(caja({ background: c.color, opacity: Math.max(0.55, c.alfa / 255) }), t("app.torm.clase." + c.c), t("app.torm.clase.temp", { t: c.desde }), c.c))}
        {fila(<i aria-hidden="true" className="mx-1.5 inline-block size-3 shrink-0 rounded-full ring-2 ring-white" style={{ background: NEGRO, boxShadow: `0 0 0 3px ${NEGRO}33` }}></i>, t("app.torm.ley.rayo"), null, "r")}
        {datos.movimiento?.flechas.length ? fila(<Icono id="i-adelante" className="size-6 shrink-0 -rotate-45 text-negro" />, t("app.torm.ley.flecha"), null, "f") : null}
        {fila(<i aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-tinta text-white ring-2 ring-white"><Icono id="i-casa" className="size-3.5" /></i>, t("app.torm.ley.lugar"), null, "y")}
        {fila(<i aria-hidden="true" className="inline-block w-6 shrink-0" style={{ borderTop: `2px dashed ${TINTA}` }}></i>, t("app.torm.ley.radio", { a: datos.radios.encima, b: datos.radios.cerca, c: datos.radios.lejos }), null, "c")}
        {fila(<i aria-hidden="true" className="inline-block w-6 shrink-0" style={{ borderTop: `3px solid ${TINTA}` }}></i>, t("app.torm.ley.canton"), null, "l")}
      </ul>
    </section>
  );
}

function QueEs() {
  const { t } = useI18n();
  return (
    <section aria-labelledby="torm-que" className={`${K.ficha} mb-2`}>
      <h2 id="torm-que" className="text-lg font-bold">{t("app.torm.que.t")}</h2>
      <Html como="div" clave="app.torm.que.c" className="mt-2 text-sm leading-relaxed text-pretty [&_b]:font-semibold [&_li]:mt-1.5 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5" />
    </section>
  );
}

/** Reproducir las últimas 2 h: antes baja las imágenes (son livianas: casi todo transparente) para que no parpadee;
    se detiene al salir de la vista. Con datos nuevos y sin reproducir, vuelve a la más reciente. */
function useAnimacion(marcos: Marco[], activa: boolean) {
  const ultimo = Math.max(0, marcos.length - 1);
  const [indice, setIndice] = useState(ultimo);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const listas = useRef(new Set<string>());
  const clave = marcos.map((m) => m.id).join(",");

  // datos nuevos: se vuelve a la imagen más reciente (si no se está reproduciendo)
  const [claveVista, setClaveVista] = useState(clave);
  if (clave !== claveVista) { setClaveVista(clave); if (!reproduciendo) setIndice(ultimo); }
  // al salir de la vista se detiene
  if (!activa && reproduciendo) setReproduciendo(false);

  useEffect(() => {
    if (!reproduciendo) return;
    const h = setTimeout(() => setIndice((i) => (i >= ultimo ? 0 : i + 1)), indice >= ultimo ? PAUSA_FINAL_MS : PASO_MS);
    return () => clearTimeout(h);
  }, [reproduciendo, indice, ultimo]);

  const alternar = () => {
    if (reproduciendo) { setReproduciendo(false); return; }
    const faltan = marcos.filter((m) => !listas.current.has(m.id));
    if (!faltan.length) { setReproduciendo(true); return; }
    setPreparando(true);
    void Promise.all(faltan.map((m) => new Promise<void>((ok) => {
      const img = new Image();
      img.onload = img.onerror = () => { listas.current.add(m.id); ok(); };
      img.src = urlMarco(m.id);
    }))).then(() => { setPreparando(false); setReproduciendo(true); });
  };
  return { indice: Math.min(indice, ultimo), setIndice: (i: number) => { setReproduciendo(false); setIndice(i); }, reproduciendo, alternar, preparando };
}
