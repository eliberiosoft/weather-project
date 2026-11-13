# Feature Specification: Despliegue automático con GitHub Actions

**Feature Branch**: `017-despliegue-github-actions`

**Created**: 2026-11-09

**Status**: Implementado

**Input**: Pedido del dueño: «crea un action git para desplegar el proyecto en el servidor; configura los secrets y variables con 1Password (registro yaguachiweather); crea en el servidor un usuario deployer que se conecte por llave SSH, la misma que se configura en GitHub».

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un merge a main queda desplegado (Priority: P1)

**Independent Test**: haz merge de un PR a `main`. El workflow **Desplegar** termina en verde y `http://SERVIDOR/api/estado` responde con la versión nueva.

**Acceptance Scenarios**:

1. **Given** un push a `main`, **When** corre el workflow, **Then** envía el código del commit, el `.env` y los secretos al servidor, construye las imágenes y levanta los servicios con `--wait`.
2. **Given** que el build falla, **When** corre el despliegue, **Then** los contenedores anteriores siguen corriendo y `/opt/yaguachi/current` no cambia.
3. **Given** dos despliegues a la vez, **When** llega el segundo, **Then** espera su turno: `concurrency` en el workflow y `flock` en el servidor.
4. **Given** un repositorio sin `DEPLOY_HOST`, por ejemplo un fork, **When** hay un push a main, **Then** el job se omite.

### User Story 2 - La llave de GitHub solo sirve para desplegar (Priority: P1)

**Acceptance Scenarios**:

1. **Given** la llave de `deployer`, **When** alguien intenta abrir una shell o ejecutar otra orden, **Then** el servidor solo acepta `deploy <sha de 40 caracteres>` y `status`.
2. **Given** `deployer`, **Then** no tiene clave ni sudo, y su `authorized_keys` lleva `command=`, `no-pty`, `no-port-forwarding`, `no-agent-forwarding` y `no-X11-forwarding`.
3. **Given** el servidor, **Then** su huella se fija en `DEPLOY_KNOWN_HOSTS` y el workflow usa `StrictHostKeyChecking=yes`.

### User Story 3 - Los datos nunca se pierden (Priority: P1)

**Acceptance Scenarios**:

1. **Given** el servidor, **Then** los datos viven en directorios del host, no en volúmenes de Docker (pedido del dueño): `/opt/database` para PostgreSQL y `/opt/files` para las fotos y `config.json`. Los monta `compose.servidor.yaml`.
2. **Given** cualquier despliegue, **Then** esos directorios se conservan. Nunca se ejecuta `down -v`.
3. **Given** `POSTGRES_PASSWORD`, **Then** queda guardada en 1Password (yaguachiweather → app) y en el secreto del repositorio, y no se cambia después de crear la base.

## Requirements *(mandatory)*

- **FR-001**: El workflow `.github/workflows/desplegar.yml` corre en push a `main` y con `workflow_dispatch`, con `permissions: contents: read` y las acciones fijadas por SHA.
- **FR-002**: El `.env` se genera en el runner a partir de las variables y secretos del repositorio. La lista está en `docs/despliegue.md`.
- **FR-003**: El paquete es un tar enviado por stdin a `ssh deployer@HOST "deploy $GITHUB_SHA"`. El servidor lo limita a 300 MB.
- **FR-004**: `deploy/yaguachi-deploy.sh` se instala en `/usr/local/bin/yaguachi-deploy` (dueño root) con `deploy/preparar-servidor.sh`. GitHub no puede modificarlo.
- **FR-005**: Se conservan las 5 últimas versiones en `/opt/yaguachi/releases/` y se borran las imágenes huérfanas.
- **FR-006**: Tras desplegar, el workflow comprueba `/api/estado` con hasta 12 intentos.

## Fuera de alcance

- HTTPS y Cloudflare (siguiente paso; ver `docs/seguridad.md`).
- Pruebas automáticas en CI antes de desplegar. El build de Docker ya ejecuta `tsc` y el build de Vite; las pruebas siguen siendo locales.
