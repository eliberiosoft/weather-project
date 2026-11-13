/* Aviso pequeño de carga sobre el mapa («Cargando capas…», «Cargando el mapa…»): píldora de papel con un aro que gira
   (quieto con movimiento reducido). */
export function ChipCarga({ texto, className = "" }: { texto: string; className?: string }) {
  return (
    <p role="status" className={`pointer-events-none inline-flex h-9 items-center gap-2 rounded-full bg-papel/95 px-3.5 text-sm font-semibold text-texto shadow-flota backdrop-blur ${className}`}>
      <span aria-hidden="true" className="size-4 shrink-0 animate-spin rounded-full border-2 border-tinta/25 border-t-tinta"></span>
      {texto}
    </p>
  );
}
