/* Pestaña «Dispositivos» (solo superadmin, permiso alcance.detalle; la API lo verifica y cada consulta queda en la
   auditoría): los teléfonos que usan la app ciudadana y los que tienen las notificaciones activas.
   Cada teléfono es un código fijo («7F3A2C», de la firma cifrada): el mismo en todas las listas del panel, sin su id,
   su número ni el nombre de nadie. El tipo de teléfono es aproximado (sistema y navegador). */
import { useCallback, useEffect, useState } from "react";
import { api, mensajeError } from "../../shared/api/cliente";
import { useI18n } from "../../shared/i18n/useI18n";
import { ErrorCarga } from "../../shared/ui/Carga";
import { EsqueletoBloque, EsqueletoLinea, Esperando } from "../../shared/ui/Esqueleto";
import { Icono } from "../../shared/ui/Icono";
import { K } from "../../shared/ui/clases";

export type Periodo = "hoy" | "7d" | "30d" | "todos";
const PERIODOS: Periodo[] = ["hoy", "7d", "30d", "todos"];

export interface Telefono {
  codigo: string; plataforma: string | null; instalada: boolean | null; idioma: string | null; version: string | null;
  /** marca (nunca el modelo), versión mayor del sistema y formato: los manda la app al avisar su uso */
  marca?: string | null; so_version?: number | null; formato?: "telefono" | "tablet" | "computadora" | null;
  notificaciones: boolean; recinto: string | null; alta: string; ultimo_uso: string; dias: number | null;
}
interface Resumen {
  total: number; hoy: number; semana: number; mes: number; con_notificaciones: number; instaladas: number;
  marcas: { marca: string; n: number }[]; formatos: Record<string, number>;
}
interface Respuesta { resumen: Resumen; dispositivos: Telefono[]; total: number; pagina: number; paginas: number }

const POR_PAGINA = 25;

/** Ruta de una página con sus filtros (la API filtra y pagina). Pura: se prueba sola. */
export function rutaDispositivos(periodo: Periodo, pagina: number, soloPush: boolean, codigo: string): string {
  const p = new URLSearchParams({ periodo, pagina: String(pagina), n: String(POR_PAGINA) });
  if (soloPush) p.set("push", "1");
  const c = codigo.trim().toUpperCase().replace(/[^0-9A-F]/g, "");
  if (c) p.set("codigo", c);
  return `/api/panel/dispositivos?${p}`;
}

/** «Samsung · Android 14» arriba y «Chrome» abajo: marca y sistema con versión, y el navegador. Pura: se prueba sola. */
export function describir(d: Pick<Telefono, "plataforma" | "marca" | "so_version">): { titulo: string; navegador: string | null } {
  const [equipo, navegador] = (d.plataforma || "").split(" · ");
  // en Apple la plataforma dice el equipo («iPhone»): se muestra el sistema, para que «iOS 18» no parezca un modelo
  const sistema = ({ iPhone: "iOS", iPad: "iPadOS", Mac: "macOS" } as Record<string, string>)[equipo ?? ""] ?? equipo;
  const so = sistema && sistema !== "otro" ? `${sistema}${d.so_version ? " " + d.so_version : ""}` : "";
  return { titulo: [d.marca && d.marca !== "Otra" ? d.marca : "", so].filter(Boolean).join(" · "), navegador: navegador && navegador !== "otro" ? navegador : null };
}

/** «20261112-1552-…» → «12/11 15:52» (la versión de la app es la fecha de su build). */
export const versionCorta = (v: string | null) => (v && /^\d{8}-\d{4}/.test(v) ? `${v.slice(6, 8)}/${v.slice(4, 6)} ${v.slice(9, 11)}:${v.slice(11, 13)}` : v ?? "—");

