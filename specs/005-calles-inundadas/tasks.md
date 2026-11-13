---
description: "Tareas (as-built) de calles con agua"
---

# Tasks: Calles con agua (aviso de vecinos)

**Input**: `/specs/005-calles-inundadas/` (spec.md, plan.md, data-model.md, contracts/api.md)

**Tests**: no se pidieron pruebas automáticas; verificación manual con un servidor aislado y datos temporales.

**Organización**: `[X]` = construido; `[ ]` = pendiente (brechas y mejoras).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Exportar las vías OSM del cantón (`vias_canton`: `id`, `nombre`, `clase`, simplificadas a 3 m) a `compartido/capas/calles.geojson` en `preparar_capas.py`
- [X] T002 Tipo `calle_inundada` (8 h), escala `ALTURA` de tres valores y `PUBLICO_YA` en `api/servidor.py`

---

## Phase 2: Foundational

- [X] T003 Columnas `altura_agua`, `via`, `tramo` en `reportes` y `ip` en `confirmaciones` (con migración de bases viejas) en `ESQUEMA` e `iniciar_db()` de `api/servidor.py`
- [X] T004 Id aleatorio del teléfono con `crypto` (`idDispositivo`, `ay_dispositivo`) y envío en la cabecera `X-Dispositivo` (`api()`) en `cliente/app.js`
- [X] T005 [P] Textos `altura.*`, `altura.*.larga`, `estado.calle_pendiente`, `tipo.calle_inundada` en `compartido/i18n.js` (es y en)

---

## Phase 3: User Story 1 - Avisar desde el mapa (P1) 🎯 MVP

- [X] T006 [US1] Carga perezosa de calles y encaje del toque a la vía más cercana con tramo de ±120 m (`cargarCalles`, `tramoCercano`) en `cliente/app.js`
- [X] T007 [US1] Modo calle con barra de aviso, cursor en cruz y botones ocultos (`modoCalle`, `mostrarModo`, `ocultarModo`, `alClicMapa`) en `cliente/app.js`
- [X] T008 [US1] Hoja `#hoja-calle` con nombre de la vía, tres alturas como `radiogroup`, consentimiento recordado y Enviar en `cliente/index.html`
- [X] T009 [US1] Selección del tramo, validación y envío (`elegirTramo`, `nombreVia`, `recintoMasCercano`, `#hoja-enviar`, `cancelarCalle`) en `cliente/app.js`
- [X] T010 [US1] Entradas al modo calle desde «Mi lugar» (`#btn-modo-calle`) y desde la hoja de un recinto o río (`data-accion="calle-aqui"`) en `cliente/app.js`
- [X] T011 [US1] Validación del aviso y del tramo, límites y deduplicación bajo `_db_lock`, y respuesta con mensaje de «aviso de vecinos» (`validar_dispositivo`, `validar_tramo`, `crear_reporte`) en `api/servidor.py`
- [X] T012 [P] [US1] Textos `app.modo.calle`, `app.calle.*`, `app.altura.*`, `app.alturas.etq`, `app.consent.calle`, `app.val.*`, `app.toast.acerca`, `app.toast.toca_calle`, `app.toast.calle_ok` en `cliente/textos-app.js` (es y en)

**Checkpoint**: un aviso se crea desde el mapa y la API lo guarda como `pendiente`.

---

## Phase 4: User Story 2 - Ver las calles con agua (P1)

- [X] T013 [US2] Lista pública con avisos de calle pendientes y vigentes, verificados primero (`listar_reportes`, `reporte_publico`) en `api/servidor.py`
- [X] T014 [US2] Capa `callesAgua` con halo, línea por altura (`AGUA`, `AGUA_W`), discontinua sin verificar y línea de toque de 26 px (`refrescarCapasDinamicas`) en `cliente/app.js`
- [X] T015 [US2] Hoja del aviso con altura, estado, recinto, nota del analista y votos (`abrirInfo({tipo: "calle"})`) en `cliente/app.js`
- [X] T016 [US2] «Calles inundadas cerca» en «Mi lugar» (≤ 3 km, hasta 10) (`pintarReportesCerca`, `itemReporte`, `etiquetaEstado`) en `cliente/app.js`
- [X] T017 [P] [US2] Leyenda de alturas y «sin verificar» en la hoja de capas (`capasDef`) en `cliente/app.js`
- [X] T018 [P] [US2] Página compartida `/r/<id>` con vía, altura y «Aviso de vecinos, sin verificar.» (`pagina_compartida`) en `api/servidor.py`

---

## Phase 5: User Story 3 - Confirmar «sigue» / «ya pasó» (P2)

