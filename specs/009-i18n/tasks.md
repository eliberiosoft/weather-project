---
description: "Tareas de idiomas (construidas y pendientes)"
---

# Tasks: Idiomas (i18n es/en)

**Input**: `specs/009-i18n/` (spec.md, plan.md, data-model.md, contracts/api.md)

**Tests**: no se pidieron pruebas automáticas; la verificación es manual (ver plan.md).

## Format: `[ID] [P?] [Story] Description`

- **[Story]**: US1 app en su idioma, US2 panel en su idioma, US3 motivos traducidos, US4 agregar textos.

---

## Phase 1: Foundational (motor)

- [X] T001 Crear el motor `compartido/i18n.js` (IIFE) con `IDIOMAS` (es, en), `LOCALE` (es-EC, en-US), `agregar`, `t`, `lista`, `existe`, `locale`, `fecha`
- [X] T002 `aplicar()` en `compartido/i18n.js`: `data-i18n`, `data-i18n-html`, `data-i18n-attr`, `data-i18n-titulo`, `data-i18n-desc`, `<html lang>` y `select[data-idioma]` (con modo `corto`)
- [X] T003 `cambiar()` con persistencia en `localStorage["ay_idioma"]` y evento `idioma` en `compartido/i18n.js`
- [X] T004 Idioma inicial: `ay_idioma` → `navigator.language` → `es` en `compartido/i18n.js`
- [X] T005 Textos comunes en `compartido/i18n.js`: niveles, tipos, gravedad, altura, estados y acciones por nivel (es/en)
- [X] T006 [P] Copiar `compartido/i18n.js` a la raíz servida en `cliente/Dockerfile` y `admin/Dockerfile`; segunda raíz `compartido/` en `--estaticos`/`--admin` de `api/servidor.py`

## Phase 2: User Story 1 - App en su idioma (P1) 🎯 MVP

- [X] T007 [US1] Diccionario `cliente/textos-app.js` (claves `app.*`, es/en)
- [X] T008 [US1] Marcar todos los textos de `cliente/index.html` con `data-i18n*` y `<html data-i18n-titulo data-i18n-desc>`
- [X] T009 [US1] Selector `#idioma` (`data-idioma="corto"`) con etiqueta `idioma.etq` en la barra de `cliente/index.html`
- [X] T010 [US1] Textos que arma `cliente/app.js` con `I18N.t` (`t`, `NIV`, `ALT`), fechas con `I18N.fecha`/`I18N.locale` y `I18N.aplicar()` al arrancar
- [X] T011 [US1] Repintado en el evento `idioma` en `cliente/app.js` (banners, lugar, avisos, muro, asistente, capas, hoja de información)
- [X] T012 [US1] Incluir `i18n.js` y `textos-app.js` en `BASE` de `cliente/sw.js` para uso sin conexión

## Phase 3: User Story 2 - Panel en su idioma (P2)

- [X] T013 [US2] Diccionario `admin/textos-panel.js` (claves `panel.*`, es/en)
- [X] T014 [US2] `data-i18n*` y selector `#idioma` en `admin/index.html`
- [X] T015 [US2] Repintado sin red y sin perder lo elegido en el evento `idioma` de `admin/panel.js`

## Phase 4: User Story 3 - Motivos traducidos (P1)

- [X] T016 [US3] `M()`, `unir()` y `sin_es()` en `api/servidor.py`; motivos estructurados en `nivel_glofas`, `nivel_regla`, `nivel_lluvia`, `evaluar_punto` y `calcular_estado`
- [X] T017 [US3] `I18N.motivo()` (modo técnico, agrupado por punto y fuente) en `compartido/i18n.js`
- [X] T018 [US3] `motivoVecino()` (frases llanas, sin repetidos, con fuentes) en `compartido/i18n.js`
- [X] T019 [US3] Claves `motivo.*`, `motivo.src.*`, `vecino.*`, `vecino.src.*`, `fuente.*` en es/en en `compartido/i18n.js`
- [X] T020 [P] [US3] Usar `I18N.motivo(obj, { vecino: true })` en `cliente/app.js` y `I18N.motivo(obj)` en `admin/panel.js`

## Phase 5: User Story 4 - Regla «nunca texto directo» (P2)

- [X] T021 [US4] Documentar el uso del motor en la cabecera de `compartido/i18n.js` y en `README.md` («Estilos e idiomas»)
- [X] T022 [US4] Incluir la regla en `.specify/memory/constitution.md` (principio IV) y en `PRODUCT.md`

---

## Phase 6: Pendiente (brechas y mejoras)

- [ ] T023 [US3] Alinear el contrato de motivos (G-01): corregir el principio IV de `.specify/memory/constitution.md` a `{k, v, src?, pid?}` + `motivo` en español, o enviar `es` dentro de cada motivo en `api/servidor.py`
- [ ] T024 [P] [US4] Corregir la documentación vieja (G-02): `README.md` y `PRODUCT.md` sobre los motivos, y la ruta `web/i18n.js` del comentario de `M()` en `api/servidor.py`
- [ ] T025 [US1] Errores de la API traducibles (G-03): enviar un código estable además de `error` (p. ej. `{"error": "…", "k": "error.foto_grande"}`) desde `api/servidor.py` y traducirlo en `cliente/app.js` y `admin/panel.js`
- [ ] T026 [P] [US1] Traducir en el cliente las etiquetas de cabecera (`CABECERAS`) y `ambito_nombre` («Todo el cantón») con claves en `cliente/textos-app.js` en vez de mostrar el texto del servidor
- [ ] T027 [P] [US1] Mandar siempre `nombre` a `/api/lugar` o armar «Cerca de …» en el cliente con una clave `app.*`
- [ ] T028 [US4] Script de comprobación de claves (es = en y claves usadas definidas) para correr antes de cada cambio, p. ej. en `estilos.sh` o un `herramientas/claves.js` (G-04)
- [ ] T029 [US1] Decidir la zona horaria de las fechas (G-05): `timeZone: "America/Guayaquil"` en `I18N.fecha` de `compartido/i18n.js`
- [ ] T030 [US1] Página `/r/<id>` (`pagina_compartida` en `api/servidor.py`) en el idioma de quien comparte, o al menos con la descripción en los dos idiomas
- [ ] T031 Probar el cambio de idioma en la app levantada (360 px y escritorio, consola sin `[i18n] falta la clave`) y dejar constancia (compuerta 6)
