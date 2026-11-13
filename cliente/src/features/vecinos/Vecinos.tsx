/* «Vecinos»: tus reportes, los de tus vecinos y los incidentes del equipo de riesgo, como publicaciones.
   Filtros (cerca, míos, todos), búsqueda sin tildes, me gusta, fotos y compartir. Scroll infinito: se dibujan de a
   15 y, al acercarse al final, 15 más (con «Ver más» de respaldo); la lista ya está en el teléfono. */
import { useEffect, useRef, useState } from "react";
import { almacen } from "../../shared/almacen";
import { DISP, postJSON } from "../../shared/api";
import { ErrorCarga } from "../../shared/componentes/ErrorCarga";
import { Icono } from "../../shared/componentes/Icono";
import { BotonesVoto, EtiquetaEstado, iconoReporte } from "../../shared/componentes/Reporte";
import { verFoto } from "../../shared/componentes/VisorFoto";
import { Vista } from "../../shared/componentes/Vista";
import { refrescarReportes } from "../../shared/datos";
import { autoria, cuantasFotos, esCalle, textoAutoria, textoCompartir, tituloReporte, urlCompartir, urlFoto } from "../../shared/dominio";
import { K } from "../../shared/estilo";
import { distM, hace, metros, sinMovimiento } from "../../shared/formato";
import { useI18n } from "../../shared/i18n";
import { pendientes } from "../../shared/pendientes";
import { store, toast, useApp, type FiltroMuro } from "../../shared/store";
import type { Reporte } from "../../shared/tipos";
import { useVista } from "../../shared/vistas";
import { verEnMapa } from "../mapa/acciones";
import { EsqueletoVecinos } from "./EsqueletoVecinos";
import { cuantasMostrar, filtrarMuro, TANDA } from "./muro";

const FILTROS: FiltroMuro[] = ["cerca", "mios", "todos"];

function useCentroLugar() {
  const det = useApp((s) => s.lugarDet);
  const lugar = useApp((s) => s.lugar);
  const r = det?.recinto;
  if (r && r.lat != null) return { lat: r.lat, lon: r.lon };
  return lugar?.tipo === "punto" ? { lat: lugar.lat, lon: lugar.lon } : null;
}