- [X] T019 [US3] Votos de vecinos con un voto por teléfono, límite de 30 por IP y hora y recálculo de `sigue`/`ya_no` (`confirmar_reporte`) en `api/servidor.py`
- [X] T020 [US3] Cierre automático de avisos pendientes con ≥ 3 conexiones distintas y `ya_no > 2 × sigue` en `confirmar_reporte` de `api/servidor.py`
- [X] T021 [US3] Cierre por el autor de su aviso de calle y rechazo de su voto «sigue» o en otros tipos en `confirmar_reporte` de `api/servidor.py`
- [X] T022 [US3] Botones de voto según autor y tipo (`botonesVoto`) y envío con refresco de lugar, mapa y muro (`confirmar`) en `cliente/app.js`
- [X] T023 [US3] Borrado de la IP de avisos y votos a las 48 h (`mantenimiento`) en `api/servidor.py`
- [X] T024 [P] [US3] Textos `app.voto.*`, `app.info.vecinos.txt`, `app.toast.bajo`, `app.toast.gracias` en `cliente/textos-app.js` (es y en)

---

## Phase 6: User Story 4 - Desde el asistente «Reportar» (P3)

- [X] T025 [US4] Paso 2 con altura en lugar de gravedad para calles (`#rep-alturas`, `pasoListo(2)`, `irPaso`) en `cliente/app.js` y `cliente/index.html`
- [X] T026 [US4] Nombre de la vía en el paso «¿Dónde?» (`fijarUbicacionReporte`, `textoDonde`, `app.rep.donde.sin_calle`) en `cliente/app.js`
- [X] T027 [US4] Tramo y punto ajustado al enviar (`enviarReporte`) en `cliente/app.js`

---

## Phase 7: Pendientes (brechas y mejoras)

- [X] T028 [US3] Exigir `estado = 'pendiente'` cuando el autor cierra su aviso en `confirmar_reporte` de `api/servidor.py` y ocultar el botón «El agua ya pasó» en avisos verificados en `botonesVoto` de `cliente/app.js` (Brecha 1) — **hecho el 2026-11-09:** el autor solo cierra mientras está `pendiente` (servidor); falta ocultar el botón en lo verificado
- [ ] T029 [US3] Alinear la regla de cierre con su intención: decidir ventana de tiempo y si cuenta «nadie sigue» o la proporción 2:1, y corregir el comentario en `confirmar_reporte` de `api/servidor.py` (Brecha 2)
- [ ] T030 [US3] Contar `sigue`/`ya_no` por conexión distinta (o mostrar ambos conteos) en `confirmar_reporte` de `api/servidor.py` (Brecha 3)
- [X] T031 [US3] Rechazar votos sobre avisos vencidos (`expira <= ahora` → 404) en `confirmar_reporte` de `api/servidor.py` (Brecha 4) — **hecho el 2026-11-09:** votar un aviso vencido → 409
- [X] T032 [US2] Filtrar por `expira` los avisos propios en el mapa y en «Mi lugar» (`refrescarCapasDinamicas`, `pintarReportesCerca`, `botonesVoto`) en `cliente/app.js` (Brecha 5) — **hecho el 2026-11-09:** `vigente()` en `refrescarCapasDinamicas` y `pintarReportesCerca`
- [X] T033 [US1] Mostrar `app.toast.cola` al encolar desde `#hoja-enviar` en `cliente/app.js` (Brecha 6) — **hecho el 2026-11-09:** la hoja muestra el mensaje de la cola al encolar
- [ ] T034 [US4] Decidir si un aviso de calle sin tramo es válido; si no, rechazarlo en `crear_reporte` de `api/servidor.py` (Brecha 7)
- [ ] T035 [P] Devolver claves de error traducibles y mapearlas en `cliente/textos-app.js` (Brecha 8)
- [X] T036 [P] Capturar `ValueError`/`binascii.Error` en `validar_tramo` y en la foto de `crear_reporte` para responder 400 (Brecha 9) — **hecho el 2026-11-09:** `validar_tramo` y la foto responden 400
- [ ] T037 [US3] Decidir si un voto «sigue» extiende `expira` y aplicarlo en `confirmar_reporte` (Brecha 10; requiere aclaración)
- [X] T038 [P] Corregir en `DESIGN.md` y `.claude/skills/cartografia-riesgo/SKILL.md` los nombres de la escala (tobillo / rodilla / no se puede pasar → hasta la vereda / sobre la vereda / no cruces) (Brecha 11) — **hecho el 2026-11-09:** `DESIGN.md` y la skill usan la escala propia
- [ ] T039 [P] Pasar los tipos de `PUBLICO_YA` como parámetros en `listar_reportes` de `api/servidor.py` (Brecha 12)
- [ ] T040 Probar de punta a punta en la app levantada con un servidor aislado (`YAGUACHI_DATOS` temporal): crear, votar desde tres IP, cerrar por el autor, vencer a las 8 h (compuerta 6)

---

## Dependencies & Execution Order

- US1 depende de la Fase 2; US2 depende de US1 (necesita avisos); US3 depende de US2 (botones en las vistas); US4 reutiliza `tramoCercano` de US1.
- T028 y T031 tocan la misma función: hacerlas en el mismo cambio. Cualquier cambio en `cliente/` obliga a subir `VERSION` en `cliente/sw.js`.
