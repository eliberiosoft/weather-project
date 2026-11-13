# Implementation Plan: Mapa interactivo del cantón

**Branch**: `003-mapa-interactivo` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-mapa-interactivo/spec.md`

**Nota**: plan *as-built*.

## Summary

Un mapa Leaflet 1.9.4 a pantalla completa en `#v-mapa` que se monta la primera vez que se abre la pestaña (`iniciarMapa` → `montarMapa`). Crea *panes* con el orden de la cartografía de riesgo, un renderizador canvas por *pane* y todas las capas fijas una sola vez; en cada refresco solo cambia estilos de ríos y recintos y rehace reportes y calles con agua. Lo tocado se abre en hojas inferiores propias, las capas se eligen en una hoja propia con leyenda, y la vista vive en el hash para compartirla. Sigue las skills `.claude/skills/mapas-leaflet/SKILL.md` y `.claude/skills/cartografia-riesgo/SKILL.md`.

## Technical Context

**Language/Version**: JavaScript plano (ES2020+), sin módulos ni bundler.

**Primary Dependencies**: Leaflet 1.9.4 (`https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` y `.css` con `integrity` sha256); teselas de OpenStreetMap y Esri World Imagery. Ninguna otra.

**Storage**: capas GeoJSON estáticas (`compartido/capas/`, copiadas a `capas/` en la imagen del cliente); preferencias en `localStorage` (`ay_capas_on`, `ay_fondo`); vista en el hash de la URL.

**Testing**: manual, según «Cómo verificar un cambio en el mapa» de la skill `mapas-leaflet` (360 px y 1280 px; zooms 11, 14, 17; tocar cada tipo de objeto; modo avión).

**Target Platform**: Chrome en Android de gama baja; escritorio para revisión.

**Project Type**: aplicación web (servicio `cliente`, nginx con archivos estáticos).

**Performance Goals**: un canvas por *pane* (7) en vez de un SVG por objeto; capas fijas creadas una vez; `setStyle` en los refrescos; calles (345 KB) bajo demanda.

**Constraints**: CSP sin scripts en línea (los eventos se enlazan en JS, nada de `onclick`); `img-src`/`connect-src` solo para `tile.openstreetmap.org`, `server.arcgisonline.com` y `unpkg.com`; objetivos táctiles ≥ 44 px en los controles; textos por i18n.

**Scale/Scope**: 10 ríos, 71 recintos, 9 puntos de control, 63 tramos, 6 zonas, 4 huellas, 15 equipamientos, hasta 400 reportes (`LIMIT 400` de `/api/reportes`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Compuerta | Estado | Evidencia |
|---|---|---|---|
| 1 | Detector de Impeccable en 0 hallazgos | Cumplida con reservas | `.impeccable/hook.cache.json`: 0 hallazgos en `web/app.js`, `web/index.html` y `web/estilos/fuente.css` antes del traslado a `cliente/`; capturas `.impeccable/review/desktop-mapa.png`. Sin corrida registrada sobre `cliente/`. |
| 2 | Textos nuevos en `es` y en `en` | Cumplida | Claves `app.capa.*`, `app.ley.*`, `app.info.*`, `app.mapa.*`, `app.fondo.*`, `app.zoom.*`, `app.toast.teselas`… presentes en los dos idiomas (336/336 claves `app.*`). Excepción: atribuciones de teselas (Brecha 10). |
| 3 | `VERSION` del service worker subida | Cumplida | `cliente/sw.js` `VERSION = "v1.6"`; las 11 capas están en `BASE`. |
| 4 | Sin dependencias nuevas sin justificar | Cumplida | Solo Leaflet 1.9.4, que la constitución ya fija (principio III). Ningún plugin. |
| 5 | Límites y validación en toda escritura nueva de la API | No aplica | El mapa solo lee; las escrituras desde el mapa son las de `specs/005-calles-inundadas/`. |
| 6 | Probado en la app levantada | Sin evidencia en el repositorio | Hay capturas de revisión de diseño (`.impeccable/review/`), no un registro de prueba funcional. Esta documentación no levantó Docker. |

Desvíos del principio I encontrados al documentar: Brecha 1 (capas pesadas al abrir). Queda como tarea pendiente, no como excepción justificada.

## Project Structure

### Documentation (this feature)

```text
specs/003-mapa-interactivo/
├── spec.md
├── plan.md
├── data-model.md
└── tasks.md
```

### Source Code (repository root)

```text
cliente/
├── index.html
│   └── #v-mapa: #mapa, #form-mapa/#buscar-mapa, #btn-capas, #aviso-modo, #btn-zoom-mas, #btn-zoom-menos,
│       #btn-ubicarme, #btn-canton, #btns-mapa (#btn-calle-mapa, #btn-reportar-mapa), #hoja-info, #hoja-capas
│       (fondo [data-base] + #lista-capas), #hoja-calle; Leaflet con SRI al pie
├── app.js  (sección «MAPA»)
│   ├── PANES, lienzo(), capasDef(), capasEncendidas()
│   ├── iniciarMapa(), montarMapa(), rioEstado(), refrescarCapasDinamicas()
│   ├── abrirHoja(), cerrarHojas(), quitarSeleccion(), resaltar(), encimaDeLaHoja(), abrirInfo(), dato(), escenario()
│   ├── armarHojaCapas(), marcarFondo(), irAlPunto(), guardarVista(), leerHash()
│   ├── controles: zoom, cantón, ubicarme (ubicar()), buscador (irAEnMapa), acciones delegadas [data-accion]
│   └── alClicMapa() (modo calle / modo reporte: ver 005)
├── textos-app.js   # app.capa.*, app.ley.*, app.info.*, app.mapa.*, app.fondo.*, app.toast.teselas, app.escenario…
└── estilos/fuente.css  # @layer components: .leaflet-container, .leaflet-control-attribution, .et-recinto, .sin-etiquetas

compartido/capas/*.geojson   # ver data-model.md
preparar_capas.py            # exporta las capas (QGIS 3.44, ogr2ogr)
.claude/skills/mapas-leaflet/SKILL.md, .claude/skills/cartografia-riesgo/SKILL.md   # reglas del mapa
```

**Structure Decision**: todo el mapa vive en `cliente/app.js` junto al resto de la app (sin módulos); el estilo de lo que dibuja Leaflet por su cuenta es la única CSS fuera de utilidades, en `@layer components` de `cliente/estilos/fuente.css`.

## Complexity Tracking

No hay violaciones que justificar.
