/* Campo de clave con botón para mostrarla u ocultarla. */
import { useState } from "react";
import { useI18n } from "../../shared/i18n/useI18n";
import { Icono } from "../../shared/ui/Icono";
import { K } from "../../shared/ui/clases";

export function CampoClave({ id, etiqueta, valor, alCambiar, autoComplete, ayuda, autoFocus }: {
  id: string; etiqueta: string; valor: string; alCambiar: (v: string) => void;
  autoComplete: "current-password" | "new-password"; ayuda?: string; autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const [ver, setVer] = useState(false);
  return (
    <div className="mt-4">
      <label htmlFor={id} className={K.etiqueta}>{etiqueta}</label>
      <div className="relative">
        <input id={id} type={ver ? "text" : "password"} value={valor} onChange={(e) => alCambiar(e.target.value)}
          autoComplete={autoComplete} autoCapitalize="off" spellCheck={false} autoFocus={autoFocus}
          aria-describedby={ayuda ? id + "-ayuda" : undefined}
          className={`${K.campo} h-12 pr-14`} />
        <button type="button" onClick={() => setVer(!ver)} aria-pressed={ver}
          aria-label={t(ver ? "panel.login.ocultar" : "panel.login.mostrar")}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-gris transition hover:text-tinta">
          <Icono id={ver ? "ojoNo" : "ojo"} className="size-5" />
        </button>
      </div>
      {ayuda && <p id={id + "-ayuda"} className="mt-1.5 text-xs text-gris">{ayuda}</p>}
    </div>
  );
}
