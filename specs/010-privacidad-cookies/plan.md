# Implementation Plan: Privacidad y cookies

**Branch**: `010-privacidad-cookies` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-privacidad-cookies/spec.md` (documentación «as-built»).

## Summary

Una vista más de la PWA (`#v-privacidad`, sin pestaña propia en la barra inferior), un aviso flotante de una sola vez (`#aviso-cookies`) y un botón de borrado local con confirmación en dos toques, todo en `cliente/index.html` + `cliente/app.js` con textos `app.priv.*`. Del lado del servidor, la privacidad se apoya en lo que ya hace `api/servidor.py`: consentimiento obligatorio en `crear_reporte()`, permisos de `GET /api/foto/<id>`, borrado de la foto al descartar (`panel_revisar()`) y el hilo `mantenimiento()` que borra fotos de 90 días e IP de 48 h.

## Technical Context

**Language/Version**: JavaScript del navegador (app); Python 3.12 en Docker (API, solo stdlib).

**Primary Dependencies**: ninguna nueva. API del navegador: `localStorage`, `caches` (Cache Storage), `navigator.serviceWorker`, `crypto.randomUUID` / `crypto.getRandomValues`.

**Storage**: en el teléfono, claves `ay_*` de `localStorage` y las cachés `v1.6` (archivos y respuestas de `/api/*`) y `ay-teselas` (teselas vistas). En el servidor, SQLite (`reportes`, `confirmaciones`, `me_gusta`) y `datos/fotos/`. Ver [data-model.md](data-model.md).

**Testing**: manual. App: DevTools → Application (Local Storage, Cache Storage, Service Workers, Cookies) antes y después del borrado. Servidor: instancia aislada con `YAGUACHI_DATOS` temporal; nunca el volumen `yaguachi-weather_datos`.

**Target Platform**: Chrome/Android de gama baja; la vista debe leerse a 360 px.

**Project Type**: aplicación web (PWA) + API.

**Performance Goals**: el aviso no tapa la ficha del nivel ni la barra inferior (se ubica sobre la barra: `bottom: calc(4.5rem + safe-area + .75rem)`).

**Constraints**: CSP sin scripts en línea; sin cookies; textos legales en lenguaje llano y en los dos idiomas.

**Scale/Scope**: 1 vista, 1 aviso, 1 botón; 16 claves `ay_*` en el teléfono; 3 tablas y una carpeta de fotos en el servidor con plazos automáticos.

## Constitution Check

*GATE: compuertas de «Flujo de trabajo y calidad» de `.specify/memory/constitution.md`.*

| # | Compuerta | Estado | Evidencia |
|---|---|---|---|
| 1 | Detector de Impeccable en 0 hallazgos | ⚠️ Sin evidencia | No hay registro de `impeccable detect` sobre `cliente/index.html` en su ubicación actual (la vista y el aviso son nuevos respecto del último commit). |
| 2 | Textos nuevos en `es` y `en` | ✅ Cumple | 25 claves `app.priv.*` (más `app.consent.calle`, `app.rep.consent`, `app.val.consent`) con el mismo conjunto en `es` y `en`; 0 claves faltantes en `cliente/textos-app.js`. |
| 3 | `VERSION` del service worker subida | ✅ Cumple | `cliente/sw.js` pasó de `ay-v2` (último commit) a `VERSION = "v1.6"`. |
| 4 | Sin dependencias nuevas sin justificar | ✅ Cumple | Sin librerías; solo API del navegador. |
| 5 | Límites y validación en toda escritura nueva de la API | ✅ Cumple | No agrega rutas de escritura. La que toca (`POST /api/reportes`) exige `consentimiento === true` y aplica sus límites bajo candado (ver 004/012). |
| 6 | Probado en la app levantada | ⚠️ Sin evidencia | No hay registro de prueba del aviso, la vista y el borrado a 360 px y en escritorio con consola limpia. |

Principio V (privacidad por defecto): ✅ sin cuentas, id aleatorio con `crypto`, consentimiento explícito, fotos de otros solo verificadas, fotos 90 días y al descartar, IP 48 h, sin analítica ni cookies, borrado local desde «Privacidad». ❌ Parcial en «los datos personales nunca van en la URL»: ver brechas PR-01 y PR-02.

## Project Structure

### Documentation (this feature)

```text
specs/010-privacidad-cookies/
├── spec.md
├── plan.md              # este archivo
├── data-model.md        # qué se guarda en el teléfono y en el servidor, y cuánto dura
├── contracts/
│   └── api.md           # consentimiento, X-Dispositivo, permisos de foto y plazos
└── tasks.md
```

### Source Code (repository root)

```text
cliente/
├── index.html           # #v-privacidad (secciones resp, cookies, local, cache, terceros, reportes, derechos, borrar),
                         # #aviso-cookies (#cookies-ok, #cookies-ver), enlace en #aviso-oficial, #consent con enlace,
                         # #hoja-consent / #hoja-ok en la hoja de calle inundada
├── app.js               # almacen (prefijo ay_), idDispositivo(), irA("privacidad"), aviso de una vez en iniciar(),
                         # #cookies-ok, #borrar-datos (dos toques, 5 s), consentimiento en enviarReporte() y #hoja-enviar,
                         # api() con cabecera X-Dispositivo
├── textos-app.js        # app.priv.*, app.consent.calle, app.rep.consent, app.val.consent (es/en)
├── sw.js                # no guarda /api/foto; cachés v1.6 y ay-teselas
├── nginx.conf           # sin cookies; proxy de /api/ con X-Real-IP
└── seguridad.conf       # CSP: solo unpkg.com, tile.openstreetmap.org y server.arcgisonline.com como externos
api/
└── servidor.py          # crear_reporte() (consentimiento, IP para límites), reporte_publico() (foto solo verificada o propia),
                         # GET /api/foto/<id>, panel_revisar() (borra foto al descartar), limpiar_fotos_viejas(),
                         # mantenimiento() (cada 6 h), log_message() (sin query)
docs/seguridad.md        # pendiente: revisión legal y correo de contacto
```

**Structure Decision**: la política es contenido estático traducible dentro de la PWA (funciona sin conexión porque `index.html` y `textos-app.js` están en la caché), no una página aparte; los plazos se cumplen en el servidor sin intervención del analista.
