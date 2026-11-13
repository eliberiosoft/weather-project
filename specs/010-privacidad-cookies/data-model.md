# Data Model: Privacidad y cookies

Inventario de los datos que la app guarda en el teléfono y de los datos personales que guarda el servidor, con su plazo. Es la base de lo que dice la vista `#privacidad`.

## En el teléfono

### `localStorage` (todas las claves llevan el prefijo `ay_`; `almacen.get/set` las guarda como JSON)

| Clave | Contenido | Quién la escribe | En la política |
|---|---|---|---|
| `ay_dispositivo` | id aleatorio del teléfono (`"d"` + 32 hex) | `idDispositivo()` | sí («un identificador al azar») |
| `ay_lugar` | lugar elegido: `{tipo: "recinto", id}` o `{tipo, lat, lon, nombre}` (calle o GPS) | buscador / GPS | sí («tu lugar») |
| `ay_recinto` | id del recinto (formato de una versión anterior; solo se lee para migrar a `ay_lugar`) | — | no (heredada) |
| `ay_idioma` | `"es"` o `"en"` | `I18N.cambiar()` | sí («tu idioma») |
| `ay_capas_on` | capas del mapa encendidas | hoja de capas | sí («preferencias del mapa») |
| `ay_fondo` | `"osm"` o `"sat"` | hoja de capas | sí |
| `ay_muro_filtro` | `"cerca"`, `"mios"` o `"todos"` | pestaña Vecinos | sí («el filtro de Vecinos») |
| `ay_cola_reportes` | reportes sin enviar (cuerpo completo con `consentimiento: true`; la foto en base64 si cabe) | `encolar()` | sí («reportes por enviar») |
| `ay_territorio` | copia de `/api/territorio` | `iniciar()` | sí («lo último que descargaste») |
| `ay_estado_cache` | copia de `/api/estado` | `cargarEstado()` | sí |
| `ay_ultimo_lugar_det` | último detalle del lugar (`/api/recinto` o `/api/lugar`) | `cargarLugar()` | sí |
| `ay_avisos_cache` | copia de `/api/avisos` | `cargarAvisos()` | sí |
| `ay_avisos_vistos` | ids de avisos ya vistos (insignia) | `pintarAvisos()` | **no** (PR-04) |
| `ay_avisos_notificados` | ids de avisos ya notificados | `pintarAvisos()` | **no** (PR-04) |
| `ay_consent_ok` | `true` tras el primer reporte enviado con éxito | asistente y hoja de calle | **no** (PR-04) |
| `ay_aviso_cookies` | `true` cuando se vio el aviso | `#cookies-ok`, `irA("privacidad")` | sí («que ya viste este aviso») |

Ninguna cookie: la app no escribe `document.cookie` y nginx no fija `Set-Cookie`.

### Cache Storage (service worker `cliente/sw.js`)

| Caché | Contenido | Se borra |
|---|---|---|
| `v1.6` (`VERSION`) | archivos de la app, capas GeoJSON, Leaflet de unpkg y respuestas `GET /api/*` (salvo `/api/foto`) | al subir `VERSION` (las viejas) o con «Borrar los datos» |
| `ay-teselas` | teselas de OSM y Esri ya vistas | con «Borrar los datos» (sobrevive a los cambios de `VERSION`) |

### Borrado local (`#borrar-datos`)

```text
reposo ──toque──► confirmar (texto «Toca otra vez para confirmar», 5 s) ──toque──► borrar ay_*, todas las cachés,
   ▲                        │                                                 desregistrar SW, recargar sin hash
   └──── 5 s sin toque ─────┘
```

## En el servidor (`datos/yaguachi.db` y `datos/fotos/`)

| Dato | Dónde | Para qué | Plazo |
|---|---|---|---|
| id del teléfono | `reportes.dispositivo`, `confirmaciones.dispositivo`, `me_gusta.dispositivo` | reconocer «míos», un voto por teléfono, límites por teléfono | sin plazo (PR-03) |
| IP del envío | `reportes.ip`, `confirmaciones.ip`, `me_gusta.ip` | límites anti-abuso | `NULL` a las 48 h (hilo cada 6 h → hasta ~54 h) |
| ubicación | `reportes.lat`, `lon`, `tramo` | el reporte en sí | sin plazo (PR-03) |
| texto | `reportes.descripcion` (≤ 500), `via` | el reporte en sí | sin plazo (PR-03) |
| foto | `datos/fotos/<uuid>.jpg` y `reportes.foto` | el reporte en sí | al descartar: enseguida; si no: 90 días (`dias_conservar_fotos`), revisado al arrancar y cada 6 h |
| consentimiento | no se guarda como campo: todo reporte guardado lo tuvo (la API rechaza los demás) | — | — |

### Quién ve qué

| Dato | El autor | Otros vecinos | El analista (PIN) |
|---|---|---|---|
| reporte pendiente (salvo calle inundada) | sí | no | sí |
| calle inundada pendiente | sí | sí («aviso de vecinos») | sí |
| reporte verificado | sí | sí | sí |
| foto | siempre | solo si está verificado | siempre |
| id del teléfono | — (`mio: true`) | no | 6 primeros caracteres |
| IP | no | no | no |

## Fuera de la base (brecha PR-01)

- **Access log de nginx** (`cliente`, `admin`): IP, hora y URL completa de cada petición (incluida `/api/lugar?lat=&lon=` con la ubicación GPS), en la salida de `docker logs`, sin plazo de borrado definido.
- **`config.json`**: además del PIN, guarda `secreto_fotos` (32 bytes hex), con el que se firman las llaves `?k=` de las fotos propias; si se cambia, las llaves viejas dejan de valer.
- **Log de la API**: hora, ruta sin query, código y tamaño; ante un error `500` imprime la ruta con su query.
