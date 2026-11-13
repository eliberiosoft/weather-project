/* Reglas limnimétricas: lecturas de los vigías (a mano o pegando el WhatsApp), borde de desborde por punto y últimas lecturas. */
import { useMemo, useState } from "react";
import { api, mensajeError } from "../../shared/api/cliente";
import type { Ajustes } from "../../shared/api/tipos";
import { deLocal } from "../../shared/formato";
import { Rico } from "../../shared/i18n/rico";
import { useI18n } from "../../shared/i18n/useI18n";
import { ErrorCarga } from "../../shared/ui/Carga";
import { EsqueletoBloque, EsqueletoCampo, EsqueletoFilas, EsqueletoLinea, Esperando } from "../../shared/ui/Esqueleto";
import { K } from "../../shared/ui/clases";
import { toast } from "../../shared/ui/avisos";
import { usePanelDatos } from "../datos/PanelDatos";
import { leerWhatsApp, type Tendencia } from "./whatsapp";

export function Reglas() {
  const { t, existe } = useI18n();
  const { ajustes, error, recargarTodo } = usePanelDatos();
  if (error && !ajustes) return <ErrorCarga texto={mensajeError(error, t, existe)} reintentar={recargarTodo} />;
  if (!ajustes) return <EsqueletoReglas />;
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <FormLectura ajustes={ajustes} />
        <Bordes ajustes={ajustes} />
      </div>
      <UltimasLecturas ajustes={ajustes} />
    </div>
  );
}

const puntosOrdenados = (a: Ajustes) => Object.values(a.puntos).sort((x, y) => x.id.localeCompare(y.id));

