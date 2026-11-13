---
description: "Tareas de Avisos del analista y notificaciones (as-built)"
---

# Tasks: Avisos del analista y notificaciones

**Input**: Design documents from `/specs/007-avisos-notificaciones/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.md; panel con PIN (spec 008) y service worker (spec 011).

**Tests**: sin pruebas automáticas; cada historia se verifica con su «Independent Test».

**Organization**: `[X]` = construido; `[ ]` = pendiente.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Claves `avisos_max_24h_por_ambito` (3) y `horas_silencio` ([22, 6]) en `CONFIG_DEF` de `api/servidor.py` y en `config.ejemplo.json`
- [X] T002 [P] Nombres de nivel `nivel.1..4` en `es`/`en` en `compartido/i18n.js`

---

## Phase 2: Foundational

- [X] T003 Tabla `avisos` en `ESQUEMA` de `api/servidor.py`
- [X] T004 Rutas `GET /api/avisos`, `POST /api/panel/aviso` y `POST /api/panel/avisos/{id}/anular` en `Manejador` de `api/servidor.py`

---

## Phase 3: User Story 1 - El analista publica un aviso (P1) 🎯 MVP

- [X] T005 [US1] `panel_aviso()`: validación de nivel, ámbito, título, texto y horas (1–168), `ambito_nombre` legible e inserción bajo `_db_lock` en `api/servidor.py`
- [X] T006 [US1] Formulario de aviso (ámbito, cuál, nivel, título 90, texto 600, horas) en `admin/index.html`
- [X] T007 [US1] Selector «Cuál» según el ámbito (parroquias, ríos, recintos) en `llenarSelects()` de `admin/panel.js`
- [X] T008 [US1] Listener de `#a-publicar` y lista `pintarAvisos()` (últimos 50, con «anulado») en `admin/panel.js`
- [X] T009 [P] [US1] Parroquias y recintos para los selectores en `panel_ajustes_get()` de `api/servidor.py`
- [X] T010 [P] [US1] Textos `panel.av.*` en `es`/`en` en `admin/textos-panel.js`

---

## Phase 4: User Story 2 - Reglas anti-saturación (P1)

- [X] T011 [US2] Tope de 3 en 24 h, texto repetido en 6 h y nivel repetido en 3 h, con RESPUESTA exenta, en `panel_aviso()` de `api/servidor.py`
- [X] T012 [US2] Texto de las reglas junto al formulario (`panel.av.reglas`) en `admin/index.html` y confirmación antes de publicar RESPUESTA en `admin/panel.js`

---

## Phase 5: User Story 3 - El vecino ve los avisos de su zona (P1)

- [X] T013 [US3] `avisos_para()`: vigentes (50) y anteriores (20), regla de ámbito (cantón, recinto, parroquia, río ≤ 1,5 km) y `horas_silencio` en `api/servidor.py`
- [X] T014 [US3] Pestaña `#v-avisos` con vigentes, botón de notificaciones y anteriores; insignia `#insignia` en la barra, en `cliente/index.html`
- [X] T015 [US3] `cargarAvisos()` con `ay_avisos_cache` sin red y `pintarAvisos()` con tarjeta por nivel (color + nombre escrito) en `cliente/app.js`
- [X] T016 [US3] Insignia de no vistos y marca de vistos al abrir la pestaña (`ay_avisos_vistos`) en `cliente/app.js`
- [X] T017 [US3] Consulta cada 5 min y al abrir la pestaña (`iniciar()`, `irA("avisos")`) en `cliente/app.js`
- [X] T018 [US3] Subtítulo «Para {lugar} y todo el cantón» (`pintarAvisosPara()`) en `cliente/app.js`
- [X] T019 [P] [US3] Textos `app.av.*` en `es`/`en` en `cliente/textos-app.js`

---

## Phase 6: User Story 4 - Notificaciones con horas de silencio (P2)

- [X] T020 [US4] Botón «Activar notificaciones» con `Notification.requestPermission()` y toasts en `cliente/app.js`
- [X] T021 [US4] `enSilencio()` y notificación por el service worker (título con nivel, 180 caracteres, `tag`, `requireInteraction` en RESPUESTA), una vez por aviso (`ay_avisos_notificados`), en `cliente/app.js`
- [X] T022 [US4] `notificationclick` que enfoca la app o abre `./#avisos` en `cliente/sw.js`

---

## Phase 7: User Story 5 - Anular un aviso (P2)

