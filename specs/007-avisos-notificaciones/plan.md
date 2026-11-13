# Implementation Plan: Avisos del analista y notificaciones

**Branch**: `007-avisos-notificaciones` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-avisos-notificaciones/spec.md`

## Summary

El analista publica avisos desde el panel (`POST /api/panel/aviso`) para uno de cuatro ámbitos; la API aplica tres reglas anti-saturación (tope de 3 en 24 h, texto repetido en 6 h, nivel repetido en 3 h) que RESPUESTA se salta, y los guarda en la tabla `avisos`. La app consulta `GET /api/avisos?recinto=` al arrancar, cada 5 minutos y al abrir la pestaña; filtra por ámbito en el servidor, pinta tarjetas con el nivel escrito sobre su color, muestra una insignia de no vistos y lanza notificaciones locales por el service worker, calladas de noche para los niveles 1 y 2. El panel puede anular un aviso.

## Technical Context

**Language/Version**: Python 3.10+ (imagen `python:3.12-slim`); JavaScript ES2020 plano (app y panel).

**Primary Dependencies**: biblioteca estándar en la API; en el navegador, Notifications API y `ServiceWorkerRegistration.showNotification`; Tailwind v4.3.5. Sin Web Push ni servicios externos.

**Storage**: tabla `avisos` en SQLite; `horas_silencio` y `avisos_max_24h_por_ambito` en `config.json`; `ay_avisos_*` en `localStorage`.

**Testing**: manual: panel en `admin` y app en `cliente` contra un servidor aislado; Chrome de escritorio y Android con HTTPS o `chrome://flags` (las notificaciones y el service worker no funcionan por HTTP en la red local). Sin pruebas automáticas.

**Target Platform**: Chrome de Android para la app; navegador de escritorio para el panel.

**Project Type**: aplicación web (API + PWA + panel).

**Performance Goals**: consulta de avisos cada 5 min con la app abierta; respuesta pequeña (≤ 70 avisos).

**Constraints**: sin push del servidor; notificaciones solo con la app viva; nombre del nivel siempre escrito (principio II); la app no se presenta como canal oficial.

**Scale/Scope**: 1 cantón, 4 parroquias, 10 ríos/esteros, 71 recintos; pocos avisos al día.

## Constitution Check

*Compuertas de la constitución v1.0.0. Revisadas contra el código el 2026-11-09, sin levantar Docker.*

| # | Compuerta | Estado | Evidencia |
|---|---|---|---|
| 1 | Impeccable en 0 hallazgos | ✅ (registro) | `.impeccable/hook.cache.json`: 0 hallazgos en `app.js`, `index.html` y `panel.js` (rutas anteriores `web/`). No se volvió a ejecutar. |
| 2 | Textos en `es` y `en` | ⚠️ parcial | `app.av.*` (`cliente/textos-app.js`) y `panel.av.*` (`admin/textos-panel.js`) en los dos idiomas. Errores 400/409 de la API solo en español. `app.av.notif.nota` no describe bien el comportamiento (brechas 3 y 4 de la spec). |
| 3 | `VERSION` del service worker | ✅ | `cliente/sw.js`: `v1.6`; `notificationclick` en ese archivo. |
| 4 | Sin dependencias nuevas | ✅ | APIs del navegador. |
| 5 | Límites y validación en la escritura | ⚠️ | `panel_aviso`: nivel, ámbito, longitudes, horas 1–168 y reglas anti-saturación ✅; detrás de PIN ✅. Pero: reglas fuera del candado, `ambito_id` sin validar, `forzar` abierto y `panel_anular_aviso` sin comprobar que el id exista (brechas 6–9). |
| 6 | Probado en la app levantada | ❌ | El panel no puede publicar avisos de RESPUESTA y muestra un error tras publicar los demás (`const t` tapa la función `t` en el listener de `#a-publicar`, `admin/panel.js`). Esto no habría pasado una prueba en la app levantada. |

Otros principios:

- **II (honestidad del nivel)**: la tarjeta escribe el nombre del nivel sobre su color (`NIV[a.nivel_cod]` sobre `FONDO[n]`) ✅; el texto de la pestaña dice que los avisos no reemplazan a los del COE ni la SGR ✅.
- **VI (seguridad)**: publicar y anular solo con `X-PIN` y solo por el servicio `admin` ✅; título y texto del analista pasan por `esc()` en la app y en el panel ✅; acciones delegadas con `data-accion`, sin `onclick` ✅.

## Project Structure

### Documentation (this feature)

```text
specs/007-avisos-notificaciones/
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
├── CONFIG_DEF: avisos_max_24h_por_ambito, horas_silencio
├── ESQUEMA: tabla avisos
├── avisos_para()              # GET /api/avisos (vigentes, anteriores, aplica por ámbito)
├── panel_aviso()              # POST /api/panel/aviso (validación + anti-saturación)
├── panel_anular_aviso()       # POST /api/panel/avisos/{id}/anular
└── panel_ajustes_get()        # avisos, parroquias y recintos para el panel

admin/index.html               # formulario #a-tipo, #a-id, #a-nivel, #a-titulo, #a-texto, #a-horas, #a-publicar; #a-lista
admin/panel.js                 # llenarSelects() (#a-tipo → #a-id), listener de #a-publicar, pintarAvisos(), anular()
admin/textos-panel.js          # panel.av.*

cliente/index.html             # #v-avisos (#avisos-para, #avisos-vigentes, #btn-notif, #avisos-anteriores); #insignia en la barra
cliente/app.js                 # enSilencio(), cargarAvisos(), pintarAvisos(), #btn-notif, pintarAvisosPara(), setInterval de 5 min en iniciar()
cliente/textos-app.js          # app.av.*, app.toast.notif_*
cliente/sw.js                  # notificationclick; caché de /api/avisos
compartido/i18n.js             # nivel.1..4
```

**Structure Decision**: los avisos viven en la misma API y base que el resto; las notificaciones son locales porque Web Push necesita claves VAPID, un servicio de envío y guardar suscripciones, algo que el README deja como pendiente.

## Complexity Tracking

No aplica.
