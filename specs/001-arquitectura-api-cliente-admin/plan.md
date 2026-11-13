# Implementation Plan: Arquitectura en tres servicios (api, cliente, admin)

**Branch**: `001-arquitectura-api-cliente-admin` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-arquitectura-api-cliente-admin/spec.md`

## Summary

Se separó el antiguo `web/` + `servidor.py` en tres servicios. La API en Python sirve solo `/api/*` y `/r/<id>`. Dos nginx sirven los frontends estáticos y hacen de proxy hacia la API. El panel vive en su propio servicio, ligado a 127.0.0.1, y el cliente bloquea `/api/panel`.

## Technical Context

**Language/Version**: Python 3.12 (imagen `python:3.12-slim`; el código pide 3.10 o superior); JavaScript ES2020 en el navegador.

**Primary Dependencies**:
- API: ninguna fuera de la biblioteca estándar (`http.server`, `sqlite3`, `urllib`).
- Frontends: Leaflet 1.9.4 (unpkg, con SRI) y Tailwind v4.3.5 (CLI standalone, solo en la construcción).
- Servidor web: `nginx:1.27-alpine`.

**Storage**: SQLite (`/app/datos/yaguachi.db`), fotos JPEG en `/app/datos/fotos/` y `config.json`, todo en el volumen `yaguachi-weather_datos`.

**Testing**: pruebas manuales y con scripts contra un servidor aislado (`YAGUACHI_DATOS` temporal); curl para cabeceras y rutas; navegador a 360 px y escritorio; detector de Impeccable.

**Target Platform**: Linux con Docker (amd64/arm64). En desarrollo, macOS o Windows con Python.

**Project Type**: aplicación web, con API, PWA y panel.

**Performance Goals**: respuesta de `/api/estado` en menos de 1 s con caché; la API acepta hasta 200 conexiones simultáneas.

**Constraints**: sin build de JavaScript ni dependencias de pip. La API no publica puertos.

**Scale/Scope**: un cantón (71 recintos y 9 puntos de control); decenas a cientos de reportes al día en temporada de lluvias.

## Constitution Check

| Compuerta | Estado | Evidencia |
|---|---|---|
| Impeccable en 0 | ✅ | `impeccable detect` sobre `cliente/` y `admin/`: 0 hallazgos (2026-11-09) |
| Textos es/en | ✅ | `cliente/textos-app.js` y `admin/textos-panel.js` con `es` y `en` |
| `VERSION` del SW subida | ✅ | `cliente/sw.js`: v1.6 |
| Sin dependencias nuevas | ✅ | solo nginx (imagen oficial) para servir estáticos |
| Escrituras con límites | ✅ | ver `specs/012-seguridad` |
| Probado levantado | ✅ | `docker compose ps`: los tres en marcha; `/api/panel` → 404 en :8090 |

## Project Structure

### Documentation (this feature)

```text
specs/001-arquitectura-api-cliente-admin/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```text
compose.yaml                 # tres servicios + volumen yaguachi-weather_datos
.dockerignore
api/
├── Dockerfile               # python:3.12-slim, usuario yaguachi (uid 1000), HEALTHCHECK
└── servidor.py              # API + /r/<id>; --estaticos/--admin solo en desarrollo
cliente/
├── Dockerfile               # etapa Tailwind (sha256) → nginx
├── nginx.conf               # proxy /api/ y /r/, 404 a /api/panel, timeouts
├── seguridad.conf           # cabeceras (CSP…), incluido en cada location
├── index.html · app.js · textos-app.js · sw.js · manifest.webmanifest · íconos
└── estilos/fuente.css       # fuente Tailwind (@theme) → estilos.css
admin/
├── Dockerfile · nginx.conf · seguridad.conf
├── index.html · panel.js · textos-panel.js
└── estilos/fuente.css
compartido/
├── i18n.js                  # motor de idiomas (lo copian ambas imágenes)
├── capas/*.geojson          # capas del cantón (las usan la API y el cliente)
estilos.sh                   # Tailwind local para desarrollo (descarga verificada)
preparar_capas.py            # regenera compartido/capas desde las fuentes
```

**Structure Decision**: tres carpetas de despliegue (`api`, `cliente`, `admin`) más `compartido/`. Las imágenes se construyen desde la raíz del repositorio (`context: .`) para poder copiar `compartido/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| nginx como dependencia nueva | cabeceras de seguridad, bloqueo de `/api/panel`, timeouts y separación del panel | servir todo desde `http.server` mezcla el panel con la app pública y no da control de cabeceras por ruta |
