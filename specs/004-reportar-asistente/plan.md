# Implementation Plan: Reportar — asistente paso a paso

**Branch**: `004-reportar-asistente` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-reportar-asistente/spec.md`

## Summary

Asistente de cinco pasos en la PWA ciudadana (`#v-reportar`): tipo → gravedad o altura del agua → ubicación confirmada en un mini mapa Leaflet → foto reducida en el cliente y detalles → resumen con consentimiento. El envío es un `POST /api/reportes` en JSON (foto en base64). La API valida, aplica los límites por dispositivo, IP y fotos bajo un candado y guarda en SQLite con estado `pendiente`. Solo las calles inundadas se ven al momento; el resto espera la verificación del analista. Sin red, el reporte queda en una cola de `localStorage`.

## Technical Context

**Language/Version**: Python 3.10+ (imagen `python:3.12-slim`) en la API; JavaScript ES2020 plano en el navegador.

**Primary Dependencies**: API solo con la biblioteca estándar (`http.server`, `sqlite3`, `base64`, `uuid`, `shutil`). Cliente: Leaflet 1.9.4 (unpkg, SRI) para el mini mapa; `createImageBitmap` + `<canvas>` para reducir la foto; Tailwind v4.3.5 (CLI standalone) para las clases.

**Storage**: tabla `reportes` en SQLite (`datos/yaguachi.db`); fotos como archivos `datos/fotos/<uuid>.jpg`; cola y preferencias en `localStorage` (`ay_*`).

**Testing**: manual en la app levantada (`PUERTO=8090 docker compose up -d --build`) a 360 px y escritorio; peticiones con `curl` contra un servidor aislado (`YAGUACHI_DATOS` y `YAGUACHI_CONFIG` en un directorio temporal, ver «Cómo probar»). No hay pruebas automáticas en el repositorio.

**Target Platform**: navegadores de Android de gama baja (Chrome); la API en Linux con Docker.

**Project Type**: aplicación web (API + PWA + panel).

**Performance Goals**: foto enviada de 150–400 KB típicos (1280 px, JPEG 0,7) en lugar de 2–5 MB; avance automático de paso en 260 ms.

**Constraints**: cuerpo ≤ 3 MB (API y nginx); foto ≤ 1500 KB decodificada; sin cuentas; funciona sin red (cola); textos en `es` y `en`.

**Scale/Scope**: 14 tipos de reporte; 71 recintos; decenas a cientos de reportes al día en temporada de lluvias.

## Constitution Check

*Compuertas de la constitución v1.0.0 («Flujo de trabajo y calidad»). Revisadas contra el código el 2026-11-09, sin levantar Docker.*

| # | Compuerta | Estado | Evidencia |
|---|---|---|---|
| 1 | Impeccable en 0 hallazgos | ✅ (registro) | `.impeccable/hook.cache.json` registra 0 hallazgos en `app.js`, `index.html` y `textos-app.js` (rutas anteriores `web/`). No se volvió a ejecutar `impeccable detect` al escribir esta spec. |
| 2 | Textos en `es` y `en` | ⚠️ parcial | Claves `app.wiz.*`, `app.rep.*`, `tipo.*`, `altura.*`, `app.grav.*` en los dos idiomas (`cliente/textos-app.js`, `compartido/i18n.js`). Pero los errores de la API llegan en español y se muestran tal cual (brecha 3 de la spec). |
| 3 | `VERSION` del service worker | ✅ | `cliente/sw.js`: `VERSION = "v1.6"`. |
| 4 | Sin dependencias nuevas | ✅ | Leaflet ya estaba; la reducción de la foto usa APIs del navegador. |
| 5 | Límites y validación en la escritura | ✅ | `crear_reporte()`: formato del dispositivo, consentimiento, tipo, gravedad, bbox, altura, tramo, foto JPEG ≤ 1500 KB; 6/h por dispositivo, 40/h por IP, 20 fotos/24 h por IP, duplicado < 150 m/30 min, 1 GB libre; todo bajo `_db_lock`. Body ≤ 3 MB en `_cuerpo()` y nginx. |
| 6 | Probado en la app levantada | ⚠️ no re-verificado | Esta spec es «as-built» y se escribió sin levantar Docker ni tocar el volumen. Falta una pasada de prueba con la lista de `quickstart` de abajo. |

