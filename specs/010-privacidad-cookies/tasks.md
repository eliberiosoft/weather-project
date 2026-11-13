---
description: "Tareas de privacidad y cookies (construidas y pendientes)"
---

# Tasks: Privacidad y cookies

**Input**: `specs/010-privacidad-cookies/` (spec.md, plan.md, data-model.md, contracts/api.md)

**Tests**: no se pidieron pruebas automáticas; la verificación es manual (ver plan.md).

## Format: `[ID] [P?] [Story] Description`

- **[Story]**: US1 aviso de una vez, US2 política, US3 borrar datos, US4 consentimiento, US5 plazos en el servidor.

---

## Phase 1: Foundational

- [X] T001 `almacen` con prefijo `ay_` y try/catch (modo privado) en `cliente/app.js`
- [X] T002 Id del teléfono con `crypto.randomUUID` / `crypto.getRandomValues` (sin `Math.random`) en `idDispositivo()` de `cliente/app.js`
- [X] T003 Cabecera `X-Dispositivo` en `api()` de `cliente/app.js` y lectura en `GET /api/reportes` de `api/servidor.py`
- [X] T004 Registro de la API sin query en `Manejador.log_message()` de `api/servidor.py`

## Phase 2: User Story 4 - Consentimiento al reportar (P1) 🎯 MVP

- [X] T005 [US4] Rechazo de reportes sin `consentimiento: true` en `crear_reporte()` de `api/servidor.py`
- [X] T006 [US4] Casilla `#consent` obligatoria en el paso 5 del asistente, con enlace a `#privacidad`, en `cliente/index.html` y `pasoListo(5)`/`enviarReporte()` de `cliente/app.js`
- [X] T007 [US4] Casilla `#hoja-ok` en la hoja de calle inundada y recuerdo con `ay_consent_ok` en `cliente/index.html` y `cliente/app.js`
- [X] T008 [P] [US4] Textos `app.rep.consent`, `app.consent.calle` y `app.val.consent` (es/en) en `cliente/textos-app.js`

## Phase 3: User Story 5 - Plazos en el servidor (P1)

- [X] T009 [US5] `limpiar_fotos_viejas()` (90 días) al arrancar, en `api/servidor.py`
- [X] T010 [US5] Hilo `mantenimiento()` cada 6 h: fotos de 90 días e `ip = NULL` a las 48 h en `reportes`, `confirmaciones` y `me_gusta`, en `api/servidor.py`
- [X] T011 [US5] Columna `ip` en `confirmaciones` y `me_gusta` (migración en `iniciar_db()` de `api/servidor.py`)
- [X] T012 [US5] Borrado de la foto al descartar en `panel_revisar()` de `api/servidor.py`
- [X] T013 [US5] Fotos de otros solo verificadas: `reporte_publico()`, `GET /api/foto/<id>` y `og:image` de `pagina_compartida()` en `api/servidor.py`
- [X] T014 [P] [US5] No guardar `/api/foto` en la caché del service worker (`cliente/sw.js`)
- [X] T014b [US5] Llave firmada `?k=` para las fotos propias (`llave_foto()`, `secreto_fotos` en `cargar_config()`, `foto_k` en `reporte_publico()`) en `api/servidor.py` y `urlFoto()` en `cliente/app.js`, para no poner el id del teléfono en la URL

## Phase 4: User Story 2 - Política (P1)

- [X] T015 [US2] Vista `#v-privacidad` con secciones resp, cookies, local, cache, terceros, reportes, derechos y borrar en `cliente/index.html`
- [X] T016 [US2] Ruta `#privacidad` en `irA()`, el escuchador de `hashchange` e `iniciar()` de `cliente/app.js`
- [X] T017 [US2] Enlace «Privacidad y cookies» bajo el aviso «No es un canal oficial» de Inicio en `cliente/index.html`
- [X] T018 [P] [US2] Textos `app.priv.*` (es/en) en `cliente/textos-app.js`

## Phase 5: User Story 1 - Aviso de una vez (P1)

- [X] T019 [US1] Aviso `#aviso-cookies` con «Entendido» y «Ver la política» sobre la barra inferior en `cliente/index.html`
- [X] T020 [US1] Mostrarlo en `iniciar()` si falta `ay_aviso_cookies` (salvo en `#privacidad`) y ocultarlo con `#cookies-ok` o al abrir la política, en `cliente/app.js`

## Phase 6: User Story 3 - Borrar los datos del teléfono (P2)

- [X] T021 [US3] Botón `#borrar-datos` con confirmación en dos toques (clase `confirmar`, 5 s) en `cliente/index.html` y `cliente/app.js`
- [X] T022 [US3] Borrado de claves `ay_*`, cachés y service workers, y recarga sin hash en `cliente/app.js`
- [X] T023 [US3] Subir `VERSION` de `cliente/sw.js` (hoy `v1.6`)

---

## Phase 7: Pendiente (brechas y mejoras)

- [ ] T024 [US2] Agregar el correo de contacto del proyecto en `app.priv.derechos.c` (es/en) de `cliente/textos-app.js` (P-01) y subir `VERSION` en `cliente/sw.js`
- [ ] T025 [US2] Revisión legal (LOPDP) de la política y de los textos de consentimiento; actualizar `app.priv.fecha` al publicar los cambios (P-02)
- [X] T026 [US5] Desactivar o recortar el `access_log` de nginx en `cliente/nginx.conf` y `admin/nginx.conf` (sin query y sin IP, o con rotación ≤ 48 h), o declararlo en la política (PR-01) — **hecho el 2026-11-09:** nginx registra con `log_format privado` (sin IP ni query)
- [ ] T027 [US5] Sacar la ubicación GPS de la URL de `/api/lugar` (POST o cabecera) en `cliente/app.js` y `api/servidor.py` (PR-02)
- [ ] T028 [US5] Definir el plazo de conservación de los reportes y los votos, implementarlo en `mantenimiento()` de `api/servidor.py` y decirlo en `app.priv.reportes.c` (PR-03)
- [ ] T029 [P] [US2] Completar `app.priv.local.c` (es/en) con el consentimiento recordado y los avisos vistos/notificados (PR-04)
- [ ] T030 [P] [US4] Enlazar la política desde la casilla `#hoja-ok` de la hoja de calle inundada en `cliente/index.html` (PR-05)
- [ ] T031 [US4] Confirmar con la revisión legal si el consentimiento recordado (`ay_consent_ok`) vale para los reportes siguientes de calle inundada; si no, pedirlo cada vez (FR-008)
- [ ] T032 [US3] Al cambiar de idioma con el botón en `confirmar`, reponer también su estado (quitar `confirmar`) o el texto de confirmación, en el escuchador de `idioma` de `cliente/app.js`
- [ ] T033 [US1] Mostrar el aviso de una vez aunque falle la primera carga del territorio (mover la comprobación antes del `return` de `iniciar()` en `cliente/app.js`)
- [X] T034 [US4] Avisar si un reporte encolado no cabe en `localStorage` y encolarlo sin foto (`encolar()` y `avisoCola()` de `cliente/app.js`, claves `app.toast.cola_sin_foto`, `app.toast.cola_llena`, `app.toast.cola_rechazados`; hecho el 2026-11-09)
- [ ] T035 [US5] Ruta o procedimiento documentado para que una persona pida borrar un reporte suyo (con su id de teléfono) (PR-06)
- [ ] T036 Pasar `impeccable detect` sobre `cliente/index.html` (vista y aviso) hasta 0 hallazgos y probar a 360 px y en escritorio con consola limpia (compuertas 1 y 6)
