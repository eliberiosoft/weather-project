/* Lo que se toca en el mapa se abre en una hoja; lo que tiene nivel se imprime con su banda. */
import type { ReactNode } from "react";
import { Banda } from "../../shared/componentes/Banda";
import { Icono } from "../../shared/componentes/Icono";
import { BotonesVoto, EtiquetaEstado } from "../../shared/componentes/Reporte";
import { LecturaRegla, MedidorRio } from "../../shared/componentes/Rio";
import { verFoto } from "../../shared/componentes/VisorFoto";
import { autoria, categoria, cuantasFotos, esCalle, etiquetaTipo, nivelEfectivo, rioEstado, textoAutoria } from "../../shared/dominio";
import { K } from "../../shared/estilo";
import { hace, metros, num } from "../../shared/formato";
import { motivoVecino, useI18n } from "../../shared/i18n";
import { useApp } from "../../shared/store";
import type { LatLon } from "../../shared/tipos";
import { CasosGraves } from "./CasosGraves";
import { ContarVista } from "../../shared/vistas";
import { CuerpoAlbergue } from "./HojaAlbergue";
import type { Tocado } from "./motor";

function Dato({ etq, children }: { etq: string; children: ReactNode }) {
  if (!children && children !== 0) return null;
  return <p className={K.dato}><span className="text-gris">{etq}</span><span className="text-right font-medium">{children}</span></p>;
}

function Escenario() {
  const { t } = useI18n();
  return (
    <p className="mt-3 flex gap-2 rounded-2xl bg-suelo p-3 text-[.85rem] leading-snug font-medium">
      <Icono id="i-alerta" className="mt-0.5 size-4.5 text-escenario" /><span>{t("app.escenario")}</span>
    </p>
  );
}

/** Título de la hoja según lo tocado. */
export function tituloInfo(o: Tocado, t: (k: string, v?: Record<string, string | number>) => string, recintoNombre: (id: number) => string): string {
  const pr = "f" in o ? (o.f.properties || {}) : {};
  switch (o.tipo) {
    case "recinto": return recintoNombre(o.id);
    case "albergue": return o.a.nombre;
    case "rio": return o.rio;
    case "calle": case "reporte": return esCalle(o.r) ? o.r.via || t("app.info.calle_def") : etiquetaTipo({ tipo: o.r.tipo, etiqueta: o.r.etiqueta });
    case "punto": return `${pr.id} · ${pr.rio}`;
    case "equip": return pr.nombre === "s/n" ? categoria(String(pr.categoria)) : String(pr.nombre);
    case "zona": return t("app.info.zona", { cod: String(pr.cod) });
    case "huella": return t("app.info.huella", { cod: String(pr.cod) });
    case "tramo": return t("app.info.tramo", { rio: String(pr.rio) });
    case "muyAlto": return t("app.info.muyalto");
  }
}

interface Props {
  o: Tocado;
  centro: LatLon;
  onVerLugar(id: number): void;
  onCalleAqui(ll: LatLon): void;
  /** la ruta a un albergue ya está en el mapa: se cierra la hoja para verla */
  onRutaLista(): void;
}

