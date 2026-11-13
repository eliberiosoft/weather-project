/* «Mi lugar»: el nivel de tu recinto, calle o ubicación y qué hacer, sin desplazarse; luego lluvia, río,
   lo que hay cerca y las calles con agua. */
import { pedirLlamada911 } from "../../app/Llamar911";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Banda } from "../../shared/componentes/Banda";
import { ErrorCarga } from "../../shared/componentes/ErrorCarga";
import { Html } from "../../shared/componentes/Html";
import { Icono } from "../../shared/componentes/Icono";
import { ItemReporte } from "../../shared/componentes/Reporte";
import { LecturaRegla, MedidorRio } from "../../shared/componentes/Rio";
import { Vista } from "../../shared/componentes/Vista";
import { cargarLugar, cargarReportes } from "../../shared/datos";
import { categoria, esCalle, nivelEfectivo, vigente } from "../../shared/dominio";
import { CasosGraves } from "../mapa/CasosGraves";
import { K, fondoNivel } from "../../shared/estilo";
import { distM, hace, metros, nombrePropio, num } from "../../shared/formato";
import { I18N, tHtml, useI18n } from "../../shared/i18n";
import type { LugarBuscado } from "../../shared/lugares";
import { pendientes } from "../../shared/pendientes";
import { store, toast, useApp } from "../../shared/store";
import type { LugarDetalle, Reporte } from "../../shared/tipos";
import { verEnMapa } from "../mapa/acciones";
import { abrirGuiaIos } from "../../app/GuiaIos";
import { casoIos, equipoActual } from "../pwa/ios";
import { almacen } from "../../shared/almacen";
import { FichaTormentas } from "../tormentas/FichaTormentas";
import { EsqueletoLugar } from "./EsqueletoLugar";
import { GraficaLluvia } from "./GraficaLluvia";
import { alberguesCercanos } from "./albergues";
import { BuscadorLugar } from "./Buscador";
import { CallesCerca } from "./CallesCerca";
import { lugarPorGps } from "./miUbicacion";

export function MiLugar() {
  const det = useApp((s) => s.lugarDet);
  const lugar = useApp((s) => s.lugar);
  const error = useApp((s) => s.lugarError || s.arranque === "error");
  // sin el arranque, «Reintentar» lo repite; con él, vuelve a pedir el lugar
  const reintentar = () => (lugar && store.get().arranque === "ok" ? void cargarLugar(lugar) : pendientes.reintentar());
  // con un lugar guardado: su placeholder mientras llega el detalle (o la copia), o el error con «Reintentar»
  const cuerpo = det ? <ConLugar det={det} />
    : !lugar ? <SinLugar />
    : error ? <ErrorCarga className="mt-5 lg:max-w-lg" onReintentar={reintentar} />
    : <EsqueletoLugar />;
  return (
    <Vista id="inicio" etiqueta="app.sec.inicio" className="vista mx-auto hidden max-w-lg px-4 pt-4 lg:max-w-5xl lg:px-6 [&.activa]:block [&.activa]:animate-entra">
      <Banners />
      <FormLugar />
      {cuerpo}
      <AvisoOficial />
    </Vista>
  );
}

/** «Qué hacer ahora», siempre plegado al abrir para que no ocupe la pantalla (pedido del dueño, 2026-11-11): los pasos
    del nivel quedan a un toque. */