export function Vecinos() {
  const { t } = useI18n();
  const reportes = useApp((s) => s.reportes);
  const filtro = useApp((s) => s.filtroMuro);
  const destacado = useApp((s) => s.destacado);
  const terr = useApp((s) => s.terr);
  const arranque = useApp((s) => s.arranque);
  const carga = useApp((s) => s.reportesCarga);
  const centro = useCentroLugar();
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const entrada = useRef<HTMLInputElement>(null);
  const [pedidas, setPedidas] = useState(TANDA);

  useEffect(() => {   // espera corta mientras se escribe
    const h = setTimeout(() => setBusqueda(texto), 150);
    return () => clearTimeout(h);
  }, [texto]);

  // la publicación de un enlace compartido (#muro/<id>) se resalta y se centra
  useEffect(() => {
    if (!destacado) return;
    const el = document.getElementById("post-" + destacado);
    if (!el) return;
    const h = setTimeout(() => el.scrollIntoView({ block: "center", behavior: sinMovimiento() ? "auto" : "smooth" }), 80);
    return () => clearTimeout(h);
  }, [destacado, reportes]);

  // al cambiar el filtro o la búsqueda se vuelve a la primera tanda
  const [claveLista, setClaveLista] = useState(filtro + "|" + busqueda);
  if (claveLista !== filtro + "|" + busqueda) { setClaveLista(filtro + "|" + busqueda); setPedidas(TANDA); }
  const lista = filtrarMuro(reportes, filtro, centro, busqueda);
  const visibles = lista.slice(0, cuantasMostrar(lista, pedidas, destacado));
  const quedan = lista.length - visibles.length;
  const masUnaTanda = () => setPedidas((n) => n + TANDA);
  const elegirFiltro = (f: FiltroMuro) => { almacen.set("muro_filtro", f); store.set({ filtroMuro: f, destacado: null }); };
  // hasta tener el territorio y la primera lista: 3 publicaciones de placeholder; si falló sin nada guardado, el error
  const estadoLista = terr && carga === "ok" ? "ok" : arranque === "error" || carga === "error" ? "error" : "cargando";
  const reintentar = () => (arranque === "ok" ? void refrescarReportes() : pendientes.reintentar());

  return (
    <Vista id="muro" etiqueta="app.sec.muro" className={K.vista}>
      <h1 className={K.h1}>{t("app.muro.titulo")}</h1>
      <p className="mt-0.5 text-sm text-gris">{t("app.muro.sub")}</p>
      <form role="search" onSubmit={(e) => { e.preventDefault(); setBusqueda(texto); entrada.current?.blur(); }}
        className="mt-4 flex h-12 items-center gap-2 rounded-2xl bg-vidrio pr-1.5 pl-4 text-gris shadow-ficha ring-1 ring-white/70 focus-within:ring-4 focus-within:ring-tinta/15">
        <label className="sr-only" htmlFor="buscar-muro">{t("app.muro.buscar.etq")}</label>
        <Icono id="i-buscar" className="size-5" />
        <input ref={entrada} id="buscar-muro" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={t("app.muro.buscar.ph")} autoComplete="off" enterKeyHint="search" className="h-full min-w-0 flex-1 bg-transparent font-medium text-texto outline-none" />
      </form>
      <div role="radiogroup" aria-label={t("app.muro.filtros")} className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-white/60 p-1">
        {FILTROS.map((f) => (
          <button key={f} type="button" role="radio" aria-checked={filtro === f} onClick={() => elegirFiltro(f)}
            className="min-h-10 rounded-xl text-sm font-semibold text-gris aria-checked:bg-papel aria-checked:text-tinta aria-checked:shadow-ficha">{t("app.muro.f." + f)}</button>
        ))}
      </div>
      {estadoLista === "cargando" ? <EsqueletoVecinos />
        : estadoLista === "error" ? <ErrorCarga className="mt-3 mb-2" onReintentar={reintentar} />
        : <>
          <p className="mt-3 text-[.85rem] text-gris" aria-live="polite">
            {filtro === "cerca" && !centro ? t("app.muro.sin_lugar") : t(lista.length === 1 ? "app.muro.cuenta.uno" : "app.muro.cuenta", { n: lista.length })}
          </p>
          <div className="mt-2 mb-2 grid gap-3">
            {lista.length ? visibles.map((r) => <Publicacion key={r.id} r={r} centro={centro} destacada={r.id === destacado} onFoto={verFoto} />)
              : <p className="rounded-ficha bg-vidrio p-5 text-sm text-gris shadow-ficha ring-1 ring-white/70">{busqueda.trim() ? t("app.muro.vacio.buscar", { q: busqueda }) : t("app.muro.vacio." + filtro)}</p>}
          </div>
          {quedan > 0 && (
            <>
              {/* key: uno nuevo en cada tanda; si el final sigue a la vista (pantalla alta), vuelve a avisar */}
              <Centinela key={visibles.length} alVer={masUnaTanda} />
              <button type="button" onClick={masUnaTanda} className={`${K.btnSec} mb-2`}>{t("app.muro.ver_mas", { n: quedan })}</button>
            </>
          )}
        </>}
    </Vista>
  );
}

/** Avisa cuando el final de la lista se acerca a la pantalla (400 px antes), para dibujar la siguiente tanda. */
function Centinela({ alVer }: { alVer: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(alVer);
  useEffect(() => { cb.current = alVer; }, [alVer]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) cb.current(); }, { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} aria-hidden="true" className="h-px" />;
}

