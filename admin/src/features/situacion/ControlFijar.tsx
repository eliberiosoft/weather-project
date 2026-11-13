/* Fijar el nivel verificado de un ámbito con su motivo (queda en el historial).
   Lo elegido y no fijado vive en el estado de cada fila: refrescar la tabla no lo borra. */
import { useState } from "react";
import { api, mensajeError } from "../../shared/api/cliente";
import type { AmbitoTipo, Nivel } from "../../shared/api/tipos";
import { useI18n } from "../../shared/i18n/useI18n";
import { K } from "../../shared/ui/clases";
import { confirmar, toast } from "../../shared/ui/avisos";
import { usePanelDatos } from "../datos/PanelDatos";

/** `apilado`: en una tarjeta del celular, nivel y motivo a todo el ancho y el botón debajo. */
export function ControlFijar({ tipo, id, actual, nombre, fuerte = false, apilado = false }: {
  tipo: AmbitoTipo; id: string | number; actual: Nivel; nombre: string; fuerte?: boolean; apilado?: boolean;
}) {
  const { t, existe } = useI18n();
  const { recargarAjustes, recargarEstado } = usePanelDatos();
  const [nivel, setNivel] = useState<string | null>(null);      // null: sin tocar (muestra el verificado actual)
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const elegido = nivel ?? (actual ? String(actual) : "");
  const idMotivo = `mot-${tipo}-${id}`;
  // dentro de una tarjeta (fondo suelo) los campos van en papel para que se distingan
  const campo = apilado ? K.campoChico.replace("bg-suelo", "bg-papel") : K.campoChico;

  async function fijar() {
    if (elegido && !motivo.trim()) {
      document.getElementById(idMotivo)?.focus();
      toast(t("panel.fijar.falta_motivo"));
      return;
    }
    if (elegido === "4" && !(await confirmar(t("panel.fijar.confirmar_respuesta")))) return;
    setEnviando(true);
    try {
      await api("/api/panel/nivel", { ambito_tipo: tipo, ambito_id: String(id), nivel_cod: elegido ? Number(elegido) : null, motivo: motivo.trim() });
      toast(t("panel.fijar.guardado"), 6000);
      setNivel(null);
      setMotivo("");
      await Promise.all([recargarAjustes(), recargarEstado(true)]);
    } catch (e) {
      toast(mensajeError(e, t, existe), 6000);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={apilado ? "grid gap-2" : "flex flex-wrap items-center gap-1.5"}>
      <select value={elegido} onChange={(e) => setNivel(e.target.value)} aria-label={`${t("panel.fijar.nivel_etq")} · ${nombre}`} className={`${campo} min-h-11`}>
        <option value="">{t("panel.fijar.sin_verificar")}</option>
        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{t("nivel." + n)}</option>)}
      </select>
      <input id={idMotivo} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300}
        aria-label={`${t("panel.fijar.motivo_etq")} · ${nombre}`} placeholder={t("panel.fijar.motivo_ph")}
        className={`${campo} min-h-11 min-w-40 flex-1`} />
      <button type="button" disabled={enviando} onClick={fijar} className={fuerte || apilado ? K.btnChicoFuerte : K.btnChico}>{t("panel.fijar.boton")}</button>
    </div>
  );
}