function FormLectura({ ajustes }: { ajustes: Ajustes }) {
  const { t, existe } = useI18n();
  const { recargarAjustes, recargarEstado } = usePanelDatos();
  const puntos = useMemo(() => puntosOrdenados(ajustes), [ajustes]);
  const [punto, setPunto] = useState(puntos[0]?.id ?? "");
  const [lectura, setLectura] = useState("");
  const [tendencia, setTendencia] = useState<Tendencia>("");
  const [hora, setHora] = useState("");
  const [vigia, setVigia] = useState("");
  const [lluvia, setLluvia] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  function pegar() {
    const l = leerWhatsApp(mensaje);
    if (!l) { toast(t("panel.reg.mal_formato")); return; }
    if (puntos.some((p) => p.id === l.punto)) setPunto(l.punto);
    if (l.hora) setHora(l.hora);
    setLectura(l.lectura);
    setTendencia(l.tendencia);
    setLluvia(l.lluvia);
    toast(t("panel.reg.revisa"));
  }

  async function guardar() {
    setEnviando(true);
    try {
      await api("/api/panel/lectura", { punto_id: punto, lectura_m: lectura, tendencia, hora: deLocal(hora), vigia, lluvia });
      toast(t("panel.reg.guardada"));
      setLectura("");
      setMensaje("");
      await recargarAjustes();
      recargarEstado(true).catch(() => {});
    } catch (e) { toast(mensajeError(e, t, existe), 6000); } finally { setEnviando(false); }
  }

  return (
    <section className={K.ficha} aria-labelledby="reg-lectura">
      <h2 id="reg-lectura" className={K.h2}>{t("panel.reg.lectura_titulo")}</h2>
      <label htmlFor="l-punto" className={`mt-4 ${K.etiqueta}`}>{t("panel.reg.punto")}</label>
      <select id="l-punto" value={punto} onChange={(e) => setPunto(e.target.value)} className={K.campo}>
        {puntos.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.rio} · {p.sitio}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="l-lectura" className={`mt-4 ${K.etiqueta}`}>{t("panel.reg.lectura")}</label>
          <input id="l-lectura" inputMode="decimal" value={lectura} onChange={(e) => setLectura(e.target.value)} placeholder={t("panel.reg.lectura_ph")} className={`${K.campo} tabular-nums`} />
        </div>
        <div>
          <label htmlFor="l-tend" className={`mt-4 ${K.etiqueta}`}>{t("panel.reg.tendencia")}</label>
          <select id="l-tend" value={tendencia} onChange={(e) => setTendencia(e.target.value as Tendencia)} className={K.campo}>
            <option value="">{t("panel.reg.t.vacia")}</option>
            <option value="sube">{t("panel.reg.t.sube")}</option>
            <option value="igual">{t("panel.reg.t.igual")}</option>
            <option value="baja">{t("panel.reg.t.baja")}</option>
          </select>
        </div>
      </div>
      <label htmlFor="l-hora" className={`mt-4 ${K.etiqueta}`}>{t("panel.reg.hora")}</label>
      <input id="l-hora" type="datetime-local" value={hora} onChange={(e) => setHora(e.target.value)} className={K.campo} />
      <label htmlFor="l-vigia" className={`mt-4 ${K.etiqueta}`}>{t("panel.reg.vigia")}</label>
      <input id="l-vigia" value={vigia} maxLength={60} onChange={(e) => setVigia(e.target.value)} placeholder={t("panel.reg.vigia_ph")} className={K.campo} />
      <label className="mt-4 flex min-h-11 items-center gap-2.5 text-sm">
        <input type="checkbox" checked={lluvia} onChange={(e) => setLluvia(e.target.checked)} className="size-5" /> {t("panel.reg.lloviendo")}
      </label>
      <button type="button" disabled={enviando || !lectura} onClick={guardar} className={`${K.btnPrimario} mt-4 w-full`}>{t("panel.reg.guardar")}</button>
      <p className="mt-5 text-sm text-gris"><Rico texto={t("panel.reg.formato")} /></p>
      <div className="mt-2 flex gap-2">
        <input value={mensaje} onChange={(e) => setMensaje(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") pegar(); }}
          placeholder={t("panel.reg.pegar_ph")} aria-label={t("panel.reg.pegar_etq")} className={`${K.campo} min-w-0 flex-1`} />
        <button type="button" onClick={pegar} className={K.btnSecundario}>{t("panel.reg.leer")}</button>
      </div>
    </section>
  );
}

function Bordes({ ajustes }: { ajustes: Ajustes }) {
  const { t } = useI18n();
  const puntos = useMemo(() => puntosOrdenados(ajustes), [ajustes]);
  return (
    <section className={K.ficha} aria-labelledby="reg-borde">
      <h2 id="reg-borde" className={K.h2}>{t("panel.reg.borde_titulo")}</h2>
      <p className="mt-2 text-sm text-gris">{t("panel.reg.borde_explica")}</p>
      <table className={`${K.tabla} mt-3 [&_td]:align-middle`}>
        <CabezaBordes />
        <tbody>
          {puntos.map((p) => <FilaBorde key={p.id} id={p.id} rio={p.rio} borde={ajustes.reglas[p.id]?.borde_m ?? null} />)}
        </tbody>
      </table>
    </section>
  );
}

function FilaBorde({ id, rio, borde }: { id: string; rio: string; borde: number | null }) {
  const { t, existe } = useI18n();
  const { recargarAjustes, recargarEstado } = usePanelDatos();
  const [valor, setValor] = useState<string | null>(null);
  const mostrado = valor ?? (borde ?? "").toString();
  async function guardar() {
    try {
      await api("/api/panel/regla", { punto_id: id, borde_m: mostrado });
      toast(t("panel.reg.borde_guardado"));
      setValor(null);
      await recargarAjustes();
      recargarEstado(true).catch(() => {});
    } catch (e) { toast(mensajeError(e, t, existe), 6000); }
  }
  return (
    <tr>
      <td><b>{id}</b> <span className={K.mini}>{rio}</span></td>
      <td><input value={mostrado} onChange={(e) => setValor(e.target.value)} inputMode="decimal" aria-label={t("panel.reg.borde_etq", { punto: id })} className={`${K.campoChico} min-h-11 w-24 tabular-nums`} /></td>
      <td><button type="button" onClick={guardar} className={K.btnChico}>{t("panel.reg.guardar_borde")}</button></td>
    </tr>
  );
}

function UltimasLecturas({ ajustes }: { ajustes: Ajustes }) {
  const { t, existe, hora } = useI18n();
  const filas = useMemo(() => Object.values(ajustes.lecturas).flat().sort((a, b) => b.creado.localeCompare(a.creado)).slice(0, 40), [ajustes]);
  return (
    <section className={K.ficha} aria-labelledby="reg-ultimas">
      <h2 id="reg-ultimas" className={K.h2}>{t("panel.reg.ultimas")}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className={`${K.tabla} tabular-nums`}>
          <CabezaLecturas />
          <tbody>
            {filas.length ? filas.map((l, i) => (
              <tr key={l.creado + l.punto_id + i}>
                <td>{hora(l.creado)}</td><td>{l.punto_id}</td><td>{l.lectura_m} m</td>
                <td>{l.tendencia && existe("panel.reg.t." + l.tendencia) ? t("panel.reg.t." + l.tendencia) : l.tendencia ?? ""}</td>
                <td>{l.lluvia ? t("panel.reg.lluvia_si") : ""}</td><td>{l.vigia ?? ""}</td>
              </tr>
            )) : <tr><td colSpan={6} className={K.vacio}>{t("panel.reg.sin_lecturas")}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CabezaBordes() {
  const { t } = useI18n();
  return <thead><tr><th scope="col">{t("panel.col.punto")}</th><th scope="col">{t("panel.col.borde")}</th><th scope="col"><span className="sr-only">{t("panel.col.acciones")}</span></th></tr></thead>;
}

function CabezaLecturas() {
  const { t } = useI18n();
  return (
    <thead><tr>
      <th scope="col">{t("panel.col.hora")}</th><th scope="col">{t("panel.col.punto")}</th><th scope="col">{t("panel.col.lectura")}</th>
      <th scope="col">{t("panel.col.tendencia")}</th><th scope="col">{t("panel.col.lluvia")}</th><th scope="col">{t("panel.col.vigia")}</th>
    </tr></thead>
  );
}

/** Mientras llegan los ajustes: el formulario de lectura, la tabla de bordes y la de últimas lecturas, en gris. */
function EsqueletoReglas() {
  const { t } = useI18n();
  return (
    <Esperando className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className={K.ficha}>
          <h2 className={K.h2}>{t("panel.reg.lectura_titulo")}</h2>
          <EsqueletoCampo etiqueta="w-28" />
          <div className="grid grid-cols-2 gap-3"><EsqueletoCampo etiqueta="w-24" /><EsqueletoCampo etiqueta="w-24" /></div>
          <EsqueletoCampo etiqueta="w-36" />
          <EsqueletoCampo etiqueta="w-20" />
          <EsqueletoLinea className="mt-6 mb-4 w-40" />
          <EsqueletoBloque className="mt-4 h-11 rounded-xl" />
          <EsqueletoLinea className="mt-5 w-11/12" />
          <EsqueletoLinea className="w-2/3" />
          <EsqueletoBloque className="mt-2 h-11.5 rounded-xl" />
        </div>
        <div className={K.ficha}>
          <h2 className={K.h2}>{t("panel.reg.borde_titulo")}</h2>
          <div className="mt-2"><EsqueletoLinea /><EsqueletoLinea className="w-3/4" /></div>
          <table className={`${K.tabla} mt-3 [&_td]:align-middle`}>
            <CabezaBordes />
            <tbody>
              <EsqueletoFilas filas={5} celdas={["w-28", <EsqueletoBloque className="h-11 w-24 rounded-xl" />, <EsqueletoBloque className="h-11 w-24 rounded-xl" />]} />
            </tbody>
          </table>
        </div>
      </div>
      <div className={K.ficha}>
        <h2 className={K.h2}>{t("panel.reg.ultimas")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className={K.tabla}>
            <CabezaLecturas />
            <tbody><EsqueletoFilas filas={4} celdas={["w-24", "w-10", "w-14", "w-16", "w-8", "w-20"]} /></tbody>
          </table>
        </div>
      </div>
    </Esperando>
  );
}
