/* Qué tipo de teléfono es, sin el modelo (pestaña «Dispositivos» del superadmin, spec 021): la marca, la versión mayor
   del sistema y si es teléfono, tablet o computadora. El navegador puede dar el modelo exacto (Client Hints, solo
   Chrome/Edge en Android): se usa AQUÍ para deducir la marca y no se envía. En un cantón chico, el modelo exacto
   junto con el recinto podría señalar a una persona; la marca no. Funciones puras salvo `leerEquipo`. */

export type Marca = "Samsung" | "Xiaomi" | "Motorola" | "Apple" | "Google" | "Huawei" | "realme" | "OPPO" | "vivo"
  | "Tecno" | "Infinix" | "Nokia" | "LG" | "ZTE" | "Otra";
export type Formato = "telefono" | "tablet" | "computadora";
export interface Equipo { marca: Marca | null; so_version: number | null; formato: Formato }

const REGLAS: [RegExp, Marca][] = [
  [/^(SM-|GT-|Galaxy)/i, "Samsung"], [/^Pixel/i, "Google"], [/^(moto|XT\d)/i, "Motorola"],
  [/^(Redmi|Mi |MI |POCO|Xiaomi|M2\d{3}|2\d{3}[0-9A-Z]{3,})/i, "Xiaomi"], [/^RMX/i, "realme"], [/^CPH/i, "OPPO"],
  [/^(V2\d{3}|vivo)/i, "vivo"], [/^(TECNO|K[A-Z]\d)/i, "Tecno"], [/^(Infinix|X6\d{2})/i, "Infinix"], [/^(Nokia|TA-)/i, "Nokia"],
  [/^(LM-|LG)/i, "LG"], [/^(ZTE|Blade)/i, "ZTE"], [/^[A-Z]{3}-[A-Z]{1,2}\d/, "Huawei"],
];

/** Marca a partir del modelo («SM-A146M» → Samsung) o del User-Agent (iPhone, iPad, Mac → Apple). */
export function marcaDe(modelo: string | null | undefined, ua: string): Marca | null {
  if (/iPhone|iPad|Macintosh/.test(ua)) return "Apple";
  const m = (modelo || "").trim();
  if (!m) return null;
  return REGLAS.find(([re]) => re.test(m))?.[1] ?? "Otra";
}

/** Versión mayor del sistema: Android (de Client Hints; el User-Agent de Chrome la congela en «Android 10; K») o iOS. */
export function versionSo(ua: string, platformVersion?: string | null): number | null {
  if (platformVersion && /Android/.test(ua)) return Number.parseInt(platformVersion, 10) || null;
  const ios = /(?:iPhone|iPad|CPU) OS (\d+)_/.exec(ua);
  if (ios) return Number(ios[1]);
  const android = /Android (\d+)/.exec(ua);
  if (android && !/Android 10; K\)/.test(ua)) return Number(android[1]);
  return null;
}

/** Teléfono, tablet o computadora (los iPad nuevos dicen «Macintosh» pero tienen pantalla táctil). */
export function formatoDe(ua: string, movil: boolean | undefined, tactil: number, ladoCorto: number): Formato {
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && tactil > 1)) return "tablet";
  if (movil || /Mobile|iPhone/.test(ua)) return "telefono";
  if (tactil > 0 && /Android/.test(ua)) return ladoCorto >= 600 ? "tablet" : "telefono";
  return "computadora";
}

interface UAData { mobile?: boolean; getHighEntropyValues?(h: string[]): Promise<{ model?: string; platformVersion?: string }> }

export async function leerEquipo(): Promise<Equipo> {
  const ua = navigator.userAgent;
  const d = (navigator as Navigator & { userAgentData?: UAData }).userAgentData;
  let alto: { model?: string; platformVersion?: string } = {};
  try { alto = (await d?.getHighEntropyValues?.(["model", "platformVersion"])) ?? {}; } catch { /* el navegador no lo da */ }
  return {
    marca: marcaDe(alto.model, ua),                 // el modelo se queda aquí: solo sale la marca
    so_version: versionSo(ua, alto.platformVersion),
    formato: formatoDe(ua, d?.mobile, navigator.maxTouchPoints || 0, Math.min(screen.width, screen.height)),
  };
}
