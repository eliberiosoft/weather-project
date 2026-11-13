/* Íconos: trazo 2 sobre cuadrícula de 24, color = currentColor. Un solo sprite SVG en el documento;
   cada ícono se usa con <Icono id="…" /> (o icoHtml() en los marcadores de Leaflet). */
import type { SVGProps } from "react";

export type IdIcono =
  | "i-instalar"
  | "i-casa"
  | "i-mapa"
  | "i-mas"
  | "i-menos"
  | "i-campana"
  | "i-gps"
  | "i-capas"
  | "i-tel"
  | "i-x"
  | "i-check"
  | "i-buscar"
  | "i-canton"
  | "i-ola"
  | "i-camara"
  | "i-pin"
  | "i-atras"
  | "i-adelante"
  | "i-lluvia"
  | "i-muro"
  | "i-corazon"
  | "i-compartir"
  | "i-chat"
  | "i-enlace"
  | "i-alerta"
  | "i-sinred"
  | "i-luna"
  | "i-pulgar"
  | "i-bajo"
  | "i-refrescar"
  | "i-nube"
  | "i-tormenta"
  | "i-rayo"
  | "i-play"
  | "i-pausa"
  | "i-agregar"
  | "i-puntos"
  | "i-lineas"
  | "i-galeria"
  | "i-albergue"
  | "i-ruta"
  | "i-caminar"
  | "i-auto"
  | "i-usuario"
  | "i-candado"
  | "t-calle_inundada"
  | "t-vivienda_inundada"
  | "t-rio_crecido"
  | "t-desborde"
  | "t-via_cerrada"
  | "t-alcantarilla"
  | "t-dique_filtracion"
  | "t-socavon"
  | "t-arbol_poste"
  | "t-sin_luz"
  | "t-lluvia_fuerte"
  | "t-aislados"
  | "t-cultivos_ganado"
  | "t-bache"
  | "t-basura"
  | "t-robo"
  | "t-otro"
  | "e-Salud"
  | "e-Seguridad"
  | "e-Educación"
  | "a-1"
  | "a-2"
  | "a-3";

