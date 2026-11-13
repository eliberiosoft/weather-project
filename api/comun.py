"""Piezas compartidas por servidor.py, auth.py, usuarios.py y push.py: rutas de datos, conexión a PostgreSQL,
hora y errores.

Vive aparte para que los módulos nuevos no importen servidor.py (que se ejecuta como __main__: importarlo
crearía una segunda copia con otro estado).

Base de datos (spec 016): PostgreSQL 17 con psycopg 3 y un pool de conexiones (psycopg_pool). La URL sale de
DATABASE_URL, p. ej. postgresql://yaguachi:<clave>@db:5432/yaguachi (la clave, de POSTGRES_PASSWORD en .env).
Las filas llegan como dict (dict_row): el código sigue leyendo r["campo"].
"""
import contextlib
import datetime as dt
import os
import sys
import threading
import time

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)                      # raíz del repositorio (api/, cliente/, admin/, compartido/)
# en Docker se apuntan a un volumen para que las fotos (y el SQLite viejo, como respaldo) sobrevivan al contenedor
DATOS = os.environ.get("YAGUACHI_DATOS") or os.path.join(RAIZ, "datos")
FOTOS = os.path.join(DATOS, "fotos")
SQLITE_ANTERIOR = os.path.join(DATOS, "yaguachi.db")   # base de antes de la spec 016: solo se lee para importarla

TZ = dt.timezone(dt.timedelta(hours=-5), "ECT")           # Ecuador continental, sin horario de verano

# --------------------------------------------------------------------------- atomicidad de los límites
#
# DECISIÓN (spec 016, «comprobaciones atómicas»): toda comprobación de límites + escritura (topes por IP y por
# dispositivo, anti-saturación de avisos, último superadmin, etc.) va dentro de `db_escritura()`, que toma DOS
# candados, en este orden:
#   1. `_db_lock`, el candado del proceso: los hilos de esta API esperan en fila SIN ocupar una conexión del pool;
#   2. `pg_advisory_xact_lock(CANDADO_ESCRITURA)` dentro de la transacción: serializa las escrituras también entre
#      procesos (si algún día hay dos réplicas de la API, o un comando de consola mientras corre el servidor).
#      Se suelta solo al terminar la transacción (COMMIT o ROLLBACK).
# Con aislamiento READ COMMITTED cada sentencia ve lo ya confirmado, y como quien tenía el candado confirmó antes de
# soltarlo, los conteos de los topes siempre incluyen la escritura anterior. Es el mismo comportamiento que tenía
# SQLite con `_db_lock`: un solo escritor a la vez; las lecturas no esperan.
_db_lock = threading.Lock()
CANDADO_ESCRITURA = 0x59570001        # «YW» + 1: clave fija del advisory lock de escrituras
CANDADO_MIGRACION = 0x59570002        # migraciones e importación de SQLite al arrancar

# --------------------------------------------------------------------------- conexión


def url_base():
    """DATABASE_URL o, para desarrollar sin Docker, el PostgreSQL del compose publicado en 127.0.0.1:PUERTO_DB."""
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    puerto = os.environ.get("PUERTO_DB") or "5433"
    return f"postgresql://yaguachi@127.0.0.1:{puerto}/yaguachi"


def _extra():
    """Parámetros de conexión que no van en la URL (la clave de .env si la URL no la trae)."""
    extra = {"application_name": "yaguachi-api", "connect_timeout": 5}
    if not os.environ.get("DATABASE_URL") and os.environ.get("POSTGRES_PASSWORD"):
        extra["password"] = os.environ["POSTGRES_PASSWORD"]
    return extra


def destino(url=None):
    """«host:puerto/base» para los mensajes (nunca la clave)."""
    try:
        d = psycopg.conninfo.conninfo_to_dict(url or url_base())
    except psycopg.ProgrammingError:
        return "(DATABASE_URL inválida)"
    return f"{d.get('host') or 'localhost'}:{d.get('port') or 5432}/{d.get('dbname') or '?'}"


def conectar_directo(url=None, **kw):
    """Una conexión suelta (sin pool), con filas como dict. Para comandos de consola y pruebas."""
    return psycopg.connect(url or url_base(), row_factory=dict_row, **{**_extra(), **kw})


