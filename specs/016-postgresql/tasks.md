# Tasks: Base de datos PostgreSQL

## Hecho

- [X] T001 Servicio `db` (`postgres:17-alpine`, volumen `yaguachi-weather_pg`, healthcheck, solo `127.0.0.1:5433`) y `DATABASE_URL` en `compose.yaml`
- [X] T002 `.env` local con `POSTGRES_PASSWORD` aleatoria en hexadecimal (fuera del repositorio) y `.env.example` actualizado
- [X] T003 `api/comun.py`: pool de psycopg, `db()`, `db_escritura()` con doble candado y reintento al arrancar
- [X] T004 `api/esquema.py`: migraciones versionadas e idempotentes
- [X] T005 SQL traducido en `servidor.py`, `auth.py`, `usuarios.py` y `push.py`
- [X] T006 `api/importar_sqlite.py` (automático y `--importar-sqlite`) y pruebas del importador
- [X] T007 Pruebas contra un PostgreSQL de pruebas (75 OK) y prueba de atomicidad
- [X] T008 Importación real en el despliegue: 16 de 16 filas, el SQLite queda como respaldo
- [X] T009 `iniciar-dev.sh`, `INICIAR_APP.bat`, README y constitución 2.1.0

## Pendiente

- [X] T010 nginx (cliente y admin) resuelve `api` por DNS en cada petición (`resolver 127.0.0.11`): recrear la API ya no deja 502 (comprobado)
- [ ] T011 Copia de seguridad programada (`pg_dump` diario con rotación)
- [ ] T012 Cuando todo esté estable, decidir si se borra el `yaguachi.db` de respaldo del volumen `datos`
