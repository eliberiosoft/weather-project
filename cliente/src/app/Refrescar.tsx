/* «Jalar para refrescar» sobre la lista principal (main): con la vista arriba del todo, bajar el dedo muestra
   un círculo bajo la cabecera; al soltar pasado el umbral, gira mientras se recarga todo (refrescarTodo).
   No se arma en el mapa: ahí arrastrar mueve el mapa. */
import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import { Icono } from "../shared/componentes/Icono";
import { useI18n } from "../shared/i18n";
import { crearJalar, UMBRAL_JALAR, type EstadoJalar } from "../shared/jalar";
import { store } from "../shared/store";
import { refrescarTodo } from "./arranque";

export function JalarRefrescar({ zona }: { zona: RefObject<HTMLElement | null> }) {
  const { t } = useI18n();
  const [{ dist, refrescando }, setEstado] = useState<EstadoJalar>({ dist: 0, refrescando: false });

  useEffect(() => {
    const el = zona.current;
    if (!el) return;
    const jalar = crearJalar(refrescarTodo, setEstado);
    const empezar = (e: TouchEvent) => {
      const dedo = e.touches[0];
      const libre = e.touches.length === 1 && store.get().vista !== "mapa" && !(e.target as Element).closest?.(".leaflet-container");
      jalar.empezar(dedo?.clientY ?? 0, libre && el.scrollTop <= 0);
    };
    const mover = (e: TouchEvent) => {
      const dedo = e.touches[0];
      if (dedo && jalar.mover(dedo.clientY) && e.cancelable) e.preventDefault();   // frena el rebote del navegador
    };
    const soltar = () => jalar.soltar();
    el.addEventListener("touchstart", empezar, { passive: true });
    el.addEventListener("touchmove", mover, { passive: false });
    el.addEventListener("touchend", soltar);
    el.addEventListener("touchcancel", soltar);
    return () => {
      el.removeEventListener("touchstart", empezar);
      el.removeEventListener("touchmove", mover);
      el.removeEventListener("touchend", soltar);
      el.removeEventListener("touchcancel", soltar);
    };
  }, [zona]);

  const avance = Math.min(1, dist / UMBRAL_JALAR);
  const vars = { "--y": `${dist - 48}px`, "--giro": `${avance * 270}deg`, "--o": String(avance) } as CSSProperties;
  return (
    <>
      <div aria-hidden="true" style={vars}
        className={`pointer-events-none fixed top-14 left-1/2 z-[999] grid size-10 -translate-x-1/2 translate-y-(--y) place-items-center rounded-full bg-papel text-tinta opacity-(--o) shadow-flota ${dist || refrescando ? "" : "hidden"} ${refrescando ? "transition-transform duration-200" : ""}`}>
        <Icono id="i-refrescar" className={`size-5 ${refrescando ? "animate-spin" : "rotate-(--giro)"} ${avance >= 1 ? "text-tinta" : "text-gris"}`} />
      </div>
      <span role="status" className="sr-only">{refrescando ? t("app.refrescar.etq") : ""}</span>
    </>
  );
}
