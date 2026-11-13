---
description: "Tareas de Reportar — asistente paso a paso (as-built)"
---

# Tasks: Reportar — asistente paso a paso

**Input**: Design documents from `/specs/004-reportar-asistente/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.md

**Tests**: no hay pruebas automáticas en el repositorio; cada historia se verifica a mano según su «Independent Test».

**Organization**: tareas agrupadas por historia de usuario. `[X]` = construido y presente en el código; `[ ]` = pendiente.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Catálogo `TIPOS` (14 tipos con emoji, etiqueta, horas de vigencia y si sube a RESPUESTA), `GRAVEDAD`, `ALTURA` y `PUBLICO_YA` en `api/servidor.py`
- [X] T002 [P] Nombres de los tipos, gravedades, alturas y estados en `es`/`en` en `compartido/i18n.js` (`tipo.*`, `gravedad.*`, `altura.*`, `estado.*`)
- [X] T003 [P] Íconos SVG `t-<tipo>`, `a-1..3`, `i-pin`, `i-camara`, `i-gps` en el sprite de `cliente/index.html`

---

## Phase 2: Foundational

- [X] T004 Tabla `reportes` en `ESQUEMA` y migración de columnas `altura_agua`, `via`, `tramo` en `iniciar_db()` de `api/servidor.py`
- [X] T005 `validar_dispositivo()` y `ErrorApi` en `api/servidor.py`
- [X] T006 Id del teléfono con `crypto.randomUUID`/`getRandomValues` (`idDispositivo()`) y envoltorio `api()` que manda `X-Dispositivo` en `cliente/app.js`
- [X] T007 Lectura del cuerpo con tope de 3 MB y `Content-Length` validado (`Manejador._cuerpo`) en `api/servidor.py`; `client_max_body_size 3m` en `cliente/nginx.conf`

**Checkpoint**: la API acepta y guarda reportes; el cliente tiene identidad sin cuentas.

---

## Phase 3: User Story 1 - Enviar un reporte con mi ubicación (P1) 🎯 MVP

- [X] T008 [US1] Estructura del asistente `#v-reportar` con 5 pasos, pantalla `ok`, barra de progreso y botón atrás en `cliente/index.html`
- [X] T009 [US1] `pasoListo()`, `irPaso()` (animación, foco en la pregunta, «Paso n de 5») y `actualizarSiguiente()` en `cliente/app.js`
- [X] T010 [US1] `pintarTipos()` y avance automático `avanzar()` (260 ms, 0 con movimiento reducido) en `cliente/app.js`
- [X] T011 [US1] Selector de gravedad con «Moderada» por defecto en `cliente/index.html` y su listener en `cliente/app.js`
- [X] T012 [US1] Botón «Mi ubicación» con `ubicar()` (alta precisión, 15 s) en `cliente/app.js`
- [X] T013 [US1] `pintarResumen()` con «Cambiar» por fila (`data-ir-paso`) y casilla `#consent` en `cliente/app.js` / `cliente/index.html`
- [X] T014 [US1] `enviarReporte()` y pantalla final con «Ver en Vecinos», «Ver en el mapa», «Hacer otro reporte» (`reiniciarReporte()`) en `cliente/app.js`
- [X] T015 [US1] `crear_reporte()` con validación, recinto cercano (≤ 3 km), `en_canton`, `expira` por tipo y respuesta 201 en `api/servidor.py`
- [X] T016 [US1] Límites bajo `_db_lock`: 6/h por dispositivo, 40/h por IP, duplicado < 150 m en 30 min, en `api/servidor.py`
- [X] T017 [US1] Aviso de ECU 911 (`#alerta-911`) para `aislados`, `desborde` y `vivienda_inundada` en `cliente/app.js`
- [X] T018 [P] [US1] Textos `app.wiz.*`, `app.rep.*`, `app.toast.rep_ok`, `app.val.consent` en `es`/`en` en `cliente/textos-app.js`

**Checkpoint**: un vecino envía un reporte con GPS y el analista lo ve como `pendiente`.

---

## Phase 4: User Story 2 - Confirmar o corregir el lugar en el mini mapa (P1)

- [X] T019 [US2] `fijarUbicacionReporte()` con origen `gps` / `mapa` / `ajustada` y texto `textoDonde()` en `cliente/app.js`
- [X] T020 [US2] Botón «En el mapa» que abre el mapa en modo reporte y vuelve al asistente al tocar (`#rep-mapa`, `alClicMapa`) en `cliente/app.js`
- [X] T021 [US2] `pintarMiniMapa()`: OSM zoom 17, pin arrastrable, toque para mover, círculo de precisión, sin arrastre de mapa en móviles en `cliente/app.js`
- [X] T022 [US2] Nombre de la calle cercana (≤ 70 m) en el texto de ubicación para `calle_inundada` en `cliente/app.js`

---

## Phase 5: User Story 3 - Calle inundada desde el asistente (P2)

