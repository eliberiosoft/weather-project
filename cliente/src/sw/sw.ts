/* Service worker de Yaguachi Weather: la app abre sin señal con lo último guardado, y llegan los avisos push.
   Se construye aparte (vite.config.ts → dist/sw.js) con la lista de archivos del build en __PRECACHE__.
   El push de Firebase Cloud Messaging se recibe con el evento «push» estándar: el mensaje es solo de datos
   ({tipo, aviso_id, nivel, titulo, cuerpo, url}) y la notificación se arma aquí en el idioma guardado. */
/// <reference lib="webworker" />
export {};
declare const self: ServiceWorkerGlobalScope;
declare const __PRECACHE__: string;
declare const __BUILD__: string;

// versión de la caché: la sube una persona en cada despliegue (v2.0, v2.1, …) y el build le suma su id único
// (vite.config.ts), así cada despliegue tiene su caché aunque alguien olvide subir el número
const VERSION = "v2.25-" + __BUILD__;
const ES_VERSION = /^v\d+\.\d+(-|$)/;
const TESELAS = "ay-teselas";
// imágenes del satélite de «Tormentas» (spec 020): la de una hora dada no cambia; se guardan las últimas 2 h y poco más
const TORMENTAS = "ay-tormentas";
const MAX_TORMENTAS = 16;
const PREFS = "ay-prefs", URL_PREFS = "/_ay/prefs.json";
// las teselas vistas se guardan con tope (unas 30 MB como máximo en un teléfono): se borran las más antiguas
const MAX_TESELAS = 1500;
const ESPERA_RED = 3500;
// la copia vale aunque la petición traiga otras cabeceras (p. ej. Origin en los <script type="module">)
const COPIA: CacheQueryOptions = { ignoreVary: true };

const recortando = new Set<string>();
async function recortar(c: Cache, nombre: string, max: number): Promise<void> {
  if (recortando.has(nombre)) return;
  recortando.add(nombre);
  try {
    const ks = await c.keys();
    for (const k of ks.slice(0, Math.max(0, ks.length - max))) await c.delete(k);
  } finally { recortando.delete(nombre); }
}
const recortarTeselas = (c: Cache) => recortar(c, TESELAS, MAX_TESELAS);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(JSON.parse(__PRECACHE__) as string[])).then(() => self.skipWaiting()));
});

// Al activarse se borran las cachés viejas, MENOS la versión anterior: una pestaña que todavía corre el código viejo
// puede necesitar sus pantallas diferidas (Mapa-<hash viejo>.js), que el servidor ya no tiene. La app recarga sola
// cuando puede (features/pwa/version.ts) y en el despliegue siguiente esa copia se va.
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => {
      const versiones = ks.filter((k) => ES_VERSION.test(k));
      const anterior = versiones.filter((k) => k !== VERSION).pop();     // caches.keys() viene en orden de creación
      return Promise.all(ks.filter((k) => k !== VERSION && k !== anterior && k !== TESELAS && k !== TORMENTAS && k !== PREFS
        && !k.startsWith("panel-")).map((k) => caches.delete(k)));
    })
    .then(() => self.clients.claim())
    // cada pestaña abierta compara este build con el suyo: si es otro, recarga o avisa (features/pwa/version.ts)
    .then(() => self.clients.matchAll({ type: "window" }))
    .then((cs) => { for (const c of cs) c.postMessage({ build: __BUILD__ }); }));
});

