---
description: "Tareas (as-built) del semáforo de «Mi lugar»"
---

# Tasks: Semáforo de «Mi lugar»

**Input**: `/specs/002-semaforo-mi-lugar/` (spec.md, plan.md, data-model.md, contracts/api.md)

**Tests**: no se pidieron pruebas automáticas; la verificación es manual con la app levantada (principio VII).

**Organización**: las tareas marcadas `[X]` describen lo que ya está construido; las `[ ]` del final son brechas y mejoras pendientes.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Constantes del semáforo (`NIVELES`, `COLORES`, `DIST_RIO_M`, `RIOS_MAREA`, `CABECERAS`, `ACCIONES`) en `api/servidor.py`
- [X] T002 Umbrales de lluvia y tiempos de caché en `CONFIG_DEF` y `cargar_config()` de `api/servidor.py` (se guardan en `config.json`)
- [X] T003 [P] Capas que usa el cálculo exportadas a WGS84 con 6 decimales por `preparar_capas.py` en `compartido/capas/` (`recintos`, `rios`, `puntos_control`, `parroquias`, `equipamientos`, `calles`, `limite_canton`)

---

## Phase 2: Foundational

- [X] T004 Tablas `niveles_oficiales`, `lecturas`, `reglas`, `ajustes`, `cache` en `ESQUEMA` e `iniciar_db()` de `api/servidor.py`
- [X] T005 Geometría sin dependencias (`dist_m`, `dist_punto_lineas`, `punto_en_poligono`, `celda_de`) en `api/servidor.py`
- [X] T006 Clase `Territorio` (recintos con río cercano, distancia y celda; parroquias; puntos; equipamientos; calles agrupadas para el buscador; `bbox`) en `api/servidor.py`
- [X] T007 Caché de datos externos con respaldo sin red (`con_cache`, `lluvia_celdas`, `glofas_punto`, modo `--offline`) en `api/servidor.py`
- [X] T008 Motivos estructurados `M()`, `unir()`, `sin_es()` en `api/servidor.py`

**Checkpoint**: la API arranca, carga el territorio y baja (o lee de caché) lluvia y GloFAS.

---

## Phase 3: User Story 1 - Ver el nivel de mi recinto y qué hacer (P1) 🎯 MVP

- [X] T009 [US1] Nivel GloFAS por punto con 51 escenarios y probabilidades a 3 y 30 días (`nivel_glofas`) en `api/servidor.py`
- [X] T010 [US1] Nivel medido por regla limnimétrica (`nivel_regla`) en `api/servidor.py`
- [X] T011 [US1] Lluvia por celda y su nivel (`lluvia_resumen`, `lluvia_en`, `nivel_lluvia`) en `api/servidor.py`
- [X] T012 [US1] Advertencia INAMHI, aguaje, niveles verificados y reportes graves verificados (`advertencia_vigente`, `aguaje_vigente`, `oficiales`, `reportes_graves_validados`) en `api/servidor.py`
- [X] T013 [US1] Nivel por río, por recinto y del cantón con caché de 120 s (`evaluar_punto`, `calcular_estado`, `invalidar_estado`) en `api/servidor.py`
- [X] T014 [US1] Rutas `GET /api/estado`, `GET /api/territorio` y `GET /api/recinto` en `Manejador._api_get` de `api/servidor.py`
- [X] T015 [P] [US1] Estructura de «Mi lugar» (`#banners`, `#form-lugar`, `#lista-lugares`, `#sin-lugar` con la guía de niveles, `#con-lugar`, `#mosaico`, `#acciones`, botón ECU 911, `#aviso-oficial`) en `cliente/index.html`
- [X] T016 [US1] Buscador de lugares (`armarBuscador`, `buscarLugar`, `elegirPorTexto`) en `cliente/app.js`
- [X] T017 [US1] Nivel efectivo y ficha del nivel con sello, motivo, escala y escena (`nivelEfectivo`, `banda`, `escena`, `olas`) en `cliente/app.js`
- [X] T018 [US1] Pintado del lugar con nombre, subtítulo y «Qué hacer ahora» desde `acciones.{n}` (`pintarLugar`, `cargarLugar`) en `cliente/app.js`
- [X] T019 [P] [US1] Textos `nivel.*`, `acciones.*` en `compartido/i18n.js` y `app.sinlugar.*`, `app.guia.*`, `app.banda.*`, `app.ambito.*`, `app.no_oficial` en `cliente/textos-app.js` (es y en)

**Checkpoint**: elegir un recinto muestra su nivel, su origen y qué hacer.

---

## Phase 4: User Story 2 - Ver el nivel donde estoy con el GPS (P1)

- [X] T020 [US2] Detalle de un punto libre con nivel verificado del recinto a ≤ 1,5 km (`estado_lugar`) en `api/servidor.py`
- [X] T021 [US2] Ruta `GET /api/lugar` con validación de `lat`/`lon` y del rectángulo del cantón en `api/servidor.py`
- [X] T022 [US2] Botón GPS: `ubicar()` + `tramoCercano(lat, lon, 60)` para nombrar la calle y `cargarLugar({tipo: "punto", gps: true})` en `cliente/app.js`
- [X] T023 [US2] Mensajes de error de ubicación (`app.err.sin_gps`, `app.err.gps`) en `cliente/textos-app.js`