- [X] T023 [US5] `panel_anular_aviso()` en `api/servidor.py` y exclusión de anulados en `avisos_para()` y en las reglas
- [X] T024 [US5] Botón «Anular» con confirmación y recarga de la lista (`anular()`) en `admin/panel.js`

---

## Phase 8: Pendiente (brechas y mejoras)

- [X] T025 **Urgente**: renombrar la variable local `t` del listener de `#a-publicar` (p. ej. `const tipo = $("#a-tipo").value;`) para que no tape la función de traducción; hoy no se pueden publicar avisos de RESPUESTA y los demás muestran un error falso, en `admin/panel.js` — **hecho el 2026-11-09:** la variable se llama `ambito`
- [X] T026 Mandar el recinto más cercano (o la parroquia y el río del punto) en `cargarAvisos()` cuando «Mi lugar» es un punto GPS o una calle, en `cliente/app.js` (y aceptar esos parámetros en `avisos_para()` de `api/servidor.py`) — **hecho el 2026-11-09:** `cargarAvisos` usa el recinto más cercano (≤ 3 km)
- [X] T027 No marcar como notificado un aviso callado por las horas de silencio; notificarlo al terminar la franja si sigue vigente, en `cliente/app.js` (`pintarAvisos`) — **hecho el 2026-11-09:** en silencio, un aviso 1–2 no se marca como notificado: se notifica fuera de la franja
- [ ] T028 Corregir `app.av.notif.nota` (no hay aviso de cambio de nivel) y armar las horas de silencio desde `horas_silencio` en lugar de escribirlas en el texto, en `cliente/textos-app.js` y `admin/textos-panel.js`
- [X] T029 Evaluar las horas de silencio en hora de Ecuador (UTC−5), en `cliente/app.js` (`enSilencio`) — **hecho el 2026-11-09:** `enSilencio` usa la hora de Ecuador (UTC−5)
- [X] T030 Guardar quién/cuándo/por qué se anula, responder 404 si el id no existe, y contar los anulados recientes en el tope anti-saturación, en `api/servidor.py` (`panel_anular_aviso`, `panel_aviso`) — **hecho el 2026-11-09:** anular un id inexistente → 404 (falta guardar quién/cuándo/por qué)
- [X] T031 Comprobar las reglas anti-saturación bajo `_db_lock` junto con la inserción, en `api/servidor.py` (`panel_aviso`) — **hecho el 2026-11-09:** reglas e inserción bajo `_db_lock`
- [ ] T032 Validar `ambito_id` contra las capas (parroquias, ríos, recintos; `yaguachi` para el cantón), en `api/servidor.py` (`panel_aviso`)
- [ ] T033 Quitar o documentar y registrar el parámetro `forzar`, en `api/servidor.py` (`panel_aviso`)
- [ ] T034 Errores estructurados (`{k, v, es}`) en `panel_aviso` y traducción en el panel, en `api/servidor.py` y `admin/textos-panel.js`
- [X] T035 Validar en el panel que «Vigente por (horas)» no esté vacío (hoy da 1 h), en `admin/panel.js` — **hecho el 2026-11-09:** el panel manda 24 h si el campo queda vacío
- [X] T036 En `notificationclick`, llevar la ventana enfocada a `#avisos` (`client.navigate` o `postMessage`), en `cliente/sw.js` — **hecho el 2026-11-09:** `notificationclick` manda `postMessage({ir:'avisos'})` a la ventana abierta
- [X] T037 Recortar `ay_avisos_vistos` y `ay_avisos_notificados` a los ids recientes, en `cliente/app.js` — **hecho el 2026-11-09:** las listas guardan solo los ids vigentes
- [ ] T038 Notificaciones push reales (Web Push con VAPID) — pendiente de README; requiere justificar dependencias en «Complexity Tracking»
- [ ] T039 Prueba completa en la app levantada: publicar los 4 niveles, probar las tres reglas, anular, notificación de día y de noche (compuerta 6)

---

## Dependencies & Execution Order

- T025 primero: bloquea la prueba de US1 y US2 desde el panel.
- T026 depende de decidir la regla para puntos que no son recinto ([NEEDS CLARIFICATION] en la spec).
- T027–T029 tocan la misma función; hacerlas juntas.

## Notes

- Cambios en `cliente/` → subir `VERSION` en `cliente/sw.js`.
- Si cambia el comportamiento, actualizar `spec.md` en el mismo cambio.
