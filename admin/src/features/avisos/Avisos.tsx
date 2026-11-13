/* Avisos a la población: publicar (con reglas anti-saturación de la API y push a la app) y anular. */
import { useMemo, useState } from "react";
import { api, mensajeError } from "../../shared/api/cliente";
import type { AmbitoTipo, Aviso, Usuario } from "../../shared/api/tipos";
import { useI18n } from "../../shared/i18n/useI18n";
import { ErrorCarga } from "../../shared/ui/Carga";
import { EsqueletoBloque, EsqueletoLinea, EsqueletoPildora, Esperando } from "../../shared/ui/Esqueleto";
import { Icono } from "../../shared/ui/Icono";
import { Nivel } from "../../shared/ui/Nivel";
import { K } from "../../shared/ui/clases";
import { confirmar, toast } from "../../shared/ui/avisos";
import { textoConSentido } from "../../shared/formato";
import { tiene } from "../auth/permisos";
import { usePanelDatos } from "../datos/PanelDatos";
import { bytesDataUrl, MAX_BYTES, reducirFoto } from "../incidentes/foto";
import { VerTelefonos } from "../alcance/Alcance";

/** El flyer lleva texto: se reduce menos que una foto (1600 px, calidad 0,82). */
const FLYER_LADO = 1600;
const FLYER_CALIDAD = 0.82;

const AMBITOS: AmbitoTipo[] = ["canton", "parroquia", "rio", "recinto"];
/** Vigencia por defecto de un aviso nuevo (la API usa el mismo valor si no llega `horas`). */
const HORAS_POR_DEFECTO = 96;

export function Avisos({ usuario }: { usuario: Usuario }) {
  const { t, existe } = useI18n();
  const { ajustes, error, recargarTodo } = usePanelDatos();
  const puede = tiene(usuario, "avisos.publicar");
  // el formulario se ve desde el principio (el cantón no necesita los ajustes); la lista espera con su placeholder
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      {puede ? <FormAviso /> : <p className={`${K.ficha} text-sm text-gris`}>{t("panel.av.solo_lectura")}</p>}
      {error && !ajustes ? <ErrorCarga texto={mensajeError(error, t, existe)} reintentar={recargarTodo} /> : <ListaAvisos puedeAnular={puede} puedeEliminar={tiene(usuario, "avisos.eliminar")} detalle={tiene(usuario, "alcance.detalle")} />}
    </div>
  );
}

