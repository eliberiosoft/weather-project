/// <reference types="vitest/config" />
/* Yaguachi Weather · build de la app ciudadana.
   - React + Tailwind v4 (@tailwindcss/vite).
   - El motor i18n y las capas GeoJSON viven en ../compartido (solo lectura): el alias @compartido
     los importa y el plugin «capasCompartidas» sirve /capas/*.geojson en desarrollo y los copia al build.
   - El service worker (src/sw/sw.ts) se construye al final con la lista de archivos del build para precachearlos.
   - Cada build lleva un BUILD único (fecha + UUID corto): va en el código (__BUILD__), en /version.json, en el nombre
     de la caché del service worker y como ?v= en sw.js, el manifiesto y las capas. Así un despliegue nuevo nunca queda
     escondido detrás de una caché (del teléfono, del service worker o de Cloudflare). */
import { randomUUID } from "node:crypto";
import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { build, defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const RAIZ = import.meta.dirname;
const COMPARTIDO = resolve(RAIZ, "../compartido");
const CAPAS = join(COMPARTIDO, "capas");
const PUBLICO = join(RAIZ, "public");
const API = process.env.API_DEV || "http://127.0.0.1:8095";

const geojson = () => readdirSync(CAPAS).filter((f) => f.endsWith(".geojson")).sort();

/** «20261112-1530-ab12cd34»: fecha y hora UTC del build más 8 caracteres de un UUID (YW_BUILD lo fija a mano). */
function idBuild(): string {
  const d = new Date().toISOString();
  return process.env.YW_BUILD || `${d.slice(0, 10).replace(/-/g, "")}-${d.slice(11, 16).replace(":", "")}-${randomUUID().slice(0, 8)}`;
}
const BUILD = process.env.NODE_ENV === "test" ? "pruebas" : idBuild();

/** Escribe dist/version.json (la app lo consulta para saber si hay un despliegue nuevo) y pone ?v=BUILD al manifiesto. */
function versionado(): Plugin {
  let salida = "dist";
  return {
    name: "yw-versionado",
    apply: "build",
    configResolved(c) { salida = resolve(c.root, c.build.outDir); },
    transformIndexHtml: (html) => html.replace('href="/manifest.webmanifest"', `href="/manifest.webmanifest?v=${BUILD}"`),
    writeBundle() {
      writeFileSync(join(salida, "version.json"), JSON.stringify({ build: BUILD, fecha: new Date().toISOString() }) + "\n");
    },
  };
}

/** /capas/*.geojson: en desarrollo se leen de compartido/capas; en el build se copian a dist/capas. */
function capasCompartidas(): Plugin {
  let salida = "dist";
  return {
    name: "yw-capas-compartidas",
    configResolved(c) { salida = resolve(c.root, c.build.outDir); },
    configureServer(server) {
      server.middlewares.use("/capas", (req, res, next) => {
        const nombre = decodeURIComponent((req.url || "").split("?")[0] || "").replace(/^\//, "");
        if (!/^[a-z_]+\.geojson$/.test(nombre)) return next();
        const ruta = join(CAPAS, nombre);
        if (!existsSync(ruta)) return next();
        res.setHeader("Content-Type", "application/geo+json");
        res.setHeader("Cache-Control", "no-cache");
        createReadStream(ruta).pipe(res);
      });
    },
    writeBundle() {
      mkdirSync(join(salida, "capas"), { recursive: true });
      for (const f of geojson()) copyFileSync(join(CAPAS, f), join(salida, "capas", f));
    },
  };
}

/** Construye dist/sw.js (IIFE) con la lista de lo que hay que precachear: el build con hash, lo de public/ y las capas.
    El chunk de Firebase no se precachea: solo lo baja quien activa las notificaciones. */
function serviceWorker(): Plugin {
  let salida = "dist";
  let archivos: string[] = [];
  return {
    name: "yw-service-worker",
    apply: "build",
    configResolved(c) { salida = resolve(c.root, c.build.outDir); },
    writeBundle(_, bundle) {
      archivos = Object.keys(bundle).filter((f) => !f.endsWith(".map") && !/(^|\/)firebase-[\w-]+\.js$/.test(f));
    },
    async closeBundle() {
      // las pantallas de inicio de iOS no se precachean: iOS las guarda al instalar y los demás teléfonos no las usan
      const publicos = readdirSync(PUBLICO).filter((f) => statSync(join(PUBLICO, f)).isFile() && !f.startsWith("inicio-ios-"));
      // las capas con ?v=BUILD, igual que las pide la app: así la copia guardada es la de este despliegue
      const lista = ["./", ...archivos, ...publicos, ...geojson().map((f) => `capas/${f}?v=${BUILD}`)]
        .filter((f, i, a) => f !== "sw.js" && f !== "version.json" && a.indexOf(f) === i);
      await build({
        configFile: false,
        logLevel: "warn",
        publicDir: false,
        // como texto JSON: el minificador no toca una cadena
        define: { __PRECACHE__: JSON.stringify(JSON.stringify(lista)), __BUILD__: JSON.stringify(BUILD) },
        build: {
          outDir: salida,
          emptyOutDir: false,
          copyPublicDir: false,
          minify: true,
          sourcemap: false,
          lib: { entry: resolve(RAIZ, "src/sw/sw.ts"), formats: ["iife"], name: "ywSw", fileName: () => "sw.js" },
        },
      });
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
  plugins: [react(), tailwindcss(), capasCompartidas(), versionado(), serviceWorker(), htmlSinComentarios()],
  define: { __BUILD__: JSON.stringify(BUILD) },
  resolve: {
    alias: [
      { find: "@compartido", replacement: COMPARTIDO },
      // la versión ESM de Leaflet (la principal es UMD): permite al bundler quitar lo que no se usa
      { find: /^leaflet$/, replacement: "leaflet/dist/leaflet-src.esm.js" },
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: [RAIZ, COMPARTIDO] },
    proxy: { "/api": API, "/r/": API, "/a/": API },
  },
  preview: {
    port: 4173,
    proxy: { "/api": API, "/r/": API, "/a/": API },
  },
  build: {
    target: "es2020",
    sourcemap: false,
    assetsInlineLimit: 2048,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
