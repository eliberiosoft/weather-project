---
description: "Tareas del panel del analista (construidas y pendientes)"
---

# Tasks: Panel del analista

**Input**: `specs/008-panel-analista/` (spec.md, plan.md, data-model.md, contracts/api.md)

**Tests**: no se pidieron pruebas automáticas; la verificación es manual con la app levantada o con un servidor aislado (ver plan.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos).
- **[Story]**: US1 ingreso, US2 Situación, US3 Reportes, US4 Reglas y lecturas, US5 Avisos, US6 Ajustes.

---

## Phase 1: Setup

- [X] T001 Crear la carpeta del panel y su página `admin/index.html` con ingreso, pestañas (`role=tab`/`tabpanel`), íconos SVG y toast
- [X] T002 [P] Crear la fuente de estilos `admin/estilos/fuente.css` (tokens `@theme`, semáforo `n0`–`n4`) y generar `admin/estilos.css` con `sh estilos.sh admin`
- [X] T003 [P] Crear `admin/textos-panel.js` con las claves `panel.*` en `es` y `en`

## Phase 2: Foundational

- [X] T004 Esquema SQLite de `niveles_oficiales`, `lecturas`, `reglas`, `avisos` y `ajustes` en `ESQUEMA` / `iniciar_db()` de `api/servidor.py`
- [X] T005 PIN en `cargar_config()` de `api/servidor.py`: generación con `secrets.token_urlsafe(12)`, rotación de PIN < 12 caracteres, `PIN_PANEL` con mínimo de 12, aviso en consola solo al generarlo
- [X] T006 `Manejador._pin_ok()` en `api/servidor.py`: `X-PIN` con `hmac.compare_digest` y espera creciente por IP tras 5 fallos (`_fallos_pin`)
- [X] T007 Enrutado `/api/panel/*` en `do_GET`/`do_POST` de `api/servidor.py` con `401` sin PIN y `POST /api/panel/login`
- [X] T008 Función `api()` en `admin/panel.js` que añade `X-PIN`, convierte errores en toasts y llama a `salir()` ante `401`
- [X] T009 Escuchador delegado de clics por `data-accion` en `admin/panel.js` (sin `onclick` en línea)

## Phase 3: User Story 1 - Entrar con el PIN (P1) 🎯 MVP

- [X] T010 [US1] `entrar()`, `salir()` y entrada automática con `sessionStorage["ay_pin"]` en `admin/panel.js`
- [X] T011 [US1] Refresco de Situación y contador de pendientes cada 60 s en `admin/panel.js`

## Phase 4: User Story 2 - Situación y nivel verificado (P1)

- [X] T012 [US2] `GET /api/panel/estado` con `?forzar=1` sobre `calcular_estado()` en `api/servidor.py`
- [X] T013 [US2] `panel_nivel()` en `api/servidor.py`: ámbito, nivel 1–4 o `null`, motivo obligatorio, fila nueva en `niveles_oficiales`
- [X] T014 [US2] `oficiales()` y precedencia recinto > parroquia > río > cantón en `evaluar_punto()` de `api/servidor.py`
- [X] T015 [US2] `pintarSituacion()` en `admin/panel.js`: cantón, ríos (pleamar, fuente, motivo técnico con `I18N.motivo`) y recintos ≥ VIGILANCIA o con verificado
- [X] T016 [US2] `fijar()` con motivo obligatorio y confirmación de RESPUESTA en `admin/panel.js`
- [X] T017 [US2] Conservar niveles y motivos sin fijar al repintar (`pendientesSituacion`, `reponerPendientes`) en `admin/panel.js`

## Phase 5: User Story 3 - Revisar reportes (P1)

- [X] T018 [US3] `panel_reportes()` en `api/servidor.py`: filtro por estado, 300 máx., dispositivo recortado, sin IP
- [X] T019 [US3] `panel_revisar()` en `api/servidor.py`: estados permitidos, nota ≤ 300, `revisado_en`, borrado de la foto al descartar
- [X] T020 [US3] Acceso a `GET /api/foto/<id>` con `X-PIN` en `api/servidor.py` y carga como `blob:` en `pintarReportes()` de `admin/panel.js`
- [X] T021 [US3] Filtro `#f-estado`, tarjetas de reporte, nota del analista y botones Validar / Resuelto / Descartar en `admin/panel.js`

## Phase 6: User Story 4 - Reglas y lecturas (P2)

- [X] T022 [US4] `panel_lectura()` y `panel_regla()` en `api/servidor.py`
- [X] T023 [US4] `nivel_regla()` en `api/servidor.py`: lectura ≤ 12 h, distancia al borde, subida en 24 h y velocidad por hora
- [X] T024 [US4] Prioridad de lo medido sobre GloFAS (salvo RESPUESTA de GloFAS → al menos PREPARACIÓN) en `calcular_estado()` de `api/servidor.py`
- [X] T025 [US4] Lector del formato WhatsApp `P05 | 21-oct 06:00 | 3,45 m | sube | lluvia sí` (`#l-pegar`) en `admin/panel.js`
- [X] T026 [US4] Tabla de bordes por punto y últimas 40 lecturas (`pintarReglas`, `guardarBorde`) en `admin/panel.js`