function QueHacer({ acciones, className, style }: { acciones: string[]; className: string; style: CSSProperties }) {
  const { t } = useI18n();
  const [abierto, setAbierto] = useState(false);
  return (
    <details open={abierto} onToggle={(e) => setAbierto(e.currentTarget.open)} style={style}
      className={`group col-span-2 rounded-ficha bg-vidrio shadow-ficha ring-1 ring-white/70 [&.abierto]:lg:row-span-2 ${abierto ? "abierto" : ""} ${className}`}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-ficha p-5 [&::-webkit-details-marker]:hidden">
        <h2 id="h-hacer" className="flex-1 text-lg font-bold">{t("app.hacer.titulo")}</h2>
        <span className="text-sm font-semibold text-tinta group-open:hidden">{t("app.hacer.ver", { n: acciones.length })}</span>
        <Icono id="i-adelante" className="size-5 shrink-0 rotate-90 text-tinta transition group-open:-rotate-90" />
      </summary>
      <ol aria-labelledby="h-hacer" className="-mt-2 list-none px-5 pb-5">
        {acciones.map((a, i) => (
          <li key={i} className="flex gap-3 border-b border-regla py-3 last:border-0 last:pb-0">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-tinta-suave text-sm font-bold text-tinta">{i + 1}</span>
            <span className="pt-0.5 font-medium leading-snug">{a}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

function Banners() {
  const { t } = useI18n();
  const estado = useApp((s) => s.estado);
  const enLinea = useApp((s) => s.enLinea);
  // iPhone sin instalar: la ventana de inicio sale una sola vez, así que aquí queda un aviso que se puede cerrar
  const [verBanner, setVerBanner] = useState(() => !almacen.get("ios_banner_cerrado", false));
  const iphone = verBanner && casoIos(equipoActual()) !== "no";
  const cerrarBanner = () => { almacen.set("ios_banner_cerrado", true); setVerBanner(false); };
  const fila = (icono: string, hijos: ReactNode) => (
    <div key={icono} className="flex items-start gap-3 rounded-2xl bg-vidrio p-3.5 text-sm leading-snug shadow-ficha ring-1 ring-white/70 last:mb-3">
      <Icono id={icono} className="mt-0.5 size-5 text-tinta" /><div>{hijos}</div>
    </div>
  );
  return (
    <div className="grid gap-2">
      {estado?.advertencia ? fila("i-alerta", <><b>{t("app.ban.inamhi")}</b> {estado.advertencia.texto || ""}</>) : null}
      {estado?.aguaje ? fila("i-luna", <><b>{t("app.ban.aguaje", { fecha: estado.aguaje.hasta })}</b> {t("app.ban.aguaje.texto")} {estado.aguaje.nota || ""}</>) : null}
      {!enLinea ? fila("i-sinred", t("app.ban.offline")) : null}
      {iphone ? (
        <div className="flex items-center gap-3 rounded-2xl bg-vidrio p-3.5 text-sm leading-snug shadow-ficha ring-1 ring-white/70 last:mb-3">
          <Icono id="i-instalar" className="size-5 shrink-0 text-tinta" />
          <p className="min-w-0 flex-1">{t("app.ios.banner")}</p>
          <button type="button" onClick={abrirGuiaIos} className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-tinta px-3 text-sm font-semibold text-white active:scale-95">{t("app.ios.perm_boton")}</button>
          <button type="button" onClick={cerrarBanner} aria-label={t("app.cerrar")} className="grid size-10 shrink-0 place-items-center rounded-xl text-gris"><Icono id="i-x" className="size-4.5" /></button>
        </div>
      ) : null}
    </div>
  );
}

/** El buscador usa el evento «change» nativo: se elige al tocar una opción de la lista o al terminar de escribir. */
function FormLugar() {
  const { t } = useI18n();
  const elegir = (l: LugarBuscado): boolean => {
    void cargarLugar(l.tipo === "recinto" ? { tipo: "recinto", id: l.id, texto: l.texto } : l);
    return true;   // el nombre ya está en el título: no repetirlo en el buscador
  };
  const gps = () => lugarPorGps().catch((e: unknown) => toast((e as Error).message, 5000));
  return (
    <BuscadorLugar id="buscar-lugar" etiqueta={t("app.buscar.etq")} placeholder={t("app.buscar.ph")}
      alElegir={elegir} alNoEncontrar={() => toast(t("app.toast.no_lugar"))}
      className="flex h-12 items-center gap-2 rounded-2xl bg-vidrio pr-1.5 pl-4 ring-1 ring-white/70 text-gris shadow-ficha focus-within:ring-4 focus-within:ring-tinta/15 lg:max-w-lg"
      extra={
        <button type="button" onClick={gps} aria-label={t("app.gps.etq")} title={t("app.gps.etq")} className="grid size-9 shrink-0 place-items-center rounded-xl bg-tinta-suave text-tinta active:scale-95">
          <Icono id="i-gps" className="size-5" />
        </button>
      } />
  );
}

function SinLugar() {
  const { t } = useI18n();
  const buscando = useApp((s) => s.buscandoUbic);
  const guia = (n: number, cls: string) => (
    <li className={cls}><b className="block text-sm font-extrabold tracking-wide">{t("nivel." + n)}</b><span className="text-sm font-medium">{t("app.guia." + n)}</span></li>
  );
  return (
    <div className="mt-5 rounded-ficha bg-vidrio p-5 shadow-ficha ring-1 ring-white/70 lg:max-w-lg">
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">{t("app.sinlugar.titulo")}</h1>
      <p className="mt-2 text-pretty text-gris">{t("app.sinlugar.texto")}</p>
      <p role="status" className="mt-3 flex items-center gap-2 text-sm font-semibold text-tinta empty:hidden">
        {buscando ? <><Icono id="i-gps" className="size-4.5 animate-pulse" />{t("app.sinlugar.buscando")}</> : null}
      </p>
      <ol aria-label={t("app.guia.etq")} className="mt-4 grid list-none grid-cols-2 gap-2 p-0">
        {guia(1, "rounded-2xl bg-n1 p-3 text-black")}{guia(2, "rounded-2xl bg-n2 p-3")}{guia(3, "rounded-2xl bg-n3 p-3")}{guia(4, "rounded-2xl bg-n4 p-3 text-white")}
      </ol>
    </div>
  );
}

/** Las fichas del mosaico entran en cascada. */
const ENTRA = "animate-entra [animation-fill-mode:both] [animation-delay:var(--d)]";
const demora = (i: number) => ({ "--d": i * 55 + "ms" }) as CSSProperties;

function ConLugar({ det }: { det: LugarDetalle }) {
  const { t, lista } = useI18n();
  const lugar = useApp((s) => s.lugar);
  const estado = useApp((s) => s.estado);
  const p = det.recinto, e = det.estado;
  const ef = nivelEfectivo(e);
  const n = ef.n || 1;
  const ambito = ef.fuente ? t("app.ambito." + ef.fuente) : "";
  // «Tu ubicación · Calle X» (también el formato guardado por versiones anteriores) se muestra como «Calle X» con «Tu ubicación» abajo
  const gps = (lugar?.tipo === "punto" && lugar.gps) || /^(Tu ubicación|Your location)( · |$)/.test(p.nombre || "");
  const nombre = (p.nombre || "").replace(/^(Tu ubicación|Your location)( · )?/, "") || t("app.tu_ubicacion");
  const parroquia = nombrePropio(p.parroquia);
  const sub = p.id ? (p.etiqueta ? p.etiqueta : t("app.lugar.recinto", { parroquia }))
    : [gps ? t("app.tu_ubicacion") : "", parroquia,
      p.recinto_cercano && p.recinto_cercano.toLowerCase() !== parroquia.toLowerCase() ? t("app.lugar.cerca_de", { lugar: p.recinto_cercano }) : ""].filter(Boolean).join(" · ");
  const extra = <>
    {ef.oficial && ambito ? <p className="mt-2 text-[.85rem] font-medium">{t("app.banda.fijado", { ambito })}</p> : null}
    {ef.oficial && e.sugerido && e.sugerido !== ef.n ? <p className="mt-1 text-[.85rem] font-medium">{t("app.banda.manda", { nivel: t("nivel." + e.sugerido) })}</p> : null}
  </>;
  const hoy = I18N.fecha(new Date(), { weekday: "short", day: "numeric", month: "short" });
  const fecha = hoy.charAt(0).toUpperCase() + hoy.slice(1) + (estado?.generado ? " · " + t("app.actualizado", { hace: hace(estado.generado) }) : "");
  const ll = e.lluvia;
  const cifra = (v: string | null, u: string) => (v == null ? "—" : <>{v}<small className="ml-0.5 text-base font-semibold text-gris">{u}</small></>);
  const casilla = (titulo: string, v: ReactNode, icono: string) => (
    <div className="flex min-w-0 flex-col justify-between gap-3 rounded-ficha bg-vidrio p-4 shadow-ficha ring-1 ring-white/70">
      <dt className="flex items-center gap-2 text-sm font-medium text-gris"><Icono id={icono} className="size-4.5 text-tinta" />{titulo}</dt>
      <dd className="text-[1.9rem] leading-none font-bold tracking-tight tabular-nums">{v}</dd>
    </div>
  );
  const dr = p.dist_rio_m;
  const cerca = useReportesCerca(det);
  const irAlMapa = () => {
    const recinto = lugar?.tipo === "recinto";
    void verEnMapa([p.lat, p.lon], recinto ? 15 : 17, recinto && lugar ? { tipo: "recinto", id: lugar.id } : undefined);
  };

  return (
    <div>
      <div className="mt-5 mb-3">
        <div className="flex items-start gap-1.5">
          <Icono id="i-pin" className="mt-1.5 size-5 shrink-0 text-tinta" />
          <h1 className={`min-w-0 flex-1 text-[1.75rem] leading-tight font-bold tracking-tight text-balance [&.largo]:text-[1.4rem] ${nombre.length > 22 ? "largo" : ""}`}>{nombre}</h1>
          <button type="button" onClick={irAlMapa} className="mt-0.5 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-papel px-3 text-sm font-semibold text-tinta shadow-ficha active:scale-95">
            <Icono id="i-mapa" className="size-4.5" /><span>{t("app.ver_mapa")}</span>
          </button>
        </div>
        <p className="mt-0.5 text-sm text-gris">{sub}</p>
        <p className="text-sm text-gris">{fecha}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Banda n={n} oficial={ef.oficial} horaVerif={ef.hora} motivo={ef.motivo || t("app.banda.sin_motivo")} extra={extra} lluvia={ll?.prox_24h} className={ENTRA} style={demora(0)} />
        <CasosGraves motivos={e?.motivos} className={`col-span-2 rounded-ficha bg-vidrio p-5 shadow-ficha ring-1 ring-white/70 ${ENTRA}`} />

        {/* key: al cambiar el nivel vuelve a plegarse */}
        <QueHacer key={n} acciones={lista("acciones." + n)} className={ENTRA} style={demora(1)} />
        <FichaTormentas className={ENTRA} style={demora(2)} />

        {/* ficha: siempre las mismas tres casillas, en el mismo orden */}
        <dl className="contents">
          {casilla(t("app.ficha.lluvia24"), cifra(ll ? num(ll.prox_24h) : null, "mm"), "i-lluvia")}
          {casilla(t("app.ficha.lluvia3"), cifra(ll ? num(ll.suma_3d) : null, "mm"), "i-lluvia")}
          {casilla(t("app.ficha.rio"), dr == null ? "—" : dr >= 1000 ? cifra(num(dr / 1000, 1), "km") : cifra(num(dr), "m"), "i-ola")}
        </dl>
        <button type="button" onClick={pedirLlamada911} aria-haspopup="dialog" style={demora(3)} className={`flex flex-col justify-between gap-3 rounded-ficha bg-negro p-4 text-left text-white shadow-ficha active:scale-[.98] ${ENTRA}`}>
          <span className="grid size-10 place-items-center rounded-full bg-white/15"><Icono id="i-tel" className="size-5" /></span>
          <span className="text-lg leading-tight font-bold">{t("app.emerg.llamar")}</span>
        </button>

        <CallesCerca calles={cerca.calles} centro={{ lat: p.lat, lon: p.lon }} className={ENTRA} style={demora(4)} />

        <section aria-labelledby="h-lluvia" style={demora(5)} className={`col-span-2 rounded-ficha bg-vidrio p-5 shadow-ficha ring-1 ring-white/70 ${ENTRA}`}>
          <h2 id="h-lluvia" className="text-lg font-bold">{t("app.lluvia.titulo")}</h2>
          <div className="mt-3">{ll ? <GraficaLluvia ll={ll} /> : <p className={K.vacio}>{t("app.lluvia.vacio")}</p>}</div>
          {ll ? <Html como="p" clave="app.lluvia.nota" vars={{ ult: num(ll.ult_24h, 1) }} className="mt-2 text-[.85rem] leading-snug text-gris" /> : <p className="mt-2 text-[.85rem] leading-snug text-gris"></p>}
        </section>

        <section aria-labelledby="rio-titulo" style={demora(6)} className={`col-span-2 rounded-ficha bg-vidrio p-5 shadow-ficha ring-1 ring-white/70 ${ENTRA}`}>
          <h2 id="rio-titulo" className="text-lg font-bold">{t("app.rio.a", { rio: p.rio_cercano ?? "", dist: metros(p.dist_rio_m) })}</h2>
          <div><RioCuerpo det={det} /></div>
        </section>

        <section aria-labelledby="h-cerca" style={demora(7)} className={`col-span-2 rounded-ficha bg-vidrio p-5 shadow-ficha ring-1 ring-white/70 ${ENTRA}`}>
          <h2 id="h-cerca" className="text-lg font-bold">{t("app.cerca.titulo")}</h2>
          <ul className="mt-1 list-none p-0">
            {det.equipamientos.map((q, i) => (
              <li key={i} className={K.item}>
                <span className={K.itemIco}><Icono id={"e-" + q.categoria} className="size-5" /></span>
                <div>
                  <b className="font-semibold">{q.nombre === "s/n" ? t("app.cerca.sin_nombre", { cat: categoria(q.categoria) }) : q.nombre}</b>
                  <div className={K.meta}>{t("app.cerca.a", { cat: categoria(q.categoria), dist: metros(q.dist_m) })}</div>
                </div>
              </li>
            ))}
            <AlberguesCerca centro={{ lat: p.lat, lon: p.lon }} />
            {baseDelPlan(det) && (
              <li className={K.item}>
                <span className={K.itemIco}><Icono id="i-alerta" className="size-5" /></span>
                <div className={K.desc} dangerouslySetInnerHTML={{ __html: baseDelPlan(det) }} />
              </li>
            )}
          </ul>
        </section>

        <OtrosCerca otros={cerca.otros} error={cerca.error} />
      </div>
    </div>
  );
}

/** Si el lugar las tiene, la prioridad y el riesgo base del plan («» si no). */
function baseDelPlan(det: LugarDetalle): string {
  const p = det.recinto;
  const base = [p.prioridad ? tHtml("app.cerca.prioridad", { v: p.prioridad }) : "", p.riesgo_base ? tHtml("app.cerca.riesgo", { v: p.riesgo_base }) : ""].filter(Boolean).join("; ");
  return base ? I18N.t("app.cerca.base", { base }).trim() : "";
}

/** Los albergues que cargó el equipo en el panel, del más cercano al más lejano (hasta 3), con «Cómo llegar», que abre
    el mapa en el albergue con su hoja (fotos y ruta a pie o en carro). Si todavía no hay ninguno, el aviso del COE. */
function AlberguesCerca({ centro }: { centro: { lat: number; lon: number } }) {
  const { t } = useI18n();
  const todos = useApp((s) => s.albergues);
  const lista = alberguesCercanos(todos, centro);
  if (!lista.length) {
    return (
      <li className={K.item}>
        <span className={K.itemIco}><Icono id="i-albergue" className="size-5" /></span>
        <p className={K.desc}>{t("app.cerca.albergues")}</p>
      </li>
    );
  }
  return (
    <>
      {lista.map(({ a, dist }) => (
        <li key={a.id} className={`${K.item} items-center`}>
          <span className={K.itemIco}><Icono id="i-albergue" className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <b className="font-semibold">{a.nombre}</b>
            <div className={K.meta}>{t("app.cerca.albergue_a", { dist: metros(dist) })}</div>
            {a.descripcion && <p className="mt-0.5 line-clamp-2 text-sm">{a.descripcion}</p>}
          </div>
          <button type="button" onClick={() => void verEnMapa([a.lat, a.lon], 16, { tipo: "albergue", a })} className={`${K.btnChico} shrink-0`}>
            <Icono id="i-ruta" className="size-4" />{t("app.cerca.como_llegar")}
          </button>
        </li>
      ))}
    </>
  );
}

function RioCuerpo({ det }: { det: LugarDetalle }) {
  const { t } = useI18n();
  const estado = useApp((s) => s.estado);
  const rio = det.rio, p = det.recinto;
  if (!rio) return <p className={K.vacio}>{t("app.rio.vacio")}</p>;
  const nr = rio.oficial || rio.sugerido || 0;
  const pid = rio.puntos[0];
  const g = pid ? estado?.puntos[pid]?.glofas : null;
  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <span className={`${K.placa} ${fondoNivel(nr)}`}>{t("nivel." + nr)}</span>
        <span className={K.marcaCert}>{rio.oficial ? <><Icono id="i-check" className="size-4.5" />{t("estado.validado")}</> : t("app.estimado")}</span>
      </div>
      <MedidorRio g={g} /><LecturaRegla estado={estado} pid={pid} />
      {rio.sugerido_pleamar ? <p className={K.nota}>{t("app.rio.pleamar", { nivel: t("nivel." + rio.sugerido_pleamar) })}</p> : null}
      {(p.dist_rio_m ?? 0) > 1500 ? <p className={K.nota}>{t("app.rio.lejos")}</p> : null}
      {!rio.puntos.length ? <p className={K.nota}>{t("app.rio.sin_punto")}</p> : null}
    </>
  );
}

/** Reportes a 3 km o menos del lugar: se recargan cada vez que cambia el detalle del lugar. */
function useReportesCerca(det: LugarDetalle) {
  const reportes = useApp((s) => s.reportes);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vivo = true;
    cargarReportes().then(() => vivo && setError(false), () => vivo && setError(true));
    return () => { vivo = false; };
  }, [det]);
  const p = det.recinto;
  const cerca = reportes.filter((r) => vigente(r)).filter((r) => !r.mio || r.estado !== "descartado").filter((r) => distM(p.lon, p.lat, r.lon, r.lat) <= 3000);
  return {
    error,
    calles: cerca.filter((r) => esCalle(r) && ["pendiente", "validado"].includes(r.estado)),
    otros: cerca.filter((r) => !esCalle(r) && r.estado === "validado"),
  };
}

/** Otros reportes verificados cerca. */
function OtrosCerca({ otros, error }: { otros: Reporte[]; error: boolean }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="h-otros" style={demora(8)} className={`col-span-2 rounded-ficha bg-vidrio p-5 shadow-ficha ring-1 ring-white/70 ${ENTRA}`}>
      <h2 id="h-otros" className="text-lg font-bold">{t("app.otros.titulo")}</h2>
      <ul className="mt-1 list-none p-0">
        {error ? <li className={K.vacio}>{t("app.otros.error")}</li>
          : otros.length ? otros.slice(0, 8).map((r) => <ItemReporte key={r.id} r={r} conVotos />) : <li className={K.vacio}>{t("app.otros.vacio")}</li>}
      </ul>
    </section>
  );
}

function AvisoOficial() {
  const { t } = useI18n();
  return (
    <aside id="aviso-oficial" className="mt-3 mb-2 flex scroll-mt-20 gap-3 rounded-ficha bg-tinta-suave p-4 text-[.85rem] leading-snug text-texto lg:mt-4">
      <Icono id="i-alerta" className="mt-0.5 size-5 text-tinta" />
      <div className="max-w-[60ch]">
        <Html como="p" className="text-pretty" clave="app.no_oficial" />
        <a href="#privacidad" className="mt-2 inline-block text-[.85rem] font-semibold">{t("app.priv.enlace")}</a>
      </div>
    </aside>
  );
}