function FormAviso() {
  const { t, existe } = useI18n();
  const { ajustes, estado, recargarAjustes } = usePanelDatos();
  const [ambito, setAmbito] = useState<AmbitoTipo>("canton");
  const [cual, setCual] = useState("");
  const [nivel, setNivel] = useState(2);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [horas, setHoras] = useState(HORAS_POR_DEFECTO);
  const [flyer, setFlyer] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function elegirFlyer(archivo: File | undefined) {
    if (!archivo) return;
    if (!archivo.type.startsWith("image/")) { toast(t("panel.av.flyer.no_imagen")); return; }
    setPreparando(true);
    try {
      // se redibuja en un canvas: sale en JPEG y sin los metadatos de la cámara (ubicación incluida)
      let d = await reducirFoto(archivo, FLYER_LADO, FLYER_CALIDAD);
      if (bytesDataUrl(d) > MAX_BYTES) d = await reducirFoto(archivo, 1280, 0.72);
      if (bytesDataUrl(d) > MAX_BYTES) { toast(t("panel.av.flyer.grande")); return; }
      setFlyer(d);
    } catch { toast(t("panel.av.flyer.no_imagen")); } finally { setPreparando(false); }
  }

  const opciones = useMemo(() => {
    if (!ajustes) return [];
    if (ambito === "parroquia") return ajustes.parroquias.map((p) => ({ valor: p, texto: p }));
    if (ambito === "rio") {
      const rios = estado ? estado.rios.map((r) => r.rio) : [...new Set(Object.values(ajustes.puntos).map((p) => p.rio))];
      return rios.map((r) => ({ valor: r, texto: r }));
    }
    if (ambito === "recinto") return ajustes.recintos.map((r) => ({ valor: String(r.id), texto: `${r.nombre} (${r.parroquia})` }));
    return [];
  }, [ajustes, estado, ambito]);
  const elegido = opciones.some((o) => o.valor === cual) ? cual : opciones[0]?.valor ?? "";

  async function publicar() {
    if (!textoConSentido(titulo, 3) || !textoConSentido(texto)) { toast(t("panel.av.falta_texto")); return; }
    if (nivel === 4 && !(await confirmar(t("panel.av.confirmar_respuesta")))) return;
    setEnviando(true);
    try {
      await api("/api/panel/aviso", {
        ambito_tipo: ambito, ambito_id: ambito === "canton" ? "yaguachi" : elegido, nivel_cod: nivel,
        titulo: titulo.trim(), texto: texto.trim(), horas: Math.min(168, Math.max(1, horas || HORAS_POR_DEFECTO)),
        ...(flyer ? { flyer } : {}),
      });
      toast(t("panel.av.publicado"));
      setTitulo("");
      setTexto("");
      setFlyer(null);
      await recargarAjustes();
    } catch (e) { toast(mensajeError(e, t, existe), 7000); } finally { setEnviando(false); }
  }

  return (
    <section className={K.ficha} aria-labelledby="av-publicar">
      <h2 id="av-publicar" className={K.h2}>{t("panel.av.publicar_titulo")}</h2>
      <label htmlFor="a-tipo" className={`mt-4 ${K.etiqueta}`}>{t("panel.av.ambito")}</label>
      <select id="a-tipo" value={ambito} onChange={(e) => setAmbito(e.target.value as AmbitoTipo)} className={K.campo}>
        {AMBITOS.map((a) => <option key={a} value={a}>{t("panel.av.a." + a)}</option>)}
      </select>
      {ambito !== "canton" && (
        <select value={elegido} onChange={(e) => setCual(e.target.value)} aria-label={t("panel.av.cual")} className={`${K.campo} mt-2`}>
          {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
        </select>
      )}
      <label htmlFor="a-nivel" className={`mt-4 ${K.etiqueta}`}>{t("panel.av.nivel")}</label>
      <select id="a-nivel" value={nivel} onChange={(e) => setNivel(Number(e.target.value))} className={K.campo}>
        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{t("nivel." + n)}</option>)}
      </select>
      <label htmlFor="a-titulo" className={`mt-4 ${K.etiqueta}`}>{t("panel.av.titulo")}</label>
      <input id="a-titulo" value={titulo} maxLength={90} onChange={(e) => setTitulo(e.target.value)} placeholder={t("panel.av.titulo_ph")} className={K.campo} />
      <label htmlFor="a-texto" className={`mt-4 ${K.etiqueta}`}>{t("panel.av.texto")}</label>
      <textarea id="a-texto" rows={5} value={texto} maxLength={600} onChange={(e) => setTexto(e.target.value)} placeholder={t("panel.av.texto_ph")} className={`${K.campo} resize-y`} />
      <span className={`mt-4 ${K.etiqueta}`}>{t("panel.av.flyer")}</span>
      {flyer ? (
        <div className="overflow-hidden rounded-xl border border-regla bg-suelo">
          <img src={flyer} alt={t("panel.av.flyer.vista")} className="mx-auto max-h-80 w-full object-contain" />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-regla bg-papel px-3 py-2">
            <span className={K.mini}>{t("panel.av.flyer.peso", { kb: Math.round(bytesDataUrl(flyer) / 1024) })}</span>
            <button type="button" onClick={() => setFlyer(null)} className={K.btnNeutro}><Icono id="papelera" className="size-4.5" />{t("panel.av.flyer.quitar")}</button>
          </div>
        </div>
      ) : (
        <label className={`${K.btnSecundario} w-full cursor-pointer`}>
          <Icono id="foto" className="size-5" />{t(preparando ? "panel.av.flyer.preparando" : "panel.av.flyer.elegir")}
          <input type="file" accept="image/*" className="sr-only" disabled={preparando} onChange={(e) => { void elegirFlyer(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      )}
      <p className={`${K.ayuda} mt-1.5`}>{t("panel.av.flyer.ayuda")}</p>
      <label htmlFor="a-horas" className={`mt-4 ${K.etiqueta}`}>{t("panel.av.horas")}</label>
      <input id="a-horas" type="number" min={1} max={168} value={horas} onChange={(e) => setHoras(Number(e.target.value))} className={`${K.campo} w-32 tabular-nums`} />
      <p className={`${K.nota} mt-5 font-normal`}><Icono id="campana" className="mt-0.5 size-5 text-tinta" />{t("panel.av.push")}</p>
      <button type="button" disabled={enviando || preparando || (ambito !== "canton" && !elegido)} onClick={publicar} className={`${K.btnPrimario} mt-4 w-full`}>{t(enviando ? "panel.av.publicando" : "panel.av.publicar")}</button>
      <p className="mt-4 text-sm text-gris">{t("panel.av.reglas")}</p>
    </section>
  );
}

/** Anular (quien publica avisos): deja de verse en la app pero sigue en esta lista, marcado.
    Eliminar (solo superadmin): eliminación lógica; desaparece de la app y del panel y queda en la base y la auditoría. */
function ListaAvisos({ puedeAnular, puedeEliminar, detalle }: { puedeAnular: boolean; puedeEliminar: boolean; detalle: boolean }) {
  const { t, existe, hora } = useI18n();
  const { ajustes, recargarAjustes } = usePanelDatos();
  const avisos = ajustes?.avisos ?? [];
  async function anular(id: number) {
    if (!(await confirmar(t("panel.av.confirmar_anular")))) return;
    try { await api(`/api/panel/avisos/${id}/anular`, {}); await recargarAjustes(); } catch (e) { toast(mensajeError(e, t, existe)); }
  }
  async function eliminar(id: number, titulo: string) {
    if (!(await confirmar(t("panel.av.confirmar_eliminar", { titulo }), t("panel.av.eliminar")))) return;
    try {
      await api(`/api/panel/avisos/${id}/eliminar`, {});
      toast(t("panel.av.eliminado"));
      await recargarAjustes();
    } catch (e) { toast(mensajeError(e, t, existe)); }
  }
  return (
    <section className={K.ficha} aria-labelledby="av-lista">
      <h2 id="av-lista" className={K.h2}>{t("panel.av.publicados")}</h2>
      {!ajustes ? (
        <Esperando className="mt-2">
          {[0, 1].map((i) => (
            <div key={i} aria-hidden="true" className="border-b border-regla py-3.5 last:border-b-0">
              <div className="flex items-center gap-2"><EsqueletoPildora /><EsqueletoBloque className="h-4.5 w-48 rounded-full" /></div>
              <EsqueletoLinea className="mt-1 w-2/3" />
              <EsqueletoLinea className="mt-2 w-full" /><EsqueletoLinea className="w-4/5" />
              {(puedeAnular || puedeEliminar) && <EsqueletoBloque className="mt-2 h-11 w-24 rounded-xl" />}
            </div>
          ))}
        </Esperando>
      ) : <div className="mt-2">
        {avisos.length ? avisos.map((a) => (
          <div key={a.id} className="border-b border-regla py-3.5 last:border-b-0">
            <div className="flex flex-wrap items-center gap-2">
              <Nivel n={a.nivel_cod} /> <b className="break-words">{a.titulo}</b>
              {!!a.anulado && <span className={K.pildora.apagado}>{t("panel.av.anulado")}</span>}
            </div>
            <p className={`${K.mini} mt-1`}>{a.ambito_nombre || a.ambito_tipo} · {hora(a.creado)} → {hora(a.vigente_hasta)}</p>
            <div className="mt-1.5 flex items-start gap-3">
              {a.flyer && <a href={a.flyer} target="_blank" rel="noopener" className="shrink-0"><img src={a.flyer} alt={t("panel.av.flyer.vista")} loading="lazy" className="h-20 w-16 rounded-lg border border-regla object-cover" /></a>}
              <p className="min-w-0 flex-1 text-sm break-words whitespace-pre-line">{a.texto}</p>
            </div>
            {a.alcance && <AlcanceAviso a={a} />}
            {detalle && a.alcance && a.alcance.vistas > 0 && <VerTelefonos tipo="aviso" id={a.id} />}
            {((puedeAnular && !a.anulado) || puedeEliminar) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {puedeAnular && !a.anulado && <button type="button" onClick={() => void anular(a.id)} className={K.btnChico}>{t("panel.av.anular")}</button>}
                {puedeEliminar && (
                  <button type="button" onClick={() => void eliminar(a.id, a.titulo)} className={K.btnNeutro}>
                    <Icono id="papelera" className="size-4.5" />{t("panel.av.eliminar")}
                  </button>
                )}
              </div>
            )}
          </div>
        )) : <p className={K.vacio}>{t("panel.av.sin_avisos")}</p>}
      </div>}
    </section>
  );
}

/** Alcance de un aviso: a cuántos teléfonos les llegó la notificación y cuántos lo abrieron (nunca quiénes). */
function AlcanceAviso({ a }: { a: Aviso }) {
  const { t } = useI18n();
  const x = a.alcance!;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-texto">
      <span className="inline-flex items-center gap-1"><Icono id="ojo" className="size-4 text-tinta" />{t(x.vistas === 1 ? "panel.alcance.vistas1" : "panel.alcance.vistas", { n: x.vistas })}</span>
      <span className="inline-flex items-center gap-1"><Icono id="campana" className="size-4 text-tinta" />{t("panel.alcance.push", { n: x.push })}</span>
      {x.enviados != null && <span className="text-gris">{t("panel.alcance.enviados", { n: x.enviados })}</span>}
    </p>
  );
}
