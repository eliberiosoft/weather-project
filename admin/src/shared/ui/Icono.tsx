/* Íconos de trazo (mismo dibujo que el sprite del panel anterior). */
import type { ReactNode } from "react";

const TRAZOS: Record<string, ReactNode> = {
  instalar: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  recalcular: <path d="M20 12a8 8 0 11-2.3-5.6M20 4v5h-5" />,
  salir: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  alerta: <path d="M12 3l10 18H2zM12 10v5M12 18v.01" />,
  luna: <path d="M20 14.5A8.5 8.5 0 019.5 4a7 7 0 1010.5 10.5z" />,
  usuario: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></>,
  llave: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M14 9l2 2" /></>,
  ojo: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  ojoNo: <path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2" />,
  copiar: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" /></>,
  mas: <path d="M12 5v14M5 12h14" />,
  foto: <><path d="M3 8h4l2-3h6l2 3h4v12H3z" /><circle cx="12" cy="13" r="4" /></>,
  pin: <><path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
  canton: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  campana: <path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 21h4" />,
  // menú del panel
  situacion: <path d="M3 20h18M6 20v-6M10 20V9M14 20v-8M18 20V5" />,
  reportes: <path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5" />,
  albergues: <path d="M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5" />,
  incidentes: <><path d="M12 21s7-6.2 7-11.5a7 7 0 10-14 0C5 14.8 12 21 12 21z" /><path d="M12 6.5v4M12 13v.01" /></>,
  reglas: <path d="M5 21V3M5 5h4M5 9h6M5 13h4M5 17h6M14 21q2-3 4 0M14 16q2-3 4 0" />,
  ajustes: <path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4" />,
  dispositivos: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></>,
  usuarios: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14.5a6.5 6.5 0 013.5 5.5" /></>,
  config: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  gps: <><circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  papelera: <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />,
  atras: <path d="M15 5l-7 7 7 7" />,
  adelante: <path d="M9 5l7 7-7 7" />,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  mapa: <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" />,
  analisis: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  capas: <path d="M12 3l9 5-9 5-9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5" />,
  agrandar: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  achicar: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  auto: <><path d="M5 17h14v-5l-2-5H7l-2 5zM5 12h14" /><circle cx="8" cy="17" r="1.8" /><circle cx="16" cy="17" r="1.8" /></>,
  caminar: <><circle cx="13" cy="4.5" r="1.8" /><path d="M10 21l2-6 3 3v3M9 12l2-4 3 1 2 4M11 8l-2 1-1 3" /></>,
  nube: <path d="M7 18a4.5 4.5 0 01-.6-9A6 6 0 0118 8.5a4.5 4.5 0 01-1 9M12 21v-8M9 15.5l3-3 3 3" />,
  sinred: <path d="M2 8.5a15 15 0 0120 0M5.5 12a10 10 0 0113 0M9 15.5a5 5 0 016 0M12 19h.01M3 3l18 18" />,
  "t-calle_inundada": <path d="M5 3l-2 18M19 3l2 18M12 4v2M12 9v2M4 15q2-2 4 0t4 0 4 0 4 0" />,
  "t-vivienda_inundada": <path d="M3 11l9-7 9 7M5 9.5V20h14V9.5M5 15.5q1.8-2 3.5 0t3.5 0 3.5 0 3.5 0" />,
  "t-rio_crecido": <path d="M12 13V3M8 7l4-4 4 4M2 18q2.5-3 5 0t5 0 5 0 5 0" />,
  "t-desborde": <path d="M4 13h16v8H4zM2 9q2.5-3 5 0t5 0 5 0 5 0M9 13v8M15 13v8" />,
  "t-via_cerrada": <><circle cx="12" cy="12" r="9" /><path d="M7 12h10" /></>,
  "t-alcantarilla": <path d="M3 7h18v11H3zM7.5 7v11M12 7v11M16.5 7v11" />,
  "t-dique_filtracion": <path d="M3 5h18v12H3zM12 5l-2 4 3 2.5-2 5.5M5 21q1.7-1.5 3.5 0t3.5 0 3.5 0 3.5 0" />,
  "t-socavon": <path d="M2 9h6l2 8h4l2-8h6M10 13h4" />,
  "t-arbol_poste": <path d="M3 20h18M6 20L16 5M12 11l5 3.5M14 8l4 2.5" />,
  "t-sin_luz": <path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9V16h7v-2.1A6 6 0 0012 3zM3 3l18 18" />,
  "t-lluvia_fuerte": <path d="M7 13a4 4 0 01.4-8A5.5 5.5 0 0118 6.5a3.3 3.3 0 01-1 6.5zM7 16l-1.5 5M11 16l-1.5 5M15 16l-1.5 5M19 16l-1.5 5" />,
  "t-aislados": <><circle cx="8" cy="5.5" r="2" /><circle cx="16" cy="5.5" r="2" /><path d="M5 14v-3a3 3 0 016 0v3M13 14v-3a3 3 0 016 0v3M2 19q2.5-3 5 0t5 0 5 0 5 0" /></>,
  "t-cultivos_ganado": <path d="M12 21V10M12 14c-4 0-6.5-3-6.5-6.5 4 0 6.5 3 6.5 6.5zM12 11c0-4 2.5-7 6.5-7 0 4-2.5 7-6.5 7zM4 21h16" />,
  "t-bache": <path d="M2 13h5c1.5 4.5 8.5 4.5 10 0h5M9.5 9.5l1 2.5M12 8.5v3M14.5 9.5l-1 2.5M2 19h20" />,
  "t-basura": <path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5" />,
  "t-robo": <path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 7.6-1.7M12 14.5v3" />,
  "t-otro": <path d="M6 3h9l4 4v14H6zM9 12h7M9 16h5" />,
};

export function Icono({ id, className = "" }: { id: string; className?: string }) {
  return (
    <svg className={`ico ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {TRAZOS[id] ?? TRAZOS["t-otro"]}
    </svg>
  );
}
