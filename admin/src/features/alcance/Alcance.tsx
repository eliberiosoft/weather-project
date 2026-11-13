/* Detalle del alcance (spec 021, US5), solo para el superadmin (permiso alcance.detalle, verificado en la API):
   - «Ver teléfonos» bajo cada aviso o incidente: qué teléfonos lo abrieron, cuándo y por dónde (app o notificación).
   La lista de todos los teléfonos que usan la app está en la pestaña «Dispositivos».
   Cada teléfono es un código fijo («7F3A2C», de la firma cifrada): el mismo teléfono tiene el mismo código en todas las
   listas, pero no se ve su id ni el nombre de nadie. El tipo de teléfono es aproximado (sistema y navegador).
   Cada consulta queda en la auditoría. */
import { useState } from "react";
import { api, mensajeError } from "../../shared/api/cliente";
import { useI18n } from "../../shared/i18n/useI18n";
import { EsqueletoLinea, Esperando } from "../../shared/ui/Esqueleto";
import { Icono } from "../../shared/ui/Icono";
import { K } from "../../shared/ui/clases";

interface TelAbrio { codigo: string; vias: ("app" | "push")[]; primera: string; plataforma: string | null; notificaciones: boolean; recinto: string | null }

/** Botón «Ver teléfonos» y la lista de los que abrieron este aviso o incidente. */
export function VerTelefonos({ tipo, id }: { tipo: "aviso" | "incidente"; id: number | string }) {
  const { t, existe, hora } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState<TelAbrio[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function alternar() {
    if (abierto) { setAbierto(false); return; }
    setAbierto(true);
    setError(null);
    try { setLista((await api<{ dispositivos: TelAbrio[] }>(`/api/panel/alcance/${tipo}/${id}`)).dispositivos); }
    catch (e) { setError(mensajeError(e, t, existe)); }
  }

  return (
    <div className="mt-1.5">
      <button type="button" aria-expanded={abierto} onClick={() => void alternar()} className={K.btnNeutro}>
        <Icono id="usuarios" className="size-4.5" />{t(abierto ? "panel.alcance.ocultar" : "panel.alcance.ver")}
      </button>
      {abierto && (
        <div className="mt-2 rounded-xl border border-regla bg-suelo p-3">
          {error ? <p className="text-sm">{error}</p>
            : !lista ? <Esperando><EsqueletoLinea className="w-2/3" /><EsqueletoLinea className="mt-2 w-1/2" /></Esperando>
            : !lista.length ? <p className={K.vacio}>{t("panel.alcance.nadie")}</p>
            : (
              <ul className="divide-y divide-regla">
                {lista.map((x) => (
                  <li key={x.codigo} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                    <Codigo codigo={x.codigo} />
                    <span className="min-w-0 flex-1">{x.plataforma || t("panel.alcance.sin_tipo")}{x.recinto ? ` · ${x.recinto}` : ""}</span>
                    <span className="flex gap-1">{x.vias.map((v) => <span key={v} className={K.pildora.suave}>{t("panel.alcance.via." + v)}</span>)}</span>
                    <span className={K.mini}>{hora(x.primera)}</span>
                  </li>
                ))}
              </ul>
            )}
          <p className={`${K.mini} mt-2`}>{t("panel.alcance.nota")}</p>
        </div>
      )}
    </div>
  );
}

function Codigo({ codigo }: { codigo: string }) {
  const { t } = useI18n();
  return <span className="rounded-lg bg-papel px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-texto ring-1 ring-regla" title={t("panel.alcance.codigo_ayuda")}>{codigo}</span>;
}
