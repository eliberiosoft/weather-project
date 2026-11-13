# Data Model: PWA instalable y uso sin conexión

Esta funcionalidad no usa la base SQLite. Todo vive en el navegador: Cache Storage (service worker) y `localStorage` (prefijo `ay_`, envuelto en `try/catch` por `almacen.get`/`almacen.set` en `cliente/app.js`).

## Cache Storage

| Caché | Quién escribe | Contenido | Vida |
|---|---|---|---|
| `VERSION` (hoy `v1.6`) | `install` (`addAll(BASE)`) y `fetch` | `BASE` (app, estilos, textos, íconos, manifiesto, 11 capas, Leaflet 1.9.4) + respuestas `ok` de archivos + **toda** respuesta de `/api/*` (salvo `/api/foto`) | Hasta que cambie `VERSION` (se borra al activar la siguiente). |
| `ay-teselas` | `fetch` de teselas | Teselas de `*.tile.openstreetmap.org` y `server.arcgisonline.com` (`ok` u opacas) | Sin vencimiento; solo se borra desde «Privacidad». |

Clave de cada entrada: la URL completa de la petición (las cabeceras como `X-Dispositivo` no forman parte de la clave).

### Estrategia de `fetch` (`cliente/sw.js`)

| Petición | Estrategia | Respaldo |
|---|---|---|
| Método distinto de `GET` | No se intercepta. | — |
| `/api/foto*` | No se intercepta. | — |
| `/api/*` | Red primero; guarda la respuesta (cualquier código) en `VERSION`. | Copia de `VERSION`, o error si no hay. |
| Teselas OSM / Esri | Caché `ay-teselas` primero; si no, red y guarda si `ok` u opaca. | Cualquier copia (`caches.match`). |
| Resto (app, capas, Leaflet, `/r/…`) | Red primero; guarda si `ok`. | Si hay copia: la que llegue primero entre la red y 3,5 s; si la red falla, la copia. Sin copia: solo red. |

## `localStorage` (prefijo `ay_`)

| Clave | Escribe | Lee | Contenido |
|---|---|---|---|
| `ay_dispositivo` | `idDispositivo` | `api()` | Id aleatorio del teléfono. |
| `ay_idioma` | `I18N.cambiar` (`compartido/i18n.js`) | arranque de i18n | `es` o `en`. |
| `ay_territorio` | `iniciar` | `iniciar` (si falla la red) | Respuesta de `/api/territorio`. |
| `ay_estado_cache` | `cargarEstado` | `cargarEstado` (si falla la red) | Respuesta de `/api/estado`. |
| `ay_lugar` | `cargarLugar` | arranque | Lugar elegido. |
| `ay_ultimo_lugar_det` | `cargarLugar` | `cargarLugar` (si falla la red) | Último detalle de lugar (uno solo). |
| `ay_recinto` | versión anterior | `iniciar` (migración) | Id de recinto (formato viejo). |
| `ay_avisos_cache` | `cargarAvisos` | `cargarAvisos`, evento `idioma` | Respuesta de `/api/avisos`. |
| `ay_avisos_vistos`, `ay_avisos_notificados` | `pintarAvisos` | `pintarAvisos` | Ids de avisos ya vistos / ya notificados. |
| `ay_cola_reportes` | `encolar`, `enviarCola` | `enviarCola` | `[cuerpo de POST /api/reportes, …]` (incluida la foto en base64). |
| `ay_consent_ok` | envío de reporte | hoja de calle, asistente | `true` tras el primer envío aceptado. |
| `ay_capas_on`, `ay_fondo` | hoja de capas | mapa | Preferencias del mapa. |
| `ay_muro_filtro` | muro | muro | `cerca`, `mios` o `todos`. |
| `ay_aviso_cookies` | «Entendido», «Privacidad» | arranque | Aviso de privacidad ya visto. |

## Cola de reportes: ciclo de vida

| Desde | Evento | Hacia |
|---|---|---|
| (envío) | `POST /api/reportes` falla con `navigator.onLine === false` | en cola (`ay_cola_reportes`) |
| (envío) | falla con `navigator.onLine === true` | no se encola; se muestra el error |
| en cola | `iniciar()` con red o evento `online` → `enviarCola()` → `POST` ok | enviado (se quita) |
| en cola | `enviarCola()` → `POST` falla y `onLine` sigue verdadero | **descartado** sin aviso (Brecha 4) |
| en cola | `enviarCola()` → `POST` falla y `onLine` pasó a falso | sigue en cola |
| en cola | «Privacidad → Borrar los datos» | borrado |

## Ciclo de vida del service worker

| Fase | Qué hace |
|---|---|
| `register("sw.js")` | Al cargar `app.js`, si hay `navigator.serviceWorker`. |
| `install` | `caches.open(VERSION).addAll(BASE)` y `skipWaiting()`. Si falla un archivo de `BASE`, la instalación falla. |
| `activate` | Borra cachés ≠ `VERSION` y ≠ `ay-teselas`; `clients.claim()`. |
| `fetch` | Ver la tabla de estrategia. |
| `notificationclick` | Cierra la notificación; enfoca la primera ventana o abre `./#avisos`. |

## Manifiesto (`cliente/manifest.webmanifest`) e íconos

| Campo | Valor |
|---|---|
| `name` | Yaguachi Weather |
| `short_name` | Yaguachi Weather |
| `description` | Solo en español; incluye «no es un canal oficial». |
| `lang` | `es-EC` |
| `start_url`, `scope` | `./` |
| `display`, `orientation` | `standalone`, `portrait` |
| `background_color`, `theme_color` | `#dcf0fa`, `#bfe3f6` (`<meta name="theme-color">` igual) |
| `icons` | `icono.svg` (any), `icono-192.png` 192×192, `icono-512.png` 512×512, `icono-maskable-512.png` 512×512 (*maskable*) |

En `index.html`: `icono.svg` y `favicon-32.png` (32×32) como favicon, `icono-apple-180.png` (180×180) como `apple-touch-icon`. Sin uso: `icono-maskable.svg`.
