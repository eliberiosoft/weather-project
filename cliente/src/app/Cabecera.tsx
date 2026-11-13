import { Icono } from "../shared/componentes/Icono";
import { I18N, useI18n } from "../shared/i18n";
import { toast, useApp } from "../shared/store";
import { enviarCola } from "../features/reportar/cola";
import { BotonCuenta } from "../features/cuenta/MenuCuenta";
import { BarraCarga } from "./BarraCarga";
import { pedirLlamada911 } from "./Llamar911";

/** Marca, aviso de sin conexión, idioma, llamada al ECU 911 (siempre a un toque), «Mi cuenta» y la barra de carga en el borde. */
export function Cabecera() {
  const { t, idioma } = useI18n();
  const sinRed = useApp((s) => s.sinRed);
  return (
    <header className="sticky top-0 z-[1000] flex h-14 flex-none items-center gap-2 border-b border-white/50 bg-white/55 px-4 backdrop-blur-md">
      <img src="icono.svg" alt="" width="32" height="32" className="size-8 rounded-xl shadow-ficha" />
      <span className="min-w-0 truncate text-lg font-bold tracking-tight text-texto">{t("app.marca")}</span>
      <EstadoEnvio sinRed={sinRed} />
      <label htmlFor="idioma" className="sr-only">{t("idioma.etq")}</label>
      <select id="idioma" value={idioma} onChange={(e) => I18N.cambiar(e.target.value)} className="ml-auto h-9 rounded-full bg-white/70 px-3 text-sm font-semibold text-texto">
        {Object.keys(I18N.IDIOMAS).map((c) => <option key={c} value={c} lang={c}>{c.toUpperCase()}</option>)}
      </select>
      <button type="button" onClick={pedirLlamada911} aria-label={t("app.llamar.etq")} aria-haspopup="dialog" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-negro px-3.5 text-sm font-bold text-white active:scale-95">
        <Icono id="i-tel" className="size-4.5" /><span>{t("app.llamar.corto")}</span>
      </button>
      <BotonCuenta />
      <BarraCarga />
    </header>
  );
}

/** Sin señal y reportes por enviar, en una sola pastilla: el ícono dice si hay red; el número, cuántos esperan.
    Tocarla explica que se enviarán solos (o, si ya hay red, los manda en ese momento). */
function EstadoEnvio({ sinRed }: { sinRed: boolean }) {
  const { t } = useI18n();
  const n = useApp((s) => s.colaPendiente);
  const enviando = useApp((s) => s.sincronizando);
  const offline = useApp((s) => !s.enLinea);
  if (!n) {
    return (
      <span hidden={!sinRed} role="img" aria-label={t("app.red.no")} title={t("app.red.no")} className="grid size-8 shrink-0 place-items-center rounded-full bg-negro text-white">
        <Icono id="i-sinred" className="size-4.5" />
      </span>
    );
  }
  const etiqueta = t(enviando ? "app.cola.enviando" : "app.cola.etq", { n });
  const tocar = () => {
    if (navigator.onLine) { void enviarCola(); toast(t("app.cola.enviando")); }
    else toast(t("app.cola.espera", { n }), 6000);
  };
  return (
    <button type="button" onClick={tocar} aria-label={etiqueta} title={etiqueta}
      className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-sm font-bold tabular-nums active:scale-95 ${offline || sinRed ? "bg-negro text-white" : "bg-tinta-suave text-tinta"}`}>
      <Icono id={offline ? "i-sinred" : "i-nube"} className={`size-4.5 ${enviando ? "animate-pulse" : ""}`} />
      {n}
    </button>
  );
}
