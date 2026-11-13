---
description: "Tareas (as-built) del mapa interactivo"
---

# Tasks: Mapa interactivo del cantón

**Input**: `/specs/003-mapa-interactivo/` (spec.md, plan.md, data-model.md)

**Tests**: no se pidieron pruebas automáticas; verificación manual según la skill `mapas-leaflet`.

**Organización**: `[X]` = construido; `[ ]` = pendiente (brechas y mejoras).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Exportar las 11 capas a GeoJSON WGS84 con 6 decimales y simplificación en `preparar_capas.py` → `compartido/capas/`
- [X] T002 Cargar Leaflet 1.9.4 desde unpkg con `integrity` sha256 en `cliente/index.html` y permitir unpkg y las teselas en la CSP de `cliente/seguridad.conf` y `CABECERAS_SEG` de `api/servidor.py`
- [X] T003 [P] Copiar `compartido/capas/` a `capas/` en la imagen del cliente (`cliente/Dockerfile`) y servirlas con `Cache-Control: no-cache` y `application/geo+json` (`cliente/nginx.conf`)

---

## Phase 2: Foundational

- [X] T004 Estructura de `#v-mapa` a pantalla completa entre las barras, con controles flotantes y las tres hojas en `cliente/index.html`
- [X] T005 Estilos de lo que dibuja Leaflet (`.leaflet-container`, atribución, `.et-recinto`, `.sin-etiquetas`) en `@layer components` de `cliente/estilos/fuente.css`
- [X] T006 *Panes* en el orden de la cartografía y renderizador canvas por *pane* (`PANES`, `lienzo`) en `cliente/app.js`
- [X] T007 Montaje perezoso del mapa la primera vez que se abre la pestaña (`iniciarMapa`, `montarMapa`) con `minZoom` 10, `maxZoom` 19 y `maxBounds` del cantón en `cliente/app.js`

---

## Phase 3: User Story 1 - Ver dónde está el peligro ahora (P1) 🎯 MVP

- [X] T008 [US1] Ríos con halo (blanco o negro si verificado), línea del color del nivel y línea de toque de 24 px (`capas._rioHalo`, `capas._rioLinea`, `rioEstado`) en `cliente/app.js`
- [X] T009 [US1] Recintos como `circleMarker` en canvas con etiqueta permanente oculta bajo zoom 13 (`recMarcas`) en `cliente/app.js`
- [X] T010 [US1] Refresco de estilos y de las capas de reportes y calles con agua sin recrear lo fijo (`refrescarCapasDinamicas`) en `cliente/app.js`
- [X] T011 [P] [US1] Puntos de control como marcadores rectangulares con su código (`capas.puntos`) en `cliente/app.js`
- [X] T012 [P] [US1] Límite cantonal siempre visible y no interactivo (`limite`) en `cliente/app.js`

**Checkpoint**: el mapa muestra el semáforo de ríos y recintos y los reportes.

---

## Phase 4: User Story 2 - Tocar algo y entender qué es (P1)

- [X] T013 [US2] Hojas inferiores `#hoja-info`/`#hoja-capas` con apertura exclusiva y cierre por ✕, Escape y toque en el mapa vacío (`abrirHoja`, `cerrarHojas`, `alClicMapa`) en `cliente/app.js`
- [X] T014 [US2] Resaltado de lo tocado en el *pane* `seleccion` y desplazamiento sobre la hoja en móvil (`resaltar`, `encimaDeLaHoja`) en `cliente/app.js`
- [X] T015 [US2] Detalle por tipo (recinto, río, calle, reporte, punto, equipamiento, zona, huella, tramo, riesgo muy alto) con ficha compacta del nivel y rótulo de escenario (`abrirInfo`, `dato`, `escenario`) en `cliente/app.js`
- [X] T016 [US2] Acciones «Ver qué hacer aquí» y «Avisar de una calle inundada aquí/cerca» (delegadas por `data-accion`) en `cliente/app.js`
- [X] T017 [P] [US2] Textos `app.info.*`, `app.escenario` en `cliente/textos-app.js` (es y en)

---

## Phase 5: User Story 3 - Elegir capas y fondo (P2)