---

## Phase 5: User Story 3 - Entender de dónde sale el nivel (P2)

- [X] T024 [US3] Traducción de motivos estructurados en palabras de vecino (`I18N.motivo`, `motivoVecino`, claves `vecino.*` y `motivo.*`) en `compartido/i18n.js`
- [X] T025 [US3] Banners de advertencia INAMHI, aguaje y sin conexión (`pintarBanners`) en `cliente/app.js`
- [X] T026 [US3] Ficha de tres casillas (lluvia 24 h, lluvia 3 días, distancia al río) en `pintarLugar` de `cliente/app.js`
- [X] T027 [US3] Curva de lluvia de 6 días con escala fija 0–120 mm y umbrales 50/100 mm (`graficaLluvia`) en `cliente/app.js`
- [X] T028 [US3] Ficha del río con placa de nivel, medidor GloFAS frente a P90/Q2/Q5 y lectura de regla (`medidorRio`, `lecturaRegla`) en `cliente/app.js`
- [X] T029 [US3] «Cerca de ti» (3 equipamientos, nota de albergues, prioridad y riesgo base) y reportes cercanos a ≤ 3 km (`pintarReportesCerca`) en `cliente/app.js`

---

## Phase 6: User Story 4 - Sin señal y en mi idioma (P2)

- [X] T030 [US4] Guardado de `ay_lugar`, `ay_ultimo_lugar_det`, `ay_estado_cache`, `ay_territorio` y respaldo al fallar la red (`cargarLugar`, `cargarEstado`, `iniciar`) en `cliente/app.js`
- [X] T031 [US4] Migración del formato viejo `ay_recinto` en `iniciar()` de `cliente/app.js`
- [X] T032 [US4] Refresco cada 5 minutos de estado, lugar, avisos y capas en `iniciar()` de `cliente/app.js`
- [X] T033 [US4] Repintado al cambiar de idioma (evento `idioma`) en `cliente/app.js`
- [X] T034 [US4] Fecha y «actualizado hace…» (`pintarFecha`) en `cliente/app.js`

---

## Phase 7: Pendientes (brechas y mejoras)

- [ ] T035 [US1] Mostrar «Sin dato» (`nivel.0`) cuando no hay datos de modelo ni lluvia en lugar de NORMAL: que `evaluar_punto` en `api/servidor.py` devuelva `sugerido = null` (o un motivo `sin_datos`) y que `pintarLugar` en `cliente/app.js` no use `ef.n || 1` (Brecha 1)
- [ ] T036 [US3] Mostrar la edad de los datos de modelo usando `fuentes.lluvia_desactualizada` y `puntos[*].glofas.desactualizado` en `cliente/app.js` (Brecha 2)
- [ ] T037 [US3] Propagar `src`/`fuente_sugerido` del río al motivo `rio_cerca` del recinto en `evaluar_punto` (`api/servidor.py`) y decidir si el sello distingue modelo, medido y reportes (Brecha 3; requiere aclaración)
- [ ] T038 [US3] En la ficha del río, usar el punto que fija el nivel (o mostrar todos) en vez de `rio.puntos[0]` en `pintarLugar` de `cliente/app.js` (Brecha 4)
- [X] T039 [US1] Filtrar los avisos de un punto GPS o calle por su recinto más cercano en `cargarAvisos` de `cliente/app.js` o en `avisos_para` de `api/servidor.py` (Brecha 5; requiere aclaración) — **hecho el 2026-11-09:** con un punto GPS o una calle se piden los avisos del recinto más cercano (≤ 3 km) en `cargarAvisos`
- [ ] T040 [US2] Decidir si la ubicación GPS puede ir en la URL de `/api/lugar`; si no, pasarla a un `POST` o a cabeceras y excluir esa ruta de la caché del service worker (Brecha 6; requiere aclaración)
- [ ] T041 [P] Aligerar `/api/estado` para el ciudadano (sin `serie_15d`/`fechas_15d`) o corregir el comentario de `_api_get` en `api/servidor.py` (Brecha 7)
- [ ] T042 [P] Quitar `ACCIONES` de las respuestas de la API o documentar que el cliente no lo usa, en `api/servidor.py` (Brecha 8)
- [ ] T043 Bajar GloFAS de los 9 puntos en paralelo o fuera de `_estado_lock` en `calcular_estado` de `api/servidor.py` (Brecha 9)
- [ ] T044 [US4] Guardar el último detalle por lugar (no uno solo) en `cargarLugar` de `cliente/app.js` (Brecha 10)
- [ ] T045 [P] Traducir los errores de la API: devolver una clave (`{"error": …, "k": …}`) y mapearla en `cliente/textos-app.js` (Brecha 11)
- [ ] T046 Correr `impeccable detect` sobre `cliente/index.html` y `cliente/app.js` tras el traslado desde `web/` y dejar constancia (compuerta 1)

---

## Dependencies & Execution Order

- Fase 2 depende de la 1; US1 depende de la 2; US2 reutiliza `evaluar_punto` de US1; US3 y US4 dependen de US1.
- Pendientes: T035 y T037 tocan `evaluar_punto` (hacer en el mismo cambio); T040 afecta también a `cliente/sw.js` (ver `specs/011-pwa-sin-conexion/`) y obliga a subir `VERSION`.
