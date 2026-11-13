/* Panel del analista · Yaguachi Weather (Vite + React + Tailwind v4).
   - dev:   npm run dev   → http://127.0.0.1:5174 con /api/ redirigido a la API (API_DEV, por defecto http://127.0.0.1:8095)
   - build: npm run build → dist/ (index.html, assets/ con hash, sw.js generado con la lista de la cáscara) */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { minify } from "vite";
import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const COMPARTIDO = path.resolve(AQUI, "../compartido");

/** Archivos de public/ que también son parte de la cáscara del panel instalado. */
const PUBLICOS = ["manifest.webmanifest", "icono.svg", "favicon-32.png", "icono-192.png", "icono-512.png",
  "icono-maskable-512.png", "icono-apple-180.png"];

/** Genera dist/sw.js a partir de src/features/pwa/sw.js con la lista de archivos del build (nombres con hash).
    Las capas .geojson no van en la lista: el SW las guarda la primera vez que se piden. */
function serviceWorker(): Plugin {
  return {
    name: "yw-service-worker",
    apply: "build",
    async generateBundle(_opciones, bundle) {
      const delBuild = Object.keys(bundle).filter((f) => !f.endsWith(".map") && !f.endsWith(".geojson"));
      const archivos = ["./", ...delBuild.filter((f) => f !== "index.html"), ...PUBLICOS];
      const plantilla = readFileSync(path.resolve(AQUI, "src/features/pwa/sw.js"), "utf8");
      if (!plantilla.includes("/*ARCHIVOS*/[]")) this.error("sw.js: falta el marcador /*ARCHIVOS*/[]");
      // se publica minificado y sin comentarios (las notas quedan en src/features/pwa/sw.js)
      const r = await minify("sw.js", plantilla.replace("/*ARCHIVOS*/[]", JSON.stringify(archivos)), { compress: true, mangle: true });
      if (r.errors?.length) this.error("sw.js: " + JSON.stringify(r.errors));
      this.emitFile({ type: "asset", fileName: "sw.js", source: r.code });
    },
  };
}

/** En el build, el index.html sale sin comentarios <!-- … -->: las notas internas quedan en el código fuente, no en lo publicado. */
function htmlSinComentarios(): Plugin {
  return {
    name: "html-sin-comentarios",
    apply: "build",
    transformIndexHtml: (html) => html.replace(/<!--[\s\S]*?-->\s*/g, ""),
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), serviceWorker(), htmlSinComentarios()],
  resolve: { alias: { "@compartido": COMPARTIDO } },
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    fs: { allow: [AQUI, COMPARTIDO] },
    proxy: { "/api": { target: process.env.API_DEV || "http://127.0.0.1:8095", changeOrigin: false } },
  },
  preview: { host: "127.0.0.1", port: 5175 },
  build: { outDir: "dist", assetsDir: "assets", sourcemap: false, target: "es2022" },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
