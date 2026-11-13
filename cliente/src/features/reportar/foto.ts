/* Fotos del reporte: se reducen en el teléfono antes de subirlas, para que pesen poco con señal débil.
   Lado mayor de 1024 px y JPEG 0,6 (unos 120–250 KB); si aún pasa de 300 KB, se baja la calidad y luego el tamaño.
   Al redibujarla en un canvas se pierden los metadatos EXIF (incluida la ubicación de la cámara). */

export const MAX_FOTOS = 3;
export const PASOS_REDUCCION: readonly { lado: number; calidad: number }[] = [
  { lado: 1024, calidad: 0.6 }, { lado: 1024, calidad: 0.45 }, { lado: 800, calidad: 0.45 }, { lado: 640, calidad: 0.4 },
];
/** Objetivo por foto. La API acepta hasta 1,5 MB, pero tres fotos de 300 KB suben bien hasta con señal débil. */
export const OBJETIVO_BYTES = 300 * 1024;

export function escala(ancho: number, alto: number, max: number): { ancho: number; alto: number } {
  const k = Math.min(1, max / Math.max(ancho, alto));
  return { ancho: Math.round(ancho * k), alto: Math.round(alto * k) };
}

/** Bytes reales de un data URL en base64. */
export function bytesDataUrl(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const relleno = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - relleno;
}

/** Prueba los pasos en orden hasta que una versión quede por debajo del objetivo (o devuelve la más liviana). */
export async function reducirHasta(dibujar: (lado: number, calidad: number) => Promise<string> | string, objetivo = OBJETIVO_BYTES): Promise<string> {
  let ultima = "";
  for (const p of PASOS_REDUCCION) {
    ultima = await dibujar(p.lado, p.calidad);
    if (bytesDataUrl(ultima) <= objetivo) return ultima;
  }
  return ultima;
}

export async function reducirFoto(f: Blob): Promise<string> {
  const img = await createImageBitmap(f);
  try {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("canvas");
    return await reducirHasta((lado, calidad) => {
      const { ancho, alto } = escala(img.width, img.height, lado);
      c.width = ancho; c.height = alto;
      ctx.drawImage(img, 0, 0, ancho, alto);
      return c.toDataURL("image/jpeg", calidad);
    });
  } finally {
    img.close();
  }
}