Otros principios relevantes:

- **I (mala señal)**: cola sin conexión ✅, pero solo con `navigator.onLine === false` (brecha 1).
- **V (privacidad)**: sin nombre ni teléfono ✅; consentimiento explícito en cada reporte ✅; foto ajena solo si `validado` ✅; fotos a 90 días y al descartar ✅; IP a 48 h ✅; el EXIF se pierde al redibujar ✅. El id del teléfono va en `?dispositivo=` en la URL de las fotos propias (pendiente ya anotado en `docs/seguridad.md`).
- **VI (seguridad)**: SQL con parámetros ✅ (la lista `IN ('calle_inundada')` se arma con una constante del código, no con datos del usuario); `esc()` en todo texto del vecino que va al HTML (`pintarResumen`, `post`, `itemReporte`) ✅.

### Cómo probar (quickstart)

1. `D=$(mktemp -d); YAGUACHI_DATOS=$D YAGUACHI_CONFIG=$D/config.json python api/servidor.py --estaticos cliente --admin admin --puerto 8095` (datos y PIN temporales; nunca el volumen ni el `config.json` de la raíz).
2. En http://localhost:8095 a 360 px: hacer un reporte de cada tipo de flujo (normal, calle, con foto, sin red con DevTools → Offline).
3. `curl` del límite: 7 `POST /api/reportes` seguidos con el mismo `dispositivo` → el 7.º da 429.
4. En http://localhost:8095/panel/ (PIN en la consola): validar uno y descartar otro con foto; comprobar que el archivo desaparece de `$YAGUACHI_DATOS/fotos`.

## Project Structure

### Documentation (this feature)

```text
specs/004-reportar-asistente/
├── spec.md
├── plan.md
├── data-model.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code (repository root)

```text
api/servidor.py
├── TIPOS, GRAVEDAD, ALTURA, PUBLICO_YA        # catálogo de tipos y escalas
├── ESQUEMA / iniciar_db()                     # tabla reportes y migraciones de columnas
├── validar_dispositivo(), validar_tramo()
├── crear_reporte()                            # validación, límites bajo _db_lock, foto a disco
├── listar_reportes(), reporte_publico()       # quién ve qué
├── limpiar_fotos_viejas(), mantenimiento()    # 90 días de fotos, 48 h de IP
└── Manejador: POST /api/reportes, GET /api/reportes, GET /api/foto/{id}

cliente/index.html
├── #v-reportar  (#wiz-atras, #wiz-paso, #wiz-barra, #alerta-911)
├── #wiz [data-paso=1..5, ok]   (#tipos, #rep-alturas, #gravedad, #rep-gps, #rep-mapa,
│                                #rep-donde, #rep-minimapa, #foto, #descripcion, #wiz-resumen, #consent)
└── #wiz-acciones (#wiz-siguiente), #wiz-mios

cliente/app.js
├── pasoListo(), irPaso(), actualizarSiguiente(), avanzar()
├── pintarTipos(), fijarUbicacionReporte(), pintarMiniMapa(), pintarResumen(), reiniciarReporte()
├── listener de #foto (reducción a 1280 px, JPEG 0,7)
├── enviarReporte(), encolar(), enviarCola()
├── tramoCercano(), nombreVia(), recintoMasCercano(), ubicar()
└── textoDonde(), pintarDonde(), pintarFotoTxt()

cliente/textos-app.js      # app.wiz.*, app.rep.*, app.toast.*, app.val.*, app.err.*
compartido/i18n.js         # tipo.*, gravedad.*, altura.*, estado.*
cliente/sw.js              # no intercepta POST; no cachea /api/foto
cliente/nginx.conf         # client_max_body_size 3m; /api/ → api:8080 con X-Real-IP
```

**Structure Decision**: la funcionalidad vive en los tres archivos del cliente y en `api/servidor.py`, como el resto de la app (sin módulos ni build). La revisión del analista está en `admin/panel.js` y se documenta en la spec 008.

## Complexity Tracking

No aplica: no hay violaciones de la constitución que justificar.
