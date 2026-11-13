/* Avisos del analista: carga (con copia sin conexión), insignia de no vistos y notificaciones locales. */
import { almacen } from "../../shared/almacen";
import { api } from "../../shared/api";
import { enSilencio, recintoDeLugar } from "../../shared/dominio";
import { t } from "../../shared/i18n";
import { store } from "../../shared/store";
import type { Avisos } from "../../shared/tipos";

export async function cargarAvisos(visto: boolean): Promise<void> {
  const { lugar, terr } = store.get();
  const q = recintoDeLugar(lugar, terr) ?? "";
  if (store.get().avisosError) store.set({ avisosError: false });   // otro intento: placeholder
  try {
    const j = await api<Avisos>(`/api/avisos?recinto=${q}`);
    almacen.set("avisos_cache", j);
    procesar(j, visto);
  } catch {
    const c = almacen.get<Avisos | null>("avisos_cache", null);
    if (c) procesar(c, visto);
    else if (!store.get().avisos) store.set({ avisosError: true });
  }
}

function procesar(j: Avisos, visto: boolean): void {
  const vistos = new Set(almacen.get<number[]>("avisos_vistos", []));
  const nuevos = j.vigentes.filter((a) => !vistos.has(a.id));
  const ids = new Set(j.vigentes.map((a) => a.id));
  // solo se recuerdan los avisos vigentes: las listas no crecen sin fin
  if (visto) almacen.set("avisos_vistos", [...ids]);
  store.set({ avisos: j, avisosNuevos: visto ? 0 : nuevos.length });

  const notificados = new Set(almacen.get<number[]>("avisos_notificados", []));
  for (const a of nuevos) {
    if (notificados.has(a.id) || typeof Notification === "undefined" || Notification.permission !== "granted") continue;
    // en horas de silencio un aviso de nivel 1–2 espera: se notifica en la próxima carga fuera de esa franja
    if (a.nivel_cod < 3 && enSilencio(j.horas_silencio)) continue;
    notificados.add(a.id);
    // la misma etiqueta que la notificación push: si llegan las dos, la segunda reemplaza a la primera
    void navigator.serviceWorker?.ready.then((reg) => reg.showNotification(`${t("nivel." + a.nivel_cod)} · ${a.titulo}`, {
      ...(a.flyer ? { image: a.flyer } : {}),
      body: a.texto.slice(0, 180), icon: "icono-192.png", badge: "badge-96.png", tag: "aviso-" + a.id, requireInteraction: a.nivel_cod >= 4,
      data: { url: `/#avisos/${a.id}/push` },
    } as NotificationOptions));
  }
  almacen.set("avisos_notificados", [...notificados].filter((id) => ids.has(id)));
}
