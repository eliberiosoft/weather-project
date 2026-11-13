/* Análisis del superadmin (dashboard.ver): zonas con más reportes (mapa de calor), horas pico, lo que nadie atendió
   y la exportación a Excel. Los números los calcula la API (los mismos del Excel); aquí solo se dibujan.
   Gráficos sin librería (skill dataviz): una sola serie por gráfico, escala secuencial de un solo tono (azules del
   agua), tooltip en cada barra o celda y su tabla equivalente para lectores de pantalla. */
import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { api, mensajeError } from "../../shared/api/cliente";
import type { Analisis as DatosAnalisis } from "../../shared/api/tipos";
import { useI18n } from "../../shared/i18n/useI18n";
import { ErrorCarga } from "../../shared/ui/Carga";
import { EsqueletoBloque, Esperando } from "../../shared/ui/Esqueleto";
import { Icono } from "../../shared/ui/Icono";
import { K } from "../../shared/ui/clases";
import { toast } from "../../shared/ui/avisos";
import { descargarExcel, escalon, horasTexto, PERIODOS } from "./graficos";

const MapaCalor = lazy(() => import("./MapaCalor"));

/** clases de los 6 escalones (0 = sin reportes), escritas completas para Tailwind */
const CELDA = ["bg-suelo text-gris", "bg-[#c6dbef] text-texto", "bg-[#9ecae1] text-texto", "bg-[#6baed6] text-texto", "bg-[#2171b5] text-white", "bg-[#08306b] text-white"];

export function Analisis() {
  const { t, existe } = useI18n();
  const [dias, setDias] = useState(30);
  const [d, setD] = useState<DatosAnalisis | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [foco, setFoco] = useState<[number, number] | null>(null);
  const [bajando, setBajando] = useState(false);

  const cargar = useCallback(async (n: number) => {
    setError(null);
    try { setD(await api<DatosAnalisis>(`/api/panel/analisis?dias=${n}`)); } catch (e) { setError(e); }
  }, []);
  useEffect(() => { void cargar(dias); }, [cargar, dias]);

  async function exportar() {
    setBajando(true);
    try { await descargarExcel(dias); toast(t("panel.an.exportado"), 5000); }
    catch { toast(t("panel.an.exportar_error"), 7000); }
    finally { setBajando(false); }
  }

  const DIAS = t("panel.an.dias").split(",");
  return (
    <div className="grid gap-4">
      <section className={`${K.ficha} flex flex-wrap items-center gap-3`} aria-labelledby="an-titulo">
        <div className="min-w-0 flex-1">
          <h2 id="an-titulo" className={K.h2}>{t("panel.an.titulo")}</h2>
          <p className={K.ayuda}>{t("panel.an.explica")}</p>
        </div>
        <div role="radiogroup" aria-label={t("panel.an.periodo")} className="inline-flex rounded-xl bg-suelo p-1">
          {PERIODOS.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={dias === p} onClick={() => setDias(p)}
              className="min-h-10 rounded-lg px-3 text-sm font-semibold text-gris transition aria-checked:bg-tinta aria-checked:text-white">
              {t("panel.an.p_" + p)}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void exportar()} disabled={bajando || !d} className={K.btnChicoFuerte}>
          <Icono id="instalar" className="size-4.5" />{t(bajando ? "panel.an.exportando" : "panel.an.exportar")}
        </button>
      </section>

      {error && !d ? <ErrorCarga texto={mensajeError(error, t, existe)} reintentar={() => void cargar(dias)} />
        : !d ? <Esperando className="grid gap-4"><EsqueletoBloque className="h-28 rounded-ficha" /><EsqueletoBloque className="h-96 rounded-ficha" /></Esperando>
        : <>
          {d.limitado && <p className={K.nota}><Icono id="alerta" className="size-5 text-tinta" />{t("panel.an.limitado")}</p>}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Ficha titulo={t("panel.an.k_total")} valor={d.total} sub={t("panel.an.k_total_sub", { v: d.vecinos, e: d.equipo })} />
            <Ficha titulo={t("panel.an.k_sin")} valor={d.sin_atender.length} sub={t("panel.an.k_sin_sub")} />
            <Ficha titulo={t("panel.an.k_pico")} valor={d.pico.hora === null ? "—" : `${String(d.pico.hora).padStart(2, "0")}:00`}
              sub={d.pico.dia === null ? "" : t("panel.an.k_pico_sub", { dia: DIAS[d.pico.dia] ?? "", hora: `${String(d.pico.hora_dia).padStart(2, "0")}:00` })} />
            <Ficha titulo={t("panel.an.k_atencion")} valor={d.atencion.mediana_horas === null ? "—" : horasTexto(d.atencion.mediana_horas, t)}
              sub={t("panel.an.k_atencion_sub", { n: d.atencion.revisados })} />
          </div>

          <section className={K.ficha} aria-labelledby="an-calor">
            <h2 id="an-calor" className={K.h2}>{t("panel.an.calor")}</h2>
            <p className={`${K.ayuda} mb-3`}>{t("panel.an.calor_ayuda")}</p>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div>
                <Suspense fallback={<div className="grid h-80 place-items-center rounded-2xl bg-suelo text-sm text-gris lg:h-[28rem]">{t("panel.inc.mapa_cargando")}</div>}>
                  <MapaCalor puntos={d.puntos} foco={foco} />
                </Suspense>
                <div className="mt-2 flex items-center gap-2 text-xs text-gris" aria-hidden="true">
                  {t("panel.an.menos")}<span className="h-2.5 w-32 rounded-full bg-linear-to-r from-[#c6dbef] via-[#2171b5] to-[#08306b]" />{t("panel.an.mas")}
                </div>
              </div>
              <Zonas zonas={d.zonas} enfocar={setFoco} />
            </div>
          </section>

          <section className={K.ficha} aria-labelledby="an-horas">
            <h2 id="an-horas" className={K.h2}>{t("panel.an.horas")}</h2>
            <p className={`${K.ayuda} mb-4`}>{t("panel.an.horas_ayuda")}</p>
            <BarrasHora horas={d.horas} pico={d.pico.hora} />
            <h3 className="mt-6 mb-2 font-bold text-texto">{t("panel.an.semana")}</h3>
            <Grilla semana={d.semana} dias={DIAS} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <SinAtender items={d.sin_atender} />
            <PorTipo tipos={d.por_tipo} />
          </div>
        </>}
    </div>
  );
}

