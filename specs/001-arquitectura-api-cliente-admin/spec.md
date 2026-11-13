# Feature Specification: Arquitectura en tres servicios (api, cliente, admin)

**Feature Branch**: `001-arquitectura-api-cliente-admin`

**Created**: 2026-11-09

**Status**: Implementado

**Input**: Pedido del dueño: «por seguridad … la parte de panel muévela a otro proyecto y agrégalo en el docker para levantar todo; entonces se tendría un api, un cliente y un admin».

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Levantar todo con un comando (Priority: P1)

Quien recibe el proyecto clona el repositorio y, con Docker, levanta la API, la app ciudadana y el panel sin instalar Python, Node ni Tailwind.

**Why this priority**: sin esto nadie puede probar ni desplegar la app.

**Independent Test**: `PUERTO=8090 docker compose up -d --build` en un equipo limpio deja los tres servicios en marcha (la `api`, además, «healthy»).

**Acceptance Scenarios**:

1. **Given** un equipo con Docker, **When** se ejecuta `PUERTO=8090 docker compose up -d --build`, **Then** http://localhost:8090 sirve la app ciudadana y http://127.0.0.1:8091 el panel.
2. **Given** los servicios en marcha, **When** se reinician o se reconstruyen, **Then** los reportes, las fotos y `config.json` (con el PIN) se conservan en el volumen `yaguachi-weather_datos`.
3. **Given** el puerto 8080 ocupado en el equipo, **When** se define `PUERTO`/`PUERTO_ADMIN`, **Then** la app usa esos puertos.

---

### User Story 2 - El panel no se publica con la app (Priority: P1)

El analista usa el panel desde su equipo (o detrás de Cloudflare Access); desde la app pública no se llega a las rutas del panel.

**Why this priority**: el panel puede cambiar el nivel de alerta del cantón; exponerlo es el mayor riesgo del sistema.

**Independent Test**: `curl http://localhost:8090/api/panel/reportes` responde 404; el puerto del panel solo escucha en 127.0.0.1.

**Acceptance Scenarios**:

1. **Given** la app pública, **When** alguien pide `/api/panel` o `/api/panel/*`, **Then** nginx del cliente responde 404 sin llegar a la API.
2. **Given** otro equipo de la red, **When** intenta abrir el puerto 8091 del servidor, **Then** no hay conexión (solo escucha en 127.0.0.1).

---

### User Story 3 - Desarrollar sin Docker (Priority: P2)

Un desarrollador corre la API con Python y sirve los dos frontends desde la misma API para iterar rápido.

**Independent Test**: `sh estilos.sh && python api/servidor.py --estaticos cliente --admin admin` sirve la app en http://localhost:8080 y el panel en http://localhost:8080/panel/.

**Acceptance Scenarios**:

1. **Given** Python 3.10+, **When** se arranca con `--estaticos cliente --admin admin`, **Then** `/` sirve el cliente, `/panel/` el panel y `/api/` la API.
2. **Given** sin internet, **When** se arranca con `--offline`, **Then** la API no consulta Open-Meteo y usa la última caché.

### Edge Cases

- `config.json` del volumen con otro dueño (copiado con `docker cp`): la API avisa «no se pudo guardar» y trabaja en memoria; se corrige con `chown` dentro del contenedor (ver `docs/seguridad.md`).
- Faltan las capas GeoJSON: la API termina con un mensaje que indica correr `preparar_capas.py` o definir `YAGUACHI_CAPAS`.
- `PIN_PANEL` de menos de 12 caracteres: la API no arranca.
- `docker compose down -v` borra el volumen con todos los reportes: solo se usa a pedido expreso del dueño.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST constar de tres servicios en `compose.yaml`:
  - `api`: Python, sin puertos publicados.
  - `cliente`: nginx, en `${PUERTO:-8090}:80`.
  - `admin`: nginx, en `127.0.0.1:${PUERTO_ADMIN:-8091}:80`.
- **FR-002**: `cliente` y `admin` MUST pasar `/api/` a `http://api:8080`, y `cliente` también `/r/`, con `X-Real-IP` y `X-Forwarded-Proto`.
- **FR-003**: `cliente` MUST responder 404 a `/api/panel` y `/api/panel/*`.
- **FR-004**: `cliente` y `admin` MUST esperar a que `api` esté «healthy». El healthcheck de la API consulta `/api/territorio`.
- **FR-005**: Los datos MUST persistir en el volumen nombrado `yaguachi-weather_datos`, montado en `/app/datos`: `yaguachi.db`, `fotos/` y `config.json`.
- **FR-006**: Los estilos de cada frontend MUST generarse en la construcción de la imagen con el CLI standalone de Tailwind, cuya huella sha256 se verifica.
- **FR-007**: La API MUST leer su configuración de variables de entorno:
  - `YAGUACHI_DATOS`, `YAGUACHI_CONFIG` y `YAGUACHI_CAPAS`: rutas.
  - `YAGUACHI_PROXIES`: proxies de confianza para la IP real.
  - `PIN_PANEL`: opcional, de al menos 12 caracteres.
  - `URL_PUBLICA`: base de los enlaces compartidos.
- **FR-008**: La API MUST correr como un usuario sin privilegios (uid 1000), no como root.
- **FR-009**: En desarrollo, `--estaticos DIR` y `--admin DIR` MUST servir los frontends desde la propia API. En Docker no se usan.
- **FR-010**: El código compartido MUST vivir en `compartido/` (motor i18n, capas y logo) y copiarse a cada imagen en la construcción.

### Key Entities

- **Servicio `api`**: `api/servidor.py` (biblioteca estándar) y las capas en `/app/capas`. Es dueño de la base SQLite y de las fotos.
- **Servicio `cliente`**: archivos de `cliente/`, más `compartido/i18n.js` y `compartido/capas/`, servidos por nginx con `cliente/nginx.conf` y `cliente/seguridad.conf`.
- **Servicio `admin`**: archivos de `admin/`, más `compartido/i18n.js` y los íconos del cliente, servidos por nginx con `admin/nginx.conf` y `admin/seguridad.conf`.
- **Volumen `yaguachi-weather_datos`**: el estado persistente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona nueva levanta los tres servicios con un comando y sin instalar nada más que Docker.
- **SC-002**: 0 rutas `/api/panel/*` alcanzables desde el puerto público (se comprueba con curl).
- **SC-003**: Reconstruir las imágenes no pierde ningún reporte ni el PIN.
- **SC-004**: La imagen de la API no instala paquetes de pip.

## Assumptions

- Despliegue en un solo servidor con Docker Compose. Para internet se recomienda Cloudflare Tunnel delante del `cliente` (ver `specs/012-seguridad` y `docs/seguridad.md`).
- En la máquina del dueño el puerto 8080 está ocupado por otro contenedor; por eso se usan 8090 y 8091.
