/* Service worker del panel (plantilla: el build reemplaza el marcador con la lista de archivos con hash).
   - Guarda solo la «cáscara» (HTML, JS y CSS con hash, manifiesto e íconos) para que el panel instalado abra sin red.
   - Las respuestas de /api/ NUNCA se guardan: llevan datos del panel y la sesión, y no deben quedar en el equipo.
   - Caché con prefijo «panel-» (en desarrollo puede compartir origen con la app ciudadana). */
// versión de la caché del panel: sube en cada despliegue del admin (v2.0, v2.1, …)
const VERSION = "v2.14";
const CACHE = "panel-" + VERSION;
const CASCARA = /*ARCHIVOS*/[];

self.addEventListener("install", (e) => {
  // uno por uno: si falta un archivo, el resto igual se guarda
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(CASCARA.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith("panel-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.includes("/api/")) return;
  // archivos con hash: nunca cambian, primero la copia guardada
  if (u.pathname.includes("/assets/")) {
    e.respondWith(caches.match(e.request).then((g) => g || fetch(e.request).then((r) => guardar(e.request, r))));
    return;
  }
  // lo demás (index.html, manifiesto, íconos): primero la red, sin señal la copia guardada
  e.respondWith(fetch(e.request).then((r) => guardar(e.request, r))
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((g) => g || caches.match("./"))));
});

function guardar(pedido, r) {
  if (r.ok && r.type === "basic") {
    const copia = r.clone();
    caches.open(CACHE).then((c) => c.put(pedido, copia));
  }
  return r;
}
