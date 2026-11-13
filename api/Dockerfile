# Yaguachi Weather · API (Python, biblioteca estándar + psycopg para PostgreSQL + redis para la caché de tormentas
# + firebase-admin opcional para el push).
# Se construye desde la raíz del repositorio: docker compose build api
FROM python:3.15-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TZ=America/Guayaquil \
    YAGUACHI_DATOS=/app/datos \
    YAGUACHI_CONFIG=/app/datos/config.json \
    YAGUACHI_CAPAS=/app/capas

WORKDIR /app

# Dependencias primero (capa en caché mientras requirements.txt no cambie), con versión fija y sin caché de pip
COPY api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

RUN useradd --create-home --uid 1000 yaguachi \
    && mkdir -p /app/datos \
    && chown yaguachi:yaguachi /app/datos

COPY api/servidor.py api/comun.py api/esquema.py api/importar_sqlite.py api/auth.py api/usuarios.py api/push.py api/xlsx.py api/cuentas.py api/cache.py api/tormentas.py ./
COPY compartido/capas/ ./capas/

# La base es PostgreSQL (DATABASE_URL, servicio `db` del compose). El volumen de datos guarda las fotos, config.json y,
# si existe, el yaguachi.db de SQLite de antes: se importa a PostgreSQL la primera vez y se deja intacto como respaldo.

USER yaguachi

EXPOSE 8080
VOLUME ["/app/datos"]

# Credenciales de Firebase: NO van en la imagen. Se montan como secreto de solo lectura y se indica la ruta con
# FIREBASE_CREDENCIALES (p. ej. /run/secrets/firebase_credenciales). Sin ellas, el push queda deshabilitado.

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/territorio', timeout=4)" || exit 1

CMD ["python", "servidor.py"]
