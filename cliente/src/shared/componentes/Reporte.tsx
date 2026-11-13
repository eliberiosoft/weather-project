/* Piezas de un reporte que se repiten en «Mi lugar», el mapa y «Vecinos». */
import type { ReactNode } from "react";
import { autoria, cuantasFotos, esCalle, etiquetaTipo, textoAutoria, tituloReporte } from "../dominio";
import { confirmar } from "../datos";
import { hace } from "../formato";
import { useI18n } from "../i18n";
import { mapaActual } from "../mapaControl";
import { ESTADO_CLS, K } from "../estilo";
import type { Reporte } from "../tipos";
import { Icono } from "./Icono";
import { verFoto } from "./VisorFoto";

export function EtiquetaEstado({ r }: { r: Reporte }) {
  const { t, existe } = useI18n();
  if (esCalle(r) && r.estado === "pendiente") return <span className={ESTADO_CLS.pendiente}>{t("estado.calle_pendiente")}</span>;
  // validado por vecinos: se dice así, no «verificado» (lo verificado es del equipo)
  if (r.estado === "validado" && r.validado_por === "vecinos") return <span className={ESTADO_CLS.pendiente}>{t("estado.vecinos", { n: r.vecinos_n ?? 3 })}</span>;
  return <span className={ESTADO_CLS[r.estado] || ESTADO_CLS.resuelto}>{existe("estado." + r.estado) ? t("estado." + r.estado) : r.estado}</span>;
}

/** Votos de vecinos: en calles «aún inundada / ya pasó» (el autor solo «el agua ya pasó»); en lo verificado «sigue así / ya no».
    `extra`: más botones en la misma fila (p. ej. «En el mapa»). */
export function BotonesVoto({ r, extra }: { r: Reporte; extra?: ReactNode }) {
  const { t } = useI18n();
  const calle = esCalle(r);
  const abierto = r.estado === "validado" || (calle && r.estado === "pendiente");
  const fila = (...b: ReactNode[]) => <div className="mt-2 flex flex-wrap gap-2">{b}{extra}</div>;
  if (!abierto) return extra ? fila() : null;
  const votar = (sigue: boolean) => void confirmar(r.id, sigue, () => mapaActual()?.cerrarHojas());
  const b = (sigue: boolean, icono: string, txt: string) => (
    <button key={String(sigue)} type="button" className={K.btnChico} onClick={() => votar(sigue)}><Icono id={icono} className="size-4.5" />{txt}</button>
  );
  if (r.mio) return calle ? fila(b(false, "i-bajo", t("app.voto.bajo_mio"))) : extra ? fila() : null;
  return calle
    ? fila(b(true, "i-ola", t("app.voto.sigue_agua", { n: r.sigue ?? 0 })), b(false, "i-bajo", t("app.voto.bajo", { n: r.ya_no ?? 0 })))
    : fila(b(true, "i-pulgar", t("app.voto.sigue", { n: r.sigue ?? 0 })), b(false, "i-check", t("app.voto.ya_no", { n: r.ya_no ?? 0 })));
}

export const iconoReporte = (r: Reporte) => (esCalle(r) ? "a-" + (r.altura_agua || 1) : "t-" + r.tipo);

/** Un reporte en una lista (calles inundadas y otros reportes cerca de tu lugar). */
export function ItemReporte({ r, conVotos }: { r: Reporte; conVotos: boolean }) {
  const { t } = useI18n();
  const calle = esCalle(r);
  const autor = autoria(r);
  return (
    <li className={K.item}>
      <span className={autor.tipo === "equipo" ? "grid size-10 shrink-0 place-items-center rounded-xl bg-negro text-white" : K.itemIco}><Icono id={iconoReporte(r)} className="size-5" /></span>
      <div>
        <b className="font-semibold">{calle ? tituloReporte(r) : etiquetaTipo({ tipo: r.tipo, etiqueta: r.etiqueta })}</b> <EtiquetaEstado r={r} />
        <div className={K.meta}>
          {autor.tipo === "equipo" ? <>{textoAutoria(autor)} · </> : null}
          {r.recinto || ""} · {hace(r.creado)}{calle ? "" : " · " + t("gravedad." + r.gravedad)}
          {r.foto ? <> · <button type="button" onClick={() => verFoto(r)} className="font-semibold text-tinta underline underline-offset-3">{cuantasFotos(r) > 1 ? t("app.ver_fotos", { n: cuantasFotos(r) }) : t("app.ver_foto")}</button></> : null}
        </div>
        {r.descripcion ? <div className={K.desc}>{r.descripcion}</div> : null}
        {r.nota_ugr ? <div className={K.desc}>{t("app.analista", { nota: r.nota_ugr })}</div> : null}
        {conVotos || r.mio ? <BotonesVoto r={r} /> : null}
      </div>
    </li>
  );
}
