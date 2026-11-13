/* Curva de lluvia de 6 días, con escala fija (0–120 mm) y los umbrales del plan (50 y 100 mm). */
import { num } from "../../shared/formato";
import { I18N, useI18n } from "../../shared/i18n";
import type { Lluvia } from "../../shared/tipos";

const TOPE = 120, BASE = 160, ALTO = 120;
const x = (i: number) => 50 + i * 100, y = (mm: number) => BASE - (Math.min(mm, TOPE) / TOPE) * ALTO;

export function GraficaLluvia({ ll }: { ll: Lluvia }) {
  const { t } = useI18n();
  const dias = ll.dias.slice(0, 6);
  if (!dias.length) return null;
  const pts = dias.map((d, i): [number, number] => [x(i), y(d.mm)]);
  const p = (i: number) => pts[i] as [number, number];
  let d = `M${p(0)[0]},${p(0)[1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {   // curva suave que pasa por cada día
    const p0 = pts[i - 1] || p(i), p1 = p(i), p2 = p(i + 1), p3 = pts[i + 2] || p2;
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]},${p2[1].toFixed(1)}`;
  }
  const ultimo = p(pts.length - 1);
  const area = `${d} L${ultimo[0]},${BASE} L${p(0)[0]},${BASE}Z`;
  const resumen = dias.map((dd) => `${I18N.fecha(new Date(dd.fecha + "T12:00:00"), { weekday: "long" })} ${num(dd.mm)} mm`).join(", ");
  return (
    <svg viewBox="0 0 600 212" className="w-full overflow-visible" role="img" aria-label={t("app.lluvia.etq", { lista: resumen })}>
      <defs>
        <linearGradient id="lluvia-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="[stop-color:var(--color-cielo)] [stop-opacity:.35]" /><stop offset="1" className="[stop-color:var(--color-cielo)] [stop-opacity:0]" />
        </linearGradient>
      </defs>
      {[50, 100].map((u) => (
        <g key={u}>
          <line x1="10" x2="590" y1={y(u)} y2={y(u)} strokeDasharray="6 7" strokeWidth="2" className="stroke-gris/30" />
          <text x="590" y={y(u) - 7} textAnchor="end" fontSize="19" fontWeight="600" className="fill-gris">{u} mm</text>
        </g>
      ))}
      <line x1="10" x2="590" y1={BASE} y2={BASE} strokeWidth="2" className="stroke-regla" />
      <path d={area} fill="url(#lluvia-g)" />
      <path d={d} pathLength="1" strokeWidth="5" strokeLinecap="round" className="animate-dibujar fill-none stroke-cielo [stroke-dasharray:1]" />
      {dias.map((dd, i) => {
        const pasado = i < ll.hoy_indice, hoy = i === ll.hoy_indice;
        const et = hoy ? t("app.lluvia.hoy") : I18N.fecha(new Date(dd.fecha + "T12:00:00"), { weekday: "short", day: "numeric" });
        const [px, py] = p(i);
        return (
          <g key={dd.fecha}>
            {hoy ? <circle cx={px} cy={py} r="11" className="fill-tinta stroke-white" strokeWidth="4" />
              : <circle cx={px} cy={py} r="7" strokeWidth="4" className={pasado ? "fill-white stroke-cielo" : "fill-cielo stroke-white"} />}
            <text x={px} y={py - 18} textAnchor="middle" fontSize="22" fontWeight="700" className="fill-texto">{num(dd.mm)}</text>
            {hoy ? <><rect x={px - 34} y="178" width="68" height="28" rx="14" className="fill-tinta" /><text x={px} y="198" textAnchor="middle" fontSize="18" fontWeight="700" className="fill-white">{et}</text></>
              : <text x={px} y="198" textAnchor="middle" fontSize="18" fontWeight="500" className="fill-gris">{et}</text>}
          </g>
        );
      })}
    </svg>
  );
}
