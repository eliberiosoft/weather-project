# Implementation Plan: App ciudadana y panel instalables (PWA)

**Branch**: `013-pwa-panel-y-app` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

## Summary

La app ciudadana ya era una PWA (ver `specs/011-pwa-sin-conexion`); se le sumaron el botón de instalar, el `id` del manifiesto y la navegación desde las notificaciones. El panel pasa a ser una PWA con su propio manifiesto y su propio service worker, que guarda solo la cáscara, nunca datos de la API.

## Technical Context

**Language/Version**: JavaScript plano (Service Worker API, Web App Manifest).

**Primary Dependencies**: ninguna nueva.

**Storage**: Cache Storage: la app usa `v1.7` y `ay-teselas`; el panel, `panel-v1.0`.

**Testing**: Chrome, comprobando el registro del SW, la caché, el manifiesto y el botón de instalar.

**Constraints**: el panel no debe dejar datos protegidos en el equipo.

## Constitution Check

| Compuerta | Estado | Evidencia |
|---|---|---|
| Impeccable en 0 | ✅ | 0 hallazgos en `cliente/` y `admin/` |
| Textos es/en | ✅ | `panel.instalar*`, `panel.sin_red`, `panel.con_red`, `app.instalar*` |
| `VERSION` del SW subida | ✅ | app v1.6 → v1.7; panel v1.0 (nuevo) |
| Sin dependencias nuevas | ✅ | — |
| Escrituras con límites | n/a | no hay escrituras nuevas |
| Probado levantado | ✅ | Chrome: SW activo en :8090 y :8091, cachés `v1.7` y `panel-v1.0`, botones visibles, consola limpia |

## Project Structure

```text
admin/manifest.webmanifest   # nuevo
admin/sw.js                  # nuevo: cáscara, sin /api/
admin/index.html             # manifest, theme-color, apple-touch-icon, #btn-instalar, ícono i-instalar
admin/panel.js               # registro del SW, beforeinstallprompt, avisos online/offline
admin/textos-panel.js        # textos es/en
admin/nginx.conf · admin/seguridad.conf · admin/Dockerfile (íconos)
cliente/sw.js                # v1.7; ignora /panel; no borra panel-*; notificationclick → postMessage
cliente/index.html · cliente/app.js · cliente/textos-app.js · cliente/manifest.webmanifest (id)
```
