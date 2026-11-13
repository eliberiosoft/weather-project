/* Raíz del panel: decide entre ingreso, cambio de clave y panel según la sesión. */
import { useEffect } from "react";
import { I18N, useI18n } from "./shared/i18n/useI18n";
import { Confirmaciones, Toast } from "./shared/ui/avisos";
import { Cargando, ConexionLenta } from "./shared/ui/Carga";
import { CambiarClave } from "./features/auth/CambiarClave";
import { Ingreso } from "./features/auth/Ingreso";
import { iniciarSesion, useSesion } from "./features/auth/sesion";
import { Cabecera } from "./features/shell/Cabecera";
import { Panel } from "./features/shell/Panel";
import { useSplash } from "./features/pwa/splash";

export function App() {
  const { t, idioma } = useI18n();
  const s = useSesion();

  useEffect(() => { void iniciarSesion(); }, []);
  // splash del panel instalado: con el ingreso o el cambio de clave ya hay qué mostrar; con el panel, lo cierra Panel
  useSplash(s.fase === "ingreso" || s.fase === "clave", t("panel.splash.etq"));
  useEffect(() => {
    document.title = t("panel.titulo");
    document.documentElement.lang = I18N.locale();
  }, [t, idioma]);

  return (
    <>
      {s.fase === "panel" ? <Panel key={s.usuario.id} usuario={s.usuario} /> : (
        <>
          <Cabecera usuario={s.fase === "clave" ? s.usuario : undefined} />
          {s.fase === "cargando" && <div className="grid min-h-[calc(100dvh-4rem)] place-items-center"><Cargando /></div>}
          {s.fase === "ingreso" && <Ingreso aviso={s.aviso} />}
          {s.fase === "clave" && <CambiarClave obligatoria={s.obligatoria} />}
        </>
      )}
      <ConexionLenta />
      <Toast />
      <Confirmaciones />
    </>
  );
}
