/* Fotos de un reporte (hasta 3): la primera grande y las demás en fila debajo. */
import { useI18n } from "../i18n/useI18n";

export const urlFotoReporte = (id: string, n: number) => `/api/foto/${encodeURIComponent(id)}${n > 1 ? "/" + n : ""}`;

export function FotosReporte({ r, className = "" }: { r: { id: string; foto: boolean; n_fotos?: number }; className?: string }) {
  const { t } = useI18n();
  const n = r.foto ? Math.max(1, r.n_fotos ?? 1) : 0;
  if (!n) return null;
  return (
    <div className={`grid gap-2 ${className}`.trim()}>
      <img src={urlFotoReporte(r.id, 1)} alt={t(n > 1 ? "panel.rep.foto_n_alt" : "panel.rep.foto_alt", { n: 1 })} loading="lazy"
        className="max-h-64 w-full rounded-2xl bg-suelo object-cover" />
      {n > 1 && (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: n - 1 }, (_, i) => (
            <img key={i} src={urlFotoReporte(r.id, i + 2)} alt={t("panel.rep.foto_n_alt", { n: i + 2 })} loading="lazy"
              className="aspect-[4/3] w-full rounded-xl bg-suelo object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}