export function Dispositivos() {
  const { t, existe } = useI18n();
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [soloPush, setSoloPush] = useState(false);
  const [busca, setBusca] = useState("");
  const [codigo, setCodigo] = useState("");          // la búsqueda, unos instantes después de escribir
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setError(null);
    try { setDatos(await api<Respuesta>(rutaDispositivos(periodo, pagina, soloPush, codigo))); } catch (e) { setError(e); }
  }, [periodo, pagina, soloPush, codigo]);
  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => {
    const h = setTimeout(() => { setCodigo(busca); setPagina(1); }, 350);
    return () => clearTimeout(h);
  }, [busca]);
  const lista = datos?.dispositivos ?? [];
  // al cambiar un filtro se vuelve a la primera página
  const filtrar = (f: () => void) => { f(); setPagina(1); };

  return (
    <div className="grid gap-4">
      <section className={K.ficha} aria-labelledby="disp-titulo">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="disp-titulo" className={K.h2}>{t("panel.disp.titulo")}</h2>
            <p className={`${K.ayuda} mt-1 max-w-3xl`}>{t("panel.disp.ayuda")}</p>
          </div>
          <button type="button" onClick={() => void cargar()} className={K.btnChico}><Icono id="recalcular" className="size-4.5" />{t("panel.disp.actualizar")}</button>
        </div>
        <Resumenes r={datos?.resumen} />
        {datos && <Reparto r={datos.resumen} />}
      </section>

      <section className={K.ficha} aria-labelledby="disp-lista">
        <h2 id="disp-lista" className="sr-only">{t("panel.disp.lista")}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div role="radiogroup" aria-label={t("panel.disp.periodo")} className="grid grid-cols-4 gap-1 rounded-xl bg-suelo p-1">
            {PERIODOS.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={periodo === p} onClick={() => filtrar(() => setPeriodo(p))}
                className="min-h-10 rounded-lg px-3 text-sm font-semibold text-gris aria-checked:bg-papel aria-checked:text-tinta aria-checked:shadow-ficha">
                {t("panel.disp.p." + p)}
              </button>
            ))}
          </div>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={soloPush} onChange={(e) => { const v = e.target.checked; filtrar(() => setSoloPush(v)); }} className="size-5 accent-tinta" />{t("panel.disp.solo_push")}
          </label>
          <label className="ml-auto w-full sm:w-56">
            <span className={K.etiquetaChica}>{t("panel.disp.buscar")}</span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="7F3A2C" maxLength={6} className={`${K.campoChico} w-full font-mono uppercase`} />
          </label>
        </div>

        {error && !datos ? <div className="mt-4"><ErrorCarga texto={mensajeError(error, t, existe)} reintentar={() => void cargar()} /></div>
          : !datos ? <Esperando className="mt-4">{[0, 1, 2].map((i) => <EsqueletoLinea key={i} className="mt-3 w-full" />)}</Esperando>
          : !lista.length ? <p className={`${K.vacio} mt-2`}>{t("panel.disp.nadie")}</p>
          : <>
            <Tabla lista={lista} />
            <Fichas lista={lista} />
            <nav aria-label={t("panel.disp.paginas")} className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gris">{t("panel.rep.pag.estado", { p: datos.pagina, de: datos.paginas, n: datos.total })}</p>
              <div className="flex gap-2">
                <button type="button" disabled={datos.pagina <= 1} onClick={() => setPagina(datos.pagina - 1)} className={K.btnNeutro}>
                  <Icono id="atras" className="size-4.5" />{t("panel.rep.pag.anterior")}
                </button>
                <button type="button" disabled={datos.pagina >= datos.paginas} onClick={() => setPagina(datos.pagina + 1)} className={K.btnNeutro}>
                  {t("panel.rep.pag.siguiente")}<Icono id="adelante" className="size-4.5" />
                </button>
              </div>
            </nav>
          </>}
        <p className={`${K.mini} mt-4`}>{t("panel.alcance.nota")}</p>
      </section>
    </div>
  );
}

