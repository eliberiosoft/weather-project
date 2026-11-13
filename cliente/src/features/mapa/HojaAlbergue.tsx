/* Hoja de un albergue: sus fotos, la descripción corta y «Cómo llegar» (a pie o en carro). La ruta se dibuja en el
   mapa; abajo queda su resumen. Para ir paso a paso con voz, «Abrir en Google Maps». */
import { useState } from "react";
import { Icono } from "../../shared/componentes/Icono";
import { verFotos } from "../../shared/componentes/VisorFoto";
import { urlFotoAlbergue } from "../../shared/dominio";
import { K } from "../../shared/estilo";
import { useI18n } from "../../shared/i18n";
import { store, useApp } from "../../shared/store";
import type { Albergue, ModoRuta } from "../../shared/tipos";
import { pedirRuta, urlNavegar } from "./rutaAlbergue";

export function CuerpoAlbergue({ a, onRutaLista }: { a: Albergue; onRutaLista(): void }) {
  const { t } = useI18n();
  const ruta = useApp((s) => s.ruta);
  const [modo, setModo] = useState<ModoRuta>(() => (ruta?.albergue.id === a.id ? ruta.modo : "pie"));
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urls = Array.from({ length: a.fotos }, (_, i) => urlFotoAlbergue(a, i + 1));
  const estaRuta = ruta?.albergue.id === a.id;

  const comoLlegar = async () => {
    if (buscando) return;
    setBuscando(true);
    setError(null);
    try {
      store.set({ ruta: await pedirRuta(a, modo) });
      onRutaLista();
    } catch (e) { setError((e as Error).message); } finally { setBuscando(false); }
  };

  return (
    <>
      {urls.length ? (
        <ul aria-label={t("app.alb.fotos")} className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {urls.map((u, i) => (
            <li key={u} className={`shrink-0 snap-start ${urls.length === 1 ? "w-full" : "w-[78%]"}`}>
              <button type="button" onClick={() => verFotos({ titulo: a.nombre, urls, i })} aria-label={t("app.foto.ver_n", { n: i + 1 })} className="block w-full">
                <img src={u} alt={t("app.alb.foto_alt", { nombre: a.nombre, n: i + 1 })} loading="lazy" className="aspect-[4/3] w-full rounded-2xl bg-suelo object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {a.descripcion ? <p className="mt-3 text-pretty whitespace-pre-line">{a.descripcion}</p> : null}

      <div className="mt-4 rounded-2xl bg-suelo p-3">
        <p className="text-sm font-semibold">{t("app.alb.como_llegar")}</p>
        <div role="radiogroup" aria-label={t("app.alb.modo")} className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-white/70 p-1">
          {(["pie", "auto"] as ModoRuta[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={modo === m} onClick={() => setModo(m)}
              className={`${K.segmento} inline-flex items-center justify-center gap-1.5 aria-checked:text-texto`}>
              <Icono id={m === "pie" ? "i-caminar" : "i-auto"} className="size-4.5" />{t("app.alb.modo." + m)}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void comoLlegar()} disabled={buscando} aria-busy={buscando} className={`${K.btn} mt-2 disabled:opacity-80`}>
          <Icono id="i-ruta" className={`size-5 ${buscando ? "animate-pulse" : ""}`} />
          {t(buscando ? "app.alb.buscando" : estaRuta && ruta?.modo === modo ? "app.alb.otra_vez" : "app.alb.trazar")}
        </button>
        {error ? <p role="alert" className="mt-2 flex items-start gap-2 text-sm font-semibold text-texto"><Icono id="i-alerta" className="mt-0.5 size-4.5 shrink-0 text-tinta" />{error}</p> : null}
        <a href={urlNavegar(a, modo)} target="_blank" rel="noopener" className={`${K.btnSec} mt-2 no-underline`}>
          <Icono id="i-mapa" className="size-5" />{t("app.alb.google")}
        </a>
        {estaRuta ? (
          <button type="button" onClick={() => store.set({ ruta: null })} className="mt-2 w-full rounded-xl py-2 text-sm font-semibold text-tinta">{t("app.alb.quitar_ruta")}</button>
        ) : null}
        <p className={K.nota}>{t("app.alb.nota_ruta")}</p>
      </div>
    </>
  );
}
