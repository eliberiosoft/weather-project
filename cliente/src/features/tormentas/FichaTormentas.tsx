/* Ficha «Tormentas cerca» de «Mi lugar»: el aviso en una línea, rayos y lluvia de la próxima hora, y el botón a la
   vista con el mapa. Pide el resumen liviano (sin puntos ni imágenes) en segundo plano: no mueve la barra de carga. */
import type { CSSProperties } from "react";
import { EsqueletoLineas } from "../../shared/componentes/Esqueleto";
import { Icono } from "../../shared/componentes/Icono";
import { K } from "../../shared/estilo";
import { useI18n } from "../../shared/i18n";
import { irA } from "../../shared/navegacion";
import { useApp } from "../../shared/store";
import { useResumenTormentas } from "./datos";
import { RadarTormentas } from "./RadarTormentas";
import { horaCorta } from "../../shared/formato";
import { hayQueMirar, horaSatelite, tendencia, textoLluvia, textoRayos, titular } from "./texto";

export function FichaTormentas({ className = "", style }: { className?: string; style?: CSSProperties }) {
  const { t } = useI18n();
  const activa = useApp((s) => s.vista === "inicio");
  const { datos, carga } = useResumenTormentas(activa);
  const mirar = datos ? hayQueMirar(datos.cerca, datos.rayos) : false;
  const tend = datos ? tendencia(datos.cerca) : "";
  return (
    <section aria-labelledby="h-tormentas" style={style} className={`col-span-2 rounded-ficha p-5 shadow-ficha ring-1 [&.mirar]:bg-tinta [&.mirar]:text-white [&.mirar]:ring-tinta ${mirar ? "mirar" : "bg-vidrio ring-white/70"} ${className}`}>
      <h2 id="h-tormentas" className="flex items-center gap-2 text-lg font-bold"><Icono id="i-tormenta" className="size-5.5" />{t("app.torm.ficha.titulo")}</h2>
      {datos ? (
        <>
          <p className="mt-2 font-semibold leading-snug text-pretty">{titular(datos.cerca)}{tend ? ` · ${tend}` : ""}</p>
          {datos.cerca ? <p className={`mt-0.5 text-xs ${mirar ? "text-white/85" : "text-gris"}`}>{horaSatelite(datos.cerca, horaCorta)}</p> : null}
          {datos.radar ? (
            <div className="mt-3">
              <RadarTormentas radar={datos.radar} radios={[datos.radios.encima, datos.radios.cerca]}
                etiqueta={t("app.torm.radar.etq", { texto: titular(datos.cerca) })} />
            </div>
          ) : null}
          <dl className="mt-2 text-sm">
            <div className="flex justify-between gap-4 py-1"><dt className={mirar ? "text-white/85" : "text-gris"}>{t("app.torm.rayos.etq")}</dt><dd className="text-right font-semibold">{textoRayos(datos.rayos)}</dd></div>
            <div className="flex justify-between gap-4 py-1"><dt className={mirar ? "text-white/85" : "text-gris"}>{t("app.torm.lluvia.etq")}</dt><dd className="text-right font-semibold">{textoLluvia(datos.lluvia)}</dd></div>
          </dl>
        </>
      ) : carga === "error" ? (
        <p className={K.vacio}>{t("app.torm.cerca.sin_datos")}</p>
      ) : (
        <div aria-busy="true" className="mt-2"><span className="sr-only">{t("app.carga.etq")}</span><EsqueletoLineas n={2} /></div>
      )}
      <button type="button" onClick={() => irA("tormentas")}
        className={`mt-3 ${mirar ? "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 font-semibold text-tinta active:scale-[.98]" : K.btnSec}`}>
        <Icono id="i-mapa" className="size-5" /><span>{t("app.torm.ficha.ver")}</span>
      </button>
    </section>
  );
}