/** Me gusta: se ve al instante y se revierte si falla. */
async function meGusta(id: string) {
  const r0 = store.get().reportes.find((x) => x.id === id);
  if (!r0) return;
  const antes = { likes: r0.likes || 0, me_gusta: !!r0.me_gusta };
  const poner = (cambio: Partial<Reporte>) => store.set((s) => ({ reportes: s.reportes.map((x) => (x.id === id ? { ...x, ...cambio } : x)) }));
  poner({ me_gusta: !antes.me_gusta, likes: antes.likes + (antes.me_gusta ? -1 : 1) });
  try {
    const res = await postJSON<{ likes: number; me_gusta: boolean }>(`/api/reportes/${encodeURIComponent(id)}/megusta`, { dispositivo: DISP });
    poner({ likes: res.likes, me_gusta: res.me_gusta });
  } catch (e) {
    poner(antes);
    toast((e as Error).message);
  }
}

const ACCION = "flex min-h-12 items-center justify-center gap-1.5 transition active:scale-95";
const RED = "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white/80 text-xs font-semibold text-tinta ring-1 ring-regla active:scale-95";

/** Una publicación: quién (tú, un vecino sin nombre o el equipo de riesgo), dónde y cuándo, qué pasa, foto y acciones. */
function Publicacion({ r, centro, destacada, onFoto }: { r: Reporte; centro: { lat: number; lon: number } | null; destacada: boolean; onFoto(r: Reporte, i?: number): void }) {
  const { t } = useI18n();
  const terr = useApp((s) => s.terr);
  const [compartir, setCompartir] = useState(false);
  const d = centro ? distM(centro.lon, centro.lat, r.lon, r.lat) : null;
  const titulo = tituloReporte(r);
  const nFotos = cuantasFotos(r);
  const url = urlCompartir(r, terr);
  const autor = autoria(r);
  const equipo = autor.tipo === "equipo";
  const enRevision = r.mio && r.estado === "pendiente" && !esCalle(r);
  const porVecinos = r.estado === "validado" && r.validado_por === "vecinos";
  const cuentas = [r.likes ? t("app.muro.n_megusta", { n: r.likes }) : "", esCalle(r) && (r.sigue || r.ya_no) ? t("app.info.vecinos.txt", { s: r.sigue ?? 0, n: r.ya_no ?? 0 }) : ""].filter(Boolean);
  const share = typeof navigator !== "undefined" && !!navigator.share;
  const ref = useRef<HTMLElement>(null);
  useVista(ref, "incidente", r.id, equipo);       // alcance de los incidentes del equipo (spec 021)
  const avatar = equipo ? "grid size-11 shrink-0 place-items-center rounded-xl bg-negro text-white"
    : r.mio ? "grid size-11 shrink-0 place-items-center rounded-full bg-tinta text-white" : "grid size-11 shrink-0 place-items-center rounded-full bg-tinta-suave text-tinta";

  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); toast(t("app.muro.copiado")); }
    catch { toast(url, 9000); }   // sin permiso de portapapeles: se muestra el enlace
  };

  return (
    <article ref={ref} id={"post-" + r.id} className={`scroll-mt-24 overflow-hidden rounded-ficha bg-vidrio shadow-ficha ring-1 ring-white/70 transition-shadow [&.destacado]:ring-2 [&.destacado]:ring-tinta ${destacada ? "destacado" : ""}`}>
      <header className="flex items-start gap-3 px-4 pt-4">
        <span className={avatar}><Icono id={iconoReporte(r)} className="size-5.5" /></span>
        <div className="min-w-0 flex-1">
          <p className="leading-tight font-semibold text-pretty">{textoAutoria(autor)}{r.recinto ? <span className="font-normal text-gris"> · {r.recinto}</span> : null}</p>
          <p className="mt-0.5 text-[.85rem] text-gris">
            {equipo && autor.nombre ? <span className="font-semibold text-texto">{t("app.autor.equipo")} · </span> : null}
            {hace(r.creado)}{d != null ? " · " + t("app.muro.a", { dist: metros(d) }) : ""}
            {porVecinos ? <> <EtiquetaEstado r={r} /></> : null}
          </p>
        </div>
        {/* «confirmado por N vecinos» es largo: va en la línea de abajo para no apretar el nombre */}
        {porVecinos ? null : <span className="shrink-0"><EtiquetaEstado r={r} /></span>}
      </header>
      <div className="px-4 pt-3">
        <h2 className="text-lg leading-snug font-bold text-balance">{titulo}</h2>
        {r.descripcion ? <p className="mt-1 whitespace-pre-line text-pretty">{r.descripcion}</p> : null}
        {r.nota_ugr ? <p className="mt-2 rounded-2xl bg-white/70 p-3 text-[.85rem] text-pretty"><b>{t("app.info.analista")}:</b> {r.nota_ugr}</p> : null}
        {enRevision ? <p className="mt-2 flex items-center gap-1.5 text-[.85rem] text-gris"><Icono id="i-alerta" className="size-4 text-tinta" />{t("app.muro.revision")}</p> : null}
        <BotonesVoto r={r} />
      </div>
      {r.foto ? (
        <div className="mt-3 grid gap-0.5 bg-white/50">
          <button type="button" onClick={() => onFoto(r, 0)} aria-label={t("app.muro.foto.ver")} className="block w-full">
            <img loading="lazy" src={urlFoto(r)} alt={t("app.muro.foto.alt", { titulo })} className="aspect-[4/3] w-full object-cover" />
          </button>
          {nFotos > 1 ? (
            <div className="grid grid-cols-2 gap-0.5">
              {Array.from({ length: nFotos - 1 }, (_, i) => (
                <button key={i} type="button" onClick={() => onFoto(r, i + 1)} aria-label={t("app.foto.ver_n", { n: i + 2 })} className="block w-full">
                  <img loading="lazy" src={urlFoto(r, i + 2)} alt={t("app.foto.alt_n", { titulo, i: i + 2, n: nFotos })} className="aspect-[4/3] w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {cuentas.length ? <p className="flex flex-wrap gap-x-3 px-4 pt-3 text-[.85rem] text-gris">{cuentas.map((x) => <span key={x}>{x}</span>)}</p> : null}
      <div className="mt-3 grid grid-cols-3 border-t border-regla text-sm font-semibold text-gris">
        <button type="button" onClick={() => void meGusta(r.id)} aria-pressed={!!r.me_gusta} className={`${ACCION} aria-pressed:text-tinta`}>
          <Icono id="i-corazon" className="size-5 [[aria-pressed=true]_&]:fill-current" />{t("app.muro.megusta")}
        </button>
        <button type="button" onClick={() => void verEnMapa([r.lat, r.lon], 17, { tipo: "reporte", r })} className={ACCION}><Icono id="i-mapa" className="size-5" />{t("app.muro.mapa")}</button>
        <button type="button" onClick={() => setCompartir((x) => !x)} aria-expanded={compartir} aria-controls={"comp-" + r.id} className={`${ACCION} aria-expanded:text-tinta`}><Icono id="i-compartir" className="size-5" />{t("app.muro.compartir")}</button>
      </div>
      <div id={"comp-" + r.id} hidden={!compartir} className={share ? "grid grid-cols-4 gap-2 border-t border-regla p-3" : "grid grid-cols-3 gap-2 border-t border-regla p-3"}>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener" className={`${RED} no-underline`}><Icono id="i-compartir" className="size-5" />Facebook</a>
        <a href={`https://wa.me/?text=${encodeURIComponent(textoCompartir(r) + " " + url)}`} target="_blank" rel="noopener" className={`${RED} no-underline`}><Icono id="i-chat" className="size-5" />WhatsApp</a>
        <button type="button" onClick={() => void copiar()} className={RED}><Icono id="i-enlace" className="size-5" />{t("app.muro.copiar")}</button>
        {share ? <button type="button" onClick={() => navigator.share({ title: titulo, text: textoCompartir(r), url }).catch(() => {})} className={RED}><Icono id="i-mas" className="size-5" />{t("app.muro.mas")}</button> : null}
      </div>
    </article>
  );
}

