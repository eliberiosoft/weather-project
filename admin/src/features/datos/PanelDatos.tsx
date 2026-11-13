/* Datos compartidos por varias pestañas: ajustes (puntos, recintos, avisos, historial), el estado calculado
   y el número de reportes pendientes. El estado y los pendientes se refrescan cada minuto. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../../shared/api/cliente";
import type { Ajustes, EstadoPanel, Reporte } from "../../shared/api/tipos";

interface Datos {
  ajustes: Ajustes | null;
  estado: EstadoPanel | null;
  pendientes: number | null;
  error: unknown;
  recargarAjustes: () => Promise<void>;
  recargarEstado: (forzar?: boolean) => Promise<void>;
  recargarPendientes: () => Promise<void>;
  recargarTodo: () => Promise<void>;
}

const Contexto = createContext<Datos | null>(null);

export function usePanelDatos(): Datos {
  const d = useContext(Contexto);
  if (!d) throw new Error("usePanelDatos fuera de <PanelDatos>");
  return d;
}

export function PanelDatos({ children }: { children: ReactNode }) {
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [estado, setEstado] = useState<EstadoPanel | null>(null);
  const [pendientes, setPendientes] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);

  const recargarAjustes = useCallback(async () => { setAjustes(await api<Ajustes>("/api/panel/ajustes")); }, []);
  const recargarEstado = useCallback(async (forzar = false) => {
    setEstado(await api<EstadoPanel>("/api/panel/estado" + (forzar ? "?forzar=1" : "")));
  }, []);
  const recargarPendientes = useCallback(async () => {
    try {
      const j = await api<{ reportes: Reporte[] }>("/api/panel/reportes?estado=pendiente");
      setPendientes(j.reportes.length);
    } catch { /* el contador es secundario */ }
  }, []);
  const recargarTodo = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([recargarAjustes(), recargarEstado()]);
    } catch (e) {
      setError(e);
    }
    void recargarPendientes();
  }, [recargarAjustes, recargarEstado, recargarPendientes]);

  useEffect(() => {
    void recargarTodo();
    const h = setInterval(() => {
      recargarEstado().catch(() => {});
      void recargarPendientes();
    }, 60_000);
    return () => clearInterval(h);
  }, [recargarTodo, recargarEstado, recargarPendientes]);

  const valor = useMemo<Datos>(() => ({ ajustes, estado, pendientes, error, recargarAjustes, recargarEstado, recargarPendientes, recargarTodo }),
    [ajustes, estado, pendientes, error, recargarAjustes, recargarEstado, recargarPendientes, recargarTodo]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
