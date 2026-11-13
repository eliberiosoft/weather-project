# Implementation Plan: Panel del analista

**Branch**: `008-panel-analista` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-panel-analista/spec.md` (documentación «as-built»: describe lo construido).

## Summary

Panel web de una sola página (`admin/index.html` + `admin/panel.js`) con cinco pestañas: Situación, Reportes, Reglas y lecturas, Avisos y Ajustes. Habla solo con las rutas `/api/panel/*` de `api/servidor.py` (más `GET /api/foto/<id>`), autenticándose con la cabecera `X-PIN` en cada petición. Se despliega como servicio Docker propio (`admin`, nginx) que solo escucha en `127.0.0.1:8091`; la app ciudadana bloquea `/api/panel/*` con `404`.

## Technical Context

**Language/Version**: Python 3.12 en Docker (`python:3.12-slim`); el código declara Python ≥ 3.10 (ver brecha B-03). JavaScript del navegador (ES2020+, sin transpilar).

**Primary Dependencies**: API con solo la biblioteca estándar (`http.server.ThreadingHTTPServer`, `sqlite3`, `hmac`, `secrets`). Panel sin framework ni librerías externas (ni Leaflet: el panel no tiene mapa). Estilos con Tailwind v4 (CLI standalone, `admin/estilos/fuente.css` → `admin/estilos.css`). nginx 1.27-alpine para servir el panel.

**Storage**: SQLite `datos/yaguachi.db` (tablas `reportes`, `niveles_oficiales`, `lecturas`, `reglas`, `avisos`, `ajustes`; ver [data-model.md](data-model.md)); fotos en `datos/fotos/*.jpg`; `config.json` con `pin_panel` y `secreto_fotos` (firma de las llaves de fotos). En Docker todo vive en el volumen `yaguachi-weather_datos` (`/app/datos`).

**Testing**: no hay pruebas automáticas. Prueba manual con la app levantada (`PUERTO=8090 docker compose up -d --build`) o, para no tocar datos reales, con un servidor aislado: `YAGUACHI_DATOS=$(mktemp -d) YAGUACHI_CONFIG=$(mktemp -d)/config.json python api/servidor.py --estaticos cliente --admin admin --puerto 8095 --offline`.

**Target Platform**: navegador de escritorio del analista (Chrome/Edge/Firefox actuales), en el mismo equipo que Docker o detrás de Cloudflare Access.

**Project Type**: aplicación web (API + SPA estática).

**Performance Goals**: la Situación se refresca cada 60 s; `calcular_estado()` se cachea 120 s y `?forzar=1` la salta.

**Constraints**: CSP sin scripts en línea ni recursos externos; PIN ≥ 12 caracteres; espera creciente tras 5 fallos; nada del panel publicado a internet.

**Scale/Scope**: 1 cantón, 71 recintos, 10 ríos (6 con punto de control), 9 puntos de control (P01–P09); listas del panel acotadas a 300 reportes, 50 avisos, 50 cambios de nivel y 200 lecturas.

## Constitution Check

*GATE: compuertas de «Flujo de trabajo y calidad» de `.specify/memory/constitution.md`.*

| # | Compuerta | Estado | Evidencia |
|---|---|---|---|
| 1 | Detector de Impeccable en 0 hallazgos | ⚠️ Sin evidencia | No hay registro en el repositorio de una pasada de `impeccable detect` sobre `admin/index.html` / `admin/panel.js` en su ubicación actual (`.impeccable/hook.cache.json` solo registra archivos de la antigua carpeta `web/` y maquetas). Hay que volver a pasarlo. |
| 2 | Textos nuevos en `es` y `en` | ✅ Cumple (con salvedades) | `admin/textos-panel.js` define 146 claves `panel.*` con el mismo conjunto en `es` y `en` (comprobado: 0 claves solo en un idioma; 0 claves usadas en `panel.js`/`index.html` sin definir). Salvedades: B-06 (fuente, ámbito, errores de la API sin traducir). |
| 3 | `VERSION` del service worker subida | N/A | El panel no tiene service worker ni pasa por `cliente/sw.js`. |
| 4 | Sin dependencias nuevas sin justificar | ✅ Cumple | API solo stdlib; panel sin librerías; la CSP de `admin/seguridad.conf` (`default-src 'self'`) impide cargar nada externo. |
| 5 | Límites y validación en toda escritura nueva de la API | ❌ Parcial | Hay PIN con espera creciente, SQL parametrizado, recortes de longitud y listas cerradas de estados, ámbitos y niveles; pero `hasta` de advertencia/aguaje no se valida (B-02), algunos números mal formados dan `500` (B-05) y algunos campos no se comprueban contra lo existente (`ambito_id`). |
| 6 | Probado en la app levantada | ❌ No cumple | No hay registro de prueba. El error B-01 (no se podía publicar un aviso RESPUESTA) llegó al código sin detectarse; se corrigió el 2026-11-09 sin constancia de prueba. |

Principio VI (separación y seguridad): ✅ `compose.yaml` publica `admin` solo en `127.0.0.1:${PUERTO_ADMIN:-8091}`; `cliente/nginx.conf` devuelve 404 a `/api/panel` y `/api/panel/`; `X-PIN` comparado con `hmac.compare_digest`; botones con `data-accion` y un escuchador delegado (sin `onclick`); texto de usuario con `esc()`.

## Project Structure

### Documentation (this feature)

```text
specs/008-panel-analista/
├── spec.md
├── plan.md              # este archivo
├── data-model.md        # tablas SQLite que usa el panel, estados y transiciones
├── contracts/
│   └── api.md           # rutas /api/panel/* y /api/foto/<id> con PIN
└── tasks.md
```

### Source Code (repository root)

```text
api/
└── servidor.py          # cargar_config() (PIN), _pin_ok() (X-PIN + espera), panel_reportes, panel_revisar,
                         # panel_nivel, panel_aviso, panel_anular_aviso, panel_lectura, panel_regla,
                         # panel_ajustes_get/post, nivel_regla, calcular_estado, oficiales, do_GET/do_POST
admin/
├── index.html           # estructura: ingreso (#login), pestañas (#app), íconos SVG, toast
├── panel.js             # lógica: api() con X-PIN, entrar/salir, Situación, Reportes, Reglas, Avisos, Ajustes
├── textos-panel.js      # diccionario panel.* (es/en)
├── estilos/fuente.css   # fuente Tailwind (tokens @theme)
├── estilos.css          # CSS generado (sh estilos.sh admin)
├── nginx.conf           # sirve el panel y pasa /api/ a api:8080
├── seguridad.conf       # cabeceras estrictas (CSP sin externos, noindex, no-referrer)
└── Dockerfile           # compila Tailwind (sha256 verificado) y copia i18n.js e íconos del cliente
compartido/
├── i18n.js              # motor I18N y textos comunes (niveles, tipos, estados, motivos)
└── capas/puntos_control.geojson   # P01–P09 con umbrales P90/Q2/Q5
cliente/nginx.conf       # bloquea /api/panel en la app pública
compose.yaml             # servicio admin en 127.0.0.1:${PUERTO_ADMIN:-8091}
```

**Structure Decision**: el panel es una pieza aparte (`admin/`) que comparte con el cliente solo `compartido/i18n.js` y los íconos; la lógica de negocio vive entera en `api/servidor.py`. En desarrollo sin Docker la API sirve el panel en `/panel/` (`--admin admin`, raíces `admin/`, `compartido/`, `cliente/`).

## Cómo probar y cómo leer el PIN sin mostrarlo

1. Levantar con Docker (`PUERTO=8090 docker compose up -d --build`) y abrir `http://127.0.0.1:8091`.
2. Copiar el PIN al portapapeles **sin que aparezca en pantalla ni en el historial de salida**:
   - macOS: `docker compose exec -T api python -c "import json;print(json.load(open('/app/datos/config.json'))['pin_panel'],end='')" | pbcopy`
   - Windows (PowerShell): el mismo comando terminado en `| Set-Clipboard`
   - Linux: el mismo comando terminado en `| xclip -selection clipboard`
   
   El comando de `README.md` y `docs/seguridad.md` (sin la tubería) lo imprime en la terminal: úsalo solo si nadie más ve la pantalla y la sesión no se graba.
3. Pegarlo en el campo PIN (es `type="password"`). No pegarlo en chats, tickets ni registros. Para fijar uno propio: `PIN_PANEL='<al menos 12 caracteres>' docker compose up -d`.
4. Para pruebas que escriben (reportes, niveles, avisos), usar el servidor aislado de «Testing»: nunca el volumen `yaguachi-weather_datos`.
