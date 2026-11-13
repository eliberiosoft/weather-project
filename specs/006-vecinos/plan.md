# Implementation Plan: Vecinos — publicaciones, me gusta y compartir

**Branch**: `006-vecinos` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-vecinos/spec.md`

## Summary

La pestaña «Vecinos» (`#v-muro`) pinta como publicaciones la misma lista de `GET /api/reportes` que usa el mapa. La API decide qué puede ver cada teléfono y lo ordena (verificado primero); el cliente filtra por distancia (5 km), «míos» o todos, y busca sin tildes. «Me gusta» es una tabla `me_gusta` con un voto por teléfono y tope por IP. Compartir usa enlaces de Facebook/WhatsApp y una página `/r/<id>` que la API genera con Open Graph y que redirige a `/#muro/<id>`.

## Technical Context

**Language/Version**: Python 3.10+ (imagen `python:3.12-slim`); JavaScript ES2020 plano.

**Primary Dependencies**: biblioteca estándar en la API (`html.escape` para la página compartida); en el navegador, `<dialog>` nativo para el visor, `navigator.clipboard` y `navigator.share` si existen; Tailwind v4.3.5 para las clases. Sin SDK de Facebook ni de WhatsApp: solo URLs públicas de compartir.

**Storage**: tabla `me_gusta` en SQLite; filtro en `localStorage` (`ay_muro_filtro`); última lista en la caché del service worker.

**Testing**: manual con dos teléfonos (o dos perfiles del navegador) contra un servidor aislado; depurador de compartir de Facebook para `/r/<id>` con `URL_PUBLICA` definida. Sin pruebas automáticas en el repositorio.

**Target Platform**: Chrome de Android de gama baja; rastreadores de Facebook y WhatsApp para `/r/<id>`.

**Project Type**: aplicación web (API + PWA).

**Performance Goals**: el muro se pinta de una vez con `innerHTML` (hasta 400 publicaciones); fotos con `loading="lazy"`; búsqueda con 150 ms de espera.

**Constraints**: nada de nombres ni cuentas; fotos ajenas solo si están verificadas; textos en `es`/`en`; CSP sin scripts en línea (acciones delegadas con `data-accion`).

**Scale/Scope**: hasta 400 publicaciones por carga; un cantón.

## Constitution Check

*Compuertas de la constitución v1.0.0. Revisadas contra el código el 2026-11-09, sin levantar Docker.*

| # | Compuerta | Estado | Evidencia |
|---|---|---|---|
| 1 | Impeccable en 0 hallazgos | ✅ (registro) | `.impeccable/hook.cache.json`: 0 hallazgos en `app.js` e `index.html` (rutas anteriores `web/`). No se volvió a ejecutar al escribir esta spec. |
| 2 | Textos en `es` y `en` | ⚠️ parcial | `app.muro.*` completos en `cliente/textos-app.js`. La página `/r/<id>` y los errores de la API solo en español; «Facebook» y «WhatsApp» van escritos en el JS (son marcas). |
| 3 | `VERSION` del service worker | ✅ | `cliente/sw.js`: `v1.6`. |
| 4 | Sin dependencias nuevas | ✅ | Sin SDK externos; solo enlaces. |
| 5 | Límites y validación en la escritura | ⚠️ | `POST /api/reportes/{id}/megusta`: formato del dispositivo, visibilidad, 60 por IP y hora, bajo `_db_lock` ✅. Pero alternar dar/quitar no llega nunca al tope (brecha 3). |
| 6 | Probado en la app levantada | ⚠️ no re-verificado | Spec «as-built» escrita sin levantar Docker. Falta repetir las pruebas de la spec. |

Otros principios:

- **II (honestidad)**: cada publicación dice si está verificada o es «aviso de vecinos»; el texto para compartir incluye «aviso de vecinos, no oficial» y la página `/r/<id>` dice que no es un canal oficial ✅.
- **V (privacidad)**: autor anónimo («Un vecino»); fotos ajenas solo verificadas ✅. El id del teléfono va en `?dispositivo=` en las URLs de foto (pendiente conocido).
- **VI (seguridad)**: todo texto del vecino y del analista pasa por `esc()` en `post()`; la página `/r/<id>` escapa con `html.escape`; enlaces externos con `rel="noopener"` ✅. `/r/<id>` lleva la CSP de la API (sin scripts) ✅.

## Project Structure

### Documentation (this feature)

```text
specs/006-vecinos/
├── spec.md
├── plan.md
├── data-model.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code (repository root)

```text
api/servidor.py
├── ESQUEMA (tabla me_gusta) / iniciar_db() (columna ip)
├── listar_reportes(), reporte_publico()      # lista, orden, likes y me_gusta
├── visible_para(), me_gusta_reporte()        # POST /api/reportes/{id}/megusta
├── pagina_compartida()                        # GET /r/{id}, Open Graph, URL_PUBLICA
└── mantenimiento()                            # IP de me_gusta a NULL a las 48 h

cliente/index.html
├── #v-muro  (#form-muro, #buscar-muro, #muro-filtros, #muro-cuenta, #muro)
├── <dialog id="visor"> (#visor-titulo, #visor-cerrar, #visor-foto)
└── nav button[data-v="muro"]   # pestaña «Vecinos»

cliente/app.js  (sección «MURO»)
├── filtroMuro, CERCA_M, normalizar(), centroLugar()
├── tituloReporte(), urlCompartir(), textoCompartir()
├── post(), pintarMuro(), cargarMuro(), repintarPost()
├── meGusta(), verFoto()
├── listener delegado de [data-accion]: megusta, ver-foto, compartir, copiar, mas, post-mapa, muro-mios
└── iniciar(): enlace profundo #muro/<id> → postDestacado

cliente/textos-app.js   # app.muro.*, app.sec.muro
cliente/nginx.conf      # location /r/ → api:8080
compose.yaml            # URL_PUBLICA en el servicio api
```

**Structure Decision**: el muro reutiliza la lista de reportes (no hay endpoint propio); solo agrega la tabla `me_gusta` y la ruta `/r/<id>`. La página compartida la sirve la API porque necesita los datos del reporte en el HTML para los rastreadores, que no ejecutan JavaScript.

## Complexity Tracking

No aplica.
