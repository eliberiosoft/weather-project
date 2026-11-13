# Implementation Plan: Calles con agua (aviso de vecinos)

**Branch**: `005-calles-inundadas` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-calles-inundadas/spec.md`

**Nota**: plan *as-built*.

## Summary

El aviso de calle es un reporte del tipo `calle_inundada` que, a diferencia de los otros 13 tipos, se publica al momento como «aviso de vecinos» y vence a las 8 h. En el cliente, un modo del mapa (`modoCalle`) encaja el toque a la vía OSM más cercana (`tramoCercano`, ≤ 70 m, ±120 m), y una hoja inferior pide la altura del agua con una escala propia de tres valores. El servidor valida el tramo, la altura y los límites bajo un candado, guarda el aviso en `reportes` y lo devuelve en la lista pública. Los vecinos confirman «sigue» / «ya no» (`confirmaciones`); un aviso sin verificar se cierra solo con suficientes conexiones distintas, y el autor puede cerrar el suyo.

## Technical Context

**Language/Version**: Python 3.10+ (API); JavaScript plano (cliente).

**Primary Dependencies**: stdlib de Python; Leaflet 1.9.4 (mapa); `compartido/capas/calles.geojson` (OSM, ODbL).

**Storage**: SQLite: `reportes` (columnas `altura_agua`, `via`, `tramo` agregadas por `iniciar_db` en bases viejas) y `confirmaciones` (columna `ip` agregada). En el teléfono: `ay_dispositivo`, `ay_consent_ok`, `ay_cola_reportes`.

**Testing**: manual con la app levantada y peticiones reales a `POST /api/reportes` y `POST /api/reportes/{id}/confirmar` contra un servidor aislado con datos temporales (principio VII: nunca en el volumen `yaguachi-weather_datos`).

**Target Platform**: Chrome en Android de gama baja; API en contenedor.

**Project Type**: aplicación web (api + cliente; el panel revisa los avisos).

**Performance Goals**: `tramoCercano` recorre los 1207 tramos de `calles.geojson` en el teléfono con aritmética plana (sin índice espacial); la capa se descarga una vez y queda en memoria (`CALLES`).

**Constraints**: sin cuentas (id aleatorio por teléfono); consentimiento LOPDP explícito; límites por teléfono e IP; escala de altura propia; textos por i18n.

**Scale/Scope**: hasta 400 reportes en la lista pública; tramos de 2–80 puntos.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Compuerta | Estado | Evidencia |
|---|---|---|---|
| 1 | Detector de Impeccable en 0 hallazgos | Cumplida con reservas | 0 hallazgos en `web/app.js` y `web/index.html` según `.impeccable/hook.cache.json` (antes del traslado a `cliente/`); sin corrida sobre `cliente/`. |
| 2 | Textos nuevos en `es` y en `en` | Cumplida en la interfaz | `app.modo.calle`, `app.calle.*`, `app.altura.*`, `app.consent.calle`, `app.voto.*`, `app.toast.calle_ok`, `altura.*`… en los dos idiomas. Los mensajes de error de la API llegan solo en español (Brecha 8). |
| 3 | `VERSION` del service worker subida | Cumplida | `cliente/sw.js` `VERSION = "v1.6"`; `calles.geojson` está en `BASE`. |
| 4 | Sin dependencias nuevas sin justificar | Cumplida | Ninguna. |
| 5 | Límites y validación en toda escritura nueva de la API | Cumplida con brechas | `crear_reporte`: dispositivo, consentimiento, tipo, ubicación, altura, tramo, foto; 6/h por teléfono, 40/h por IP, 20 fotos/día por IP, deduplicación 150 m/30 min, todo bajo `_db_lock`. `confirmar_reporte`: 30/h por IP, un voto por teléfono, umbral por IP distintas. Brechas: el autor cierra su aviso verificado (1), se vota un aviso vencido (4), entradas malformadas dan 500 (9). |
| 6 | Probado en la app levantada | Sin evidencia en el repositorio | No hay registro de prueba de esta funcionalidad. Esta documentación no levantó Docker ni tocó la base. |

La Brecha 1 choca con el principio VI («Lo verificado por el analista solo lo cambia el analista»). No se justifica: queda como tarea pendiente T028.

## Project Structure

### Documentation (this feature)

```text
specs/005-calles-inundadas/
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
    ├── TIPOS["calle_inundada"] (8 h), ALTURA, PUBLICO_YA
    ├── ESQUEMA / iniciar_db(): reportes (altura_agua, via, tramo), confirmaciones (ip)
    ├── validar_dispositivo(), validar_tramo(), crear_reporte()
    ├── listar_reportes(), reporte_publico(), visible_para()
    ├── confirmar_reporte()
    ├── pagina_compartida()           # /r/<id> con la altura y «Aviso de vecinos, sin verificar.»
    └── mantenimiento()               # IP a NULL a las 48 h

cliente/
├── index.html   # #btn-calle-mapa, #aviso-modo, #hoja-calle (#hoja-via, #hoja-alturas, #hoja-consent/#hoja-ok,
│                # #hoja-enviar, #btn-cancelar-calle), #btn-modo-calle en «Mi lugar», #rep-alturas en el asistente
├── app.js
│   ├── AGUA, AGUA_W, ALT                          # simbología de altura
│   ├── cargarCalles(), tramoCercano(), nombreVia(), recintoMasCercano()
│   ├── mostrarModo(), ocultarModo(), modoCalle(), alClicMapa(), elegirTramo(), cancelarCalle(), #hoja-enviar
│   ├── refrescarCapasDinamicas() (capa callesAgua), abrirInfo({tipo: "calle"})
│   ├── etiquetaEstado(), botonesVoto(), itemReporte(), confirmar()
│   ├── pintarReportesCerca() («Calles inundadas cerca», ≤ 3 km)
│   └── asistente: pasoListo(2), fijarUbicacionReporte() (nombre de la vía), enviarReporte() (tramo al enviar), encolar()
└── textos-app.js

compartido/
├── i18n.js       # altura.*, altura.*.larga, estado.calle_pendiente, tipo.calle_inundada
└── capas/calles.geojson

admin/panel.js    # muestra «ya visible» en avisos de calle pendientes; el analista los verifica, resuelve o descarta
```

**Structure Decision**: el aviso de calle reutiliza la tabla y la ruta de reportes (`POST /api/reportes`) con tres columnas propias, en vez de una tabla aparte; así el panel, el muro, las fotos y `/r/<id>` funcionan igual para todos los tipos.

## Complexity Tracking

No hay violaciones que justificar.
