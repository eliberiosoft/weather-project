import { t } from "./i18n";

export interface Ubicacion { lat: number; lon: number; prec: number }

/** Ubicación del teléfono. Sin permiso o sin HTTPS el navegador la bloquea: se dice, no se falla en silencio. */
export function ubicar(): Promise<Ubicacion> {
  return new Promise((ok, mal) => {
    if (!navigator.geolocation) return mal(new Error(t("app.err.sin_gps")));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude, prec: p.coords.accuracy }),
      () => mal(new Error(t("app.err.gps"))),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}
