/* Configuración del superadmin: anonimato de los incidentes del equipo (se aplica al leer, también a lo ya publicado)
   y si lo que publica el operador sale validado o queda pendiente de revisión. */
import { useCallback, useEffect, useState } from "react";
import { api, mensajeError } from "../../shared/api/cliente";
import type { ConfigPanel } from "../../shared/api/tipos";
import { useI18n } from "../../shared/i18n/useI18n";
import { ErrorCarga } from "../../shared/ui/Carga";
import { EsqueletoBloque, EsqueletoLinea, Esperando } from "../../shared/ui/Esqueleto";
import { K } from "../../shared/ui/clases";
import { confirmar, toast } from "../../shared/ui/avisos";

/** Cada opción: su clave en /api/panel/config y el prefijo de sus textos (titulo, explica, estado_si/no, confirmar_si/no). */
const OPCIONES: { clave: "incidentes_anonimos" | "operador_valida_directo"; textos: string }[] = [
  { clave: "incidentes_anonimos", textos: "panel.cfg.anon" },
  { clave: "operador_valida_directo", textos: "panel.cfg.op" },
];

export function Configuracion() {
  const { t, existe } = useI18n();
  const [cfg, setCfg] = useState<ConfigPanel | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setCfg(await api<ConfigPanel>("/api/panel/config")); } catch (e) { setError(e); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  async function cambiar(clave: keyof ConfigPanel, textos: string, valor: boolean) {
    if (!(await confirmar(t(`${textos}.confirmar_${valor ? "si" : "no"}`)))) return;
    setGuardando(true);
    try {
      await api("/api/panel/config", { [clave]: valor });
      toast(t("panel.cfg.guardado"));
      await cargar();
    } catch (e) { toast(mensajeError(e, t, existe), 6000); } finally { setGuardando(false); }
  }

  if (error) return <ErrorCarga texto={mensajeError(error, t, existe)} reintentar={() => void cargar()} />;
  if (!cfg) return (
    <Esperando className={`${K.ficha} max-w-3xl`}>
      <h2 className={K.h2}>{t("panel.cfg.titulo")}</h2>
      {OPCIONES.map((o) => (
        // sin el fondo suelo de la caja real: sobre suelo los bloques no se verían; el filo interior no ocupa lugar
        <div key={o.clave} className="mt-4 flex items-start justify-between gap-4 rounded-2xl p-4 ring-1 ring-regla ring-inset">
          <div className="min-w-0 flex-1">
            <EsqueletoLinea className="w-4/5 max-w-56" />
            <EsqueletoLinea className="mt-2 w-full max-w-[65ch]" /><EsqueletoLinea className="w-3/4" />
          </div>
          <EsqueletoBloque className="mt-0.5 h-11 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </Esperando>
  );
  return (
    <section className={`${K.ficha} max-w-3xl`} aria-labelledby="cfg-titulo">
      <h2 id="cfg-titulo" className={K.h2}>{t("panel.cfg.titulo")}</h2>
      {OPCIONES.map(({ clave, textos }) => {
        const on = cfg[clave];
        return (
          <div key={clave} className="mt-4 rounded-2xl bg-suelo p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id={"cfg-" + clave} className="font-semibold">{t(textos + ".titulo")}</p>
                <p id={"cfg-" + clave + "-explica"} className="mt-1 max-w-[65ch] text-sm text-gris">{t(textos + ".explica")}</p>
              </div>
              <button type="button" role="switch" aria-checked={on} aria-labelledby={"cfg-" + clave} aria-describedby={"cfg-" + clave + "-explica"}
                disabled={guardando} onClick={() => void cambiar(clave, textos, !on)}
                className="group relative mt-0.5 inline-flex h-11 w-16 shrink-0 items-center rounded-full p-1 transition disabled:opacity-60 aria-checked:bg-tinta bg-regla">
                <span className="size-9 rounded-full bg-papel shadow-ficha transition group-aria-checked:translate-x-5" />
              </button>
            </div>
            <p role="status" className="mt-3 text-sm font-semibold">{t(textos + (on ? ".estado_si" : ".estado_no"))}</p>
          </div>
        );
      })}
      <ValidacionVecinos cfg={cfg} alGuardar={cargar} />
    </section>
  );
}

/** Validación por vecinos: el interruptor y sus tres números (con los rangos que acepta la API). */
const RANGOS = { validacion_minimo: [2, 10], validacion_radio_m: [50, 2000], validacion_horas: [1, 48] } as const;

function ValidacionVecinos({ cfg, alGuardar }: { cfg: ConfigPanel; alGuardar: () => Promise<void> }) {
  const { t, existe } = useI18n();
  const [v, setV] = useState({ validacion_minimo: cfg.validacion_minimo, validacion_radio_m: cfg.validacion_radio_m, validacion_horas: cfg.validacion_horas });
  const [guardando, setGuardando] = useState(false);
  const cambiado = (Object.keys(v) as (keyof typeof v)[]).some((k) => v[k] !== cfg[k]);

  async function guardar(cambios: Partial<ConfigPanel>) {
    setGuardando(true);
    try { await api("/api/panel/config", cambios); toast(t("panel.cfg.guardado")); await alGuardar(); }
    catch (e) { toast(mensajeError(e, t, existe), 6000); } finally { setGuardando(false); }
  }
  const campo = (k: keyof typeof RANGOS, etq: string) => (
    <label key={k} className="block">
      <span className={K.etiquetaChica}>{t(etq)}</span>
      <input type="number" min={RANGOS[k][0]} max={RANGOS[k][1]} value={v[k]} disabled={!cfg.validacion_vecinos || guardando}
        onChange={(e) => setV((x) => ({ ...x, [k]: Math.min(RANGOS[k][1], Math.max(RANGOS[k][0], Number(e.target.value) || RANGOS[k][0])) }))}
        className={`${K.campoChico} w-full tabular-nums`} />
    </label>
  );
  return (
    <div className="mt-4 rounded-2xl bg-suelo p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id="cfg-vecinos" className="font-semibold">{t("panel.cfg.vec.titulo")}</p>
          <p id="cfg-vecinos-explica" className="mt-1 max-w-[65ch] text-sm text-gris">{t("panel.cfg.vec.explica")}</p>
        </div>
        <button type="button" role="switch" aria-checked={cfg.validacion_vecinos} aria-labelledby="cfg-vecinos" aria-describedby="cfg-vecinos-explica"
          disabled={guardando} onClick={() => void guardar({ validacion_vecinos: !cfg.validacion_vecinos })}
          className="group relative mt-0.5 inline-flex h-11 w-16 shrink-0 items-center rounded-full p-1 transition disabled:opacity-60 aria-checked:bg-tinta bg-regla">
          <span className="size-9 rounded-full bg-papel shadow-ficha transition group-aria-checked:translate-x-5" />
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {campo("validacion_minimo", "panel.cfg.vec.minimo")}
        {campo("validacion_radio_m", "panel.cfg.vec.radio")}
        {campo("validacion_horas", "panel.cfg.vec.horas")}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm font-semibold">
          {cfg.validacion_vecinos
            ? `${t("panel.cfg.vec.estado_si")}: ${t("panel.cfg.vec.resumen", { n: cfg.validacion_minimo, m: cfg.validacion_radio_m, h: cfg.validacion_horas })}`
            : t("panel.cfg.vec.estado_no")}
        </p>
        <button type="button" disabled={!cambiado || guardando || !cfg.validacion_vecinos} onClick={() => void guardar(v)} className={K.btnChicoFuerte}>{t("panel.cfg.vec.guardar")}</button>
      </div>
    </div>
  );
}
