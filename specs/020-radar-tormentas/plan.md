# Implementation Plan: «Tormentas cerca» (spec 020)

**Branch**: `feat/radar-tormentas` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

## Summary

La API baja una sola vez las tres fuentes y las guarda en Redis:
- las imágenes infrarrojas de GOES-19 (NASA GIBS);
- los rayos GLM (THREDDS de Unidata);
- la lluvia de la próxima hora (Open-Meteo).

Las imágenes se procesan con la biblioteca estándar: se decodifica el PNG, cada color pasa a temperatura con la tabla de NASA Worldview y quedan 3 clases. Los grises cuentan solo si el núcleo está encerrado por nube fría. El resultado es un mosaico propio en PNG de paleta.

Expone tres rutas públicas (contrato en [contracts/api.md](contracts/api.md)). La app ciudadana suma:
- la vista diferida `#tormentas`, con su propio Leaflet regional, la animación de 2 h, la leyenda y la explicación;
- la ficha «Tormentas cerca» en «Mi lugar»;
- un botón en los controles del mapa.

## Technical Context

- **API:** Python 3.12 (`http.server`), módulos nuevos `api/cache.py` y `api/tormentas.py`. Usa `redis==8.1.0`.
- **Infraestructura:** servicio `redis` (`redis:8.2-alpine`) en `compose.yaml`, sin disco, con `maxmemory 96mb` y `allkeys-lru`. La API recibe `REDIS_URL=redis://redis:6379/0`. En el servidor no hace falta tocar nada: `deploy/yaguachi-deploy.sh` ya levanta todo el compose.
- **Cliente:** `src/features/tormentas/*`. Se carga diferido con `lazy` y comparte el archivo de Leaflet con el mapa. El service worker suma la caché `ay-tormentas` (16 imágenes, primero la copia) y pasa a la versión `v2.15`.
- **Pruebas:** `api/tests/test_tormentas.py` tiene 20 pruebas sin red: PNG, clasificación, encierro de grises, GLM, caché de una sola descarga, fallo anotado, respaldo de la imagen anterior y rutas. `cliente/src/pruebas/tormentas.test.ts` tiene 5. Además se probó el candado contra un Redis real con dos clientes (1 descarga para 8 peticiones).
- **Peso del bundle inicial:** 146,3 KB → 151,6 KB gzip, contra `main` (+5,3 KB). Casi todo son los textos `es` y `en`; la ficha y su lógica pesan unos 1,5 KB. La vista va aparte: `Tormentas-*.js`, 3 KB gzip.

## Constitution Check

| Compuerta | Estado |
|---|---|
| 1. Impeccable en 0, `tsc`, ESLint y pruebas | ✅ Impeccable en 0 en `#tormentas`, `#mapa` e `#inicio`, a 360 y a 1280 px. `npm run qa` en verde (106 pruebas) y `unittest` con 170 pruebas |
| 2. Textos en `es` y `en` | ✅ Claves `app.torm.*` y `app.error.tormentas.*`, más la línea nueva de privacidad |
| 3. `VERSION` del service worker | ✅ `v2.14` → `v2.15` |
| 4. Dependencias justificadas | ✅ Ver la tabla de abajo |
| 5. Límites y validación en escrituras | ✅ Sin escrituras nuevas. Las rutas de lectura validan la hora pedida: solo las últimas 3 h y múltiplos de 10 min |
| 6. Probado en la app levantada | ✅ `PUERTO=8090 docker compose up -d --build`, con peticiones reales, capturas a 360 y 1280 px y 0 errores de consola |

**Principios:**
- **II, honestidad:** satélite, no radar; no es un nivel de alerta; nada del semáforo en las nubes ni en los rayos; textos propios.
- **III, pila mínima:** sin Pillow ni numpy. El PNG se lee y se escribe con `zlib` y `struct`.
- **V, privacidad:** el teléfono no se conecta con terceros nuevos y la línea de privacidad lo dice.
- **VI, seguridad:** Redis no se publica fuera de `127.0.0.1` y la CSP queda igual.

## Complexity Tracking

| Agregado | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| Servicio `redis` (Docker) | Lo pidió el dueño: una sola descarga por dato aunque haya muchas visitas o varios procesos. La caché sobrevive a los reinicios de la API: tras un `--build` respondió de la caché enseguida | Tabla `cache` de PostgreSQL (como `con_cache`): no tiene candado entre procesos ni vencimiento por clave, y se llenaría de imágenes binarias |
| `redis==8.1.0` (pip) | Cliente oficial: pool de conexiones, `SET NX EX` y Lua para soltar el candado. Si falta Redis, la API sigue con la memoria del proceso | Un cliente RESP a mano con `socket`: más código propio que mantener por algo estándar |
| Decodificar PNG en Python puro | GIBS solo da PNG RGBA; hay que leer la temperatura de cada píxel. Cuesta unos 5 s de CPU por imagen, en segundo plano y una sola vez | Pillow y numpy (unos 30 MB en la imagen) para algo que se hace cada 10 min |
