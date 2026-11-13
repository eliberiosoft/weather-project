/* Protección contra capturas de pantalla (pedido del dueño, spec 018).
   Una página web NO puede impedir una captura del sistema operativo (no hay equivalente a FLAG_SECURE de Android):
   esto es una barrera disuasiva que tapa la app cuando la captura es probable.
   - Tapa la app al perder el foco o pasar a segundo plano: la miniatura del selector de apps y las herramientas que
     toman el foco (Recortes de Windows, Win+Shift+S) muestran la portada y no el contenido.
   - Atajos de captura (Impr Pant, Cmd+Shift+3/4/5/6 en Mac) e imprimir (Ctrl/Cmd+P, menú Imprimir): tapa la app y,
     con Impr Pant, borra el portapapeles. Imprimir sale en blanco (print:hidden en index.html).
   - Sin menú de «guardar imagen» ni arrastrar fotos; el texto no se selecciona salvo en los campos. */
import { store } from "../../shared/store";

export interface Tecla { key: string; code?: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }

/** ¿Es un atajo de captura de pantalla o de impresión? */
export function esAtajoCaptura(e: Tecla): boolean {
  const k = e.key.toLowerCase();
  if (e.key === "PrintScreen" || e.code === "PrintScreen") return true;
  if (e.metaKey && e.shiftKey && (["3", "4", "5", "6", "#", "$", "%", "^"].includes(k) || /^Digit[3-6]$/.test(e.code ?? ""))) return true;
  if (e.metaKey && e.shiftKey && k === "s") return true;          // Win+Shift+S (Recortes)
  return (e.ctrlKey || e.metaKey) && !e.shiftKey && k === "p";      // imprimir
}

const tapar = (motivo: "fuera" | "captura") => {
  // una captura detectada no se destapa sola al volver el foco: hace falta tocar «Volver a la app»
  if (store.get().tapada !== "captura") store.set({ tapada: motivo });
};
const destapar = () => { if (store.get().tapada === "fuera") store.set({ tapada: null }); };
export const volverALaApp = () => store.set({ tapada: null });

function vaciarPortapapeles(): void {
  try { void navigator.clipboard?.writeText("").catch(() => {}); } catch { /* sin permiso */ }
}

/** Instala la protección una vez al arrancar. */
export function protegerPantalla(): void {
  const alTeclear = (e: KeyboardEvent) => {
    if (!esAtajoCaptura(e)) return;
    e.preventDefault();
    tapar("captura");
    if (e.key === "PrintScreen") vaciarPortapapeles();
  };
  // Impr Pant en Windows solo llega como keyup
  window.addEventListener("keydown", alTeclear, true);
  window.addEventListener("keyup", alTeclear, true);
  window.addEventListener("blur", () => tapar("fuera"));
  window.addEventListener("focus", destapar);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") tapar("fuera");
    else if (document.hasFocus()) destapar();
  });
  window.addEventListener("pagehide", () => tapar("fuera"));
  window.addEventListener("beforeprint", () => tapar("captura"));
  const esFoto = (t: EventTarget | null) => t instanceof HTMLImageElement || (t instanceof Element && !!t.closest("img, canvas, svg image"));
  document.addEventListener("contextmenu", (e) => { if (esFoto(e.target)) e.preventDefault(); });
  document.addEventListener("dragstart", (e) => { if (esFoto(e.target)) e.preventDefault(); });
}
