import { useEffect, useState } from "react";
import { useApp } from "../store";

/** Mensaje corto abajo, encima de la barra de navegación. */
export function Toast() {
  const toast = useApp((s) => s.toast);
  const [vencido, setVencido] = useState(0);
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setVencido(toast.n), toast.ms);
    return () => clearTimeout(h);
  }, [toast]);
  const visible = !!toast && toast.n !== vencido;
  return (
    <div role="status" aria-live="polite" hidden={!visible}
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom)+.75rem)] left-1/2 z-[2000] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 animate-sube rounded-2xl bg-negro px-4 py-3 text-sm font-medium text-white shadow-flota">
      {visible ? toast.msg : ""}
    </div>
  );
}
