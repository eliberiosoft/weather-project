# Feature Specification: Base de datos PostgreSQL

**Feature Branch**: `016-postgresql`

**Created**: 2026-11-09

**Status**: Implementado

**Input**: Pedido del dueño: «la base del aplicativo es Postgres, ¿cierto? porque veo SQLite y eso no es».

## Contexto

Hasta ahora la API usaba SQLite, porque el diseño original exigía usar solo la biblioteca estándar de Python. El dueño espera PostgreSQL. Se migra la API a PostgreSQL y se importan los datos existentes sin perder nada.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La app corre sobre PostgreSQL (Priority: P1)

**Independent Test**: `docker compose up -d --build` levanta el servicio `db` (PostgreSQL) y la API lo usa. `docker compose exec db psql -U yaguachi -c '\dt'` lista las tablas.

**Acceptance Scenarios**:

1. **Given** un despliegue nuevo, **When** arranca la API, **Then** crea el esquema en PostgreSQL. Las migraciones son idempotentes y versionadas.
2. **Given** las mismas pruebas de la API (`api/tests`), **When** corren contra PostgreSQL, **Then** pasan todas.
3. **Given** que no hay PostgreSQL disponible, **When** arranca la API, **Then** reintenta la conexión con espera creciente durante unos 60 s y termina con un mensaje claro. El healthcheck de compose evita llegar a eso.

---

### User Story 2 - No se pierde ningún dato (Priority: P1)

**Acceptance Scenarios**:

1. **Given** el volumen actual con `yaguachi.db` (SQLite) y una base PostgreSQL vacía, **When** la API arranca por primera vez con PostgreSQL, **Then** importa todas las tablas y deja constancia en la tabla `meta`:
   - reportes, confirmaciones, me_gusta, avisos, niveles_oficiales, lecturas, reglas, ajustes, caché, usuarios, sesiones, auditoría, config, push_tokens y push_cola;
   - conserva los ids y ajusta las secuencias;
   - lo hace en una sola transacción.
2. **Given** la importación hecha, **When** se reinicia la API, **Then** no vuelve a importar.
3. **Given** el archivo SQLite, **When** termina la importación, **Then** el archivo queda intacto en el volumen como respaldo. No se borra.
4. **Given** el comando `python servidor.py --importar-sqlite <ruta>`, **When** se ejecuta a mano sobre una base vacía, **Then** hace la misma importación. Sobre una base con datos se niega, salvo con `--forzar`.

### Edge Cases

- Fechas guardadas como texto ISO en SQLite: se conservan como `TEXT` con el mismo formato, para no cambiar la lógica ni el contrato. Si se pasan a `timestamptz`, debe hacerse sin cambiar el formato que devuelve la API.
- Las comprobaciones atómicas de límites (antes con `_db_lock` y SQLite) MUST seguir siendo atómicas: con transacciones con el aislamiento adecuado, con bloqueos de PostgreSQL o manteniendo el candado del proceso con una sola instancia de la API. Cualquiera de las tres vale, siempre que la decisión quede documentada.
- `INSERT OR REPLACE`, `PRAGMA` y `AUTOINCREMENT` se traducen a sus equivalentes de PostgreSQL (`ON CONFLICT`, `information_schema`, `GENERATED … AS IDENTITY` o `SERIAL`).

## Requirements *(mandatory)*

- **FR-001**: servicio `db` en `compose.yaml` con `postgres:17-alpine`, volumen `yaguachi-weather_pg`, healthcheck `pg_isready` y sin puerto público. En desarrollo se publica solo en `127.0.0.1:${PUERTO_DB:-5433}`.
- **FR-002**: la API se conecta con `DATABASE_URL`. La clave sale de `POSTGRES_PASSWORD` en `.env`, nunca en el repositorio.
- **FR-003**: dependencia `psycopg[binary]`, más `psycopg_pool` si se usa pool, con versiones fijas en `api/requirements.txt`.
- **FR-004**: todo el SQL usa parámetros (`%s`) y nunca concatena datos.
- **FR-005**: importador de SQLite automático la primera vez, más el comando manual descrito arriba.
- **FR-006**: las fotos siguen como archivos en el volumen `datos`. `config.json` queda como está, porque guarda el secreto de las fotos.
- **FR-007**: copia de seguridad documentada: `docker compose exec db pg_dump -U yaguachi yaguachi > respaldo.sql`.

## Success Criteria *(mandatory)*

- **SC-001**: el 100 % de los registros de SQLite está en PostgreSQL tras la importación. Se comprueba contando las filas por tabla.
- **SC-002**: las pruebas de la API pasan contra PostgreSQL.
- **SC-003**: el contrato de la API no cambia: los frontends no se tocan.
