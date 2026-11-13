/* Placeholder de «Mi lugar» mientras llega el detalle del lugar guardado: la misma cabecera, la ficha del nivel,
   «Qué hacer ahora», las tres fichas de dato con la del 911 (real: llamar nunca espera a la red), las calles y la lluvia.
   Las medidas siguen a ConLugar para que nada salte al llegar los datos. */
import { pedirLlamada911 } from "../../app/Llamar911";
import { Icono } from "../../shared/componentes/Icono";
import { EsqueletoBloque, EsqueletoLineas, EsqueletoTarjeta, ZonaCargando } from "../../shared/componentes/Esqueleto";
import { useI18n } from "../../shared/i18n";

const CASILLA = "flex min-w-0 flex-col justify-between gap-3 p-4";

export function EsqueletoLugar() {
  const { t } = useI18n();
  // «Qué hacer ahora» tiene 3 o 4 acciones de 2 o 3 líneas en un teléfono
  const fila = (lineas: number, i: number) => (
    <span key={i} className="flex gap-3 border-b border-regla py-3 last:border-0 last:pb-0">
      <EsqueletoBloque className="size-7 shrink-0 rounded-full" />
      <EsqueletoLineas n={lineas} alto="h-[1.375rem]" className="flex-1" />
    </span>
  );
  const casilla = (i: number) => (
    <EsqueletoTarjeta key={i} className={CASILLA}>
      <EsqueletoLineas n={1} alto="h-5" className="w-3/4" />
      <EsqueletoBloque className="h-[1.9rem] w-1/2 rounded-lg" />
    </EsqueletoTarjeta>
  );
  return (
    <ZonaCargando>
      <div aria-hidden="true" className="mt-5 mb-3">
        <div className="flex items-start gap-1.5">
          <EsqueletoBloque className="mt-1.5 size-5 shrink-0 rounded-full" />
          <span className="flex h-[2.1875rem] min-w-0 flex-1 items-center"><EsqueletoBloque className="h-[1.4rem] w-3/5 rounded-lg" /></span>
          <EsqueletoBloque className="mt-0.5 h-9 w-28 shrink-0 rounded-full" />
        </div>
        <EsqueletoLineas n={1} alto="h-5" className="mt-0.5 w-1/2" />
        <EsqueletoLineas n={1} alto="h-5" className="w-2/5" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {/* ficha del nivel: sin color (el semáforo solo dice un nivel) */}
        <EsqueletoTarjeta className="col-span-2 rounded-[2rem] p-5 lg:row-span-2 lg:flex lg:flex-col">
          <EsqueletoBloque className="h-7 w-24 rounded-full" />
          <EsqueletoBloque className="mt-3 h-10 w-3/5 rounded-xl" />
          <EsqueletoLineas n={2} alto="h-[1.45rem]" className="mt-2" />
          <span className="mt-5 grid grid-cols-4 gap-1.5 lg:mt-auto lg:pt-5">
            {[0, 1, 2, 3].map((i) => <EsqueletoBloque key={i} className="h-2 rounded-full" />)}
            <EsqueletoBloque className="mt-1.5 h-4 rounded-full" />
          </span>
        </EsqueletoTarjeta>

        <EsqueletoTarjeta className="col-span-2 p-5 lg:row-span-2">
          <EsqueletoLineas n={1} alto="h-7" className="w-2/5" />
          <span className="mt-2 block">{[2, 3, 2].map(fila)}</span>
        </EsqueletoTarjeta>

        {[0, 1, 2].map(casilla)}
        <button type="button" onClick={pedirLlamada911} aria-haspopup="dialog" className="flex flex-col justify-between gap-3 rounded-ficha bg-negro p-4 text-left text-white shadow-ficha active:scale-[.98]">
          <span className="grid size-10 place-items-center rounded-full bg-white/15"><Icono id="i-tel" className="size-5" /></span>
          <span className="text-lg leading-tight font-bold">{t("app.emerg.llamar")}</span>
        </button>

        <EsqueletoTarjeta className="col-span-2 p-5">
          <EsqueletoLineas n={1} alto="h-7" className="w-1/2" />
          <EsqueletoLineas n={2} alto="h-5" className="mt-1 py-3" />
          <EsqueletoBloque className="mt-3 h-12 rounded-2xl" />
        </EsqueletoTarjeta>

        <EsqueletoTarjeta className="col-span-2 p-5">
          <EsqueletoLineas n={1} alto="h-7" className="w-2/5" />
          <EsqueletoBloque className="mt-3 h-40 rounded-2xl" />
        </EsqueletoTarjeta>
      </div>
    </ZonaCargando>
  );
}
