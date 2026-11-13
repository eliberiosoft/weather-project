"""Apoyo de las pruebas: levanta UNA API real (en este mismo proceso, en el puerto 8097 o YAGUACHI_PRUEBAS_PUERTO) con los datos en un
directorio temporal y una base PostgreSQL propia de la corrida, y un cliente HTTP mínimo que guarda la cookie de sesión.

Se corre en el mismo proceso para poder reemplazar el envío a FCM y la verificación de Turnstile (sin red) y
para limpiar el bloqueo por fallos entre pruebas. Nunca toca datos/, el volumen de Docker ni la base del compose.

Base de pruebas: YAGUACHI_PRUEBAS_DB (por defecto postgresql://yaguachi:pruebas@127.0.0.1:55432/yaguachi_pruebas).
En ese servidor se crea una base nueva y vacía por corrida (yaguachi_pruebas_<azar>) y se borra al terminar. Para
levantar un PostgreSQL de pruebas aislado:

    docker run -d --rm --name yw-pg-pruebas -e POSTGRES_PASSWORD=pruebas -e POSTGRES_USER=yaguachi \
        -e POSTGRES_DB=yaguachi_pruebas -p 127.0.0.1:55432:5432 postgres:17-alpine
    python -m unittest discover api/tests
    docker stop yw-pg-pruebas
"""
import atexit
import http.client
import json
import os
import random
import shutil
import sys
import tempfile
import threading
import uuid

API = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="yaguachi-pruebas-")
os.environ["YAGUACHI_DATOS"] = TMP
os.environ["YAGUACHI_CONFIG"] = os.path.join(TMP, "config.json")
# que las variables reales de quien corre las pruebas no cambien el resultado
for v in ("FIREBASE_CREDENCIALES", "FIREBASE_API_KEY", "FIREBASE_AUTH_DOMAIN", "FIREBASE_PROJECT_ID",
          "FIREBASE_MESSAGING_SENDER_ID", "FIREBASE_APP_ID", "FIREBASE_VAPID_KEY", "TURNSTILE_SITE_KEY",
          "TURNSTILE_SECRET_KEY", "COOKIE_SEGURA", "URL_PUBLICA", "YAGUACHI_PROXIES", "REDIS_URL"):
    os.environ.pop(v, None)
sys.path.insert(0, API)

import psycopg    # noqa: E402
from psycopg import sql  # noqa: E402

PRUEBAS_DB = os.environ.get("YAGUACHI_PRUEBAS_DB") or "postgresql://yaguachi:pruebas@127.0.0.1:55432/yaguachi_pruebas"


def _url_con_base(url, base):
    """La misma conexión que `url`, pero a la base `base`."""
    d = psycopg.conninfo.conninfo_to_dict(url)
    d["dbname"] = base
    return psycopg.conninfo.make_conninfo(**d)


def crear_base(prefijo="yaguachi_pruebas"):
    """Crea una base vacía en el servidor de pruebas y devuelve (nombre, url). Hay que borrarla con borrar_base()."""
    nombre = f"{prefijo}_{uuid.uuid4().hex[:10]}"
    try:
        with psycopg.connect(PRUEBAS_DB, autocommit=True, connect_timeout=5) as con:
            con.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(nombre)))
    except psycopg.OperationalError as e:
        sys.exit(f"Las pruebas necesitan un PostgreSQL de pruebas en YAGUACHI_PRUEBAS_DB ({e.__class__.__name__}). "
                 "Levántalo como se explica en api/tests/apoyo.py")
    return nombre, _url_con_base(PRUEBAS_DB, nombre)


def borrar_base(nombre):
    with psycopg.connect(PRUEBAS_DB, autocommit=True, connect_timeout=5) as con:
        con.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(nombre)))


BASE, URL_BASE = crear_base()
os.environ["DATABASE_URL"] = URL_BASE

import auth       # noqa: E402
import cuentas    # noqa: E402
import push       # noqa: E402,F401  (las pruebas lo usan como apoyo.push)
import servidor   # noqa: E402
import usuarios   # noqa: E402,F401
import comun      # noqa: E402
from comun import db, db_escritura  # noqa: E402,F401  (las pruebas usan apoyo.db y apoyo.db_escritura)

PUERTO = int(os.environ.get("YAGUACHI_PRUEBAS_PUERTO") or 8097)   # otro puerto si el 8097 está ocupado
TOKEN_PRUEBA = "XXXX.DUMMY.TOKEN.XXXX"     # lo que entrega el widget de Turnstile con la site key de prueba
FOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA" + "A" * 64     # JPEG mínimo (cabecera FF D8 FF)


def siteverify_falso(secreto, token, ip):
    """Como Cloudflare con la clave secreta de prueba: aprueba el token de prueba. Sin red."""
    return {"success": token == TOKEN_PRUEBA}


_estado = {}


def arrancar():
    """Levanta la API una sola vez para todas las pruebas. Devuelve {"srv", "clave_admin"}."""
    if _estado:
        return _estado
    auth._siteverify = siteverify_falso
    servidor.Manejador.log_message = lambda *a: None         # sin ruido en la salida de las pruebas
    clave = servidor.preparar(offline=True)
    srv = servidor.Servidor(("127.0.0.1", PUERTO), servidor.Manejador)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    _estado.update(srv=srv, clave_admin=clave)

    def cerrar():
        srv.shutdown()
        srv.server_close()
        shutil.rmtree(TMP, ignore_errors=True)
    atexit.register(cerrar)
    return _estado


def _limpiar_base():
    comun.cerrar_pool()
    borrar_base(BASE)


atexit.register(_limpiar_base)          # se registra antes que cerrar(): atexit corre en orden inverso