export function Sprite() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="hidden" aria-hidden="true">
      <defs>
    <symbol id="i-instalar" viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></symbol>
    <symbol id="i-casa" viewBox="0 0 24 24"><path d="M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-6h4v6"/></symbol>
    <symbol id="i-mapa" viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/></symbol>
    <symbol id="i-mas" viewBox="0 0 24 24"><path d="M12 4v16M4 12h16"/></symbol>
    <symbol id="i-menos" viewBox="0 0 24 24"><path d="M4 12h16"/></symbol>
    <symbol id="i-campana" viewBox="0 0 24 24"><path d="M6 16v-5a6 6 0 0112 0v5l2 2H4zM10 20.5a2 2 0 004 0"/></symbol>
    <symbol id="i-gps" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></symbol>
    <symbol id="i-capas" viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5"/></symbol>
    <symbol id="i-tel" viewBox="0 0 24 24"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 006 6L16 13l5 2v4a2 2 0 01-2 2A17 17 0 013 5a2 2 0 012-2z"/></symbol>
    <symbol id="i-usuario" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></symbol>
    <symbol id="i-candado" viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 018 0v3M12 15v2"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M4.5 12.5l5 5 10-11"/></symbol>
    <symbol id="i-buscar" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></symbol>
    <symbol id="i-canton" viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><circle cx="12" cy="12" r="2"/></symbol>
    <symbol id="i-ola" viewBox="0 0 24 24"><path d="M2 9q2.5-3 5 0t5 0 5 0 5 0M2 15q2.5-3 5 0t5 0 5 0 5 0"/></symbol>
    <symbol id="i-camara" viewBox="0 0 24 24"><path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13.5" r="3.5"/></symbol>
    <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21.5s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9.5" r="2.5"/></symbol>
    <symbol id="i-galeria" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-9 9"/></symbol>
    <symbol id="i-albergue" viewBox="0 0 24 24"><path d="M3 11l9-7 9 7M5 9.5V20h14V9.5"/><circle cx="12" cy="12" r="2"/><path d="M8.5 20a3.5 3.5 0 017 0"/></symbol>
    <symbol id="i-ruta" viewBox="0 0 24 24"><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8.5a3.5 3.5 0 000-7h-9a3.5 3.5 0 010-7H16"/></symbol>
    <symbol id="i-caminar" viewBox="0 0 24 24"><circle cx="13" cy="4" r="2"/><path d="M9 21l2.5-6.5L14 17v4M7 12.5l2.5-5.5 4 1.5 2 3.5H19M11.5 14.5L12.5 9"/></symbol>
    <symbol id="i-auto" viewBox="0 0 24 24"><path d="M5 17H3v-5l2-5h14l2 5v5h-2M5 12h14"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M9.5 17h5"/></symbol>
    <symbol id="i-atras" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol>
    <symbol id="i-adelante" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></symbol>
    <symbol id="i-lluvia" viewBox="0 0 24 24"><path d="M7 14.5a4 4 0 01.4-8A5.5 5.5 0 0118 8a3.3 3.3 0 01-1 6.5zM8 18l-1 3M12.5 18l-1 3M17 18l-1 3"/></symbol>
    <symbol id="i-muro" viewBox="0 0 24 24"><path d="M4 4h16v8H4zM4 16h16M4 20h10"/></symbol>
    <symbol id="i-corazon" viewBox="0 0 24 24"><path d="M12 20.5s-8-4.6-8-10.4A4.4 4.4 0 0112 7.6a4.4 4.4 0 018 2.5c0 5.8-8 10.4-8 10.4z"/></symbol>
    <symbol id="i-compartir" viewBox="0 0 24 24"><path d="M4 13v6a1 1 0 001 1h14a1 1 0 001-1v-6M12 3v12M7.5 7.5L12 3l4.5 4.5"/></symbol>
    <symbol id="i-chat" viewBox="0 0 24 24"><path d="M4 19l1.5-4A8 8 0 1112 20a8 8 0 01-3.6-.9z"/></symbol>
    <symbol id="i-enlace" viewBox="0 0 24 24"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></symbol>
    <symbol id="i-alerta" viewBox="0 0 24 24"><path d="M12 3l10 18H2zM12 10v5M12 18v.01"/></symbol>
    <symbol id="i-sinred" viewBox="0 0 24 24"><path d="M2 8.5a15 15 0 0120 0M5 12a10 10 0 0114 0M8.5 15.5a5 5 0 017 0M12 19.5v.01M3 3l18 18"/></symbol>
    <symbol id="i-luna" viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 019.5 4a7 7 0 1010.5 10.5z"/></symbol>
    <symbol id="i-pulgar" viewBox="0 0 24 24"><path d="M7 11v9H3v-9zM7 11l4-8a2.5 2.5 0 012.5 2.5V9h5.5a2 2 0 012 2.3l-1.4 7A2 2 0 0116.6 20H7"/></symbol>
    <symbol id="i-bajo" viewBox="0 0 24 24"><path d="M12 4v12M6 11l6 6 6-6M3 21h18"/></symbol>
    <symbol id="i-refrescar" viewBox="0 0 24 24"><path d="M20 12a8 8 0 11-2.34-5.66M20 4v5h-5"/></symbol>
    <symbol id="i-agregar" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></symbol>
    <symbol id="i-lineas" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h11"/></symbol>
    <symbol id="i-puntos" viewBox="0 0 24 24"><path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3"/></symbol>
    <symbol id="i-nube" viewBox="0 0 24 24"><path d="M7 18a4.5 4.5 0 01-.6-9A6 6 0 0118 8.5a4.5 4.5 0 01-1 9M12 21v-8M9 15.5l3-3 3 3"/></symbol>
    <symbol id="i-tormenta" viewBox="0 0 24 24"><path d="M7 15.5a4.5 4.5 0 01-.6-9A6 6 0 0118 6a4.5 4.5 0 01-.5 9.5M13 11l-3 5h4l-3 5"/></symbol>
    <symbol id="i-rayo" viewBox="0 0 24 24"><path d="M13 2L5 14h6l-1 8 8-12h-6z"/></symbol>
    <symbol id="i-play" viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></symbol>
    <symbol id="i-pausa" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></symbol>
    {/* tipos de reporte */}
    <symbol id="t-calle_inundada" viewBox="0 0 24 24"><path d="M5 3l-2 18M19 3l2 18M12 4v2M12 9v2M4 15q2-2 4 0t4 0 4 0 4 0"/></symbol>
    <symbol id="t-vivienda_inundada" viewBox="0 0 24 24"><path d="M3 11l9-7 9 7M5 9.5V20h14V9.5M5 15.5q1.8-2 3.5 0t3.5 0 3.5 0 3.5 0"/></symbol>
    <symbol id="t-rio_crecido" viewBox="0 0 24 24"><path d="M12 13V3M8 7l4-4 4 4M2 18q2.5-3 5 0t5 0 5 0 5 0"/></symbol>
    <symbol id="t-desborde" viewBox="0 0 24 24"><path d="M4 13h16v8H4zM2 9q2.5-3 5 0t5 0 5 0 5 0M9 13v8M15 13v8"/></symbol>
    <symbol id="t-via_cerrada" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M7 12h10"/></symbol>
    <symbol id="t-alcantarilla" viewBox="0 0 24 24"><path d="M3 7h18v11H3zM7.5 7v11M12 7v11M16.5 7v11"/></symbol>
    <symbol id="t-dique_filtracion" viewBox="0 0 24 24"><path d="M3 5h18v12H3zM12 5l-2 4 3 2.5-2 5.5M5 21q1.7-1.5 3.5 0t3.5 0 3.5 0 3.5 0"/></symbol>
    <symbol id="t-socavon" viewBox="0 0 24 24"><path d="M2 9h6l2 8h4l2-8h6M10 13h4"/></symbol>
    <symbol id="t-arbol_poste" viewBox="0 0 24 24"><path d="M3 20h18M6 20L16 5M12 11l5 3.5M14 8l4 2.5"/></symbol>
    <symbol id="t-sin_luz" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9V16h7v-2.1A6 6 0 0012 3zM3 3l18 18"/></symbol>
    <symbol id="t-lluvia_fuerte" viewBox="0 0 24 24"><path d="M7 13a4 4 0 01.4-8A5.5 5.5 0 0118 6.5a3.3 3.3 0 01-1 6.5zM7 16l-1.5 5M11 16l-1.5 5M15 16l-1.5 5M19 16l-1.5 5"/></symbol>
    <symbol id="t-aislados" viewBox="0 0 24 24"><circle cx="8" cy="5.5" r="2"/><circle cx="16" cy="5.5" r="2"/><path d="M5 14v-3a3 3 0 016 0v3M13 14v-3a3 3 0 016 0v3M2 19q2.5-3 5 0t5 0 5 0 5 0"/></symbol>
    <symbol id="t-cultivos_ganado" viewBox="0 0 24 24"><path d="M12 21V10M12 14c-4 0-6.5-3-6.5-6.5 4 0 6.5 3 6.5 6.5zM12 11c0-4 2.5-7 6.5-7 0 4-2.5 7-6.5 7zM4 21h16"/></symbol>
    <symbol id="t-bache" viewBox="0 0 24 24"><path d="M2 13h5c1.5 4.5 8.5 4.5 10 0h5M9.5 9.5l1 2.5M12 8.5v3M14.5 9.5l-1 2.5M2 19h20"/></symbol>
    <symbol id="t-basura" viewBox="0 0 24 24"><path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5"/></symbol>
    <symbol id="t-robo" viewBox="0 0 24 24"><path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 7.6-1.7M12 14.5v3"/></symbol>
    <symbol id="t-otro" viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6zM9 12h7M9 16h5"/></symbol>
    {/* equipamientos */}
    <symbol id="e-Salud" viewBox="0 0 24 24"><path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z"/></symbol>
    <symbol id="e-Seguridad" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z"/></symbol>
    <symbol id="e-Educación" viewBox="0 0 24 24"><path d="M2 9l10-5 10 5-10 5zM6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/></symbol>
    {/* altura del agua */}
    <symbol id="a-1" viewBox="0 0 24 24"><path d="M2 9h9v8h11M2 14q2.2-1.8 4.5 0t4.5 0"/></symbol>
    <symbol id="a-2" viewBox="0 0 24 24"><path d="M2 15h8v6h12"/><circle cx="16" cy="11" r="5"/><circle cx="16" cy="11" r="1.5"/><path d="M2 12q2.5-2 5 0t5 0 5 0 5 0"/></symbol>
    <symbol id="a-3" viewBox="0 0 24 24"><path d="M2 10q2.5-2 5 0t5 0 5 0 5 0M2 16q2.5-2 5 0t5 0 5 0 5 0M5 4l14 16"/></symbol>
      </defs>
    </svg>
  );
}

/** Ícono del sprite. Sin etiqueta propia: el texto o el aria-label del control lo nombra. */
export function Icono({ id, className = "", ...resto }: { id: IdIcono | (string & {}); className?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg className={`ico ${className}`.trim()} aria-hidden="true" {...resto}>
      <use href={"#" + id} />
    </svg>
  );
}

/** El mismo ícono como HTML, para L.divIcon (id y clases son constantes del código, nunca datos). */
export const icoHtml = (id: string, cls = "") => `<svg class="ico ${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