const guardar = (req: Request, r: Response) => {
  if (r.ok) { const copia = r.clone(); void caches.open(VERSION).then((c) => c.put(req, copia)); }   // un 429 o 500 no reemplaza lo bueno
  return r;
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  // en desarrollo el panel comparte origen (/panel/): lo maneja su propio service worker
  if (u.pathname.startsWith("/panel") || u.pathname.startsWith("/api/panel")) return;
  // las fotos de los reportes no se guardan en la caché (pueden ser privadas)
  if (u.pathname.startsWith("/api/foto")) return;
  // imágenes del satélite (/api/tormentas/marco/<hora>.png): no cambian, primero la copia; con tope
  if (u.origin === self.location.origin && u.pathname.startsWith("/api/tormentas/marco/")) {
    e.respondWith(caches.open(TORMENTAS).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) { await c.put(req, r.clone()); void recortar(c, TORMENTAS, MAX_TORMENTAS); }
      return r;
    }).catch(() => Response.error()));
    return;
  }
  // API: primero la red; sin señal, lo último guardado
  if (u.origin === self.location.origin && u.pathname.startsWith("/api/")) {
    e.respondWith(fetch(req).then((r) => guardar(req, r)).catch(async () => (await caches.match(req, COPIA)) || Response.error()));
    return;
  }
  // teselas del mapa: caché limitada a lo ya visto
  if (u.hostname.endsWith("tile.openstreetmap.org") || u.hostname === "server.arcgisonline.com") {
    e.respondWith(caches.open(TESELAS).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === "opaque") { await c.put(req, r.clone()); void recortarTeselas(c); }
      return r;
    }).catch(async () => (await caches.match(req)) || Response.error()));
    return;
  }
  if (u.origin !== self.location.origin) return;
  // la versión publicada se pregunta siempre a la red (nunca a la caché): así la app sabe si hay un despliegue nuevo
  if (u.pathname === "/version.json") return;
  // archivos del build con hash (/assets/…): no cambian nunca, la copia guardada sirve tal cual
  if (u.pathname.startsWith("/assets/")) {
    e.respondWith(caches.match(req, COPIA).then((hit) => hit || fetch(req).then((r) => guardar(req, r))));
    return;
  }
  // resto: primero la red, para que una versión nueva llegue al primer intento; si la red falla
  // o tarda más de 3,5 s y hay copia guardada, se usa la copia (la app abre igual sin señal)
  e.respondWith((async () => {
    const red = fetch(req).then((r) => guardar(req, r));
    const guardado = await caches.match(req, { ...COPIA, ignoreSearch: req.mode === "navigate" })
      || (req.mode === "navigate" ? await caches.match("./", COPIA) : undefined);
    if (!guardado) return red;
    return Promise.race([red, new Promise<Response>((ok) => setTimeout(() => ok(guardado), ESPERA_RED))]).catch(() => guardado);
  })());
});

// ---------- avisos push (Firebase Cloud Messaging, mensaje solo de datos) ----------
interface DatosAviso { tipo?: string; aviso_id?: string | number; nivel?: string | number; titulo?: string; cuerpo?: string; url?: string; imagen?: string }
interface Prefs { idioma?: string; niveles?: Record<string, string> }

/** FCM entrega {data: {…}, from, fcmMessageId…}; se aceptan también los datos sueltos. */
function leerDatos(e: PushEvent): DatosAviso | null {
  try {
    const j = e.data?.json() as { data?: DatosAviso } & DatosAviso;
    return j?.data ?? j ?? null;
  } catch { return null; }
}

async function leerPrefs(): Promise<Prefs> {
  try { return (await (await caches.open(PREFS)).match(URL_PREFS))?.json() ?? {}; } catch { return {}; }
}

async function mostrarAviso(d: DatosAviso): Promise<void> {
  const prefs = await leerPrefs();
  const nivel = Number(d.nivel) || 0;
  const nombreNivel = prefs.niveles?.[String(nivel)];
  const titulo = [nombreNivel, d.titulo].filter(Boolean).join(" · ");
  // `image`: el flyer del aviso (spec 021); Android y escritorio lo muestran grande, iPhone lo ignora
  await self.registration.showNotification(titulo, {
    ...(d.imagen ? { image: d.imagen } : {}),
    body: (d.cuerpo || "").slice(0, 180),
    icon: "/icono-192.png",
    // Android usa el badge solo como silueta: con el logo opaco salía un cuadrado blanco (scripts/badge.mjs)
    badge: "/badge-96.png",
    lang: prefs.idioma,
    // la misma etiqueta que la notificación local: si llegan las dos, la segunda reemplaza a la primera
    tag: "aviso-" + (d.aviso_id ?? ""),
    requireInteraction: nivel >= 4,
    data: { url: d.url || (d.aviso_id ? `/#avisos/${d.aviso_id}/push` : "/#avisos") },
  });
  // con la app abierta, que recargue los avisos
  for (const c of await self.clients.matchAll({ type: "window" })) c.postMessage({ actualizar: "avisos" });
}

self.addEventListener("push", (e) => {
  const d = leerDatos(e);
  if (!d || (d.tipo && d.tipo !== "aviso") || !d.titulo) return;
  e.waitUntil(mostrarAviso(d));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  // va al aviso que se tocó (#avisos/<id>/push: la app lo resalta, abre su flyer y cuenta la apertura, spec 021);
  // con la app abierta se la lleva ahí; si no, se abre ahí
  const url = String((e.notification.data as { url?: string } | null)?.url || "/#avisos");
  const hash = url.includes("#") ? url.slice(url.indexOf("#")) : "#avisos";
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => {
    const c = cs[0];
    if (!c) return self.clients.openWindow("./" + hash).then(() => undefined);
    c.postMessage({ ir: hash });
    return c.focus().then(() => undefined);
  }));
});