export function CuerpoInfo({ o, centro, onVerLugar, onCalleAqui, onRutaLista }: Props) {
  const { t } = useI18n();
  const terr = useApp((s) => s.terr);
  const estado = useApp((s) => s.estado);
  const pr = "f" in o ? (o.f.properties || {}) : {};

  if (o.tipo === "albergue") return <CuerpoAlbergue key={o.a.id} a={o.a} onRutaLista={onRutaLista} />;
  if (o.tipo === "recinto") {
    const p = terr?.recintos[o.id];
    if (!p) return null;
    const ef = nivelEfectivo(estado?.recintos[o.id]);
    return (
      <>
        <Banda n={ef.n} oficial={ef.oficial} horaVerif={ef.hora} motivo={ef.motivo} compacta />
        <CasosGraves motivos={estado?.recintos[o.id]?.motivos} />
        <Dato etq={t("app.info.lugar")}>{p.etiqueta || t("app.lugar.recinto", { parroquia: p.parroquia || "" })}</Dato>
        <div className="mt-3 grid gap-2">
          <button type="button" className={K.btn} onClick={() => onVerLugar(p.id)}><Icono id="i-casa" />{t("app.info.ver")}</button>
          <button type="button" className={K.btnSec} onClick={() => onCalleAqui([p.lat, p.lon])}><Icono id="i-ola" />{t("app.info.calle_aqui")}</button>
        </div>
      </>
    );
  }
  if (o.tipo === "rio") {
    const r = rioEstado(estado, o.rio);
    const pid = r.puntos[0];
    return (
      <>
        <Banda n={r.n} oficial={r.oficial} motivo={r.oficial ? r.oficial_motivo : motivoVecino(r)} compacta />
        {pid ? <><MedidorRio g={estado?.puntos[pid]?.glofas} /><LecturaRegla estado={estado} pid={pid} /></> : <p className={K.nota}>{t("app.rio.sin_punto")}</p>}
        {r.sugerido_pleamar ? <Dato etq={t("app.info.pleamar")}>{t("nivel." + r.sugerido_pleamar)}</Dato> : null}
        <p className={K.nota}>{t("app.rio.hereda")}</p>
        <div className="mt-3">
          {/* el punto tocado del río (no el centro del mapa) */}
          <button type="button" className={K.btnSec} onClick={() => onCalleAqui(o.ll || centro)}><Icono id="i-ola" />{t("app.info.calle_cerca")}</button>
        </div>
      </>
    );
  }
  if (o.tipo === "calle" || o.tipo === "reporte") {
    const r = o.r, calle = esCalle(r), autor = autoria(r);
    return (
      <>
        <ContarVista tipo="incidente" id={r.id} si={autor.tipo === "equipo"} />
        {calle ? <Dato etq={t("app.info.agua")}>{t("app.info.hasta", { altura: t("altura." + (r.altura_agua || 1)) })}</Dato>
          : <Dato etq={t("app.info.gravedad")}>{t("gravedad." + r.gravedad)}</Dato>}
        <p className={K.dato}><span className="text-gris">{t("app.info.estado")}</span><span className="text-right"><EtiquetaEstado r={r} /> <span className="text-sm text-gris">{hace(r.creado)}</span></span></p>
        {autor.tipo === "equipo" ? <Dato etq={t("app.info.autor")}>{autor.nombre || t("app.autor.equipo")}</Dato> : null}
        <Dato etq={t("app.info.cerca")}>{r.recinto}</Dato>
        <Dato etq={t("app.info.detalle")}>{r.descripcion}</Dato>
        <Dato etq={t("app.info.analista")}>{r.nota_ugr}</Dato>
        {calle ? <Dato etq={t("app.info.vecinos")}>{t("app.info.vecinos.txt", { s: r.sigue ?? 0, n: r.ya_no ?? 0 })}</Dato> : null}
        {r.foto ? <p className={K.dato}><button type="button" onClick={() => verFoto(r)} className="font-semibold text-tinta underline underline-offset-3">{cuantasFotos(r) > 1 ? t("app.ver_fotos", { n: cuantasFotos(r) }) : t("app.info.ver_foto")}</button></p> : null}
        {autor.tipo === "equipo" && autor.nombre ? <p className={K.nota}>{textoAutoria({ tipo: "equipo", nombre: null })}</p> : null}
        <BotonesVoto r={r} />
      </>
    );
  }
  if (o.tipo === "punto") {
    const ep = estado?.puntos[String(pr.id)];
    return (
      <>
        <Dato etq={t("app.info.sitio")}>{pr.sitio as string}</Dato>
        <MedidorRio g={ep?.glofas} /><LecturaRegla estado={estado} pid={String(pr.id)} />
        {!ep?.regla ? <p className={K.nota}>{t("app.info.sin_regla")}</p> : null}
      </>
    );
  }
  if (o.tipo === "equip") return <Dato etq={t("app.info.tipo")}>{categoria(String(pr.categoria))}</Dato>;
  if (o.tipo === "zona") return (
    <>
      <Dato etq={t("app.info.prioridad")}>{pr.prioridad as string}</Dato>
      <Dato etq={t("app.info.zona_nombre")}>{pr.zona as string}</Dato>
      <Dato etq={t("app.info.porque")}>{pr.motivo as string}</Dato>
      <Escenario />
    </>
  );
  if (o.tipo === "huella") return (
    <>
      <Dato etq={t("app.info.rio")}>{pr.rio as string}</Dato>
      <Dato etq={t("app.info.escenario")}>{pr.nivel as string}</Dato>
      <Dato etq={t("app.info.area")}>{`${num(pr.area_ha as number)} ha`}</Dato>
      <Dato etq={t("app.info.personas")}>{num(pr.poblacion as number)}</Dato>
      <Escenario />
    </>
  );
  if (o.tipo === "tramo") return (
    <>
      <Dato etq={t("app.info.km")}>{pr.km as string}</Dato>
      <Dato etq={t("app.info.orilla")}>{t("app.info.orilla.v", { m: num(pr.alt_orilla_min as number, 1) })}</Dato>
      <Dato etq={t("app.info.recinto_cercano")}>{`${pr.recinto_cercano} (${metros(pr.dist_recinto_m as number)})`}</Dato>
      <p className={K.nota}>{t("app.info.tramo.nota")}</p>
      <Escenario />
    </>
  );
  return <><p className={K.dato}>{t("app.info.muyalto.texto")}</p><Escenario /></>;
}
