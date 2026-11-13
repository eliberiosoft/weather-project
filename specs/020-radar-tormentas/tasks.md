# Tasks: «Tormentas cerca» (spec 020)

## Fase 1: verificación de fuentes

- [x] T001 Medir RainViewer: cobertura en Ecuador (ninguna), zoom máximo 7 y las condiciones de uso desde 2026-01-01.
- [x] T002 Probar NASA GIBS GOES-East banda 13: zoom nativo 6, cada 10 min, la cabecera `Layer-Time-Actual` por HEAD y la tabla de colores de Worldview.
- [x] T003 Probar GLM por OPeNDAP en texto desde THREDDS: unos 7 KB por archivo de 20 s, contra 340 KB del NetCDF de NOAA.

## Fase 2: API y caché

- [x] T010 `api/cache.py`: Redis o memoria, `una_vez` con candado `SET NX`, copia vieja de 6 h y fallo anotado 60 s.
- [x] T011 `api/tormentas.py`: PNG con la biblioteca estándar, clasificación por la tabla, encierro de grises, mosaico 3×3 de zoom 6 y PNG de paleta.
- [x] T012 Aviso: nube más cercana, rumbo, intensidad a ≤ 40 km y tendencia contra la imagen de 30 min antes.
- [x] T013 Rayos GLM: catálogo, archivos de los últimos 30 min, filtro al mosaico; en segundo plano la primera vez.
- [x] T014 Lluvia de la próxima hora con Open-Meteo `minutely_15`.
- [x] T015 Rutas `/api/tormentas`, `/api/tormentas/resumen` y `/api/tormentas/marco/<id>.png`, que valida la hora pedida.
- [x] T016 Hilo que mantiene la caché solo con demanda (30 min) y arma la animación en segundo plano.
- [x] T017 Si la hora nueva no está completa en GIBS (404 en algunas teselas), usar la anterior.
- [x] T018 Servicio `redis` en `compose.yaml`, `REDIS_URL`, `PUERTO_REDIS`, `iniciar-dev.sh`, Dockerfile y `requirements.txt`.
- [x] T019 `api/tests/test_tormentas.py` (20 pruebas, sin red); `REDIS_URL` aislado en `tests/apoyo.py`.

## Fase 3: app ciudadana

- [x] T020 Vista `#tormentas` diferida: aviso, mapa regional, animación, leyenda y «Qué estás viendo».
- [x] T021 Ficha «Tormentas cerca» en «Mi lugar» (resumen liviano) y botón en los controles del mapa.
- [x] T022 Íconos `i-tormenta`, `i-rayo`, `i-play` e `i-pausa`; textos `es` y `en`; línea de privacidad.
- [x] T023 Service worker: caché `ay-tormentas` (16 imágenes) y `v2.15`.
- [x] T024 `src/pruebas/tormentas.test.ts`.
- [x] T025 Padding de la atribución de Leaflet (hallazgo de Impeccable, vale para los dos mapas).

## Fase 4: verificación

- [x] T030 `npm run qa`, `unittest` completo y pyflakes.
- [x] T031 Docker en el puerto 8090: caché caliente y fría, imágenes, claves en Redis y reinicio de la API.
- [x] T032 Capturas a 360 y 1280 px, la animación en el navegador y 0 errores de consola.
- [x] T033 Impeccable en 0 en `#tormentas`, `#mapa` e `#inicio`, a 360 y 1280 px.
