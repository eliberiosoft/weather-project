# Implementation Plan: PWA instalable y uso sin conexión

**Branch**: `011-pwa-sin-conexion` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-pwa-sin-conexion/spec.md`

**Nota**: plan *as-built*.

## Summary

Un service worker escrito a mano (`cliente/sw.js`, 60 líneas) precarga la app, las 11 capas y Leaflet en una caché con nombre de versión, sirve los archivos con «red primero y copia si tarda más de 3,5 s», la API con «red primero y copia sin red», y las teselas con «caché primero» en una caché aparte que sobrevive a las versiones. La app guarda además sus últimas respuestas en `localStorage`, pone en cola los reportes enviados sin señal y los reenvía al volver la conexión. Un manifiesto y cinco íconos hacen la app instalable. nginx sirve `sw.js` sin caché para que una `VERSION` nueva llegue al primer intento.

## Technical Context

**Language/Version**: JavaScript plano (service worker clásico, sin módulos).

**Primary Dependencies**: APIs del navegador: Service Worker, Cache Storage, `localStorage`, `Notification`, `navigator.onLine`. Ninguna biblioteca (sin Workbox).

**Storage**: Cache Storage (`v1.6`, `ay-teselas`) y `localStorage` con prefijo `ay_` (ver `data-model.md`).

**Testing**: manual en Chrome con DevTools (Application → Service Workers / Cache Storage; Network → Offline). No hay registro de prueba sin conexión en el repositorio (README).

**Target Platform**: Chrome en Android (instalación y service worker requieren HTTPS o `localhost`); Safari iOS para el ícono de inicio.

**Project Type**: aplicación web; servicio `cliente` (nginx).

**Performance Goals**: abrir desde la copia en ≤ 3,5 s con red colgada; precarga de ~0,8 MB de capas más la app y Leaflet.

**Constraints**: sin build (no se puede generar la lista de precarga con hash; se mantiene a mano en `BASE`); la `VERSION` se sube a mano en cada despliegue; CSP `worker-src 'self'`, `manifest-src 'self'`.

**Scale/Scope**: una app (`/`), 26 entradas en `BASE`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Compuerta | Estado | Evidencia |
|---|---|---|---|
| 1 | Detector de Impeccable en 0 hallazgos | Cumplida con reservas | `.impeccable/hook.cache.json` registra 0 hallazgos en `web/sw.js` antes del traslado a `cliente/`. El service worker no tiene interfaz; los textos del banner y los avisos están en `cliente/app.js`. |
| 2 | Textos nuevos en `es` y en `en` | Cumplida con reservas | `app.ban.offline`, `app.red.no`, `app.toast.cola`, `app.toast.cola_enviados`, `app.toast.offline_lugar`, `app.toast.teselas`, `app.toast.sin_servidor`, `app.priv.cache.*`, `app.priv.borrar.*` en los dos idiomas. El manifiesto (nombre y descripción) solo está en español (Brecha 12). |
| 3 | `VERSION` del service worker subida | Cumplida | `cliente/sw.js`: `VERSION = "v1.6"` (la versión del último commit era `ay-v2`). |
| 4 | Sin dependencias nuevas sin justificar | Cumplida | Sin Workbox ni otra biblioteca. |
| 5 | Límites y validación en toda escritura nueva de la API | No aplica | La cola reutiliza `POST /api/reportes`, con sus límites (ver `specs/005-calles-inundadas/contracts/api.md`). |
| 6 | Probado en la app levantada | No cumplida | README, «Pendiente o por revisar»: el modo sin conexión no se verificó en el navegador integrado y en Chrome «falta probar el uso sin conexión». |

La compuerta 6 no cumplida y las Brechas 1, 3, 4 y 5 afectan directamente al principio I («los reportes enviados sin señal quedan en cola y se reenvían»). Quedan como tareas pendientes, no como excepción justificada.

## Project Structure

### Documentation (this feature)

```text
specs/011-pwa-sin-conexion/
├── spec.md
├── plan.md
├── data-model.md
└── tasks.md
```

### Source Code (repository root)

```text
cliente/
├── sw.js                      # VERSION, BASE; install, activate, fetch (4 estrategias), notificationclick
├── manifest.webmanifest       # nombre, colores, display, íconos
├── icono.svg, favicon-32.png, icono-192.png, icono-512.png, icono-maskable-512.png, icono-apple-180.png
├── icono-maskable.svg         # sin referencias
├── index.html                 # <link rel="manifest">, íconos, theme-color, #chip-red, #banners, «Privacidad» (#borrar-datos)
├── app.js
│   ├── almacen (get/set con try/catch)
│   ├── cargarEstado(), iniciar(), cargarLugar(), cargarAvisos()   # respaldos en localStorage
│   ├── pintarBanners()                                            # banner sin conexión
│   ├── encolar(), enviarCola(), enviarReporte(), #hoja-enviar     # cola de reportes
│   ├── pintarAvisos() (showNotification), #btn-notif
│   ├── #borrar-datos (borra ay_*, cachés y registro del SW)
│   └── navigator.serviceWorker.register("sw.js"); eventos online/offline
├── nginx.conf                 # sw.js: no-cache, no-store; resto y capas: no-cache
└── Dockerfile                 # copia compartido/i18n.js y compartido/capas/ junto a la app

compartido/i18n.js, compartido/capas/   # precargados por el SW (en la imagen quedan en / y /capas/)
api/servidor.py                         # en desarrollo (--estaticos) sirve cliente/ y compartido/ con no-cache
```

**Structure Decision**: un service worker propio y pequeño en vez de Workbox (principio III, sin build ni dependencias); la lista de precarga y la versión se mantienen a mano y la constitución obliga a subir `VERSION` en cada despliegue.

## Complexity Tracking

No hay violaciones que justificar.
