# Especificaciones (Spec Kit)

Documentación de Yaguachi Weather con [Spec Kit](https://github.com/github/spec-kit): qué hace cada parte, por qué y cómo está construida. Las reglas que no se negocian están en la constitución, [`.specify/memory/constitution.md`](../.specify/memory/constitution.md).

| # | Funcionalidad | Estado |
|---|---|---|
| [001](001-arquitectura-api-cliente-admin/spec.md) | Arquitectura en tres servicios: api, cliente, admin | Implementado |
| [002](002-semaforo-mi-lugar/spec.md) | Semáforo y «Mi lugar» | Implementado |
| [003](003-mapa-interactivo/spec.md) | Mapa interactivo (Leaflet) | Implementado |
| [004](004-reportar-asistente/spec.md) | Reportar: asistente paso a paso | Implementado |
| [005](005-calles-inundadas/spec.md) | Calles inundadas y confirmaciones de vecinos | Implementado |
| [006](006-vecinos/spec.md) | Vecinos: publicaciones, me gusta y compartir | Implementado |
| [007](007-avisos-notificaciones/spec.md) | Avisos del analista y notificaciones | Implementado |
| [008](008-panel-analista/spec.md) | Panel del analista | Implementado |
| [009](009-i18n/spec.md) | Idiomas (i18n es/en) | Implementado |
| [010](010-privacidad-cookies/spec.md) | Privacidad y cookies | Implementado |
| [011](011-pwa-sin-conexion/spec.md) | PWA y uso sin conexión | Implementado |
| [012](012-seguridad/spec.md) | Seguridad | Implementado |
| [013](013-pwa-panel-y-app/spec.md) | App y panel instalables (PWA) | Implementado |
| [014](014-usuarios-incidentes-push-react/spec.md) | Usuarios y roles, incidentes del equipo, web push, React | Implementado (push por probar con Firebase real) |
| [015](015-carga-placeholders-splash/spec.md) | Indicador de carga, placeholders y splash animado | Implementado (splash por probar instalado) |
| [016](016-postgresql/spec.md) | Base de datos PostgreSQL (migración desde SQLite) | Implementado |
| [017](017-despliegue-github-actions/spec.md) | Despliegue automático con GitHub Actions (usuario deployer) | Implementado |
| [020](020-radar-tormentas/spec.md) | «Tormentas cerca»: satélite, rayos y lluvia de la próxima hora, con caché en Redis | Implementado |
| [021](021-avisos-flyer-alcance/spec.md) | Avisos con flyer (también en el push), compartir avisos y alcance anónimo de avisos e incidentes | Implementado |
| [022](022-validacion-vecinos/spec.md) | Validación por vecinos: 3 personas distintas del mismo sector publican sin el analista («confirmado por vecinos») | Implementado |

> Desde la spec 014, los dos frontends están en **React + TypeScript + Vite** y el panel entra con usuarios y roles, ya no con PIN. Las specs 002–013 describen el comportamiento, que se conserva. Las rutas de archivos que citan (`cliente/app.js`, `admin/panel.js`, `sw.js`, unpkg) son de la versión anterior: el código equivalente está ahora en `cliente/src/features/*` y `admin/src/features/*`.

Cada carpeta tiene `spec.md` (qué y por qué), `plan.md` (cómo, y la revisión contra la constitución) y `tasks.md` (lo hecho `[X]` y lo pendiente `[ ]`). Algunas tienen también `data-model.md` y `contracts/api.md`.

## Cómo seguir trabajando

Spec Kit ya está instalado (`.specify/` y las skills `speckit-*` en `.claude/skills/`). Con Claude Code:

1. `/speckit-specify <qué quieres>`: crea `specs/NNN-nombre/spec.md`.
2. `/speckit-clarify`: opcional; aclara las dudas.
3. `/speckit-plan`: escribe el plan y lo revisa contra la constitución.
4. `/speckit-tasks`, luego `/speckit-implement`.
5. `/speckit-analyze`: comprueba la coherencia entre spec, plan y tareas.

Para instalar el CLI en otra máquina: `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git` (o `pipx`). En este repositorio no hace falta volver a ejecutar `specify init`.

Si cambias el comportamiento de algo ya construido, actualiza su `spec.md` en el mismo cambio.
