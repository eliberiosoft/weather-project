/* Firebase Cloud Messaging (solo @firebase/app y @firebase/messaging). Este módulo se importa de forma
   perezosa: solo lo descarga quien toca «Activar notificaciones» y la API tiene el push habilitado. */
import { getApps, initializeApp } from "@firebase/app";
import { getMessaging, getToken, isSupported } from "@firebase/messaging";
import type { PushConfig } from "../../shared/tipos";

/** Token de FCM ligado al service worker propio de la app (no se usa firebase-messaging-sw.js). */
export async function pedirToken(cfg: PushConfig, registro: ServiceWorkerRegistration): Promise<string | null> {
  if (!cfg.firebase || !cfg.vapid_key || !(await isSupported())) return null;
  const app = getApps()[0] ?? initializeApp(cfg.firebase);
  const token = await getToken(getMessaging(app), { vapidKey: cfg.vapid_key, serviceWorkerRegistration: registro });
  return token || null;
}
