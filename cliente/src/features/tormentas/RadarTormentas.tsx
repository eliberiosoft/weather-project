/* Radar de «Mi lugar»: anillos de 10, 40 y 150 km alrededor del cantón, las nubes de tormenta (celdas de 10 km) y los
   rayos (celdas de 5 km) en su dirección y distancia. Es un dibujo del satélite, no un radar meteorológico. */
import { NEGRO, NUBE, TINTA } from "../../shared/estilo";
import { num } from "../../shared/formato";
import { useI18n } from "../../shared/i18n";
import { escala, punto, R_SVG } from "./radar";
import type { Radar } from "./tipos";

export function RadarTormentas({ radar, radios, etiqueta }: { radar: Radar; radios: number[]; etiqueta: string }) {
  const { t } = useI18n();
  const R = radar.radio_km;
  const borde = R_SVG + 14;
  return (
    <figure className="mx-auto w-full max-w-[17rem]">
      <svg viewBox={`${-borde} ${-borde} ${borde * 2} ${borde * 2}`} role="img" aria-label={etiqueta} className="block w-full">
        <circle r={R_SVG} fill="#fff" fillOpacity={0.75} stroke={TINTA} strokeWidth={1.5} />
        {/* barrido: solo da la idea de radar; con movimiento reducido no gira */}
        <g className="animate-[spin_6s_linear_infinite] motion-reduce:hidden">
          <path d={`M0 0 L0 ${-R_SVG} A${R_SVG} ${R_SVG} 0 0 1 ${R_SVG * Math.sin(Math.PI / 6)} ${-R_SVG * Math.cos(Math.PI / 6)} Z`} fill={TINTA} fillOpacity={0.1} />
        </g>
        <line x1={-R_SVG} x2={R_SVG} stroke={TINTA} strokeOpacity={0.15} />
        <line y1={-R_SVG} y2={R_SVG} stroke={TINTA} strokeOpacity={0.15} />
        {radios.filter((km) => km < R).map((km) => (
          <circle key={km} r={escala(km, R)} fill="none" stroke={TINTA} strokeWidth={1.2} strokeDasharray="4 4" strokeOpacity={0.7} />
        ))}
        {radar.nubes.map(([x, y, c], i) => {
          const [sx, sy] = punto(x, y, R);
          return <circle key={i} cx={sx} cy={sy} r={c === 3 ? 5 : 4} fill={NUBE[c]} fillOpacity={c === 1 ? 0.75 : 0.9} />;
        })}
        {(radar.rayos ?? []).map(([x, y, min], i) => {
          const [sx, sy] = punto(x, y, R);
          return <circle key={"r" + i} cx={sx} cy={sy} r={min <= 10 ? 2.6 : 2} fill={NEGRO} stroke="#fff" strokeWidth={1} />;
        })}
        <circle r={4.5} fill={TINTA} stroke="#fff" strokeWidth={2} />
        {[...radios.filter((km) => km < R), R].map((km) => (
          <text key={"t" + km} x={escala(km, R) * 0.71 + 2} y={-escala(km, R) * 0.71 - 2} fontSize={9} fontWeight={600} fill={TINTA}>{num(km)} km</text>
        ))}
        {(["n", "e", "s", "o"] as const).map((r, i) => (
          <text key={r} x={[0, R_SVG + 8, 0, -R_SVG - 8][i]} y={[-R_SVG - 5, 3, R_SVG + 11, 3][i]} textAnchor="middle" fontSize={9} fontWeight={700} fill={TINTA}>{t("app.torm.radar." + r)}</text>
        ))}
      </svg>
      <figcaption className="mt-1 text-center text-xs text-pretty opacity-80">{t("app.torm.radar.nota")}</figcaption>
    </figure>
  );
}
