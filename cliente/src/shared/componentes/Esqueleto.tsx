/* Placeholders («skeletons», spec 015): bloques suaves con la forma de lo que viene, para que la página no salte
   cuando llegan los datos. El brillo es un reflejo que cruza con transform (barato en un teléfono de gama baja);
   con movimiento reducido el bloque queda quieto. Los bloques son aria-hidden; la zona que los contiene lleva
   aria-busy y un «Cargando…» para lectores de pantalla. */
import type { ReactNode } from "react";
import { useI18n } from "../i18n";

const BRILLO = "relative overflow-hidden after:absolute after:inset-0 after:-translate-x-full after:animate-brillo after:bg-linear-to-r after:from-transparent after:via-white/70 after:to-transparent motion-reduce:after:hidden";

/** Un bloque: dale alto, ancho y radio con className. */
export function EsqueletoBloque({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block bg-regla/80 ${BRILLO} ${className}`}></span>;
}

const ANCHOS = ["w-full", "w-11/12", "w-4/5", "w-2/3"];

/** Líneas de texto: el alto de la línea (alto) incluye el interlineado, como el texto real. */
export function EsqueletoLineas({ n = 2, alto = "h-6", className = "" }: { n?: number; alto?: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`block ${className}`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`flex items-center ${alto}`}>
          <EsqueletoBloque className={`h-[60%] max-h-4 rounded-full ${i === n - 1 && n > 1 ? "w-3/5" : ANCHOS[i % ANCHOS.length]}`} />
        </span>
      ))}
    </span>
  );
}

/** La foto de una publicación (4:3, a todo el ancho de la tarjeta). */
export function EsqueletoMiniatura({ className = "" }: { className?: string }) {
  return <EsqueletoBloque className={`aspect-[4/3] w-full ${className}`} />;
}

/** Ficha de vidrio vacía, como las del mosaico. */
export function EsqueletoTarjeta({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div aria-hidden="true" className={`rounded-ficha bg-vidrio shadow-ficha ring-1 ring-white/70 ${className}`}>{children}</div>;
}

/** Contenedor de los placeholders de una vista: aria-busy y el «Cargando…» para lectores de pantalla. */
export function ZonaCargando({ className = "", children }: { className?: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div aria-busy="true" className={className}>
      <p className="sr-only">{t("app.carga.etq")}</p>
      {children}
    </div>
  );
}
