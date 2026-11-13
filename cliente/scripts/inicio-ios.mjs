// Genera las pantallas de inicio de iOS (apple-touch-startup-image) desde public/icono-512.png, sin dependencias:
// el ícono de 112 px (con esquinas de 28 px) centrado sobre cielo-2 (#dcf0fa), el mismo fondo del splash animado,
// para que el paso de la imagen del sistema al splash de index.html no tenga salto.
//   node scripts/inicio-ios.mjs        (desde cliente/; escribe public/inicio-ios-<ancho>x<alto>.png)
// Solo lee PNG RGB/RGBA de 8 bits sin entrelazar (el formato de icono-512.png).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync, inflateSync } from "node:zlib";

const RAIZ = join(import.meta.dirname, "..");
const FONDO = [0xdc, 0xf0, 0xfa];   // cielo-2
const ICONO_CSS = 112, RADIO_CSS = 28;
// [ancho, alto, densidad]: iPhone SE 2/3 y 8 · iPhone 11 y XR · iPhone 12, 13 y 14
export const PANTALLAS = [[750, 1334, 2], [828, 1792, 2], [1170, 2532, 3]];

function leerPng(ruta) {
  const b = readFileSync(ruta);
  let p = 8, ancho = 0, alto = 0, tipo = 0;
  const datos = [];
  while (p < b.length) {
    const largo = b.readUInt32BE(p), nombre = b.toString("latin1", p + 4, p + 8), d = b.subarray(p + 8, p + 8 + largo);
    if (nombre === "IHDR") {
      ancho = d.readUInt32BE(0); alto = d.readUInt32BE(4); tipo = d[9];
      if (d[8] !== 8 || d[12] !== 0 || (tipo !== 2 && tipo !== 6)) throw new Error("PNG no admitido");
    } else if (nombre === "IDAT") datos.push(d);
    p += 12 + largo;
  }
  const bpp = tipo === 6 ? 4 : 3, fila = ancho * bpp, crudo = inflateSync(Buffer.concat(datos));
  const px = Buffer.alloc(alto * fila);
  for (let y = 0; y < alto; y++) {
    const f = crudo[y * (fila + 1)], o = y * (fila + 1) + 1;
    for (let x = 0; x < fila; x++) {
      const a = x >= bpp ? px[y * fila + x - bpp] : 0, arriba = y ? px[(y - 1) * fila + x] : 0, c = x >= bpp && y ? px[(y - 1) * fila + x - bpp] : 0;
      const v = crudo[o + x];
      let r = v;
      if (f === 1) r = v + a;
      else if (f === 2) r = v + arriba;
      else if (f === 3) r = v + ((a + arriba) >> 1);
      else if (f === 4) { const pp = a + arriba - c, pa = Math.abs(pp - a), pb = Math.abs(pp - arriba), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? arriba : c); }
      px[y * fila + x] = r & 255;
    }
  }
  return { ancho, alto, bpp, px };
}

function escribirPng(ruta, ancho, alto, rgb) {
  const fila = ancho * 3, crudo = Buffer.alloc(alto * (fila + 1));
  for (let y = 0; y < alto; y++) {
    crudo[y * (fila + 1)] = 1;   // filtro «sub»: el fondo liso se comprime casi a nada
    for (let x = 0; x < fila; x++) crudo[y * (fila + 1) + 1 + x] = (rgb[y * fila + x] - (x >= 3 ? rgb[y * fila + x - 3] : 0)) & 255;
  }
  const trozo = (nombre, d) => {
    const n = Buffer.from(nombre, "latin1"), l = Buffer.alloc(4), c = Buffer.alloc(4);
    l.writeUInt32BE(d.length); c.writeUInt32BE(crc32(Buffer.concat([n, d])));
    return Buffer.concat([l, n, d, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(ruta, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo("IHDR", ihdr), trozo("IDAT", deflateSync(crudo, { level: 9 })), trozo("IEND", Buffer.alloc(0))]));
}

/** ¿El punto (x, y) cae dentro del cuadrado de lado l con esquinas de radio r? */
function dentro(x, y, l, r) {
  const cx = Math.min(Math.max(x, r), l - r), cy = Math.min(Math.max(y, r), l - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

const ico = leerPng(join(RAIZ, "public/icono-512.png"));
const muestra = (u, v, k) => {   // bilineal sobre el ícono, u y v en [0, 1)
  const x = Math.min(u * ico.ancho - 0.5, ico.ancho - 1.001), y = Math.min(v * ico.alto - 0.5, ico.alto - 1.001);
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y)), fx = Math.max(0, x - x0), fy = Math.max(0, y - y0);
  const at = (xx, yy) => ico.px[(yy * ico.ancho + xx) * ico.bpp + k];
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
};

for (const [ancho, alto, dpr] of PANTALLAS) {
  const lado = ICONO_CSS * dpr, radio = RADIO_CSS * dpr;
  const x0 = Math.round((ancho - lado) / 2), y0 = Math.round((alto - lado) / 2);
  const rgb = Buffer.alloc(ancho * alto * 3);
  for (let i = 0; i < ancho * alto; i++) rgb.set(FONDO, i * 3);
  const S = 4;   // 4×4 submuestras por píxel: borde redondeado suave y reducción sin dientes
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const suma = [0, 0, 0];
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const px = x + (sx + 0.5) / S, py = y + (sy + 0.5) / S;
          for (let k = 0; k < 3; k++) suma[k] += dentro(px, py, lado, radio) ? muestra(px / lado, py / lado, k) : FONDO[k];
        }
      }
      const o = ((y0 + y) * ancho + x0 + x) * 3;
      for (let k = 0; k < 3; k++) rgb[o + k] = Math.round(suma[k] / (S * S));
    }
  }
  const salida = join(RAIZ, `public/inicio-ios-${ancho}x${alto}.png`);
  escribirPng(salida, ancho, alto, rgb);
  console.log(salida);
}
