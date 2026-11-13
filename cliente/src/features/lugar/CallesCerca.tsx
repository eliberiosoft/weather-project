/* «Calles inundadas cerca» en «Mi lugar»: plegada para que no ocupe la pantalla. La barra cerrada ya dice lo
   importante (cuántas, la más cercana y si alguna dice «no cruces»); abierta, cada aviso es una ficha con la altura
   del agua (familia del agua + la palabra, nunca el semáforo), la calle, la distancia, la hora y los votos.
   «Avisar de una calle inundada» queda siempre a la vista. */
import { useState, type CSSProperties } from "react";
import { Icono } from "../../shared/componentes/Icono";
import { BotonesVoto, EtiquetaEstado } from "../../shared/componentes/Reporte";
import { verFoto } from "../../shared/componentes/VisorFoto";
import { autoria, cuantasFotos, textoAutoria } from "../../shared/dominio";
import { AGUA, K } from "../../shared/estilo";
import { distM, hace, metros } from "../../shared/formato";
import { useI18n } from "../../shared/i18n";
import type { Reporte } from "../../shared/tipos";
import { modoCalle, verEnMapa } from "../mapa/acciones";

const MAX = 10;

/** Las calles ordenadas de la más cercana a la más lejana, con su distancia al lugar. */
export function ordenarPorDistancia(calles: Reporte[], centro: { lat: number; lon: number }) {
  return calles.map((r) => ({ r, dist: distM(centro.lon, centro.lat, r.lon, r.lat) })).sort((a, b) => a.dist - b.dist);
}

export function CallesCerca({ calles, centro, className, style }: {
  calles: Reporte[]; centro: { lat: number; lon: number }; className: string; style: CSSProperties;
}) {
  const { t } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const lista = ordenarPorDistancia(calles, centro).slice(0, MAX);
  const noCruces = lista.filter(({ r }) => r.altura_agua === 3).length;
  const resumen = !lista.length ? t("app.calles.vacio")
    : [t(lista.length === 1 ? "app.calles.n1" : "app.calles.n", { n: lista.length }), t("app.calles.mas_cerca", { dist: metros(lista[0]!.dist) })].join(" · ");
  return (
    <section aria-labelledby="h-calles" style={style} className={`col-span-2 rounded-ficha bg-vidrio shadow-ficha ring-1 ring-white/70 ${className}`}>
      {lista.length ? (
        <details open={abierto} onToggle={(e) => setAbierto(e.currentTarget.open)} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-ficha px-5 pt-5 pb-3 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">
              <h2 id="h-calles" className="text-lg font-bold">{t("app.calles.titulo")}</h2>
              <span className="mt-0.5 block text-sm text-gris">{resumen}</span>
              {noCruces ? (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-negro px-2.5 py-1 text-xs font-bold text-white">
                  <Icono id="a-3" className="size-4" />{t("app.calles.no_cruces", { n: noCruces })}
                </span>
              ) : null}
            </span>
            <Icono id="i-adelante" className="size-5 shrink-0 rotate-90 text-tinta transition group-open:-rotate-90" />
          </summary>
          <ul className="flex list-none flex-col gap-2.5 px-3 pb-1">
            {lista.map(({ r, dist }) => <FichaCalle key={r.id} r={r} dist={dist} />)}
          </ul>
        </details>
      ) : (
        <div className="px-5 pt-5">
          <h2 id="h-calles" className="text-lg font-bold">{t("app.calles.titulo")}</h2>
          <p className={K.vacio}>{resumen}</p>
        </div>
      )}
      <div className="px-5 pt-2 pb-5">
        <button type="button" onClick={() => void modoCalle()} className={K.btn}>
          <Icono id="i-ola" className="size-5" /><span>{t("app.calles.reportar")}</span>
        </button>
      </div>
    </section>
  );
}

/** Un aviso de calle con agua: la altura arriba (color del agua y la palabra), la calle y lo demás debajo. */
function FichaCalle({ r, dist }: { r: Reporte; dist: number }) {
  const { t } = useI18n();
  const a = r.altura_agua || 1;
  const autor = autoria(r);
  const fotos = cuantasFotos(r);
  return (
    <li className="rounded-2xl bg-white/85 p-3.5 ring-1 ring-regla">
      <div className="flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${a === 1 ? "text-negro" : "text-white"}`} style={{ background: AGUA[a] }}>
          <Icono id={"a-" + a} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="leading-snug font-bold text-pretty">{r.via || t("app.calle.def")}</p>
          <p className="mt-0.5 text-sm font-semibold text-tinta-2">{t("altura." + a)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-tinta-suave px-2.5 py-1 text-xs font-bold whitespace-nowrap text-tinta">{t("app.calles.a", { dist: metros(dist) })}</span>
      </div>
      <p className={`${K.meta} mt-2`}>
        <EtiquetaEstado r={r} />{" "}
        {autor.tipo === "equipo" ? <>{textoAutoria(autor)} · </> : null}
        {r.recinto ? <>{r.recinto} · </> : null}{hace(r.creado)}
      </p>
      {r.descripcion ? <p className={`${K.desc} line-clamp-3`}>{r.descripcion}</p> : null}
      {r.nota_ugr ? <p className={K.desc}>{t("app.analista", { nota: r.nota_ugr })}</p> : null}
      <BotonesVoto r={r} extra={<>
        {r.foto ? (
          <button type="button" onClick={() => verFoto(r)} aria-label={fotos > 1 ? t("app.ver_fotos", { n: fotos }) : t("app.ver_foto")}
            title={fotos > 1 ? t("app.ver_fotos", { n: fotos }) : t("app.ver_foto")} className={`${K.btnChico} w-11 px-0`}>
            <Icono id="i-galeria" className="size-4.5" />
          </button>
        ) : null}
        <button type="button" onClick={() => void verEnMapa([r.lat, r.lon], 17, { tipo: "reporte", r })} aria-label={t("app.calles.en_mapa")}
          title={t("app.calles.en_mapa")} className={`${K.btnChico} w-11 px-0`}>
          <Icono id="i-mapa" className="size-4.5" />
        </button>
      </>} />
    </li>
  );
}