def limpiar_bloqueos():
    with auth._fallos_lock:
        auth._fallos.clear()
    cuentas.limpiar_limites()


def ip_nueva():
    """Cada prueba usa su propia IP (X-Real-IP; 127.0.0.1 es proxy de confianza) para no heredar bloqueos."""
    n = uuid.uuid4().int
    return f"10.{n % 250}.{(n >> 8) % 250}.{(n >> 16) % 250 + 1}"


def nombre_nuevo(prefijo="u"):
    return f"{prefijo}{uuid.uuid4().hex[:10]}"


def crear_usuario(rol, clave="clave-de-prueba-123", debe_cambiar=False, activo=True):
    """Usuario directo en la base (más rápido que pasar por la API). Devuelve (id, usuario, clave)."""
    usuario = nombre_nuevo(rol[:3])
    with db_escritura() as con:
        uid = con.execute("INSERT INTO usuarios (usuario, nombre, rol, clave, activo, debe_cambiar_clave, creado) "
                          "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                          (usuario, f"Persona {usuario}", rol, auth.hash_clave(clave), int(activo), int(debe_cambiar),
                           servidor.iso(servidor.ahora()))).fetchone()["id"]
    return uid, usuario, clave


def punto_en_canton():
    """(lat, lon) de un recinto que cae dentro del límite cantonal."""
    for rid, p in servidor.T.recintos.items():
        if servidor.T.en_canton(p["lon"], p["lat"]):
            return p["lat"], p["lon"], rid
    raise RuntimeError("sin recintos dentro del cantón")


class Cliente:
    """Cliente HTTP mínimo: guarda las cookies que le pone la API (la del panel en `cookie`, la de la cuenta ciudadana en
    `cookie_ciudadano` y las demás en `galletas`) y manda X-Requested-With salvo que se pida lo contrario."""

    def __init__(self, ip=None):
        self.ip = ip or ip_nueva()
        self.galletas = {}
        self.ultimo_set_cookie = None

    @property
    def cookie(self):
        return self.galletas.get(auth.COOKIE)

    @cookie.setter
    def cookie(self, valor):
        self._fijar(auth.COOKIE, valor)

    @property
    def cookie_ciudadano(self):
        return self.galletas.get(cuentas.COOKIE)

    @cookie_ciudadano.setter
    def cookie_ciudadano(self, valor):
        self._fijar(cuentas.COOKIE, valor)

    def _fijar(self, nombre, valor):
        if valor is None:
            self.galletas.pop(nombre, None)
        else:
            self.galletas[nombre] = valor

    def pedir(self, metodo, ruta, cuerpo=None, csrf=True, cabeceras=None):
        con = http.client.HTTPConnection("127.0.0.1", PUERTO, timeout=30)
        h = {"X-Real-IP": self.ip}
        if csrf:
            h["X-Requested-With"] = "yaguachi"
        if self.galletas:
            h["Cookie"] = "; ".join(f"{k}={v}" for k, v in self.galletas.items())
        datos = None
        if cuerpo is not None:
            datos = json.dumps(cuerpo).encode("utf-8")
            h["Content-Type"] = "application/json"
        h.update(cabeceras or {})
        con.request(metodo, ruta, body=datos, headers=h)
        r = con.getresponse()
        crudo = r.read()
        todas = r.msg.get_all("Set-Cookie") or []
        self.ultimo_set_cookie = todas[-1] if todas else None
        for sc in todas:
            nombre, valor = sc.split(";")[0].split("=", 1)
            # se guarda sin el prefijo __Host- (como antes): las pruebas de HTTPS arman la cabecera Cookie a mano
            self._fijar(nombre.removeprefix("__Host-"), None if "Max-Age=0" in sc else valor)
        con.close()
        tipo = r.getheader("Content-Type") or ""
        return r.status, (json.loads(crudo) if tipo.startswith("application/json") else crudo), r

    def get(self, ruta, **kw):
        return self.pedir("GET", ruta, **kw)

    def post(self, ruta, cuerpo=None, **kw):
        return self.pedir("POST", ruta, cuerpo if cuerpo is not None else {}, **kw)

    def login(self, usuario, clave, captcha=TOKEN_PRUEBA):
        return self.post("/api/auth/login", {"usuario": usuario, "clave": clave, "captcha": captcha})


def cedula_nueva():
    """Una cédula ecuatoriana válida al azar (provincia 01–24, tercer dígito < 6, verificador módulo 10)."""
    while True:
        base = f"{random.randint(1, 24):02d}{random.randint(0, 5)}{random.randint(0, 999999):06d}"
        for d in "0123456789":
            if cuentas.cedula_valida(base + d):
                return base + d


def datos_registro(**extra):
    d = {"nombre": "Ana María Pérez Vera", "cedula": cedula_nueva(),
         "email": f"{nombre_nuevo('v')}@ejemplo.ec", "clave": "clave-vecina-1", "consentimiento": True}
    d.update(extra)
    return d


def vecino(ip=None, **kw):
    """Cliente con una cuenta ciudadana nueva (registro propio, con cédula), listo para reportar."""
    c = Cliente(ip)
    codigo, cuerpo, _ = c.post("/api/cuenta/registro", datos_registro(**kw))
    assert codigo == 201, cuerpo
    return c


def sesion(rol, **kw):
    """Cliente ya autenticado con un usuario nuevo del rol pedido. Devuelve (cliente, id, usuario, clave)."""
    uid, usuario, clave = crear_usuario(rol, **kw)
    c = Cliente()
    codigo, cuerpo, _ = c.login(usuario, clave)
    assert codigo == 200, cuerpo
    return c, uid, usuario, clave