## Phase 7: User Story 5 - Avisos (P2)

- [X] T027 [US5] `panel_aviso()` con validación y anti-saturación bajo el candado de la base, y `panel_anular_aviso()` con `404` si no existe, en `api/servidor.py`
- [X] T028 [US5] Formulario de aviso con selector de ámbito (`llenarSelects`), lista de publicados y «Anular» con confirmación en `admin/panel.js`

## Phase 8: User Story 6 - Ajustes (P3)

- [X] T029 [US6] `panel_ajustes_get()` / `panel_ajustes_post()`, `advertencia_vigente()` y `aguaje_vigente()` en `api/servidor.py`
- [X] T030 [US6] Formulario de advertencia INAMHI y aguaje, e historial de niveles verificados (`pintarAjustes`, `pintarHistorial`) en `admin/panel.js`

## Phase 9: Despliegue y endurecimiento

- [X] T031 [P] Servicio `admin` en `compose.yaml`, solo en `127.0.0.1:${PUERTO_ADMIN:-8091}`
- [X] T032 [P] `admin/nginx.conf` (pasa `/api/` a `api:8080`, timeouts 20 s) y `admin/seguridad.conf` (CSP sin externos, `noindex`, `no-referrer`)
- [X] T033 [P] `admin/Dockerfile`: Tailwind con huella sha256 verificada, copia de `compartido/i18n.js` e íconos del cliente
- [X] T034 [P] `location = /api/panel` y `location ^~ /api/panel/` con `404` en `cliente/nginx.conf`
- [X] T035 Repintado al cambiar de idioma sin perder lo elegido (`window.addEventListener("idioma", …)`) en `admin/panel.js`

---

## Phase 10: Pendiente (brechas y mejoras)

- [X] T036 [US5] Corregir B-01: renombrar la variable `t` del manejador de `#a-publicar` en `admin/panel.js` a `ambito` (hecho el 2026-11-09; falta probarlo, ver T049)
- [X] T037 [US6] Validar `advertencia.hasta` (ISO con zona) y `aguaje.hasta` (`AAAA-MM-DD`) en `panel_ajustes_post()` de `api/servidor.py` y responder `400` si no son válidos (B-02) — **hecho el 2026-11-09:** fechas validadas en `panel_ajustes_post` (400 si no son válidas)
- [X] T038 Aceptar el sufijo `Z` en `leer_iso()` de `api/servidor.py` (reemplazarlo por `+00:00`) para funcionar en Python 3.10 (B-03) — **hecho el 2026-11-09:** `leer_iso` acepta `Z` y asume la zona de Ecuador si falta
- [ ] T039 [US6] Decidir y alinear el aguaje (B-04): aplicar `sugerido_pleamar` solo en la ventana de ±2 h de la pleamar, o corregir `panel.aj.aguaje_explica` en `admin/textos-panel.js` (es/en)
- [X] T040 Responder `400` (no `500`) a `nivel_cod`, `borde_m` y `hora` mal formados; rechazar `lectura_m` no finita, horas futuras y `ambito_id` inexistente en `api/servidor.py` (B-05) — **hecho el 2026-11-09:** datos mal formados en cualquier POST → 400 genérico (falta rechazar `nan`, horas futuras y `ambito_id` inexistente)
- [ ] T041 [P] Traducir `oficial_fuente`, `ambito_tipo` del historial y `ambito_nombre`, y mapear los errores de la API a claves `panel.*` en `admin/panel.js` y `admin/textos-panel.js` (B-06)
- [X] T042 [P] [US1] Quitar `inputmode="numeric"` del campo `#pin` en `admin/index.html` (B-07) y mostrar «PIN incorrecto» sin recargar la página en `admin/panel.js` — **hecho el 2026-11-09:** `#pin` sin `inputmode=numeric`, fuente monoespaciada
- [X] T043 [P] [US1] Corregir `panel.login.texto` en `admin/textos-panel.js` (es/en): el PIN se muestra solo al generarse (B-08) — **hecho el 2026-11-09:** `panel.login.texto` corregido en es/en
- [ ] T044 [US2] Agregar al panel un control para fijar el nivel verificado de una parroquia, o documentar que solo se fija por API (FR-009)
- [ ] T045 [US5] Decidir si `forzar` sigue en `panel_aviso()`; si se mantiene, documentarlo en README y `panel.av.reglas`
- [ ] T046 Hacer que «Recalcular con datos nuevos» pida datos frescos a Open-Meteo, o cambiar el texto del botón (B-10)
- [ ] T047 Autenticación individual del analista (Cloudflare Access o cuentas) en vez de un PIN compartido (`docs/seguridad.md`)
- [X] T048 Pasar `impeccable detect` sobre `admin/index.html` y `admin/panel.js` hasta 0 hallazgos y dejar constancia (compuerta 1) — **hecho el 2026-11-09:** `impeccable detect` sobre `admin/`: 0 hallazgos
- [ ] T049 Probar el panel completo en la app levantada (360 px y escritorio, consola sin errores) con un servidor aislado y dejar constancia (compuerta 6)