function Resumenes({ r }: { r?: Resumen }) {
  const { t } = useI18n();
  const items: [string, number | undefined][] = [["hoy", r?.hoy], ["semana", r?.semana], ["mes", r?.mes],
    ["con_notificaciones", r?.con_notificaciones], ["instaladas", r?.instaladas], ["total", r?.total]];
  return (
    <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {items.map(([k, n], i) => (
        <div key={k} className={`rounded-xl px-4 py-3 ${i === 0 ? "bg-tinta text-white" : "bg-suelo"}`}>
          <dt className={`text-xs font-semibold ${i === 0 ? "text-white/85" : "text-gris"}`}>{t("panel.disp.r." + k)}</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums">{n ?? <EsqueletoBloque className="h-7 w-10 rounded-md" />}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Cuántos por marca y por formato, en una línea cada uno. */
function Reparto({ r }: { r: Resumen }) {
  const { t } = useI18n();
  const nombre = (m: string) => (m === "?" ? t("panel.disp.sin_dato") : m === "Otra" ? t("panel.disp.otra") : m);
  const formatos = (["telefono", "tablet", "computadora", "?"] as const).filter((f) => r.formatos[f]);
  return (
    <div className="mt-3 grid gap-2 text-sm">
      {!!r.marcas.length && (
        <p className="flex flex-wrap items-center gap-1.5"><span className="mr-1 font-semibold text-gris">{t("panel.disp.marcas")}</span>
          {r.marcas.map((m) => <span key={m.marca} className={K.pildora.suave}>{nombre(m.marca)} {m.n}</span>)}
        </p>
      )}
      {!!formatos.length && (
        <p className="flex flex-wrap items-center gap-1.5"><span className="mr-1 font-semibold text-gris">{t("panel.disp.formatos")}</span>
          {formatos.map((f) => <span key={f} className={K.pildora.suave}>{f === "?" ? t("panel.disp.sin_dato") : t("panel.disp.f." + f)} {r.formatos[f]}</span>)}
        </p>
      )}
    </div>
  );
}

function Tipo({ d }: { d: Telefono }) {
  const { t } = useI18n();
  const { titulo, navegador } = describir(d);
  const abajo = [navegador, d.formato ? t("panel.disp.f." + d.formato) : null].filter(Boolean).join(" · ");
  return (
    <span className="block min-w-0">
      <span className="block font-semibold">{titulo || t("panel.alcance.sin_tipo")}</span>
      {abajo && <span className={`block ${K.mini}`}>{abajo}</span>}
    </span>
  );
}

function Uso({ d }: { d: Telefono }) {
  const { t } = useI18n();
  if (d.instalada === null) return <span className="text-gris">—</span>;
  return <span className={d.instalada ? K.pildora.suave : K.pildora.apagado}>{t(d.instalada ? "panel.disp.instalada" : "panel.disp.navegador")}</span>;
}

function Push({ d }: { d: Telefono }) {
  const { t } = useI18n();
  return d.notificaciones
    ? <span className="inline-flex items-center gap-1"><Icono id="campana" className="size-4 text-tinta" />{d.recinto || t("panel.alcance.todo_canton")}</span>
    : <span className="text-gris">{t("panel.disp.sin_push")}</span>;
}

function Tabla({ lista }: { lista: Telefono[] }) {
  const { t, hora } = useI18n();
  return (
    <div className="mt-2 hidden overflow-x-auto md:block">
      <table className={K.tabla}>
        <thead><tr>
          <th>{t("panel.alcance.col.codigo")}</th><th>{t("panel.alcance.col.tipo")}</th><th>{t("panel.disp.col.uso")}</th>
          <th>{t("panel.disp.col.push")}</th><th>{t("panel.alcance.col.idioma")}</th><th>{t("panel.disp.col.version")}</th>
          <th>{t("panel.disp.col.desde")}</th><th>{t("panel.alcance.col.ultimo")}</th><th className="text-right">{t("panel.disp.col.dias")}</th>
        </tr></thead>
        <tbody>
          {lista.map((d) => (
            <tr key={d.codigo}>
              <td><Codigo c={d.codigo} /></td>
              <td><Tipo d={d} /></td>
              <td><Uso d={d} /></td>
              <td><Push d={d} /></td>
              <td className="uppercase">{d.idioma || "—"}</td>
              <td className="font-mono text-xs" title={d.version ?? ""}>{versionCorta(d.version)}</td>
              <td className="whitespace-nowrap">{hora(d.alta)}</td>
              <td className="whitespace-nowrap">{hora(d.ultimo_uso)}</td>
              <td className="text-right tabular-nums">{d.dias ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fichas({ lista }: { lista: Telefono[] }) {
  const { t, hora } = useI18n();
  return (
    <ul className="mt-2 grid gap-2 md:hidden">
      {lista.map((d) => (
        <li key={d.codigo} className="rounded-xl border border-regla p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Codigo c={d.codigo} />
            <span className="min-w-0 flex-1 text-sm"><Tipo d={d} /></span>
            <Uso d={d} />
          </div>
          <p className="mt-2 text-sm"><Push d={d} /></p>
          <p className={`${K.mini} mt-1`}>{t(d.dias === 1 ? "panel.disp.ficha1" : "panel.disp.ficha", { ultimo: hora(d.ultimo_uso), dias: d.dias ?? "—", version: versionCorta(d.version) })}</p>
        </li>
      ))}
    </ul>
  );
}

function Codigo({ c }: { c: string }) {
  const { t } = useI18n();
  return <span className="rounded-lg bg-papel px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-texto ring-1 ring-regla" title={t("panel.alcance.codigo_ayuda")}>{c}</span>;
}
