// Genera public/badge-96.png: el ícono pequeño de las notificaciones (barra de estado de Android), sin dependencias.
// Android usa el «badge» solo como silueta (toma el canal alfa y lo pinta de blanco): si recibe el logo a color y opaco
// sale un cuadrado blanco. Por eso aquí va la silueta del logo (nube, lluvia y ola) en blanco sobre transparente,
// con margen, a 96 × 96 px (24 dp a 4×).
//   node scripts/badge.mjs        (desde cliente/)
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";

const RAIZ = join(import.meta.dirname, "..");
const LADO = 96, ESCALA = LADO / 24, MUESTRAS = 4;   // dibujo en una cuadrícula de 24, suavizado 4 × 4

const circulo = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
/** trazo recto con puntas redondas */
const trazo = (x1, y1, x2, y2, r) => (x, y) => {
  const dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2 <= r * r;
};
/** ola: una línea ondulada de grosor 2r entre x0 y x1 */
const ola = (x0, x1, yc, amp, periodo, r) => (x, y) => {
  if (x < x0 - r || x > x1 + r) return false;
  const xx = Math.max(x0, Math.min(x1, x));
  const yy = yc + amp * Math.sin(((xx - x0) / periodo) * 2 * Math.PI);
  return (x - xx) ** 2 + (y - yy) ** 2 <= r * r * 1.15;
};

// la nube como unión de círculos y su base, la lluvia en tres trazos y la ola abajo (mismo dibujo que icono.svg)
const FORMAS = [
  circulo(8.2, 10.6, 3.9), circulo(12.6, 8.4, 5.2), circulo(17.2, 11.0, 3.6),
  trazo(8.2, 12.6, 17.2, 12.6, 1.95),
  trazo(8.6, 16.6, 8.0, 18.4, 0.95), trazo(12.4, 16.6, 11.8, 18.4, 0.95), trazo(16.2, 16.6, 15.6, 18.4, 0.95),
  ola(3.6, 20.4, 21.2, 0.85, 5.6, 0.95),
];
const dentro = (x, y) => FORMAS.some((f) => f(x, y));

const px = Buffer.alloc(LADO * LADO * 4);
for (let py = 0; py < LADO; py++) {
  for (let pxi = 0; pxi < LADO; pxi++) {
    let n = 0;
    for (let sy = 0; sy < MUESTRAS; sy++) {
      for (let sx = 0; sx < MUESTRAS; sx++) {
        if (dentro((pxi + (sx + 0.5) / MUESTRAS) / ESCALA, (py + (sy + 0.5) / MUESTRAS) / ESCALA)) n++;
      }
    }
    const i = (py * LADO + pxi) * 4;
    px[i] = px[i + 1] = px[i + 2] = 255;
    px[i + 3] = Math.round((n / (MUESTRAS * MUESTRAS)) * 255);
  }
}

function png(ancho, alto, rgba) {
  const fila = ancho * 4, crudo = Buffer.alloc(alto * (fila + 1));
  for (let y = 0; y < alto; y++) rgba.copy(crudo, y * (fila + 1) + 1, y * fila, (y + 1) * fila);   // filtro 0
  const trozo = (nombre, datos) => {
    const largo = Buffer.alloc(4), cab = Buffer.from(nombre, "latin1"), c = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    c.writeUInt32BE(crc32(Buffer.concat([cab, datos])) >>> 0);
    return Buffer.concat([largo, cab, datos, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; ihdr[9] = 6;   // 8 bits, RGBA
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr), trozo("IDAT", deflateSync(crudo, { level: 9 })), trozo("IEND", Buffer.alloc(0))]);
}

writeFileSync(join(RAIZ, "public/badge-96.png"), png(LADO, LADO, px));
console.log("public/badge-96.png");