function Ficha({ titulo, valor, sub }: { titulo: string; valor: ReactNode; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-2 rounded-ficha bg-papel p-4 shadow-ficha">
      <p className="text-sm font-semibold text-gris">{titulo}</p>
      <p className="text-[1.9rem] leading-none font-bold tracking-tight text-texto tabular-nums">{valor}</p>
      {sub && <p className="text-xs text-gris">{sub}</p>}
    </div>
  );
}

function Zonas({ zonas, enfocar }: { zonas: DatosAnalisis["zonas"]; enfocar: (p: [number, number]) => void }) {
  const { t } = useI18n();
  const top = zonas.slice(0, 10);
  const max = Math.max(1, ...top.map((z) => z.n));
  return (
    <div>
      <h3 className="mb-2 font-bold text-texto">{t("panel.an.zonas")}</h3>
      {!top.length ? <p className={K.vacio}>{t("panel.an.sin_datos")}</p> : (
        <ol className="grid gap-1.5">
          {top.map((z, i) => (
            <li key={z.recinto ?? "-" + i}>
              <button type="button" onClick={() => enfocar([z.lat, z.lon])} className="w-full rounded-xl px-2 py-1.5 text-left transition hover:bg-suelo"
                aria-label={t("panel.an.zona_etq", { zona: z.recinto ?? t("panel.an.sin_recinto"), n: z.n, s: z.sin_atender })}>
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-semibold text-texto">{z.recinto ?? t("panel.an.sin_recinto")}</span>
                  <span className="shrink-0 font-bold text-texto tabular-nums">{z.n}</span>
                </span>
                <span className="mt-1 block h-2 rounded-full bg-suelo">
                  <span className="block h-2 rounded-full bg-tinta" style={{ width: `${(z.n / max) * 100}%` }} />
                </span>
                {z.sin_atender > 0 && <span className="mt-0.5 block text-xs text-gris">{t("panel.an.zona_sin", { n: z.sin_atender })}</span>}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** 24 barras (una sola serie): la hora pico en el tono más oscuro y con su valor escrito. */
function BarrasHora({ horas, pico }: { horas: number[]; pico: number | null }) {
  const { t } = useI18n();
  const max = Math.max(1, ...horas);
  return (
    <figure>
      <div className="flex h-44 items-end gap-[2px] border-b border-regla" aria-hidden="true">
        {horas.map((n, h) => (
          <div key={h} className="group relative flex h-full flex-1 items-end">
            <div className={`w-full rounded-t-[4px] transition ${h === pico ? "bg-[#08306b]" : "bg-[#6baed6] group-hover:bg-[#2171b5]"}`}
              style={{ height: `${n ? Math.max(3, (n / max) * 100) : 0}%` }} />
            {h === pico && n > 0 && <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 -translate-y-full text-xs font-bold text-texto tabular-nums">{n}</span>}
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-6 hidden -translate-x-1/2 rounded-lg bg-negro px-2 py-1 text-xs font-semibold whitespace-nowrap text-white group-hover:block">
              {t("panel.an.tip_hora", { h: String(h).padStart(2, "0"), n })}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex text-xs text-gris tabular-nums" aria-hidden="true">
        {horas.map((_, h) => <span key={h} className="flex-1 text-center">{h % 3 === 0 ? String(h).padStart(2, "0") : ""}</span>)}
      </div>
      <table className="sr-only">
        <caption>{t("panel.an.horas")}</caption>
        <thead><tr><th scope="col">{t("panel.an.hora")}</th><th scope="col">{t("panel.an.reportes")}</th></tr></thead>
        <tbody>{horas.map((n, h) => <tr key={h}><th scope="row">{String(h).padStart(2, "0")}:00</th><td>{n}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/** Día × hora (7 × 24) con escala secuencial de un solo tono. Se desplaza de lado solo si no cabe. */
function Grilla({ semana, dias }: { semana: number[][]; dias: string[] }) {
  const { t } = useI18n();
  const max = Math.max(0, ...semana.flat());
  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <table className="w-full min-w-[40rem] table-fixed border-separate border-spacing-[2px] text-xs">
          <caption className="sr-only">{t("panel.an.semana")}</caption>
          <thead>
            <tr><th scope="col" className="w-12" /><>{Array.from({ length: 24 }, (_, h) => (
              <th key={h} scope="col" className="font-medium text-gris tabular-nums">{h % 3 === 0 ? String(h).padStart(2, "0") : <span className="sr-only">{h}</span>}</th>
            ))}</></tr>
          </thead>
          <tbody>
            {semana.map((fila, di) => (
              <tr key={di}>
                <th scope="row" className="pr-1 text-left font-semibold text-gris capitalize">{(dias[di] ?? "").slice(0, 3)}</th>
                {fila.map((n, h) => (
                  <td key={h} title={t("panel.an.tip_celda", { dia: dias[di] ?? "", h: String(h).padStart(2, "0"), n })}
                    className={`h-6 rounded-[4px] text-center font-semibold tabular-nums ${CELDA[escalon(n, max)]}`}>
                    <span className="sr-only">{n}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-gris" aria-hidden="true">
        {t("panel.an.menos")}{CELDA.map((c, i) => <span key={i} className={`size-3.5 rounded-[3px] ${c}`} />)}{t("panel.an.mas")}
      </div>
    </div>
  );
}

function SinAtender({ items }: { items: DatosAnalisis["sin_atender"] }) {
  const { t, existe, hora } = useI18n();
  return (
    <section className={K.ficha} aria-labelledby="an-sin">
      <h2 id="an-sin" className={K.h2}>{t("panel.an.sin", { n: items.length })}</h2>
      <p className={`${K.ayuda} mb-2`}>{t("panel.an.sin_ayuda")}</p>
      {!items.length ? <p className={K.vacio}>{t("panel.an.sin_vacio")}</p> : (
        <ul className="max-h-[32rem] overflow-y-auto overscroll-contain">
          {items.map((x) => (
            <li key={x.id} className="flex items-start gap-3 border-b border-regla py-3 last:border-0">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${x.origen === "equipo" ? "bg-negro text-white" : "bg-tinta-suave text-tinta"}`}>
                <Icono id={"t-" + x.tipo} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-texto">
                  {existe("tipo." + x.tipo) ? t("tipo." + x.tipo) : x.etiqueta}
                  <span className={x.origen === "equipo" ? K.pildora.validado : K.pildora.pendiente}>{t(x.origen === "equipo" ? "panel.an.falta_resolver" : "panel.an.falta_revisar")}</span>
                  {x.vencido && <span className={K.pildora.apagado}>{t("panel.an.vencido")}</span>}
                </p>
                <p className={`${K.mini} mt-0.5`}>{[hora(x.creado), x.recinto].filter(Boolean).join(" · ")}</p>
                {x.descripcion && <p className="mt-1 line-clamp-2 text-sm break-words">{x.descripcion}</p>}
              </div>
              <p className="shrink-0 text-right">
                <span className="block text-lg leading-none font-bold text-texto tabular-nums">{horasTexto(x.horas, t)}</span>
                <span className="text-xs text-gris">{t("panel.an.esperando")}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PorTipo({ tipos }: { tipos: DatosAnalisis["por_tipo"] }) {
  const { t, existe } = useI18n();
  const max = Math.max(1, ...tipos.map((x) => x.n));
  return (
    <section className={K.ficha} aria-labelledby="an-tipos">
      <h2 id="an-tipos" className={K.h2}>{t("panel.an.tipos")}</h2>
      {!tipos.length ? <p className={K.vacio}>{t("panel.an.sin_datos")}</p> : (
        <ul className="mt-3 grid gap-2.5">
          {tipos.map((x) => (
            <li key={x.tipo}>
              <span className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-semibold text-texto">{existe("tipo." + x.tipo) ? t("tipo." + x.tipo) : x.etiqueta}</span>
                <span className="font-bold text-texto tabular-nums">{x.n}</span>
              </span>
              <span className="mt-1 block h-2 rounded-full bg-suelo"><span className="block h-2 rounded-full bg-tinta" style={{ width: `${(x.n / max) * 100}%` }} /></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
