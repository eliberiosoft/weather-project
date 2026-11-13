/* La ficha del nivel: la pieza grande del mosaico, en el color de su nivel. En «Mi lugar» lleva una escena viva
   (el agua sube con el nivel y la nube llueve según la lluvia pronosticada). En las hojas del mapa va compacta.
   El nombre del nivel siempre va escrito y dice de dónde sale: verificado o estimación automática. */
import type { CSSProperties, ReactNode } from "react";
import { hora } from "../formato";
import { useI18n } from "../i18n";
import { fondoNivel } from "../estilo";
import { Icono } from "./Icono";

const GRAD: Record<number, string> = {
  0: "bg-linear-150 from-n0-claro to-n0 text-texto", 1: "bg-linear-150 from-n1-claro to-n1-medio text-texto",
  2: "bg-linear-150 from-n2-claro to-n2 text-texto", 3: "bg-linear-150 from-n3-claro to-n3 text-texto", 4: "bg-n4 text-white",
};
const AGUA_ALTO: Record<number, string> = { 0: "h-[14%]", 1: "h-[18%]", 2: "h-[30%]", 3: "h-[42%]", 4: "h-[54%]" };
const ONDA = "M0 18 Q50 0 100 18 T200 18 T300 18 T400 18 T500 18 T600 18 T700 18 T800 18 V100 H0Z";
const XS = [46, 58, 70, 82, 52, 64, 76];

function Escena({ mm }: { mm: number | null | undefined }) {
  const gotas = mm == null || mm < 1 ? 0 : mm < 10 ? 3 : mm < 30 ? 5 : 7;
  return (
    <svg viewBox="0 0 120 100" className="h-20 w-24 shrink-0 drop-shadow-[0_10px_12px_rgb(22_58_82/.20)]" aria-hidden="true">
      <defs>
        <linearGradient id="nube-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".5" className="[stop-color:white]" /><stop offset="1" className="[stop-color:var(--color-nube)]" />
        </linearGradient>
      </defs>
      {!gotas && <><circle cx="86" cy="32" r="18" className="fill-sol" /><circle cx="86" cy="32" r="12" className="fill-sol-claro" /></>}
      <path d="M30 64a18 18 0 012-36 26 26 0 0148-6 20 20 0 0114 42z" fill="url(#nube-g)" className="animate-flota" />
      {XS.slice(0, gotas).map((x, i) => (
        <line key={i} x1={x} y1="72" x2={x - 3} y2="82" strokeWidth="4" strokeLinecap="round" className="stroke-cielo animate-gota" style={{ animationDelay: (i * 0.17).toFixed(2) + "s" }} />
      ))}
    </svg>
  );
}

function Olas({ n }: { n: number }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 ${AGUA_ALTO[n] ?? AGUA_ALTO[0]}`} aria-hidden="true">
      <svg viewBox="0 0 800 100" preserveAspectRatio="none" className="absolute bottom-0 left-0 h-full w-[200%] animate-ola-lenta fill-white/25"><path d={ONDA} /></svg>
      <svg viewBox="0 0 800 100" preserveAspectRatio="none" className="absolute bottom-0 left-0 h-[80%] w-[200%] animate-ola fill-white/30"><path d={ONDA} /></svg>
    </div>
  );
}

interface Props {
  n: number | null;
  oficial: boolean;
  horaVerif?: string | null | undefined;
  motivo?: string | null | undefined;
  extra?: ReactNode;
  compacta?: boolean;
  lluvia?: number | null | undefined;
  className?: string;
  style?: CSSProperties;
}

export function Banda({ n: nivel, oficial, horaVerif, motivo, extra, compacta = false, lluvia = null, className = "", style }: Props) {
  const { t } = useI18n();
  const n = nivel || 0;
  const claro = n === 4;   // sobre rojo el texto va en blanco
  const sello = oficial ? (
    <>
      <span className="inline-flex flex-wrap items-center gap-x-1.5 rounded-2xl bg-negro/85 px-3 py-1 text-[.85rem] font-semibold text-white">
        <Icono id="i-check" className="size-4" /><span className="whitespace-nowrap">{t("app.banda.verificado")}</span>
        {horaVerif ? <span className="w-full pl-5.5 font-medium whitespace-nowrap opacity-80">{hora(horaVerif)}</span> : null}
      </span>
      <a href="#aviso-oficial" className="mt-1.5 block text-xs font-semibold underline decoration-1 underline-offset-2">{t("app.banda.no_oficial")}</a>
    </>
  ) : (
    <span className={claro ? "inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-[.85rem] font-semibold" : "inline-flex items-center rounded-full bg-white/60 px-3 py-1 text-[.85rem] font-semibold"}>{t("app.banda.estimado")}</span>
  );
  const barra = (k: number) => k === n
    ? (claro ? "block h-2 w-full rounded-full bg-white" : "block h-2 w-full rounded-full bg-texto/80")
    : (claro ? "block h-2 w-full rounded-full bg-white/30" : "block h-2 w-full rounded-full bg-texto/15");
  // solo el nivel actual lleva su nombre bajo la barra (los demás quedan para lectores de pantalla)
  const escala = (
    <ol aria-label={t("app.banda.escala")} className="relative mt-5 grid list-none grid-cols-4 gap-1.5 p-0 lg:mt-auto lg:pt-5">
      {[1, 2, 3, 4].map((k) => (
        <li key={k} className={k === n ? (k >= 3 ? "flex flex-col items-end" : "flex flex-col items-start") : ""} aria-current={k === n ? "true" : undefined}>
          <span className={barra(k)}></span>
          <span className={k === n ? "mt-1.5 block text-xs font-bold whitespace-nowrap" : "sr-only"}>{t("nivel." + k)}</span>
        </li>
      ))}
    </ol>
  );
  if (compacta) return (
    <div className={`mb-3 rounded-2xl p-4 ${fondoNivel(n)}`}>
      <div className="text-[1.9rem] leading-none font-extrabold tracking-tight">{t("nivel." + n)}</div>
      {motivo ? <p className="mt-2 font-semibold">{motivo}</p> : null}
      <div className="mt-3">{sello}</div>{extra}{escala}
    </div>
  );
  return (
    <div style={style} className={`relative col-span-2 overflow-hidden rounded-[2rem] p-5 shadow-ficha lg:row-span-2 lg:flex lg:flex-col ${GRAD[n] ?? GRAD[0]} ${className}`.trim()}>
      <Olas n={n} />
      <div className="absolute top-2 right-3"><Escena mm={lluvia} /></div>
      <div className="relative pr-24">{sello}</div>
      <div className="relative mt-3 text-[2.5rem] leading-none font-extrabold tracking-tight">{t("nivel." + n)}</div>
      <div className="relative">{motivo ? <p className="mt-2 font-semibold">{motivo}</p> : null}{extra}</div>
      {escala}
    </div>
  );
}