def esperar_base(url=None, total_s=60):
    """Reintenta con espera creciente (1, 2, 4, 8… s) durante ~`total_s` s. Si no hay base, sale con un mensaje claro."""
    limite = time.monotonic() + total_s
    espera, intento = 1, 1
    while True:
        try:
            with conectar_directo(url) as con:
                con.execute("SELECT 1")
            return
        except psycopg.OperationalError as e:
            resto = limite - time.monotonic()
            if resto <= 0:
                motivo = (str(e).strip().splitlines() or ["sin detalle"])[-1]
                sys.exit(f"ERROR: no hay conexión con PostgreSQL en {destino(url)} después de {total_s} s "
                         f"({intento} intentos). Revisa que el servicio `db` esté arriba y DATABASE_URL. Último error: {motivo}")
            print(f"Esperando a PostgreSQL en {destino(url)} (intento {intento}; reintento en {min(espera, resto):.0f} s)…",
                  flush=True)
            time.sleep(min(espera, resto))
            espera, intento = espera * 2, intento + 1


_pool = {"p": None}
_pool_lock = threading.Lock()
_local = threading.local()          # conexión en uso por este hilo (para que db() anidado no pida una segunda)


def conectar(url=None):
    """Abre el pool (una sola vez por proceso). Antes espera a que la base responda."""
    with _pool_lock:
        if _pool["p"] is not None:
            return _pool["p"]
        esperar_base(url)
        p = ConnectionPool(url or url_base(), min_size=1, max_size=int(os.environ.get("YAGUACHI_DB_POOL") or 20),
                           kwargs={"row_factory": dict_row, **_extra()}, timeout=30, name="yaguachi",
                           check=ConnectionPool.check_connection, open=False)
        p.open(wait=True, timeout=30)
        _pool["p"] = p
        return p


def cerrar_pool():
    with _pool_lock:
        if _pool["p"] is not None:
            _pool["p"].close()
            _pool["p"] = None


@contextlib.contextmanager
def db():
    """Conexión del pool dentro de una transacción: COMMIT al salir bien, ROLLBACK si hay una excepción (igual que
    `with sqlite3.connect() as con`). Si este hilo ya tiene una abierta (llamadas anidadas), se reutiliza la misma
    transacción: así un hilo nunca ocupa dos conexiones ni se queda esperando por sí mismo."""
    con = getattr(_local, "con", None)
    if con is not None:
        yield con
        return
    with (_pool["p"] or conectar()).connection() as con:
        _local.con = con
        try:
            yield con
        finally:
            _local.con = None


@contextlib.contextmanager
def db_escritura():
    """Transacción de escritura con comprobaciones atómicas (ver «DECISIÓN» arriba)."""
    with _db_lock, db() as con:
        con.execute("SELECT pg_advisory_xact_lock(%s)", (CANDADO_ESCRITURA,))
        yield con


def ahora():
    return dt.datetime.now(TZ)


def iso(t):
    return t.isoformat(timespec="seconds")


def leer_iso(s):
    """ISO 8601 → datetime con zona. Acepta «Z» (Python 3.10 no la entiende) y, sin zona, asume la de Ecuador."""
    d = dt.datetime.fromisoformat(s[:-1] + "+00:00" if s.endswith("Z") else s)
    return d if d.tzinfo else d.replace(tzinfo=TZ)


def plataforma(ua):
    """Tipo de teléfono aproximado («Android · Chrome», «iPhone · Safari»): solo sistema y navegador, nada más del
    User-Agent (ni versión ni modelo). Sirve para que el superadmin reconozca los teléfonos del alcance (spec 021)."""
    ua = ua or ""
    so = ("iPhone" if "iPhone" in ua else "iPad" if "iPad" in ua else "Android" if "Android" in ua else
          "Windows" if "Windows" in ua else "Mac" if "Macintosh" in ua else "Linux" if "Linux" in ua else "otro")
    nav = ("Edge" if "Edg" in ua else "Samsung Internet" if "SamsungBrowser" in ua else "Firefox" if ("Firefox" in ua or "FxiOS" in ua)
           else "Chrome" if ("Chrome" in ua or "CriOS" in ua) else "Safari" if "Safari" in ua else "otro")
    return f"{so} · {nav}"


class ErrorApi(Exception):
    """Error que se devuelve tal cual al cliente: {"error": mensaje, "k": clave i18n (opcional)}."""

    def __init__(self, codigo, mensaje, k=None):
        super().__init__(mensaje)
        self.codigo, self.mensaje, self.k = codigo, mensaje, k

    def cuerpo(self):
        return {"error": self.mensaje, "k": self.k} if self.k else {"error": self.mensaje}
