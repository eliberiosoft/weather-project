/* Diálogo modal nativo (<dialog>): foco atrapado, Escape cierra, fondo oscurecido. */
import { useEffect, useRef, type ReactNode } from "react";
import { useI18n } from "../i18n/useI18n";

export function Dialogo({ abierto, titulo, alCerrar, children, cerrable = true }: {
  abierto: boolean; titulo: string; alCerrar: () => void; children: ReactNode; cerrable?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog ref={ref} aria-labelledby="dialogo-titulo"
      onCancel={(e) => { e.preventDefault(); if (cerrable) alCerrar(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-ficha bg-papel p-6 text-texto shadow-flota backdrop:bg-negro/40">
      {abierto && (
        <>
          <div className="flex items-start justify-between gap-3">
            <h2 id="dialogo-titulo" className="text-lg font-bold">{titulo}</h2>
            {cerrable && (
              <button type="button" onClick={alCerrar} aria-label={t("panel.cerrar")}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-suelo text-gris transition hover:text-texto">
                <svg className="ico size-5" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            )}
          </div>
          {children}
        </>
      )}
    </dialog>
  );
}
