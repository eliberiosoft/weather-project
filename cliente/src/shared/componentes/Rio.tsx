/* Medidor del caudal de hoy (modelo GloFAS) y lectura de la regla (medida): siempre dicen si es modelo o medición. */
import { hora, num } from "../formato";
import { useI18n } from "../i18n";
import { K } from "../estilo";
import type { EstadoApi, Glofas } from "../tipos";
import { Html } from "./Html";

export function MedidorRio({ g }: { g: Glofas | null | undefined }) {
  const { t } = useI18n();
  if (!g || g.q_hoy == null) return null;
  const q = g.q_hoy;
  const pos = (x: number) => x <= g.p90 ? (x / g.p90) * 40 : x <= g.q2 ? 40 + ((x - g.p90) / (g.q2 - g.p90)) * 20
    : x <= g.q5 ? 60 + ((x - g.q2) / (g.q5 - g.q2)) * 20 : Math.min(98, 80 + ((x - g.q5) / g.q5) * 40);
  const zona = q <= g.p90 ? 1 : q <= g.q2 ? 2 : q <= g.q5 ? 3 : 4;   // en qué tramo está el caudal de hoy
  const tramo = (k: number, izq: number, ancho: number) => (
    <span className={k === zona ? "absolute top-5 -translate-x-1/2 text-xs font-bold text-texto" : "absolute top-5 -translate-x-1/2 text-xs font-medium text-gris"}
      style={{ left: `${izq + ancho / 2}%` }}>{t("app.medidor.zona." + k)}</span>
  );
  return (
    <>
      <p className="mt-4 text-sm font-semibold">{t("app.medidor.titulo")}</p>
      <div role="img" aria-label={t("app.medidor.etq", { q: num(q) })} className="relative mt-3 mb-9 grid h-3 grid-cols-[40fr_20fr_20fr_20fr] gap-0.5">
        <i className="rounded-l-full bg-n1"></i><i className="bg-n2"></i><i className="bg-n3"></i><i className="rounded-r-full bg-n4"></i>
        <span className="absolute -top-1.5 -ml-3 size-6 rounded-full border-4 border-white bg-negro shadow-flota" style={{ left: `${pos(q)}%` }}></span>
        {tramo(1, 0, 40)}{tramo(2, 40, 20)}{tramo(3, 60, 20)}{tramo(4, 80, 20)}
      </div>
      <Html como="p" className={K.nota} clave="app.medidor.nota" vars={{ q: num(q), zona: t("app.medidor.zona." + zona), prob: num(g.prob.Q2_30d) }} />
    </>
  );
}

export function LecturaRegla({ estado, pid }: { estado: EstadoApi | null; pid: string | null | undefined }) {
  const { t } = useI18n();
  const reg = pid ? estado?.puntos[pid]?.regla : null;
  if (!reg || !pid) return null;
  return (
    <Html como="p" className={K.nota} clave="app.regla" vars={{
      pid, m: num(reg.lectura_m, 2), hora: hora(reg.hora),
      falta: reg.falta_borde_m != null ? t("app.regla.falta", { m: num(reg.falta_borde_m, 2) }) : "",
    }} />
  );
}
