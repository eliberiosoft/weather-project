/* PWA del panel: registro del service worker (solo en el build) y botón «Instalar el panel».
   beforeinstallprompt puede llegar antes de que React monte la cabecera: se escucha desde que carga el módulo. */
import { useEffect, useSyncExternalStore } from "react";

let pendiente: BeforeInstallPromptEvent | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((o) => o());
let alInstalado: (() => void) | null = null;

window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); pendiente = e; avisar(); });
window.addEventListener("appinstalled", () => { pendiente = null; avisar(); alInstalado?.(); });

export function registrarServiceWorker(): void {
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

/** Función para instalar, o null si el navegador no lo ofrece (o el panel ya está instalado). */
export function useInstalar(instalado: () => void): (() => Promise<void>) | null {
  useEffect(() => { alInstalado = instalado; return () => { alInstalado = null; }; }, [instalado]);
  const evento = useSyncExternalStore((o) => { oyentes.add(o); return () => { oyentes.delete(o); }; }, () => pendiente);
  if (!evento) return null;
  return async () => {
    await evento.prompt();
    await evento.userChoice.catch(() => null);
    pendiente = null;
    avisar();
  };
}

/** Avisa al perder o recuperar la red (el panel abre sin señal, pero no lee ni guarda datos). */
export function useAvisoRed(aviso: (online: boolean) => void): void {
  useEffect(() => {
    const off = () => aviso(false), on = () => aviso(true);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); };
  }, [aviso]);
}
