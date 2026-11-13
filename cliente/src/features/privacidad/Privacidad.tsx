/* «Privacidad y cookies»: la política en lenguaje llano y el botón para borrar lo que la app guardó en el teléfono. */
import { useEffect, useState } from "react";
import { PREFIJO } from "../../shared/almacen";
import { Html } from "../../shared/componentes/Html";
import { Icono } from "../../shared/componentes/Icono";
import { Vista } from "../../shared/componentes/Vista";
import { K } from "../../shared/estilo";
import { useI18n } from "../../shared/i18n";
import { bajaPush } from "../avisos/push";
import { BUILD } from "../pwa/version";

const SECCIONES = ["resp", "cookies", "cuenta", "local", "cache", "terceros", "reportes", "derechos"];
const CUERPO = "mt-2 text-sm leading-relaxed text-pretty [&_li]:text-pretty [&_a]:font-semibold [&_b]:font-semibold [&_li]:mt-1.5 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5";
// bases que crea Firebase si se activaron las notificaciones push
const BASES_FIREBASE = ["firebase-messaging-database", "firebase-installations-database", "firebase-heartbeat-database"];

/** Borra ay_*, todas las cachés, el service worker (y con él la suscripción push) y las bases de Firebase. */
async function borrarTodo(): Promise<void> {
  await bajaPush();
  try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIJO)).forEach((k) => localStorage.removeItem(k)); } catch { /* modo privado */ }
  try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* sin caché */ }
  try { for (const r of (await navigator.serviceWorker?.getRegistrations()) || []) await r.unregister(); } catch { /* sin service worker */ }
  try { for (const b of BASES_FIREBASE) indexedDB.deleteDatabase(b); } catch { /* sin IndexedDB */ }
  location.replace(location.pathname);
}

export function Privacidad() {
  const { t, idioma } = useI18n();
  const [confirmar, setConfirmar] = useState(false);
  // primer toque: pide confirmar sin abrir un diálogo; a los 5 s vuelve solo
  useEffect(() => {
    if (!confirmar) return;
    const h = setTimeout(() => setConfirmar(false), 5000);
    return () => clearTimeout(h);
  }, [confirmar]);
  // al cambiar de idioma se repone el botón (no queda a medio confirmar)
  const [idiomaVisto, setIdiomaVisto] = useState(idioma);
  if (idioma !== idiomaVisto) { setIdiomaVisto(idioma); setConfirmar(false); }

  return (
    <Vista id="privacidad" etiqueta="app.priv.titulo" className={K.vista}>
      <h1 className={K.h1}>{t("app.priv.titulo")}</h1>
      <p className="mt-1 text-sm text-gris">{t("app.priv.fecha")}</p>
      <p className="text-xs text-gris">{t("app.version.etq", { v: BUILD })}</p>
      <p className="mt-3 text-sm">{t("app.priv.resumen")}</p>
      {SECCIONES.map((s) => (
        <section key={s} className={`mt-3 ${K.ficha}`}>
          <h2 className="text-lg font-bold">{t(`app.priv.${s}.t`)}</h2>
          <Html como="div" className={CUERPO} clave={`app.priv.${s}.c`} />
        </section>
      ))}
      <section className={`mt-3 mb-2 ${K.ficha}`}>
        <h2 className="text-lg font-bold">{t("app.priv.borrar.t")}</h2>
        <p className="mt-2 text-sm">{t("app.priv.borrar.c")}</p>
        <button type="button" onClick={() => (confirmar ? void borrarTodo() : setConfirmar(true))}
          className={`mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/80 px-4 font-semibold text-tinta ring-1 ring-regla active:scale-[.98] [&.confirmar]:bg-negro [&.confirmar]:text-white [&.confirmar]:ring-negro ${confirmar ? "confirmar" : ""}`}>
          <Icono id="i-x" className="size-5" /><span>{t(confirmar ? "app.priv.borrar.confirmar" : "app.priv.borrar.btn")}</span>
        </button>
      </section>
    </Vista>
  );
}