- [X] T023 [US3] Bloque de alturas `#rep-alturas` en el paso 2 (y oculta la gravedad) en `cliente/index.html` / `irPaso()`
- [X] T024 [US3] Cálculo del tramo ±120 m con `tramoCercano()` y punto ajustado a la calle al enviar en `cliente/app.js`
- [X] T025 [US3] Validación de `altura_agua`, `via` y `validar_tramo()` (2–80 puntos) en `api/servidor.py`

---

## Phase 6: User Story 4 - Foto liviana (P2)

- [X] T026 [US4] Reducción a 1280 px y JPEG 0,7 con `createImageBitmap` + canvas y vista previa en `cliente/app.js`
- [X] T027 [US4] Validación de la foto (prefijo `data:image/jpeg;base64,`, ≤ `max_foto_kb`, firma `FF D8 FF`) y guardado en `datos/fotos/` en `api/servidor.py`
- [X] T028 [US4] Límite de 20 fotos por IP en 24 h y 507 con menos de 1 GB libre en `api/servidor.py`
- [X] T029 [US4] `GET /api/foto/{id}` solo para verificado, dueño o PIN; exclusión de `/api/foto` en `cliente/sw.js`

---

## Phase 7: User Story 5 - Reportar sin señal (P2)

- [X] T030 [US5] `encolar()` en `localStorage` (`ay_cola_reportes`) y mensaje `app.toast.cola` en `cliente/app.js`
- [X] T031 [US5] `enviarCola()` al arrancar y en el evento `online` en `cliente/app.js`

---

## Phase 8: User Story 6 - Saber qué pasa con mi reporte (P3)

- [X] T032 [US6] `listar_reportes()` y `reporte_publico()` con la regla de visibilidad (verificados y calles vigentes para todos; todo lo propio para el dueño) en `api/servidor.py`
- [X] T033 [US6] Borrado de la foto al descartar en `panel_revisar()` en `api/servidor.py`
- [X] T034 [US6] Hilo `mantenimiento()` cada 6 h: fotos de más de 90 días y IP de más de 48 h en `api/servidor.py`
- [X] T035 [US6] Botón «Ver mis reportes en Vecinos» (`#wiz-mios`) y resaltado del reporte nuevo (`postDestacado`) en `cliente/app.js`

---

## Phase 9: Pendiente (brechas y mejoras)

- [X] T036 Encolar también cuando `fetch` falla por red aunque `navigator.onLine` sea `true` (distinguir `TypeError` de un error HTTP) en `cliente/app.js` (`enviarReporte`) — **hecho el 2026-11-09:** `falloDeRed()` encola también con `TypeError` de `fetch`
- [X] T037 Manejar el error de cuota de `localStorage` al encolar y avisar al vecino; guardar la cola sin foto si no cabe, en `cliente/app.js` (`encolar`, `almacen.set`) — **hecho el 2026-11-09:** `encolar()` guarda sin la foto si no cabe y avisa (`app.toast.cola_sin_foto` / `cola_llena`)
- [X] T038 No descartar en silencio los reportes de la cola rechazados por la API: avisar al vecino con el motivo, en `cliente/app.js` (`enviarCola`) — **hecho el 2026-11-09:** `enviarCola` avisa los rechazados (`app.toast.cola_rechazados`) y reintenta 429/5xx
- [ ] T039 Devolver errores estructurados (`{k, v, es}`) desde `crear_reporte()` y traducirlos en el cliente, en `api/servidor.py` y `cliente/textos-app.js`
- [X] T040 Responder 400 (no 500) a un base64 con relleno incorrecto y a una `descripcion` que no es texto, en `api/servidor.py` (`crear_reporte`) — **hecho el 2026-11-09:** base64 inválido, `descripcion` no texto y `tramo` no numérico → 400
- [X] T041 No pintar en el mapa ni en «cerca de ti» los reportes propios vencidos (`expira` < ahora), en `cliente/app.js` (`refrescarCapasDinamicas`, `pintarReportesCerca`) — **hecho el 2026-11-09:** `vigente()` filtra lo propio vencido en el mapa y en «cerca»
- [ ] T042 Recortar o simplificar el tramo a 80 puntos en el cliente antes de enviarlo, en `cliente/app.js` (`tramoCercano`)
- [ ] T043 Decidir si la casilla de consentimiento se pide en cada reporte o solo la primera vez, y alinear el asistente con la hoja de calle (spec 005)
- [ ] T044 [P] Actualizar `DESIGN.md` («Gracias»: tres botones, no dos)
- [ ] T045 Prueba completa en la app levantada a 360 px y escritorio, con la consola sin errores (compuerta 6), siguiendo «Cómo probar» de `plan.md`

---

## Dependencies & Execution Order

- Phase 1 y 2 antes que todo.
- US1 (Phase 3) es el MVP; US2–US6 dependen de US1 pero son independientes entre sí.
- Las tareas pendientes T036–T038 tocan la misma función de envío: hacerlas en ese orden.

## Notes

- Cualquier cambio en `cliente/` debe subir `VERSION` en `cliente/sw.js`.
- Si cambia el comportamiento, actualizar `spec.md` en el mismo cambio.
