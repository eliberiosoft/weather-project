---
description: "Tareas (as-built) de la PWA y el uso sin conexión"
---

# Tasks: PWA instalable y uso sin conexión

**Input**: `/specs/011-pwa-sin-conexion/` (spec.md, plan.md, data-model.md)

**Tests**: no se pidieron pruebas automáticas; verificación manual en Chrome con DevTools.

**Organización**: `[X]` = construido; `[ ]` = pendiente (brechas y mejoras).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 [P] Íconos `icono.svg`, `favicon-32.png`, `icono-192.png`, `icono-512.png`, `icono-maskable-512.png`, `icono-apple-180.png` en `cliente/`
- [X] T002 [P] Manifiesto con nombre, colores, `standalone`, `portrait` e íconos en `cliente/manifest.webmanifest`
- [X] T003 Enlaces al manifiesto, favicons, `apple-touch-icon` y `theme-color` en `<head>` de `cliente/index.html`
- [X] T004 Cabeceras de caché: `sw.js` con `no-cache, no-store`, el resto y las capas con `no-cache`, y `application/manifest+json` en `cliente/nginx.conf`
- [X] T005 CSP con `worker-src 'self'` y `manifest-src 'self'` en `cliente/seguridad.conf` y `CABECERAS_SEG` de `api/servidor.py`

---

## Phase 2: Foundational

- [X] T006 Service worker con `VERSION` y lista `BASE` (app, capas, Leaflet) en `cliente/sw.js`
- [X] T007 `install` con `addAll(BASE)` y `skipWaiting`; `activate` que borra cachés viejas salvo `ay-teselas` y hace `clients.claim` en `cliente/sw.js`
- [X] T008 Registro del service worker en `cliente/app.js`
- [X] T009 Envoltorio `almacen` de `localStorage` con `try/catch` y prefijo `ay_` en `cliente/app.js`

**Checkpoint**: el service worker se instala y precarga la app.

---

## Phase 3: User Story 1 - Abrir sin señal (P1) 🎯 MVP

- [X] T010 [US1] Estrategia «red primero, copia si falla o tarda 3,5 s» para archivos en `fetch` de `cliente/sw.js`
- [X] T011 [US1] Estrategia «red primero, copia sin red» para `/api/*` (sin tocar `/api/foto`) en `fetch` de `cliente/sw.js`
- [X] T012 [US1] Respaldos `ay_territorio`, `ay_estado_cache`, `ay_ultimo_lugar_det`, `ay_avisos_cache` en `iniciar`, `cargarEstado`, `cargarLugar`, `cargarAvisos` de `cliente/app.js`
- [X] T013 [US1] Banner sin conexión (`pintarBanners`), indicador `#chip-red` y eventos `online`/`offline` en `cliente/app.js` y `cliente/index.html`
- [X] T014 [P] [US1] Textos `app.ban.offline`, `app.red.no`, `app.toast.offline_lugar`, `app.toast.sin_servidor` en `cliente/textos-app.js` (es y en)

---

## Phase 4: User Story 2 - Reportes sin señal (P1)

- [X] T015 [US2] Cola `ay_cola_reportes` al fallar con `navigator.onLine` falso (`encolar`, `enviarReporte`, `#hoja-enviar`) en `cliente/app.js`
- [X] T016 [US2] Reenvío al arrancar y en `online` con aviso del total (`enviarCola`) en `cliente/app.js`
- [X] T017 [P] [US2] Textos `app.toast.cola`, `app.toast.cola_enviados` en `cliente/textos-app.js` (es y en)

---

## Phase 5: User Story 3 - Mapa sin señal (P2)

- [X] T018 [US3] Caché `ay-teselas` «caché primero» para OSM y Esri en `fetch` de `cliente/sw.js`
- [X] T019 [US3] Las 11 capas en `BASE` de `cliente/sw.js`
- [X] T020 [US3] Aviso único de teselas (`tileerror`, `app.toast.teselas`) en `cliente/app.js`

---

## Phase 6: User Story 4 - Instalar y recibir avisos (P2)

- [X] T021 [US4] Notificaciones locales con `showNotification` desde el service worker y horas de silencio (`pintarAvisos`, `enSilencio`, `#btn-notif`) en `cliente/app.js`
- [X] T022 [US4] `notificationclick` que enfoca la app o abre `./#avisos` en `cliente/sw.js`

---