- [X] T018 [US3] Definición de capas en tres grupos con leyenda en palabras llanas y nota de escenario (`capasDef`, `swLinea`, `swCaja`, `swPunto`, `muestra`) en `cliente/app.js`
- [X] T019 [US3] Hoja de capas con interruptores accesibles y guardado en `ay_capas_on` (`armarHojaCapas`, `capasEncendidas`) en `cliente/app.js`
- [X] T020 [US3] Fondo OSM / Satélite Esri con control segmentado y guardado en `ay_fondo` (`fondos`, `marcarFondo`) en `cliente/app.js` y `cliente/index.html`
- [X] T021 [US3] Capas de riesgo base en magenta y azules translúcidos, apagadas por defecto, y tramos críticos en negro discontinuo (`capas.muyAlto`, `capas.zonas`, `capas.huellas`, `capas.tramos`) en `cliente/app.js`
- [X] T022 [US3] Aviso único cuando fallan las teselas (`tileerror`) en `cliente/app.js`
- [X] T023 [P] [US3] Equipamientos y parroquias como capas de referencia (`capas.equip`, `capas.parroquias`) en `cliente/app.js`

---

## Phase 6: User Story 4 - Ir a un lugar, ubicarme y compartir (P2)

- [X] T024 [US4] Vista en el hash y su restauración al montar (`guardarVista`, `leerHash`, `moveend`) en `cliente/app.js`
- [X] T025 [US4] Movimiento que respeta `prefers-reduced-motion` y saltos cortos (`irAlPunto`) en `cliente/app.js`
- [X] T026 [US4] Buscador del mapa con la lista de lugares compartida (`irAEnMapa`, `#form-mapa`) en `cliente/app.js`
- [X] T027 [US4] «Mostrar mi ubicación» con punto y círculo de precisión (`#btn-ubicarme`) y «Ver todo el cantón» (`#btn-canton`) en `cliente/app.js`
- [X] T028 [US4] «Ver en el mapa» desde «Mi lugar» (`#ver-en-mapa`) en `cliente/app.js`
- [X] T029 [US4] Repintado de la hoja de capas y de la última hoja al cambiar de idioma (evento `idioma`, `ultimaInfo`) en `cliente/app.js`

---

## Phase 7: Pendientes (brechas y mejoras)

- [ ] T030 [US3] Cargar `huellas_desborde`, `riesgo_muy_alto`, `zonas_criticas` y `tramos_criticos` solo al encender su capa en `montarMapa`/`armarHojaCapas` de `cliente/app.js` (Brecha 1)
- [ ] T031 [US3] Mostrar la leyenda solo de las capas encendidas o separar una leyenda visible en `armarHojaCapas` de `cliente/app.js` (Brecha 2)
- [ ] T032 Capturar el fallo de cada capa en `capa(n)` de `montarMapa` y seguir con las demás mostrando un aviso i18n en `cliente/app.js` y `cliente/textos-app.js` (Brecha 3)
- [ ] T033 [US4] Aplicar un hash `#mapa/…` nuevo cuando el mapa ya está montado (en el `hashchange` o en `iniciarMapa`) en `cliente/app.js` (Brecha 4)
- [ ] T034 [US3] Dar a las huellas de desborde una simbología de escenario que no use `AGUA` (trama o magenta) en `capas.huellas` de `cliente/app.js` y actualizar la leyenda `app.ley.escenario` (Brecha 5)
- [ ] T035 Subir el resaltado de selección por encima de los marcadores (o resaltar con un `divIcon`) y pasar `capaTramoTmp` y el círculo de ubicación al renderizador canvas en `cliente/app.js` (Brecha 6)
- [ ] T036 [P] Dibujar calles como base vectorial cuando fallan las teselas en `cliente/app.js` (Brecha 7)
- [ ] T037 [P] Etiquetas de nombres de calle desde zoom 16 en `cliente/app.js` (Brecha 8)
- [ ] T038 [US2] Pasar el punto tocado del río al botón «Avisar de una calle cerca» en `abrirInfo` de `cliente/app.js` (Brecha 9)
- [ ] T039 Correr `impeccable detect` sobre `cliente/` y probar el mapa en la app levantada a 360 px y 1280 px (compuertas 1 y 6)

---

## Dependencies & Execution Order

- Fase 2 depende de la 1; US1 depende de la 2; US2–US4 dependen de US1.
- Cualquier tarea pendiente que cambie archivos del cliente obliga a subir `VERSION` en `cliente/sw.js`; T030 además cambia qué capas conviene tener en `BASE`.
