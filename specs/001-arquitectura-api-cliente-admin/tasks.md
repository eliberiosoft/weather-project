# Tasks: Arquitectura en tres servicios (api, cliente, admin)

**Input**: `specs/001-arquitectura-api-cliente-admin/`

## Hecho

- [X] T001 Mover `servidor.py` → `api/servidor.py`; rutas de capas y datos por variables de entorno (`YAGUACHI_CAPAS`, `YAGUACHI_DATOS`, `YAGUACHI_CONFIG`)
- [X] T002 Mover `web/index.html`, `app.js`, `sw.js`, `manifest`, íconos → `cliente/`
- [X] T003 Mover `web/panel.html` → `admin/index.html` y `web/panel.js` → `admin/panel.js`
- [X] T004 Mover las capas a `compartido/capas/` y el motor i18n a `compartido/i18n.js`
- [X] T005 `api/Dockerfile` con usuario sin privilegios y HEALTHCHECK sobre `/api/territorio`
- [X] T006 `cliente/Dockerfile` y `admin/Dockerfile` en dos etapas (Tailwind standalone verificado con sha256 → nginx)
- [X] T007 `cliente/nginx.conf`: proxy `/api/` y `/r/` con `X-Real-IP`; 404 a `/api/panel`; `Cache-Control: no-cache`; `sw.js` con `no-store`
- [X] T008 `admin/nginx.conf`: proxy `/api/`, `noindex`, cabeceras estrictas
- [X] T009 `compose.yaml`: `api` sin puertos, `cliente` en `${PUERTO:-8090}`, `admin` en `127.0.0.1:${PUERTO_ADMIN:-8091}`, volumen `yaguachi-weather_datos` (el mismo de antes)
- [X] T010 Modo desarrollo `--estaticos` / `--admin` en `api/servidor.py`
- [X] T011 `estilos.sh` genera `cliente/estilos.css` y `admin/estilos.css` (`--watch [cliente|admin]`)
- [X] T012 IP real solo desde proxies de confianza (`YAGUACHI_PROXIES`)
- [X] T013 README actualizado con la tabla de servicios y los comandos

## Pendiente

- [ ] T014 Servicio opcional `cloudflared` (Tunnel) en `compose.yaml`, desactivado por defecto con un `profile`
- [ ] T015 Copia de seguridad programada del volumen (`yaguachi.db` + `fotos/`)
- [ ] T016 Pruebas automatizadas de la API (hoy son scripts manuales contra un servidor aislado)