## Phase 7: User Story 5 - Versión nueva y borrado (P3)

- [X] T023 [US5] Regla de subir `VERSION` en cada despliegue (comentario en `cliente/sw.js`, constitución y README) — hoy `v1.6`
- [X] T024 [US5] «Borrar los datos de este teléfono» con doble toque: `ay_*`, cachés y registro del SW (`#borrar-datos`) en `cliente/app.js`
- [X] T025 [P] [US5] Textos `app.priv.cache.*`, `app.priv.borrar.*`, `app.priv.local.*` en `cliente/textos-app.js` (es y en)

---

## Phase 8: Pendientes (brechas y mejoras)

- [X] T026 [US1] Guardar en caché solo respuestas `r.ok` de `/api/*` en `cliente/sw.js` (Brecha 1) — **hecho el 2026-11-09:** solo `r.ok` se guarda
- [X] T027 [US1] Limitar las cachés: no guardar `/api/lugar` por coordenadas (o normalizar la clave) y poner tope de entradas a `ay-teselas` en `cliente/sw.js` (Brecha 2) — **hecho el 2026-11-09:** `ay-teselas` con tope de 1500 (falta `/api/lugar`)
- [X] T028 [US2] Encolar cualquier fallo de red (`TypeError` de `fetch`), no solo con `navigator.onLine` falso, en `enviarReporte` y `#hoja-enviar` de `cliente/app.js` (Brecha 3) — **hecho el 2026-11-09:** `falloDeRed()`
- [X] T029 [US2] En `enviarCola`, conservar los fallos de red y 5xx/429 para reintentar, descartar solo 4xx definitivos avisando cuántos, y contar bien los enviados en `cliente/app.js` (Brecha 4) — **hecho el 2026-11-09:** reintenta 429/5xx, avisa los 4xx
- [X] T030 [US2] Detectar que la cola no cupo en `localStorage` (que `almacen.set` devuelva éxito) y avisar, o guardar la cola en IndexedDB, en `cliente/app.js` (Brecha 5) — **hecho el 2026-11-09:** `encolar()` comprueba que se guardó
- [ ] T031 [US2] Enviar la hora del teléfono en el cuerpo del reporte encolado y usarla (acotada) para `creado`/`expira` en `crear_reporte` de `api/servidor.py` (Brecha 6)
- [ ] T032 [P] [US2] Evaluar Background Sync para vaciar la cola sin la app abierta en `cliente/sw.js` (Brecha 7)
- [ ] T033 [US1] Marcar los datos servidos desde caché (cabecera propia en la respuesta del SW o comparar `generado`) para encender `#chip-red` en `cliente/sw.js` y `cliente/app.js` (Brecha 8)
- [ ] T034 [US5] Avisar «hay una versión nueva» y recargar al activarse un SW nuevo (`controllerchange`) en `cliente/app.js` (Brecha 9)
- [X] T035 [US4] En `notificationclick`, navegar la ventana enfocada a `#avisos` en `cliente/sw.js` (Brecha 10) — **hecho el 2026-11-09:** `postMessage` → `#avisos`
- [X] T036 [P] [US4] Decidir si se agrega un botón de instalar (`beforeinstallprompt`) y completar el manifiesto (`id`, capturas) en `cliente/manifest.webmanifest` y `cliente/app.js` (Brecha 12; requiere aclaración) — **hecho el 2026-11-09:** botón «Instalar la app» en «Avisos» y `id` en el manifiesto
- [ ] T037 [P] Documentar o recuperar cómo se generan los PNG desde `cliente/icono.svg` e `icono-maskable.svg` (Brecha 13)
- [ ] T038 Probar el modo sin conexión de punta a punta en Chrome (Android o DevTools) con la app levantada y dejar constancia: abrir sin red, mapa con teselas vistas, cola y reenvío, cambio de `VERSION` (Brecha 14, compuerta 6)
- [ ] T039 [P] Renombrar la caché a `ay-v1.x` (o similar) en `cliente/sw.js` y ajustar la constitución y el README (Brecha 15)

---

## Dependencies & Execution Order

- Fase 2 depende de la 1; US1–US5 dependen de la Fase 2.
- T026–T035 y T039 cambian `cliente/sw.js` o `cliente/app.js`: cada despliegue obliga a subir `VERSION` (v1.7…).
- T031 toca la API: requiere límites y validación de la hora recibida (compuerta 5).
