# Implementation Plan: Semáforo de «Mi lugar»

**Branch**: `002-semaforo-mi-lugar` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-semaforo-mi-lugar/spec.md`

**Nota**: plan *as-built*: describe cómo está construido hoy, no un diseño por hacer.

## Summary

El servidor calcula un nivel **estimado** por río (GloFAS + regla limnimétrica + advertencia INAMHI + aguaje) y por recinto o punto (río a ≤ 1,5 km + lluvia de su celda + advertencia + reportes graves verificados), y lo combina con el nivel **verificado** que fija el analista por ámbito. La app pide el detalle del lugar (`/api/recinto` o `/api/lugar`), elige el nivel efectivo (verificado si existe), traduce los motivos estructurados y pinta la ficha del nivel con las acciones del idioma activo, la lluvia, el río y lo cercano. Todo se guarda en `localStorage` para verse sin señal.

## Technical Context

**Language/Version**: Python 3.10+ (la imagen usa `python:3.12-slim`) en la API; JavaScript plano (ES2020+, sin módulos ni bundler) en el cliente.

**Primary Dependencies**: biblioteca estándar de Python (`http.server`, `sqlite3`, `urllib`, `json`, `math`); en el cliente solo `compartido/i18n.js` y `cliente/textos-app.js`. Datos externos: Open-Meteo Forecast API (lluvia) y Open-Meteo Flood API (GloFAS, 51 escenarios).

**Storage**: SQLite (`datos/yaguachi.db` o el volumen `yaguachi-weather_datos`): tablas `niveles_oficiales`, `lecturas`, `reglas`, `ajustes`, `cache`, `reportes` (solo lectura para el nivel). Capas GeoJSON en memoria (`Territorio`). En el teléfono, `localStorage` con prefijo `ay_`.

**Testing**: no hay pruebas automáticas. Verificación manual con la app levantada y peticiones reales a la API (principio VII).

**Target Platform**: API en contenedor Linux sin puerto publicado; cliente en navegadores móviles Android de gama baja (Chrome) servidos por nginx.

**Project Type**: aplicación web en tres servicios (api, cliente, admin).

**Performance Goals**: `/api/estado` se sirve de la caché en memoria (120 s); el detalle de un lugar responde con un solo cálculo por punto. La primera pantalla con lugar guardado debe pintarse sin desplazarse a 360 px.

**Constraints**: sin dependencias nuevas; uso sin conexión con lo último guardado; textos por i18n (es/en); colores del semáforo fijos.

**Scale/Scope**: 1 cantón, 71 recintos, 316 nombres de calle agrupados para el buscador, 10 ríos, 9 puntos de control, celdas de lluvia de 0,05° con recintos.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Compuerta | Estado | Evidencia |
|---|---|---|---|
| 1 | Detector de Impeccable en 0 hallazgos | Cumplida con reservas | `.impeccable/hook.cache.json` registra 0 hallazgos en `web/index.html` y `web/app.js` (rutas anteriores al traslado a `cliente/`). No hay corrida registrada sobre `cliente/index.html` ni `cliente/app.js` después del traslado. |
| 2 | Textos nuevos en `es` y en `en` | Cumplida | `cliente/textos-app.js`: 336 claves `app.*` en `es` y las mismas 336 en `en`. `acciones.*`, `nivel.*`, `motivo.*` y `vecino.*` en `compartido/i18n.js` en los dos idiomas. Excepción: los mensajes de error de la API llegan en español (Brecha 11). |
| 3 | `VERSION` del service worker subida | Cumplida | `cliente/sw.js`: `VERSION = "v1.6"`. |
| 4 | Sin dependencias nuevas sin justificar | Cumplida | Solo stdlib en `api/servidor.py`; ningún paquete en el cliente. |
| 5 | Límites y validación en toda escritura nueva de la API | No aplica | La funcionalidad solo lee (`GET`). Las escrituras que la alimentan (`/api/panel/nivel`, `/api/panel/lectura`, `/api/panel/regla`, `/api/panel/ajustes`) son del panel y exigen PIN. `/api/lugar` valida `lat`/`lon` y el rectángulo del cantón. |
| 6 | Probado en la app levantada | Sin evidencia en el repositorio | El README cuenta pruebas en Chrome; no hay registro de prueba de esta funcionalidad. Esta documentación no levantó Docker. |

Violaciones del principio II (honestidad del nivel) encontradas al documentar: Brechas 1 a 3 de la spec. No se justifican: quedan como tareas pendientes.

## Project Structure

### Documentation (this feature)

```text
specs/002-semaforo-mi-lugar/
├── spec.md
├── plan.md
├── data-model.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code (repository root)

```text
api/
└── servidor.py
    ├── NIVELES, COLORES, DIST_RIO_M, RIOS_MAREA, ACCIONES, CABECERAS   # constantes del semáforo
    ├── iniciar_db(), ESQUEMA                                         # tablas (ver data-model.md)
    ├── Territorio (recintos, ríos, puntos, parroquias, calles del buscador)
    ├── con_cache(), lluvia_celdas(), glofas_punto()                  # datos externos con caché
    ├── M(), unir(), sin_es()                                         # motivos estructurados
    ├── nivel_glofas(), nivel_regla(), lluvia_resumen(), nivel_lluvia()
    ├── advertencia_vigente(), aguaje_vigente(), oficiales(), reportes_graves_validados()
    ├── evaluar_punto(), calcular_estado(), estado_lugar(), invalidar_estado()
    └── Manejador._api_get(): /api/estado, /api/territorio, /api/recinto, /api/lugar, /api/cercano

cliente/
├── index.html        # #v-inicio: #banners, #form-lugar, #sin-lugar, #con-lugar, #mosaico, #banda, #acciones, #ficha, #aviso-oficial
├── app.js            # sección «MI LUGAR»: nivelEfectivo, banda, escena, olas, graficaLluvia, pintarBanners,
│                     # pintarLugar, medidorRio, lecturaRegla, pintarReportesCerca, cargarLugar, armarBuscador,
│                     # buscarLugar, ubicar, #btn-gps; arranque: cargarEstado, iniciar (refresco de 5 min)
└── textos-app.js     # claves app.banda.*, app.ficha.*, app.lluvia.*, app.rio.*, app.medidor.*, app.cerca.*, …

compartido/
├── i18n.js           # motor; nivel.*, acciones.*, motivo.*, vecino.*; I18N.motivo()
└── capas/            # recintos, rios, puntos_control, parroquias, equipamientos, calles, limite_canton

config.json (se crea solo)  # umbrales de lluvia, tiempos de caché
```

**Structure Decision**: el cálculo vive solo en la API (una sola fuente de verdad para app y panel); el cliente no recalcula niveles, solo elige entre `oficial` y `sugerido` y traduce los motivos.

## Complexity Tracking

No hay violaciones que justificar: la funcionalidad no agrega dependencias ni servicios.
