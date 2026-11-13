/* Panel con sesión: pestañas según los permisos del rol (hash simple, sin router). */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { Usuario } from "../../shared/api/tipos";
import { useI18n } from "../../shared/i18n/useI18n";
import { toast } from "../../shared/ui/avisos";
import { pestanaDelRol, pestanaInicial, pestanasVisibles, type Pestana } from "../auth/permisos";
import { PanelDatos, usePanelDatos } from "../datos/PanelDatos";
import { Ajustes } from "../ajustes/Ajustes";
import { Avisos } from "../avisos/Avisos";
import { Configuracion } from "../config/Configuracion";
import { Incidentes } from "../incidentes/Incidentes";
import { useSincronizarCola, type Resumen } from "../incidentes/cola";
import { useAvisoRed } from "../pwa/pwa";
import { useSplash } from "../pwa/splash";
import { Reglas } from "../reglas/Reglas";
import { Reportes } from "../reportes/Reportes";
import { Situacion } from "../situacion/Situacion";
import { Usuarios } from "../usuarios/Usuarios";
import { Analisis } from "../analisis/Analisis";
import { Albergues } from "../albergues/Albergues";
import { Dispositivos } from "../dispositivos/Dispositivos";
import { Cabecera } from "./Cabecera";
import { BarraInferior, PestanasEscritorio } from "./Navegacion";

// el mapa en vivo (Leaflet y los grupos) solo se baja si se abre
const Tablero = lazy(() => import("../tablero/Tablero"));

export function Panel({ usuario }: { usuario: Usuario }) {
  return (
    <PanelDatos>
      <PanelConDatos usuario={usuario} />
    </PanelDatos>
  );
}

function PanelConDatos({ usuario }: { usuario: Usuario }) {
  const { t } = useI18n();
  const { estado, ajustes, error, pendientes, recargarEstado } = usePanelDatos();
  // el splash del panel instalado se cierra cuando llegan los primeros datos (o su error)
  useSplash(!!(estado && ajustes) || !!error, t("panel.splash.etq"));
  const visibles = useMemo(() => pestanasVisibles(usuario.permisos), [usuario.permisos]);
  const preferida = pestanaDelRol(usuario.rol);
  const [activa, setActiva] = useState<Pestana | null>(() => pestanaInicial(location.hash, visibles, preferida));

  useEffect(() => {
    const alCambiarHash = () => setActiva(pestanaInicial(location.hash, visibles, preferida));
    window.addEventListener("hashchange", alCambiarHash);
    return () => window.removeEventListener("hashchange", alCambiarHash);
  }, [visibles, preferida]);
  // al cambiar de sección se vuelve arriba (en el celular la barra inferior no lleva a la cabecera)
  const elegir = useCallback((p: Pestana) => { setActiva(p); window.scrollTo({ top: 0 }); }, []);
  useEffect(() => { if (activa && location.hash !== "#" + activa) history.replaceState(null, "", "#" + activa); }, [activa]);

  const red = useCallback((online: boolean) => toast(t(online ? "panel.con_red" : "panel.sin_red"), online ? 4000 : 6000), [t]);
  useAvisoRed(red);
  // incidentes guardados sin señal: se publican solos al volver la red
  const sincronizado = useCallback((r: Resumen) => {
    if (r.enviados) { toast(t("panel.cola.enviados", { n: r.enviados }), 6000); recargarEstado(true).catch(() => {}); }
    if (r.rechazos.length) toast(t("panel.cola.rechazados", { n: r.rechazos.length, motivo: r.rechazos[0] ?? "" }), 8000);
  }, [t, recargarEstado]);
  useSincronizarCola(usuario.id, sincronizado);

  return (
    <>
      <Cabecera usuario={usuario} calculo={estado?.generado} />
      <PestanasEscritorio visibles={visibles} activa={activa} elegir={elegir} pendientes={pendientes} />
      {/* el mapa en vivo ocupa todo el alto disponible, sin márgenes */}
      <main id="panel-activo" role="tabpanel" aria-labelledby={activa ? "tab-" + activa : undefined}
        className={activa === "mapa" ? "w-full" : "mx-auto max-w-7xl px-4 pt-4 pb-[calc(4.25rem+env(safe-area-inset-bottom)+2rem)] lg:px-6 lg:pt-0 lg:pb-12"}>
        {activa === "mapa" && (
          <Suspense fallback={<div className="grid h-[calc(100dvh-4rem-4.25rem)] place-items-center bg-cielo-2 text-sm font-semibold text-gris lg:h-[calc(100dvh-9rem)]">{t("panel.inc.mapa_cargando")}</div>}>
            <Tablero />
          </Suspense>
        )}
        {activa === "analisis" && <Analisis />}
        {activa === "situacion" && <Situacion usuario={usuario} />}
        {activa === "reportes" && <Reportes usuario={usuario} />}
        {activa === "incidentes" && <Incidentes usuario={usuario} />}
        {activa === "albergues" && <Albergues />}
        {activa === "avisos" && <Avisos usuario={usuario} />}
        {activa === "dispositivos" && <Dispositivos />}
        {activa === "reglas" && <Reglas />}
        {activa === "ajustes" && <Ajustes />}
        {activa === "usuarios" && <Usuarios yo={usuario} />}
        {activa === "config" && <Configuracion />}
      </main>
      <BarraInferior visibles={visibles} activa={activa} elegir={elegir} pendientes={pendientes} />
    </>
  );
}
