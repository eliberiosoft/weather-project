/* Avisos breves (toast) y confirmaciones en un <dialog> propio (sin window.confirm). */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useI18n } from "../i18n/useI18n";
import { K } from "./clases";

type Oyente = () => void;
function almacen<T>(inicial: T) {
  let valor = inicial;
  const oyentes = new Set<Oyente>();
  return {
    leer: () => valor,
    poner(v: T) { valor = v; oyentes.forEach((o) => o()); },
    suscribir(o: Oyente) { oyentes.add(o); return () => { oyentes.delete(o); }; },
  };
}

// ---------- toast ----------
const toastActual = almacen<{ texto: string; id: number } | null>(null);
let temporizador: ReturnType<typeof setTimeout> | undefined;

export function toast(texto: string, ms = 4000): void {
  clearTimeout(temporizador);
  toastActual.poner({ texto, id: Date.now() });
  temporizador = setTimeout(() => toastActual.poner(null), ms);
}

export function Toast() {
  const m = useSyncExternalStore(toastActual.suscribir, toastActual.leer);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom)+1rem)] z-50 flex justify-center px-4 lg:bottom-6">
      {m && (
        <p key={m.id} className="w-max max-w-full animate-entra rounded-2xl bg-negro px-4 py-3 font-semibold text-white shadow-flota">
          {m.texto}
        </p>
      )}
    </div>
  );
}

// ---------- confirmar ----------
interface Pedido { texto: string; si?: string; responder: (ok: boolean) => void }
const pedido = almacen<Pedido | null>(null);

/** Pide confirmación en un diálogo modal; resuelve true si la persona acepta. */
export function confirmar(texto: string, si?: string): Promise<boolean> {
  return new Promise((responder) => {
    pedido.leer()?.responder(false);
    pedido.poner({ texto, si, responder });
  });
}

export function Confirmaciones() {
  const { t } = useI18n();
  const p = useSyncExternalStore(pedido.suscribir, pedido.leer);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (p && !d.open) d.showModal();
    if (!p && d.open) d.close();
  }, [p]);
  const responder = (ok: boolean) => { p?.responder(ok); pedido.poner(null); };
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); responder(false); }}
      aria-labelledby="confirmar-texto"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-ficha bg-papel p-6 text-texto shadow-flota backdrop:bg-negro/40">
      <p id="confirmar-texto" className="text-base font-semibold">{p?.texto}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" className={K.btnNeutro} onClick={() => responder(false)}>{t("panel.confirmar.no")}</button>
        <button type="button" className={K.btnChicoFuerte} onClick={() => responder(true)} autoFocus>{p?.si || t("panel.confirmar.si")}</button>
      </div>
    </dialog>
  );
}
