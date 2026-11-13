/* Foto del incidente: se reduce en el navegador a JPEG de 1280 px como máximo (calidad 0,7), igual que la app.
   Al redibujarla en un canvas se pierden los metadatos EXIF (incluida la ubicación de la cámara). */

export const LADO_MAX = 1280;
export const CALIDAD = 0.7;
/** Tope de la API (max_foto_kb = 1500). */
export const MAX_BYTES = 1500 * 1024;

export function escala(ancho: number, alto: number, max = LADO_MAX): { ancho: number; alto: number } {
  const k = Math.min(1, max / Math.max(ancho, alto));
  return { ancho: Math.round(ancho * k), alto: Math.round(alto * k) };
}

/** Bytes reales de un data URL en base64. */
export function bytesDataUrl(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const relleno = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - relleno;
}

export async function reducirFoto(archivo: Blob, lado = LADO_MAX, calidad = CALIDAD): Promise<string> {
  const img = await createImageBitmap(archivo);
  try {
    const { ancho, alto } = escala(img.width, img.height, lado);
    const c = document.createElement("canvas");
    c.width = ancho;
    c.height = alto;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0, ancho, alto);
    return c.toDataURL("image/jpeg", calidad);
  } finally {
    img.close();
  }
}
