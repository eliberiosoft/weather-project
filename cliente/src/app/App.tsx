/* La app: cabecera, las siete vistas (todas montadas; el mapa solo después de abrirlo por primera vez),
   la barra de navegación, el aviso de cookies y los mensajes. */
import { lazy, Suspense, useEffect, useRef } from "react";
import { Sprite } from "../shared/componentes/Icono";
import { Toast } from "../shared/componentes/Toast";
import { VisorFoto } from "../shared/componentes/VisorFoto";
import { useApp } from "../shared/store";
import { Avisos } from "../features/avisos/Avisos";
import { MiLugar } from "../features/lugar/MiLugar";
import { Privacidad } from "../features/privacidad/Privacidad";
import { Reportar } from "../features/reportar/Reportar";
import { Vecinos } from "../features/vecinos/Vecinos";
import { Ingreso } from "../features/cuenta/Ingreso";
import { MenuCuenta } from "../features/cuenta/MenuCuenta";
import { Portada } from "../features/seguridad/Portada";
import { AvisoCookies } from "./AvisoCookies";
import { AvisoLento } from "./BarraCarga";
import { Cabecera } from "./Cabecera";
import { MapaCargando } from "./MapaCargando";
import { MapaNoCarga } from "./MapaNoCarga";
import { TormentasCargando, TormentasNoCarga } from "./TormentasCargando";
import { VersionNueva } from "./VersionNueva";
import { pendientes } from "../shared/pendientes";
import { Navegacion } from "./Navegacion";
import { GuiaIos, PistaIos } from "./GuiaIos";
import { Confirmar911 } from "./Llamar911";
import { Permisos } from "./Permisos";
import { JalarRefrescar } from "./Refrescar";

// Leaflet y el mapa van en otro archivo: solo se bajan al abrir el mapa (y el service worker los guarda)
// (la descarga cuenta para la barra de carga; mientras llega se ve «Cargando el mapa…» en su lugar)
const Mapa = lazy(() => pendientes.seguir(import("../features/mapa/Mapa")).catch(() => ({ default: MapaNoCarga })));
// «Tormentas» (spec 020) también usa Leaflet: se baja al abrirla por primera vez
const Tormentas = lazy(() => pendientes.seguir(import("../features/tormentas/Tormentas")).catch(() => ({ default: TormentasNoCarga })));

export function App() {
  const vista = useApp((s) => s.vista);
  const mapaVisitado = useApp((s) => s.mapaVisitado);
  const tormentasVisitado = useApp((s) => s.tormentasVisitado);
  const principal = useRef<HTMLElement>(null);
  useEffect(() => {
    if (vista !== "mapa") document.querySelector("main")?.scrollTo({ top: 0 });
  }, [vista]);
  return (
    <>
      <Sprite />
      <Cabecera />
      <main ref={principal} className="flex-1 overflow-auto overscroll-contain pb-[calc(4.5rem+env(safe-area-inset-bottom)+1rem)] lg:pb-28">
        <MiLugar />
        {mapaVisitado ? <Suspense fallback={<MapaCargando />}><Mapa /></Suspense> : null}
        <Vecinos />
        <Reportar />
        <Privacidad />
        <Avisos />
        {tormentasVisitado ? <Suspense fallback={<TormentasCargando />}><Tormentas /></Suspense> : null}
      </main>
      <JalarRefrescar zona={principal} />
      <Navegacion />
      <Permisos />
      <Confirmar911 />
      <GuiaIos />
      <PistaIos />
      <AvisoCookies />
      <AvisoLento />
      <VisorFoto />
      <MenuCuenta />
      <Ingreso />
      <VersionNueva />
      <Toast />
      <Portada />
    </>
  );
}
