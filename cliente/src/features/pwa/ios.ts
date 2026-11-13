/* Instalar en iPhone. Apple no deja que una página abra su propio instalador (no existe «beforeinstallprompt»):
   se instala a mano con Compartir → «Agregar a pantalla de inicio», y solo desde Safari (o Chrome y otros desde
   iOS 16.4). Dentro de WhatsApp, Facebook o Instagram no se puede: hay que abrir el enlace en Safari.
   Aquí solo se detecta el caso para mostrar la guía (app/GuiaIos.tsx); las notificaciones en iPhone también exigen
   la app instalada. */

export interface Equipo { ua: string; tactil: number; instalada: boolean }

/** iPhone, iPod o iPad (el iPad moderno dice ser un Mac, pero tiene pantalla táctil). */
export const esIos = ({ ua, tactil }: Pick<Equipo, "ua" | "tactil">) =>
  /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && tactil > 1);

/** El navegador interno de una red social o de un chat: ahí no aparece «Agregar a pantalla de inicio». */
export const enAppAjena = (ua: string) => /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Messenger|Line\/|Snapchat|TikTok/i.test(ua);

/** Versión de iOS («OS 16_4» → 16.4); null si no se sabe. */
export function versionIos(ua: string): number | null {
  const m = /OS (\d+)[_.](\d+)/.exec(ua);
  return m ? Number(m[1]) + Number(m[2]) / 10 : null;
}

/** Otro navegador que no es Safari (Chrome, Firefox, Edge en iPhone). Desde iOS 16.4 también puede instalar. */
const otroNavegador = (ua: string) => /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

export type CasoIos = "no" | "app_ajena" | "abrir_en_safari" | "instalar";

/** Qué guía mostrar: nada (no es iPhone o ya está instalada), abrir el enlace en Safari, o los pasos para instalar. */
export function casoIos(e: Equipo): CasoIos {
  if (!esIos(e) || e.instalada) return "no";
  if (enAppAjena(e.ua)) return "app_ajena";
  const v = versionIos(e.ua);
  if (otroNavegador(e.ua) && v !== null && v < 16.4) return "abrir_en_safari";
  return "instalar";
}

/** Versión de Safari («Version/26.0» → 26). Desde Safari 26 el «iPhone OS» del user agent quedó congelado en 18_x,
    así que la versión real de iOS solo se ve aquí. */
export function versionSafari(ua: string): number | null {
  const m = /Version\/(\d+)(?:\.(\d+))?/.exec(ua);
  return m ? Number(m[1]) + Number(m[2] ?? 0) / 10 : null;
}

/** Dónde está «Compartir» en Safari: desde iOS 26 el diseño de pestañas por defecto lo esconde en el menú de la página,
    junto a la dirección: «⋯» a la derecha en Safari 26 y «≡» a la izquierda desde Safari 27. Antes, en la barra. */
export type MenuPagina = "lineas" | "puntos" | null;
export function menuDePagina(ua: string): MenuPagina {
  const v = Math.max(versionIos(ua) ?? 0, versionSafari(ua) ?? 0);
  return v >= 27 ? "lineas" : v >= 26 ? "puntos" : null;
}
export const conMenuPuntos = (ua: string) => menuDePagina(ua) !== null;

export function equipoActual(): Equipo {
  const instalada = (typeof matchMedia !== "undefined" && matchMedia("(display-mode: standalone)").matches)
    || !!(navigator as Navigator & { standalone?: boolean }).standalone;
  return { ua: navigator.userAgent, tactil: navigator.maxTouchPoints || 0, instalada };
}
