---
description: "Tareas de Vecinos (as-built)"
---

# Tasks: Vecinos — publicaciones, me gusta y compartir

**Input**: Design documents from `/specs/006-vecinos/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.md; la spec 004 (reportes) ya construida.

**Tests**: sin pruebas automáticas; cada historia se verifica con su «Independent Test».

**Organization**: `[X]` = construido; `[ ]` = pendiente.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Renombrar la pestaña «muro» a «Vecinos» en la interfaz (`app.sec.muro` = «Vecinos» / «Neighbours») manteniendo `muro` en ids y hash, en `cliente/textos-app.js`
- [X] T002 [P] Íconos `i-muro`, `i-corazon`, `i-compartir`, `i-chat`, `i-enlace`, `i-mas` en el sprite de `cliente/index.html`

---

## Phase 2: Foundational

- [X] T003 Tabla `me_gusta` en `ESQUEMA` y columna `ip` por migración en `iniciar_db()` de `api/servidor.py`
- [X] T004 Orden «verificado primero» en `listar_reportes()` (`ORDER BY (estado='validado') DESC, creado DESC LIMIT 400`) en `api/servidor.py`
- [X] T005 `likes` y `me_gusta` por reporte en `listar_reportes()` / `reporte_publico()` en `api/servidor.py`

---

## Phase 3: User Story 1 - Ver lo que avisan los vecinos cerca de mí (P1) 🎯 MVP

- [X] T006 [US1] Sección `#v-muro` con título, buscador, filtros y contenedor en `cliente/index.html`
- [X] T007 [US1] `post()`: autor anónimo, recinto, tiempo, distancia, estado, título, descripción, nota del analista, «en revisión» y votos de calle, en `cliente/app.js`
- [X] T008 [US1] `centroLugar()` y filtro de 5 km (`CERCA_M`) con mensaje «sin lugar» en `cliente/app.js`
- [X] T009 [US1] `cargarMuro()` al abrir la pestaña y tras enviar o confirmar, usando lo último en memoria si no hay red, en `cliente/app.js`
- [X] T010 [P] [US1] Textos `app.muro.*` en `es`/`en` en `cliente/textos-app.js`

---

## Phase 4: User Story 2 - Filtrar y buscar (P1)

- [X] T011 [US2] Filtros «Cerca de ti», «Míos», «Todos» como `radiogroup` y guardado en `ay_muro_filtro` en `cliente/index.html` / `cliente/app.js`
- [X] T012 [US2] Buscador con `normalizar()` (sin tildes ni mayúsculas) y espera de 150 ms en `cliente/app.js`
- [X] T013 [US2] Cuenta de resultados (`#muro-cuenta`, `aria-live`) y mensajes de lista vacía por caso en `cliente/app.js`

---

## Phase 5: User Story 3 - Me gusta (P2)

- [X] T014 [US3] `visible_para()` y `me_gusta_reporte()` (alternar, 404 si no visible, 60 por IP y hora, bajo `_db_lock`) en `api/servidor.py`
- [X] T015 [US3] Ruta `POST /api/reportes/{id}/megusta` en `Manejador.do_POST` en `api/servidor.py`
- [X] T016 [US3] `meGusta()` con actualización optimista y reversión, botón con `aria-pressed` en `cliente/app.js`
- [X] T017 [US3] Borrado de la IP de `me_gusta` a las 48 h en `mantenimiento()` en `api/servidor.py`

---

## Phase 6: User Story 4 - Ver la foto en grande (P2)

- [X] T018 [US4] Foto 4:3 diferida en la publicación (solo si `foto: true`) en `cliente/app.js` (`post`)
- [X] T019 [US4] `<dialog id="visor">` con título y botón cerrar en `cliente/index.html`
- [X] T020 [US4] `verFoto()` con `showModal()` y cierre por botón y por fondo en `cliente/app.js`

---

## Phase 7: User Story 5 - Compartir (P2)

- [X] T021 [US5] Fila de compartir (Facebook, WhatsApp, copiar, «Más» con `navigator.share`) con `aria-expanded` en `cliente/app.js` (`post`)
- [X] T022 [US5] Copiar con `navigator.clipboard` y toast de 9 s con el enlace si falla en `cliente/app.js`
- [X] T023 [US5] `pagina_compartida()` con Open Graph, foto solo si está verificado, página genérica si no es público y `meta refresh` a `/#muro/<id>` en `api/servidor.py`
- [X] T024 [US5] `URL_PUBLICA` como base de los enlaces en `api/servidor.py` y `compose.yaml`
- [X] T025 [US5] `location /r/` hacia la API en `cliente/nginx.conf`
- [X] T026 [US5] Enlace profundo `#muro/<id>`: filtro «Todos», resaltado (`destacado`) y centrado en `cliente/app.js` (`iniciar`, `pintarMuro`)

---

## Phase 8: User Story 6 - Ir del muro al mapa (P3)

- [X] T027 [US6] Acción `post-mapa`: abrir el mapa en zoom 17 y la hoja de información en `cliente/app.js`

---

## Phase 9: Pendiente (brechas y mejoras)

- [ ] T028 Contar en el tope de «me gusta» también los quitados (o limitar los cambios por IP), en `api/servidor.py` (`me_gusta_reporte`)
- [X] T029 Revisar `expira` en `visible_para()` y en `pagina_compartida()` para que lo vencido no reciba «me gusta» ni dé vista previa, en `api/servidor.py` — **hecho el 2026-11-09:** `visible_para()` y `pagina_compartida()` miran `expira` (lo propio se sigue viendo)
- [ ] T030 Ocultar «Compartir» (o explicar que no se verá) en publicaciones no públicas: propias en revisión, descartadas o resueltas, en `cliente/app.js` (`post`)
- [X] T031 Armar el enlace para compartir con la URL pública (exponer `URL_PUBLICA` al cliente, p. ej. en `/api/territorio`) en lugar de `location.origin`, en `api/servidor.py` y `cliente/app.js` — **hecho el 2026-11-09:** `/api/territorio` expone `url_publica` y `urlCompartir` la usa
- [ ] T032 Resaltar la publicación también cuando cambia el hash a `#muro/<id>` con la app abierta y no perder el id en `irA()`, en `cliente/app.js`
- [ ] T033 Versión en inglés (o neutra) de la página `/r/<id>` según `Accept-Language`, en `api/servidor.py`
- [X] T034 Quitar el id del teléfono de la URL de las fotos propias: que `GET /api/foto/{id}` acepte la cabecera `X-Dispositivo` (hoy solo lee `?dispositivo=`) en `api/servidor.py`, y pedir la foto con `fetch` + `URL.createObjectURL`, como hace el panel, en `cliente/app.js` — **hecho el 2026-11-09:** foto propia con llave firmada `?k=` (HMAC con `secreto_fotos`), sin el id del teléfono
- [ ] T035 Avisar cuando el reporte del enlace compartido ya no está visible, en `cliente/app.js` (`pintarMuro`)
- [ ] T036 [P] Actualizar `DESIGN.md`: la barra inferior tiene 5 pestañas, no 4
- [ ] T037 Prueba completa en la app levantada con dos teléfonos y el depurador de Facebook (compuerta 6)

---

## Dependencies & Execution Order

- Depende de la spec 004 (tabla `reportes`, `GET /api/reportes`).
- US1 es el MVP; US2–US6 son independientes entre sí.
- T029 y T030 deben decidirse juntos (qué es «público»).

## Notes

- Cambios en `cliente/` → subir `VERSION` en `cliente/sw.js`.
