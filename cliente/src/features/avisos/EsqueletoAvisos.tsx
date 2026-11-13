/* Placeholder de «Avisos»: 2 tarjetas con la franja de cabecera (sin color: el semáforo solo dice un nivel), título,
   texto y vigencia, con las medidas de Tarjeta. */
import { EsqueletoBloque, EsqueletoLineas, EsqueletoTarjeta, ZonaCargando } from "../../shared/componentes/Esqueleto";

function Tarjeta() {
  return (
    <EsqueletoTarjeta className="overflow-hidden">
      <span className="flex h-11 items-center justify-between gap-2 border-b border-regla px-5">
        <EsqueletoBloque className="h-3.5 w-24 rounded-full" />
        <EsqueletoBloque className="h-3 w-28 rounded-full" />
      </span>
      <span className="block p-5">
        <EsqueletoLineas n={1} alto="h-[1.55rem]" className="w-3/4" />
        <EsqueletoLineas n={3} alto="h-[1.45rem]" className="mt-2" />
        <EsqueletoLineas n={1} alto="h-[1.2rem]" className="mt-2 w-2/5" />
      </span>
    </EsqueletoTarjeta>
  );
}

export function EsqueletoAvisos() {
  return (
    <ZonaCargando className="grid gap-3">
      <Tarjeta /><Tarjeta />
    </ZonaCargando>
  );
}
