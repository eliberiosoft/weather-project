/* Albergues (superadmin y analista): título, descripción corta, ubicación en el mapa y hasta 3 fotos.
   La app los muestra en el mapa y traza la ruta para llegar. Eliminar es lógico (la API guarda la fila). */
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { api, mensajeError } from "../../shared/api/cliente";
import type { Albergue } from "../../shared/api/tipos";
import { useI18n } from "../../shared/i18n/useI18n";
import { ErrorCarga } from "../../shared/ui/Carga";
import { EsqueletoItemLista, Esperando } from "../../shared/ui/Esqueleto";
import { Icono } from "../../shared/ui/Icono";
import { K } from "../../shared/ui/clases";
import { confirmar, toast } from "../../shared/ui/avisos";
import { reducirFoto } from "../incidentes/foto";
import type { Eleccion } from "../incidentes/MapaUbicacion";
import { cuerpoAlbergue, faltaAlbergue, formDe, LADO_FOTO, MAX_DESC, MAX_FOTOS, MAX_NOMBRE, urlFotoAlbergue, type FormAlbergue } from "./formulario";

const MapaUbicacion = lazy(() => import("../incidentes/MapaUbicacion"));

export function Albergues() {
  const { t, existe } = useI18n();
  const [lista, setLista] = useState<Albergue[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [editando, setEditando] = useState<Albergue | null>(null);
  const [ronda, setRonda] = useState(0);         // un formulario nuevo vuelve a montar el mapa
  const cargar = useCallback(async () => {
    setError(null);
    try { setLista((await api<{ albergues: Albergue[] }>("/api/panel/albergues")).albergues); } catch (e) { setError(e); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const nuevo = () => { setEditando(null); setRonda((x) => x + 1); };
  const editar = (a: Albergue) => {
    setEditando(a);
    setRonda((x) => x + 1);
    document.getElementById("alb-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  async function eliminar(a: Albergue) {
    if (!(await confirmar(t("panel.alb.confirmar_eliminar", { nombre: a.nombre }), t("panel.alb.eliminar")))) return;
    try {
      await api(`/api/panel/albergues/${encodeURIComponent(a.id)}/eliminar`, {});
      toast(t("panel.alb.eliminado"));
      if (editando?.id === a.id) nuevo();
      await cargar();
    } catch (e) { toast(mensajeError(e, t, existe), 6000); }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
      <Formulario key={ronda} albergue={editando} alGuardar={async () => { nuevo(); await cargar(); }} alCancelar={nuevo} />
      <section className={K.ficha} aria-labelledby="alb-lista">
        <div className="flex items-center gap-2">
          <h2 id="alb-lista" className={K.h2}>{t("panel.alb.lista")}</h2>
          {lista && lista.length > 0 && <span className={K.pildora.suave}>{lista.length}</span>}
        </div>
        <p className={`${K.ayuda} mt-1`}>{t("panel.alb.lista_ayuda")}</p>
        <div className="mt-2">
          {error ? <ErrorCarga texto={mensajeError(error, t, existe)} reintentar={() => void cargar()} />
            : !lista ? <Esperando>{[0, 1, 2].map((i) => <EsqueletoItemLista key={i} />)}</Esperando>
            : !lista.length ? <p className={K.vacio}>{t("panel.alb.vacio")}</p>
            : lista.map((a) => (
              <article key={a.id} className={`flex items-start gap-3 border-b border-regla py-3.5 last:border-b-0 ${editando?.id === a.id ? "-mx-2 rounded-xl bg-tinta-suave px-2" : ""}`}>
                {a.fotos > 0
                  ? <img src={urlFotoAlbergue(a, 1)} alt="" loading="lazy" className="size-16 shrink-0 rounded-xl bg-suelo object-cover" />
                  : <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-suelo text-tinta"><Icono id="albergues" className="size-6" /></span>}
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold break-words">{a.nombre}</h3>
                  {a.descripcion && <p className="mt-0.5 line-clamp-2 text-sm break-words">{a.descripcion}</p>}
                  <p className={`${K.mini} mt-1`}>{t("panel.alb.fotos_n", { n: a.fotos })} · {a.lat.toFixed(5)}, {a.lon.toFixed(5)}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button type="button" onClick={() => editar(a)} className={K.btnChico}>{t("panel.alb.editar")}</button>
                    <button type="button" onClick={() => void eliminar(a)} className={K.btnNeutro}>
                      <Icono id="papelera" className="size-4.5" />{t("panel.alb.eliminar")}
                    </button>
                  </div>
                </div>
              </article>
            ))}
        </div>
      </section>
    </div>
  );
}

function Formulario({ albergue, alGuardar, alCancelar }: { albergue: Albergue | null; alGuardar: () => Promise<void>; alCancelar: () => void }) {
  const { t, existe } = useI18n();
  const [f, setF] = useState<FormAlbergue>(() => formDe(albergue));
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const enCurso = useRef(false);
  const poner = (p: Partial<FormAlbergue>) => setF((x) => ({ ...x, ...p }));
  const alElegir = useCallback((e: Eleccion) => {
    setF((x) => ({ ...x, lat: e.lat, lon: e.lon, dentro: e.dentro }));
    setAviso(e.dentro ? null : "panel.inc.fuera");
  }, []);

  async function agregarFotos(ev: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(ev.target.files ?? []);
    ev.target.value = "";
    const libres = MAX_FOTOS - f.fotos.length;
    if (!archivos.length || libres <= 0) return;
    if (archivos.length > libres) toast(t("panel.alb.fotos_tope", { n: MAX_FOTOS }));
    setLeyendo(true);
    try {
      const nuevas: string[] = [];
      for (const a of archivos.slice(0, libres)) {
        try { nuevas.push(await reducirFoto(a, LADO_FOTO)); } catch { toast(t("panel.inc.foto_error")); }
      }
      setF((x) => ({ ...x, fotos: [...x.fotos, ...nuevas.map((d) => ({ nueva: d }))].slice(0, MAX_FOTOS) }));
    } finally { setLeyendo(false); }
  }

  const quitar = (i: number) => setF((x) => ({ ...x, fotos: x.fotos.filter((_, j) => j !== i) }));
  const primero = (i: number) => setF((x) => ({ ...x, fotos: [x.fotos[i]!, ...x.fotos.filter((_, j) => j !== i)] }));

  async function guardar() {
    if (enCurso.current) return;
    const falta = faltaAlbergue(f);
    if (falta) { toast(t(falta)); return; }
    enCurso.current = true;
    setGuardando(true);
    try {
      if (albergue) await api(`/api/panel/albergues/${encodeURIComponent(albergue.id)}`, cuerpoAlbergue(f));
      else await api("/api/panel/albergues", cuerpoAlbergue(f));
      toast(t(albergue ? "panel.alb.guardado" : "panel.alb.creado"));
      await alGuardar();
    } catch (e) { toast(mensajeError(e, t, existe), 7000); } finally { enCurso.current = false; setGuardando(false); }
  }

  const punto: [number, number] | null = f.lat !== null && f.lon !== null ? [f.lat, f.lon] : null;
  return (
    <form id="alb-form" noValidate onSubmit={(e) => { e.preventDefault(); void guardar(); }} className={`${K.ficha} scroll-mt-24`} aria-labelledby="alb-titulo">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tinta-suave text-tinta"><Icono id="albergues" className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="alb-titulo" className={K.h2}>{albergue ? t("panel.alb.editando") : t("panel.alb.nuevo")}</h2>
          {albergue && <p className={`${K.mini} truncate`}>{albergue.nombre}</p>}
        </div>
      </div>
      <p className={`${K.ayuda} mt-2`}>{t("panel.alb.explica")}</p>

      <label htmlFor="alb-nombre" className={`mt-5 ${K.etiqueta}`}>{t("panel.alb.nombre")}</label>
      <input id="alb-nombre" value={f.nombre} maxLength={MAX_NOMBRE} onChange={(e) => poner({ nombre: e.target.value })}
        placeholder={t("panel.alb.nombre_ph")} className={K.campo} />

      <label htmlFor="alb-desc" className={`mt-4 ${K.etiqueta}`}>{t("panel.alb.descripcion")}</label>
      <textarea id="alb-desc" rows={3} maxLength={MAX_DESC} value={f.descripcion} onChange={(e) => poner({ descripcion: e.target.value })}
        aria-describedby="alb-desc-n" placeholder={t("panel.alb.descripcion_ph")} className={`${K.campo} resize-y`} />
      <p id="alb-desc-n" className={`${K.mini} mt-1 text-right tabular-nums`}>{f.descripcion.length}/{MAX_DESC}</p>

      <p className={`mt-3 ${K.etiqueta}`}>{t("panel.alb.ubicacion")}</p>
      <p className={`${K.mini} mb-2`}>{t("panel.alb.ubicacion_ayuda")}</p>
      <Suspense fallback={<div className="grid h-80 place-items-center rounded-2xl bg-suelo text-sm text-gris lg:h-96">{t("panel.inc.mapa_cargando")}</div>}>
        <MapaUbicacion modoCalle={false} altura={null} punto={punto} tramo={null} alElegir={alElegir} centrarEnPunto textosGps="panel.alb.gps_" />
      </Suspense>
      <p role="status" className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-texto empty:hidden">
        {punto && <><Icono id="pin" className="mt-0.5 size-4.5 shrink-0 text-tinta" />{t("panel.inc.ubicacion_elegida", { lat: punto[0].toFixed(5), lon: punto[1].toFixed(5) })}</>}
      </p>
      {aviso && <p role="alert" className={`${K.nota} mt-2`}><Icono id="alerta" className="size-5 text-tinta" />{t(aviso)}</p>}

      <p className={`mt-5 ${K.etiqueta}`}>{t("panel.alb.fotos", { n: MAX_FOTOS })}</p>
      <ul className="grid grid-cols-3 gap-2">
        {f.fotos.map((x, i) => (
          <li key={"n" in x ? `a${x.n}` : `n${i}-${x.nueva.length}`} className="relative">
            <img src={"n" in x && albergue ? urlFotoAlbergue(albergue, x.n) : "nueva" in x ? x.nueva : ""} alt={t("panel.alb.foto_alt", { n: i + 1 })}
              className="aspect-square w-full rounded-xl bg-suelo object-cover" />
            {i === 0 && f.fotos.length > 1 && <span className="absolute top-1.5 left-1.5 rounded-full bg-negro/70 px-2 py-0.5 text-xs font-semibold text-white">{t("panel.alb.portada")}</span>}
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1.5">
              {i > 0 && (
                <button type="button" onClick={() => primero(i)} aria-label={t("panel.alb.hacer_portada", { n: i + 1 })} title={t("panel.alb.hacer_portada", { n: i + 1 })}
                  className="grid size-9 place-items-center rounded-full bg-papel text-tinta shadow-flota"><Icono id="atras" className="size-4.5" /></button>
              )}
              <button type="button" onClick={() => quitar(i)} aria-label={t("panel.alb.quitar_foto", { n: i + 1 })} title={t("panel.alb.quitar_foto", { n: i + 1 })}
                className="grid size-9 place-items-center rounded-full bg-papel text-texto shadow-flota"><Icono id="cerrar" className="size-4.5" /></button>
            </div>
          </li>
        ))}
        {f.fotos.length < MAX_FOTOS && (
          <li>
            <label className="grid aspect-square w-full cursor-pointer place-items-center content-center gap-1 rounded-xl border-2 border-dashed border-regla bg-suelo text-center text-xs font-semibold text-tinta transition hover:bg-tinta-suave has-focus-visible:ring-4 has-focus-visible:ring-tinta/25">
              <Icono id={leyendo ? "nube" : "foto"} className={`size-6 ${leyendo ? "animate-pulse" : ""}`} />
              {t(leyendo ? "panel.alb.fotos_leyendo" : "panel.alb.foto_agregar")}
              <input type="file" accept="image/*" multiple onChange={(e) => void agregarFotos(e)} disabled={leyendo} className="sr-only" />
            </label>
          </li>
        )}
      </ul>
      <p className={`${K.mini} mt-1.5`}>{t("panel.alb.fotos_ayuda")}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="submit" disabled={guardando || leyendo} className={`${K.btnPrimario} flex-1`}>
          <Icono id="check" className="size-5" />{t(guardando ? "panel.alb.guardando" : albergue ? "panel.alb.guardar" : "panel.alb.crear")}
        </button>
        {albergue && <button type="button" onClick={alCancelar} className={K.btnNeutro}>{t("panel.alb.cancelar")}</button>}
      </div>
    </form>
  );
}
