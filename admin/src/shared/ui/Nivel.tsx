/* Píldora de nivel: el color del semáforo solo aparece aquí, y siempre con el nombre escrito. */
import type { Nivel as N } from "../api/tipos";
import { useI18n } from "../i18n/useI18n";

const FONDO: Record<number, string> = {
  0: "bg-n0 text-texto",
  1: "bg-n1 text-black",
  2: "bg-n2 text-texto",
  3: "bg-n3 text-texto",
  4: "bg-n4 text-white",
};

export function Nivel({ n }: { n: N }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex h-7 min-w-24 items-center justify-center rounded-full px-3 text-xs font-bold tracking-wide whitespace-nowrap ${FONDO[n || 0]}`}>
      {n ? t("nivel." + n) : "—"}
    </span>
  );
}
