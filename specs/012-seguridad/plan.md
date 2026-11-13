# Implementation Plan: Seguridad de la API, la app y el panel

**Branch**: `012-seguridad` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-seguridad/spec.md`

## Summary

Revisión hecha sobre el código fuente, en modo guía de la skill security-audit; los hallazgos y la guía de Cloudflare están en `docs/seguridad.md`. Las correcciones son mínimas y se aplican en el último punto de decisión de confianza: `_pin_ok`, `confirmar_reporte`, `crear_reporte`, `_cuerpo`, `Servidor`, `mantenimiento` y las cabeceras de nginx y de la API.

## Technical Context

**Language/Version**: Python 3.12 (biblioteca estándar) y JavaScript plano.

**Primary Dependencies**: ninguna nueva.

**Storage**: SQLite. Columnas nuevas `ip` en `confirmaciones` y `me_gusta` (migración automática en `iniciar_db`).

**Testing**:
- servidor aislado (`YAGUACHI_DATOS` temporal, puerto 8097) con scripts que ejercitan el bloqueo del PIN, los votos, las listas y los «me gusta»;
- curl para las cabeceras;
- Chrome para la CSP.

**Target Platform**: Docker (nginx + Python) detrás de Cloudflare.

**Project Type**: aplicación web.

**Constraints**: los límites por IP necesitan la IP real; detrás de Cloudflare hay que configurar `real_ip_header CF-Connecting-IP`.

## Constitution Check

| Compuerta | Estado | Evidencia |
|---|---|---|
| Impeccable en 0 | ✅ | 0 hallazgos tras quitar los `onclick` |
| Textos es/en | ✅ | textos de privacidad actualizados en ambos idiomas (IP 48 h, foto al descartar) |
| `VERSION` del SW subida | ✅ | v1.5 → v1.6 |
| Sin dependencias nuevas | ✅ | — |
| Escrituras con límites | ✅ | reportes, fotos, confirmaciones, «me gusta» y PIN |
| Probado levantado | ✅ | curl a :8090 y :8091 (cabeceras y 404 del panel); mapa sin errores de CSP en Chrome |

## Project Structure

### Documentation (this feature)

```text
specs/012-seguridad/
├── plan.md
├── spec.md
└── tasks.md
docs/seguridad.md            # hallazgos, correcciones y lista para Cloudflare
```

### Source Code (repository root)

```text
api/servidor.py              # _pin_ok, CABECERAS_SEG, Servidor, mantenimiento, confirmar_reporte,
                             # me_gusta_reporte, crear_reporte, panel_revisar, listar_reportes, log_message
cliente/nginx.conf · cliente/seguridad.conf
admin/nginx.conf · admin/seguridad.conf
cliente/index.html           # SRI de Leaflet; sin onclick
cliente/app.js               # X-Dispositivo, getRandomValues, addEventListener
cliente/Dockerfile · admin/Dockerfile · estilos.sh   # sha256 de Tailwind
compose.yaml                 # URL_PUBLICA
```

## Complexity Tracking

No aplica: no hay violaciones.
