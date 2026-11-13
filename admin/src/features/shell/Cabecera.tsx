/* Cabecera: nombre del panel, hora del cálculo, instalar, idioma y la cuenta (cambiar clave / salir).
   En su borde inferior, la barra global de carga (spec 015). */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Usuario } from "../../shared/api/tipos";
import { I18N, useI18n } from "../../shared/i18n/useI18n";
import { BarraCarga } from "../../shared/ui/Carga";
import { Icono } from "../../shared/ui/Icono";
import { confirmar, toast } from "../../shared/ui/avisos";
import { cerrarSesion, pedirCambioClave } from "../auth/sesion";
import { borrarMios, enviarCola, pendientesDe, useCola } from "../incidentes/cola";
import { useInstalar } from "../pwa/pwa";

const PILDORA = "inline-flex h-11 items-center gap-1.5 rounded-full bg-tinta-suave px-3 text-sm font-semibold whitespace-nowrap text-tinta transition hover:brightness-95";

export function Cabecera({ usuario, calculo }: { usuario?: Usuario; calculo?: string | null }) {
  const { t, idioma, hora } = useI18n();
  const instalado = useCallback(() => toast(t("panel.instalar.ok")), [t]);
  const instalar = useInstalar(instalado);
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-regla bg-papel/90 px-4 backdrop-blur sm:gap-3 lg:px-6">
      <div className="min-w-0">
        <p className="truncate text-lg leading-tight font-bold text-texto">{t("panel.cab.titulo")}</p>
        <p className="hidden truncate text-xs text-gris sm:block">{t("panel.cab.sub")}</p>
      </div>
      {calculo && <span className="ml-auto hidden rounded-full bg-suelo px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-gris lg:inline">{t("panel.cab.calculo", { hora: hora(calculo) })}</span>}
      <div className={`flex items-center gap-2 ${calculo ? "ml-auto lg:ml-0" : "ml-auto"}`}>
        {instalar && (
          <button type="button" onClick={() => void instalar()} aria-label={t("panel.instalar")} title={t("panel.instalar")} className={PILDORA}>
            <Icono id="instalar" className="size-4.5" /><span className="hidden md:inline">{t("panel.instalar")}</span>
          </button>
        )}
        <label className="sr-only" htmlFor="idioma">{t("idioma.etq")}</label>
        <select id="idioma" value={idioma} onChange={(e) => I18N.cambiar(e.target.value)} className="h-11 rounded-full border-0 bg-suelo px-3 text-sm font-semibold text-texto">
          {Object.entries(I18N.IDIOMAS).map(([c, n]) => <option key={c} value={c} lang={c} aria-label={n}>{c.toUpperCase()}</option>)}
        </select>
        {usuario && <EstadoEnvio usuarioId={usuario.id} />}
        {usuario && <MenuCuenta usuario={usuario} />}
      </div>
      <BarraCarga />
    </header>
  );
}

function MenuCuenta({ usuario }: { usuario: Usuario }) {
  const { t } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto]);
  return (
    <div ref={caja} className="relative">
      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-controls="menu-cuenta"
        aria-label={t("panel.usuario.menu", { nombre: usuario.nombre })} className={PILDORA}>
        <Icono id="usuario" className="size-4.5" /><span className="hidden max-w-40 truncate md:inline">{usuario.nombre}</span>
      </button>
      {abierto && (
        <div id="menu-cuenta" className="absolute top-full right-0 mt-2 w-64 animate-entra rounded-2xl bg-papel p-2 shadow-flota">
          <div className="px-3 py-2">
            <p className="truncate font-semibold">{usuario.nombre}</p>
            <p className="truncate text-xs text-gris"><span className="font-mono">{usuario.usuario}</span> · {t("rol." + usuario.rol)}</p>
          </div>
          <button type="button" onClick={() => { setAbierto(false); pedirCambioClave(false); }}
            className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-texto transition hover:bg-suelo">
            <Icono id="llave" className="size-4.5 text-tinta" />{t("panel.usuario.cambiar_clave")}
          </button>
          <button type="button" onClick={() => { setAbierto(false); void salir(usuario.id, t); }}
            className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-texto transition hover:bg-suelo">
            <Icono id="salir" className="size-4.5 text-tinta" />{t("panel.salir")}
          </button>
        </div>
      )}
    </div>
  );
}

/** ¿Hay red? En una sola pastilla con los incidentes guardados por enviar. Tocarla lleva a Incidentes
    y, si ya hay señal, los publica en ese momento. */
function EstadoEnvio({ usuarioId }: { usuarioId: number }) {
  const { t } = useI18n();
  const { items, enviando } = useCola(usuarioId);
  const enLinea = useEnLinea();
  const n = items.length;
  if (enLinea && !n) return null;
  const etiqueta = !n ? t("panel.sin_red_corto") : t(enviando ? "panel.cola.enviando" : enLinea ? "panel.cola.etq" : "panel.cola.explica", { n });
  const tocar = () => {
    location.hash = "#incidentes";
    if (navigator.onLine && n) void enviarCola(usuarioId);
    else toast(etiqueta, 6000);
  };
  return (
    <button type="button" onClick={tocar} aria-label={etiqueta} title={etiqueta}
      className={`inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold tabular-nums transition active:scale-95 ${enLinea ? "bg-tinta-suave text-tinta" : "bg-negro text-white"}`}>
      <Icono id={enLinea ? "nube" : "sinred"} className={`size-4.5 ${enviando ? "animate-pulse" : ""}`} />
      {n ? n : <span className="hidden sm:inline">{t("panel.sin_red_corto")}</span>}
    </button>
  );
}

function useEnLinea(): boolean {
  return useSyncExternalStore((o) => {
    window.addEventListener("online", o);
    window.addEventListener("offline", o);
    return () => { window.removeEventListener("online", o); window.removeEventListener("offline", o); };
  }, () => navigator.onLine);
}

/** Salir. Si quedan incidentes guardados sin enviar, se avisa: salir los borra de este equipo (puede ser compartido);
    quedarse permite que se publiquen cuando vuelva la señal. */
async function salir(usuarioId: number, t: (k: string, v?: Record<string, string | number>) => string): Promise<void> {
  const n = pendientesDe(usuarioId);
  if (n) {
    if (!(await confirmar(t("panel.cola.salir", { n }), t("panel.cola.salir_si")))) return;
    borrarMios(usuarioId);
  }
  await cerrarSesion();
}
