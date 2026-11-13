/* Una sección de la app. Todas quedan montadas (el mapa y el asistente conservan su estado al cambiar de vista);
   solo la activa se ve, y entra con una animación corta. */
import type { ReactNode } from "react";
import { useApp, type Vista as IdVista } from "../store";
import { useI18n } from "../i18n";

export function Vista({ id, etiqueta, className, children }: { id: IdVista; etiqueta: string; className: string; children: ReactNode }) {
  const { t } = useI18n();
  const activa = useApp((s) => s.vista === id);
  return (
    <section id={"v-" + id} aria-label={t(etiqueta)} className={`${className} ${activa ? "activa" : ""}`}>
      {children}
    </section>
  );
}
