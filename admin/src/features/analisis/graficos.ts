/* Lo que el análisis calcula al dibujar y la descarga del Excel. */

export const PERIODOS = [7, 30, 90, 365] as const;

/** Escalón 0–5 de la escala secuencial (0 = sin reportes). */
export function escalon(n: number, max: number): number {
  if (!n || max <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil((n / max) * 5)));
}

/** «35 min», «4,5 h», «3 d». */
export function horasTexto(h: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (h < 1) return t("panel.an.u_min", { n: Math.max(1, Math.round(h * 60)) });
  if (h < 48) return t("panel.an.u_h", { n: (Math.round(h * 10) / 10).toString().replace(".", ",") });
  return t("panel.an.u_d", { n: Math.round(h / 24) });
}

/** El Excel lo arma la API; como toda ruta del panel exige la cabecera anti-CSRF, se pide con fetch y se descarga. */
export async function descargarExcel(dias: number): Promise<void> {
  const r = await fetch(`/api/panel/analisis.xlsx?dias=${dias}`, {
    credentials: "same-origin", cache: "no-store", headers: { "X-Requested-With": "yaguachi" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const nombre = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? `yaguachi-analisis-${dias}d.xlsx`;
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
