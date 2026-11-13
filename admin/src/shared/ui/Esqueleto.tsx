/* Placeholders («esqueletos») con la forma del contenido que viene (spec 015).
   - El contenedor `Esperando` lleva aria-busy y dice «Cargando…» una sola vez al lector de pantalla.
   - Cada bloque es aria-hidden; brillo suave con `animate-brillo` y quieto con prefers-reduced-motion.
   - Las medidas copian las del contenido real (fichas, filas de tabla de 44 px, píldoras de nivel) para que no salte (CLS). */
import type { ReactNode } from "react";
import { useI18n } from "../i18n/useI18n";
import { K } from "./clases";

// bloque en «nube» con una franja estrecha de luz que lo cruza; con reduce motion, el bloque liso
const BRILLO = "bg-nube bg-linear-90 from-nube from-40% via-cielo-3 via-50% to-nube to-60% bg-size-[250%_100%] animate-brillo motion-reduce:animate-none motion-reduce:bg-none";

/** Contenedor de una vista que todavía carga. */
export function Esperando({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { t } = useI18n();
  return (
    <div aria-busy="true" className={className}>
      <p role="status" className="sr-only">{t("panel.cargando")}</p>
      {children}
    </div>
  );
}

/** Bloque gris de cualquier forma: el tamaño y el radio van en `className`. */
export function EsqueletoBloque({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`${BRILLO} ${className}`} />;
}

/** Una línea de texto (alto de una línea de 14 px). */
export function EsqueletoLinea({ className = "w-full" }: { className?: string }) {
  return <div aria-hidden="true" className={`${BRILLO} my-1 h-3.5 rounded-full ${className}`} />;
}

/** Un título de ficha (K.h2). */
export function EsqueletoTitulo({ className = "w-48" }: { className?: string }) {
  return <div aria-hidden="true" className={`${BRILLO} my-1 h-5 rounded-full ${className}`} />;
}

/** Un campo de formulario con su etiqueta (K.etiqueta + K.campo). */
export function EsqueletoCampo({ etiqueta = "w-32", className = "mt-4" }: { etiqueta?: string; className?: string }) {
  return (
    <div aria-hidden="true" className={className}>
      <div className="mb-1.5 flex h-5 items-center"><div className={`${BRILLO} h-3.5 rounded-full ${etiqueta}`} /></div>
      <div className={`${BRILLO} h-11.5 rounded-xl`} />
    </div>
  );
}

/** Píldora de nivel (mismo alto y ancho mínimo que <Nivel>). */
export function EsqueletoPildora() {
  return <div aria-hidden="true" className={`${BRILLO} h-7 w-24 rounded-full`} />;
}

/** Filas de una tabla K.tabla. Cada celda es el ancho de una línea («w-24») o lo que imita su contenido. */
export function EsqueletoFilas({ celdas, filas = 3 }: { celdas: (string | ReactNode)[]; filas?: number }) {
  return (
    <>
      {Array.from({ length: filas }, (_, i) => (
        <tr key={i} aria-hidden="true">
          {celdas.map((c, j) => <td key={j}>{typeof c === "string" ? <EsqueletoLinea className={c} /> : c}</td>)}
        </tr>
      ))}
    </>
  );
}

/** Una ficha de papel (K.ficha) con un título y unas líneas, para lo que no tiene forma más precisa. */
export function EsqueletoTarjeta({ lineas = 3, className = "" }: { lineas?: number; className?: string }) {
  const anchos = ["w-full", "w-11/12", "w-3/4", "w-2/3", "w-5/6"];
  return (
    <div aria-hidden="true" className={`${K.ficha} ${className}`}>
      <EsqueletoTitulo />
      <div className="mt-3">
        {Array.from({ length: lineas }, (_, i) => <EsqueletoLinea key={i} className={anchos[i % anchos.length]} />)}
      </div>
    </div>
  );
}

/** Un elemento de lista con miniatura a la derecha (incidentes) o a la izquierda (ícono del tipo). */
export function EsqueletoItemLista({ miniatura = true }: { miniatura?: boolean }) {
  return (
    <div aria-hidden="true" className="flex items-start gap-3 border-b border-regla py-3.5 last:border-b-0">
      <EsqueletoBloque className="size-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <EsqueletoLinea className="w-1/2" />
        <EsqueletoLinea className="mt-2 w-2/3" />
        <EsqueletoLinea className="mt-2 w-5/6" />
      </div>
      {miniatura && <EsqueletoBloque className="size-16 shrink-0 rounded-xl" />}
    </div>
  );
}
