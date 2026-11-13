/* Placeholder de «Vecinos»: la línea de la cuenta y 3 publicaciones con su miniatura, con las medidas de Publicacion. */
import { EsqueletoBloque, EsqueletoLineas, EsqueletoMiniatura, EsqueletoTarjeta, ZonaCargando } from "../../shared/componentes/Esqueleto";

function Publicacion() {
  return (
    <EsqueletoTarjeta className="overflow-hidden">
      <span className="flex items-start gap-3 px-4 pt-4">
        <EsqueletoBloque className="size-11 shrink-0 rounded-full" />
        <span className="min-w-0 flex-1">
          <EsqueletoLineas n={1} alto="h-5" className="w-3/5" />
          <EsqueletoLineas n={1} alto="h-[1.2rem]" className="mt-0.5 w-2/5" />
        </span>
        <EsqueletoBloque className="h-6 w-20 shrink-0 rounded-full" />
      </span>
      <span className="block px-4 pt-3">
        <EsqueletoLineas n={1} alto="h-[1.55rem]" className="w-4/5" />
        <EsqueletoLineas n={2} alto="h-[1.45rem]" className="mt-1" />
      </span>
      <EsqueletoMiniatura className="mt-3" />
      <span className="mt-3 grid min-h-12 grid-cols-3 place-items-center border-t border-regla">
        {[0, 1, 2].map((i) => <EsqueletoBloque key={i} className="h-4 w-16 rounded-full" />)}
      </span>
    </EsqueletoTarjeta>
  );
}

export function EsqueletoVecinos() {
  return (
    <ZonaCargando className="mt-3 mb-2">
      <EsqueletoLineas n={1} alto="h-[1.2rem]" className="w-1/3" />
      <div className="mt-2 grid gap-3">
        <Publicacion /><Publicacion /><Publicacion />
      </div>
    </ZonaCargando>
  );
}
