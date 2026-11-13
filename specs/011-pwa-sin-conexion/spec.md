# Feature Specification: PWA instalable y uso sin conexión

**Feature Branch**: `011-pwa-sin-conexion`

**Created**: 2026-11-09

**Status**: Implementado

**Input**: Pedido del dueño: que la app ciudadana se pueda instalar en el teléfono y siga siendo útil con mala señal o sin ella: que abra con lo último guardado, que el mapa se vea con lo ya visitado y que los reportes enviados sin señal se manden solos cuando vuelva.

> Documentación *as-built* de `cliente/sw.js`, `cliente/manifest.webmanifest`, los íconos de `cliente/`, el registro del service worker y la cola de reportes en `cliente/app.js` (`encolar`, `enviarCola`, `cargarEstado`, `iniciar`, respaldos en `localStorage`), y de las cabeceras de caché de `cliente/nginx.conf`.


> **Nota (2026-11-09, spec 014):** el frontend se migró a React + TypeScript + Vite, y el panel entra con usuarios y roles en lugar del PIN. El comportamiento descrito aquí se conserva; las rutas de archivos y las referencias al PIN, a unpkg o a `sw.js` v1.x corresponden a la versión anterior. Ver [014](../014-usuarios-incidentes-push-react/spec.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Abrir la app sin señal (Priority: P1)

Una persona que ya abrió la app alguna vez la abre en un momento sin señal (o con una señal tan débil que la red tarda más de 3,5 s) y ve la app completa con su último nivel guardado, la hora de esos datos y un aviso de que no hay conexión.

**Why this priority**: principio I: «si la app falla en ese momento, falla en el único momento que importa».

**Independent Test**: abrir la app con red, elegir un lugar, abrir el mapa; en DevTools → Network → Offline, recargar: la app debe abrir con «Mi lugar», el banner «Sin conexión. Ves la última información guardada.» y el mapa con las capas.

**Acceptance Scenarios**:

1. **Given** el service worker instalado, **When** abro la app sin red, **Then** `index.html`, `estilos.css`, `i18n.js`, `textos-app.js`, `app.js`, Leaflet y los íconos salen de la caché `v1.6`.
2. **Given** red lenta, **When** un archivo de la app no responde en 3,5 s y hay copia guardada, **Then** se usa la copia (la versión nueva llega en una carga siguiente).
3. **Given** que ya pedí `/api/estado` o el detalle de mi lugar, **When** lo pido sin red, **Then** el service worker devuelve la última respuesta guardada para esa misma URL.
4. **Given** que no hay copia en el service worker, **When** falla la API, **Then** la app usa sus copias de `localStorage` (`ay_territorio`, `ay_estado_cache`, `ay_ultimo_lugar_det`, `ay_avisos_cache`) y, para el estado, enciende el indicador «sin conexión» de la barra superior.
5. **Given** `navigator.onLine` falso, **When** se pinta «Mi lugar», **Then** se muestra el banner «Sin conexión. Ves la última información guardada.».
6. **Given** la primera vez sin red y sin nada guardado, **When** abro la app, **Then** sale «No hay conexión con el servidor.».

---

### User Story 2 - Enviar un reporte sin señal (Priority: P1)

Una persona envía un reporte o un aviso de calle sin señal; la app lo guarda en el teléfono y lo manda sola cuando vuelve la conexión, avisando cuántos se enviaron.

**Why this priority**: la inundación suele cortar la señal justo cuando hay algo que reportar.

**Independent Test**: en DevTools → Offline, enviar un reporte desde «Reportar»: debe salir «Sin conexión: el reporte se enviará cuando vuelva la señal.»; volver a Online: debe salir «Se enviaron 1 reportes pendientes.» y el reporte debe verse en «Vecinos».

**Acceptance Scenarios**:

1. **Given** `navigator.onLine` falso, **When** falla el envío desde el asistente, **Then** el cuerpo completo (con foto si la hay) se guarda en `ay_cola_reportes` y la pantalla de gracias dice «Sin conexión: el reporte se enviará cuando vuelva la señal.».
2. **Given** `navigator.onLine` falso, **When** falla el envío desde la hoja de calle del mapa, **Then** se encola y se cierra la hoja (sin mensaje; ver Brechas).
3. **Given** reportes en cola, **When** la app arranca con red o llega el evento `online`, **Then** `enviarCola` los manda uno por uno y avisa «Se enviaron {n} reportes pendientes.».
4. **Given** `navigator.onLine` verdadero, **When** el envío falla (servidor caído, 4xx/5xx o error de red con «señal» débil), **Then** no se encola y se muestra el mensaje de error.

---

### User Story 3 - Ver el mapa sin señal (Priority: P2)

El mapa abre sin red con todas las capas del cantón y con las teselas del fondo que la persona ya vio; si falta el fondo, avisa una vez y sigue mostrando las capas.

**Why this priority**: orientarse y ver ríos y recintos sin señal; el fondo es secundario.

**Independent Test**: con red, mirar el mapa a zoom 14 en un recinto; pasar a Offline y recargar: el fondo de esa zona debe verse; al alejarse a zonas no vistas sale el aviso de teselas.

**Acceptance Scenarios**:

1. **Given** el service worker instalado, **When** abro el mapa sin red, **Then** las 11 capas GeoJSON salen de la caché `v1.6`.
2. **Given** teselas de OpenStreetMap o Esri ya vistas, **When** las pido sin red, **Then** salen de la caché `ay-teselas` (primero caché, luego red).
3. **Given** una tesela no vista y sin red, **When** falla, **Then** sale una sola vez «Sin señal para el fondo del mapa: se ven solo las capas del cantón.».

---

### User Story 4 - Instalar la app y recibir avisos (Priority: P2)

Desde el navegador, la persona agrega «Yaguachi Weather» a la pantalla de inicio; se abre a pantalla completa en vertical, con su ícono y color. Si activa las notificaciones, los avisos nuevos llegan como notificación local mientras la app está abierta o en segundo plano reciente.

**Why this priority**: tenerla a un toque en la pantalla de inicio en una emergencia.

**Independent Test**: en Chrome Android con HTTPS, menú → «Agregar a la pantalla de inicio»/«Instalar app»: el ícono y el nombre deben ser los del manifiesto y abrir en modo `standalone`.

**Acceptance Scenarios**:

1. **Given** el manifiesto, **When** el navegador evalúa la instalación, **Then** encuentra `name` «Yaguachi Weather», `short_name` «Yaguachi Weather», `start_url` y `scope` `./`, `display: standalone`, `orientation: portrait`, `theme_color` `#bfe3f6`, `background_color` `#dcf0fa` e íconos SVG, 192, 512 y 512 *maskable*.
2. **Given** iOS, **When** se agrega a inicio, **Then** usa `icono-apple-180.png` (`<link rel="apple-touch-icon">`).
3. **Given** permiso de notificaciones y un aviso nuevo (nivel ≥ 3, o cualquiera fuera de las horas de silencio), **When** la app lo recibe, **Then** el service worker muestra la notificación (`showNotification`, `requireInteraction` en RESPUESTA).
4. **Given** una notificación, **When** la toco, **Then** se enfoca una ventana abierta de la app o se abre `./#avisos`.

---

### User Story 5 - Recibir la versión nueva y borrar todo (Priority: P3)

Cuando se despliega una versión con `VERSION` nueva, los teléfonos la toman sola y borran la caché vieja (salvo las teselas). Desde «Privacidad» la persona puede borrar todo lo que la app guardó.

**Why this priority**: sin esto los teléfonos se quedan con lo viejo; y la LOPDP pide poder borrar los datos.

**Independent Test**: cambiar `VERSION` a `v1.7`, reconstruir el cliente y recargar dos veces: en DevTools → Application → Cache Storage debe quedar `v1.7` y `ay-teselas`, sin `v1.6`.

**Acceptance Scenarios**:

1. **Given** un `sw.js` con `VERSION` distinta, **When** el navegador lo detecta (nginx lo sirve con `no-cache, no-store`), **Then** instala la caché nueva, se activa sin esperar (`skipWaiting`, `clients.claim`) y borra todas las cachés salvo la nueva y `ay-teselas`.
2. **Given** «Borrar los datos de este teléfono» en «Privacidad», **When** toco dos veces (la segunda en 5 s), **Then** se borran las claves `ay_*` de `localStorage`, todas las cachés y el registro del service worker, y la app se recarga.

---

### Edge Cases

- **Fotos**: `/api/foto/*` nunca pasa por la caché (pueden ser privadas).
- **Peticiones que no son GET** (envíos, votos, «me gusta»): el service worker no las toca; sin red fallan y solo los reportes se encolan.
- **API con error**: el service worker guarda cualquier respuesta de `/api/*`, también un 4xx o 5xx (ver Brechas).
- **Falla la instalación**: `cache.addAll(BASE)` es atómico; si un archivo de `BASE` (incluido Leaflet en unpkg) no se puede bajar, el service worker no se instala.
- **Sin HTTPS** (IP de la red local): el navegador no registra el service worker ni da GPS ni notificaciones; el README explica cómo probar.
- **Navegador sin `serviceWorker`**: el registro se omite (`if ("serviceWorker" in navigator)`) y la app funciona en línea con los respaldos de `localStorage`.
- **Caché vieja con otro nombre** (`ay-v2` de la versión anterior): se borra al activar.

### Versiones: que nadie se quede con la app vieja (2026-11-12, pedido del dueño)

Había vecinos que no veían los cambios de un despliegue por la caché. Las causas:
- la app abierta (sobre todo instalada) seguía con el código viejo en memoria aunque el service worker nuevo ya estuviera activo;
- al activarse, el service worker nuevo borraba la caché vieja, y una pantalla diferida de la página vieja (`Mapa-<hash>.js`) ya no se podía bajar;
- `sw.js`, el manifiesto y las capas no llevaban versión en la URL, así que una caché intermedia (Cloudflare con «cachear todo») podía dar lo viejo.

Desde entonces:

1. **Build único.** Cada build tiene un id: fecha y hora UTC más 8 caracteres de un UUID, por ejemplo `20261112-1425-da0408f7`. `YW_BUILD` lo fija a mano. Va en:
   - el código (`__BUILD__`);
   - `/version.json`, que nginx sirve con `no-store` y `CDN-Cache-Control: no-store`;
   - el nombre de la caché del service worker (`v2.20-<build>`);
   - el `?v=<build>` de `sw.js`, del manifiesto y de las capas GeoJSON, que el service worker precachea con esa misma URL.

   Los JS y CSS ya llevan hash de Vite. `index.html`, `sw.js` y `version.json` llevan `CDN-Cache-Control: no-store`.
2. **Detección.** La app pregunta `/version.json`, sin caché y sin pasar por el service worker:
   - a los 3 s de abrir;
   - al volver a primer plano, como mucho cada 5 min;
   - cada 10 min con la app a la vista;
   - al jalar para refrescar.

   Si el build publicado es otro, pide al service worker que se actualice.
3. **Recarga segura.** El service worker nuevo se activa solo y, al activarse, le dice a cada pestaña su build. Una pestaña con otro build:
   - recarga sola si está en segundo plano o lleva menos de 15 s abierta, y no hay un reporte a medias ni un campo con el cursor;
   - si no, muestra «Hay una versión nueva de la app · Actualizar», y recarga sola apenas la app pase a segundo plano.
4. **Sin pantallas rotas.** El service worker conserva la caché de la versión anterior hasta el despliegue siguiente. Si igual una pantalla diferida no se puede bajar (`vite:preloadError`), recarga una vez.
5. **Sin bucles.** Si tras recargar sigue el mismo build (el servidor o una caché todavía dan lo viejo), no vuelve a recargar sola: queda el aviso.
6. **A la vista.** «Privacidad y cookies» muestra «Versión de la app: <build>», para soporte.

Probado de punta a punta en Docker el 2026-11-12:
- con la app abierta en el build A se desplegó el build B;
- apareció el aviso, con la caché de A y la de B presentes;
- «Actualizar» dejó la página en B, sin errores.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La app DEBE registrar `sw.js` con alcance `./` al cargar `app.js`, si el navegador lo admite.
- **FR-002**: Al instalarse, el service worker DEBE guardar en la caché `VERSION` (hoy `v1.6`) la lista `BASE`: `./`, `index.html`, `estilos.css`, `i18n.js`, `textos-app.js`, `app.js`, `manifest.webmanifest`, `icono.svg`, `favicon-32.png`, `icono-192.png`, `icono-512.png`, `icono-maskable-512.png`, `icono-apple-180.png`, las 11 capas `capas/*.geojson` y `leaflet.css`/`leaflet.js` 1.9.4 de unpkg.
- **FR-003**: Al activarse DEBE borrar toda caché que no sea `VERSION` ni `ay-teselas` y tomar el control de las páginas abiertas.
- **FR-004**: Estrategia por tipo de petición (solo `GET`):
  - `/api/foto*`: sin intervención (red).
  - `/api/*`: red primero; guarda la respuesta en `VERSION`; sin red, la copia guardada.
  - Teselas de `*.tile.openstreetmap.org` y `server.arcgisonline.com`: caché `ay-teselas` primero; si no está, red y se guarda si es `ok` u opaca.
  - Todo lo demás: red primero; si hay copia y la red falla o tarda más de 3,5 s, la copia; las respuestas `ok` se guardan en `VERSION`.
- **FR-005**: Cada despliegue con cambios en `cliente/` DEBE subir `VERSION` en `cliente/sw.js` (constitución, «Restricciones técnicas»); nginx DEBE servir `sw.js` con `Cache-Control: no-cache, no-store` y el resto con `no-cache`.
- **FR-006**: Un reporte que falla con `navigator.onLine` falso DEBE guardarse en `ay_cola_reportes` y reenviarse al arrancar la app con red y en el evento `online`.
- **FR-007**: La app DEBE guardar en `localStorage` el territorio, el estado, el último detalle del lugar y los avisos, y usarlos si falla la red.
- **FR-008**: El manifiesto DEBE declarar nombre, nombre corto, descripción, `lang` `es-EC`, `start_url`/`scope` `./`, `display: standalone`, `orientation: portrait`, colores y los íconos SVG, 192, 512 y 512 *maskable*; `index.html` DEBE enlazar el manifiesto, el favicon SVG y PNG 32 y el `apple-touch-icon` de 180.
- **FR-009**: El service worker DEBE abrir la app en `./#avisos` (o enfocar una ventana abierta) al tocar una notificación.
- **FR-010**: «Privacidad» DEBE permitir borrar `ay_*`, todas las cachés y el registro del service worker.
- **FR-011**: La app DEBE indicar la falta de conexión (banner con `navigator.onLine`, indicador `#chip-red` cuando falla `/api/estado`) y la edad de los datos («actualizado hace…»).

### Key Entities

- **Caché de la versión** (`v1.6`): archivos de la app, capas, Leaflet y respuestas de la API.
- **Caché de teselas** (`ay-teselas`): teselas vistas; sobrevive a los cambios de versión.
- **Cola de reportes** (`ay_cola_reportes`): cuerpos JSON completos de `POST /api/reportes` pendientes.
- **Respaldos locales** (`ay_territorio`, `ay_estado_cache`, `ay_ultimo_lugar_det`, `ay_avisos_cache`).
- **Manifiesto e íconos**.

Ver `data-model.md`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras una visita con red, la app abre sin red mostrando «Mi lugar» con el último nivel guardado y su hora.
- **SC-002**: Con una red que no responde, la app abre con la copia guardada en ≤ 3,5 s más el tiempo de pintado.
- **SC-003**: El 100 % de los reportes enviados con `navigator.onLine` falso queda en la cola y se reenvía al volver la red con la app abierta.
- **SC-004**: Tras subir `VERSION`, los teléfonos dejan de usar la caché anterior en la primera carga que detecta el `sw.js` nuevo.
- **SC-005**: La app cumple los criterios de instalación de Chrome (manifiesto válido con íconos 192 y 512, service worker con `fetch`, HTTPS).

## Assumptions

- Se sirve por HTTPS en producción (Cloudflare, `docs/seguridad.md`); en desarrollo, `localhost`.
- No hay Web Push con VAPID: las notificaciones son locales (README, «Pendiente»).
- La cuota de almacenamiento del navegador alcanza para las capas (~0,8 MB), Leaflet y unas cuantas zonas de teselas.
- La instalación usa la interfaz propia del navegador; la app no muestra un botón de instalar.

## Brechas conocidas

1. **Se guardan respuestas de error de la API.** En `/api/*` el service worker hace `cache.put` sin mirar `r.ok`: un 429 o un 500 reemplaza a la última respuesta buena y sin red se sirve el error.
2. **Cachés sin límite.** Las respuestas de la API se guardan por URL completa (cada `/api/lugar?lat=&lon=` distinto queda) y solo se limpian al cambiar `VERSION`; `ay-teselas` no tiene tope ni limpieza, y las teselas opacas cuentan con relleno en la cuota de Chrome.
3. **La cola depende de `navigator.onLine`.** Con señal débil (`onLine` verdadero pero la petición falla) el reporte no se encola: solo sale el error.
4. **La cola descarta en silencio.** `enviarCola` quita los reportes que fallan con `onLine` verdadero (409, 429, 4xx, 5xx o red caída) y los cuenta como «enviados» en el aviso.
5. **Fotos que no caben.** Un reporte con foto (hasta ~1,5 MB en base64) puede no caber en `localStorage`; `almacen.set` traga el error y el reporte se pierde aunque la app dijo que se enviaría.
6. **Hora del reporte encolado.** El servidor pone `creado` y `expira` al recibirlo; un aviso de calle enviado horas después aparece como recién creado. El cuerpo no lleva la hora del teléfono.
7. **Sin envío en segundo plano.** No se usa Background Sync: la cola solo se vacía con la app abierta.
8. **Indicador sin conexión engañoso.** Si el service worker devuelve una copia de `/api/estado`, `api()` no falla y `#chip-red` queda oculto; solo el banner por `navigator.onLine` y «actualizado hace…» delatan que los datos son viejos.
9. **Versión nueva a medias.** Con `skipWaiting` + `clients.claim` la página abierta sigue con el `app.js` viejo mientras la caché ya es la nueva; no hay aviso de «versión nueva, recarga».
10. **La notificación no lleva a Avisos si la app está abierta.** `notificationclick` enfoca la ventana existente sin navegar a `#avisos`.
11. **Sin aviso al encolar desde el mapa** (ver `specs/005-calles-inundadas/`, Brecha 6).
12. **Instalación y manifiesto.** No hay botón propio de instalar (`beforeinstallprompt`); el manifiesto no tiene `id`, capturas ni `shortcuts`, y su nombre y descripción solo están en español. [NEEDS CLARIFICATION: ¿se quiere un botón de instalar?]
13. **Origen de los íconos.** `icono-maskable.svg` no se referencia en ningún lado y el script que generaba los PNG (`generar_iconos.ps1`) se borró; no está documentado cómo regenerarlos.
14. **No verificado.** El README dice que el modo sin conexión no se pudo probar en el navegador integrado de Claude (bloquea service workers) y que en Chrome «falta probar el uso sin conexión».
15. **Nombre de caché genérico.** La caché se llama solo `v1.6` (antes `ay-v2`); funciona porque el origen es propio, pero no lleva prefijo del proyecto como `ay-teselas`.
