"""Autenticación del panel: claves con scrypt, sesiones en cookie, roles y permisos, bloqueo por fallos y Turnstile.

Reemplaza al PIN compartido (X-PIN). Contrato: specs/014-usuarios-incidentes-push-react/contracts/api.md (§1–2).
"""
import base64
import datetime as dt
import hashlib
import hmac
import json
import os
import secrets
import string
import threading
import time
import urllib.parse
import urllib.request

from comun import ErrorApi, ahora, db, db_escritura, iso, leer_iso

# --------------------------------------------------------------------------- roles y permisos

PERMISOS_TODOS = ("panel.ver", "niveles.fijar", "reportes.revisar", "avisos.publicar", "reglas.editar",
                  "ajustes.editar", "incidentes.crear", "incidentes.gestionar", "usuarios.gestionar", "config.editar",
                  "dashboard.ver", "avisos.eliminar", "incidentes.eliminar", "incidentes.reactivar",
                  "albergues.gestionar", "reportes.vigencia", "reportes.eliminar", "alcance.detalle")
# albergues.gestionar: crear, editar (fotos, título, descripción, ubicación) y eliminar albergues (superadmin y analista)
# reportes.vigencia: cambiar hasta cuándo se ven uno o varios reportes o incidentes a la vez (superadmin y analista)
# reportes.eliminar: borrar DEFINITIVAMENTE uno o varios reportes o incidentes a la vez desde «Reportes» (superadmin)
# dashboard.ver: mapa en vivo de eventos y análisis (mapa de calor, horas pico, sin atender, exportar a Excel)
# avisos.eliminar: eliminación lógica de avisos (desaparecen de la app y del panel; la fila queda en la base)
# incidentes.eliminar: borrado definitivo de un incidente del equipo (queda solo el registro en la auditoría)
# incidentes.reactivar: volver a presentar un incidente retirado
# alcance.detalle: ver qué teléfonos (por código, sin nombre) tienen notificaciones y cuáles abrieron cada aviso o
#   incidente (spec 021); cada consulta queda en la auditoría
SOLO_SUPERADMIN = ("usuarios.gestionar", "config.editar", "dashboard.ver", "avisos.eliminar",
                   "incidentes.eliminar", "incidentes.reactivar", "reportes.eliminar", "alcance.detalle")
ROLES = {
    "superadmin": PERMISOS_TODOS,
    "analista": tuple(p for p in PERMISOS_TODOS if p not in SOLO_SUPERADMIN),
    "operador": ("panel.ver", "incidentes.crear"),
}

# --------------------------------------------------------------------------- claves

SCRYPT_N, SCRYPT_R, SCRYPT_P = 2 ** 15, 8, 1
# scrypt con n=2^15 y r=8 usa 32 MiB, justo el tope por defecto de OpenSSL: hay que darle margen
_SCRYPT_MAXMEM = 64 * 1024 * 1024
# cada cálculo usa 32 MiB: con 200 hilos a la vez serían 6 GB. Se limita a unos pocos simultáneos
_scrypt_cupos = threading.BoundedSemaphore(4)
CLAVE_MIN, CLAVE_MAX = 12, 128
# sin caracteres que se confunden al dictarlos o copiarlos a mano (0/O, 1/l/I)
_ALFABETO = "".join(c for c in string.ascii_letters + string.digits if c not in "0O1lI")


def _scrypt(clave, sal, n, r, p):
    with _scrypt_cupos:
        return hashlib.scrypt(clave.encode("utf-8"), salt=sal, n=n, r=r, p=p, maxmem=_SCRYPT_MAXMEM, dklen=32)


def hash_clave(clave):
    sal = secrets.token_bytes(16)
    h = _scrypt(clave, sal, SCRYPT_N, SCRYPT_R, SCRYPT_P)
    b64 = lambda x: base64.b64encode(x).decode("ascii")
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${b64(sal)}${b64(h)}"


def clave_ok(clave, guardada):
    """Compara en tiempo constante. Con `guardada` vacía igual calcula un hash para no delatar si el usuario existe."""
    try:
        _, n, r, p, sal, h = (guardada or "").split("$")
        n, r, p, sal, h = int(n), int(r), int(p), base64.b64decode(sal), base64.b64decode(h)
    except ValueError:
        _scrypt(clave, b"\0" * 16, SCRYPT_N, SCRYPT_R, SCRYPT_P)        # mismo costo que un usuario real
        return False
    return hmac.compare_digest(_scrypt(clave, sal, n, r, p), h)


def clave_aleatoria(largo=16):
    return "".join(secrets.choice(_ALFABETO) for _ in range(largo))


def validar_clave_nueva(nueva, actual=None):
    if not isinstance(nueva, str) or len(nueva) < CLAVE_MIN:
        raise ErrorApi(400, f"la clave nueva debe tener al menos {CLAVE_MIN} caracteres", k="auth.clave_corta")
    if len(nueva) > CLAVE_MAX:
        raise ErrorApi(400, f"la clave nueva no puede pasar de {CLAVE_MAX} caracteres", k="auth.clave_larga")
    if actual is not None and hmac.compare_digest(nueva.encode("utf-8"), actual.encode("utf-8")):
        raise ErrorApi(400, "la clave nueva no puede ser igual a la actual", k="auth.clave_igual")

# --------------------------------------------------------------------------- usuarios (lectura)


def usuario_publico(r):
    """Objeto `Usuario` del contrato (nunca incluye el hash de la clave)."""
    return {"id": r["id"], "usuario": r["usuario"], "nombre": r["nombre"], "rol": r["rol"],
            "permisos": list(ROLES.get(r["rol"], ())), "debe_cambiar_clave": bool(r["debe_cambiar_clave"]),
            "activo": bool(r["activo"]), "creado": r["creado"], "ultimo_ingreso": r["ultimo_ingreso"]}

# --------------------------------------------------------------------------- sesiones

COOKIE = "yw_sesion"
# Con HTTPS (producción) la cookie lleva el prefijo __Host-: el navegador solo la acepta con Secure, Path=/ y sin Domain,
# así que otro subdominio del mismo dominio no puede plantar ni pisar la sesión (fijación de sesión). En desarrollo
# (http://localhost) no se puede usar __Host- y queda el nombre simple.
COOKIE_HOST = "__Host-yw_sesion"


def nombre_cookie(segura):
    return COOKIE_HOST if segura else COOKIE
INACTIVIDAD = dt.timedelta(hours=12)
MAXIMA = dt.timedelta(days=7)


def _sha(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def crear_sesion(usuario_id, ip):
    """Devuelve el token en claro (va solo en la cookie); en la base queda su SHA-256."""
    token = secrets.token_urlsafe(32)
    t = iso(ahora())
    with db_escritura() as con:
        con.execute("INSERT INTO sesiones (token_sha, usuario_id, creado, ultimo_uso, ip) VALUES (%s,%s,%s,%s,%s)",
                    (_sha(token), usuario_id, t, t, ip))
    return token


def cerrar_sesion(token):
    if token:
        with db_escritura() as con:
            con.execute("DELETE FROM sesiones WHERE token_sha=%s", (_sha(token),))


def cerrar_sesiones_de(con, usuario_id):
    """Se llama dentro de una transacción ya abierta (cambio de clave o de rol, desactivación)."""
    con.execute("DELETE FROM sesiones WHERE usuario_id=%s", (usuario_id,))


def usuario_de_sesion(token):
    """Usuario activo dueño de la sesión, o None si no hay sesión válida."""
    if not token or len(token) > 200:
        return None
    sha = _sha(token)
    with db() as con:
        r = con.execute("SELECT s.creado AS s_creado, s.ultimo_uso AS s_uso, u.* FROM sesiones s "
                        "JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_sha=%s", (sha,)).fetchone()
    if not r:
        return None
    t = ahora()
    if not r["activo"] or leer_iso(r["s_uso"]) < t - INACTIVIDAD or leer_iso(r["s_creado"]) < t - MAXIMA:
        cerrar_sesion(token)
        return None
    # no se escribe en cada petición: basta con refrescar el último uso cada minuto
    if leer_iso(r["s_uso"]) < t - dt.timedelta(minutes=1):
        with db_escritura() as con:
            con.execute("UPDATE sesiones SET ultimo_uso=%s WHERE token_sha=%s", (iso(t), sha))
    return usuario_publico(r)


def borrar_sesiones_vencidas(con):
    t = ahora()
    con.execute("DELETE FROM sesiones WHERE ultimo_uso < %s OR creado < %s", (iso(t - INACTIVIDAD), iso(t - MAXIMA)))


def cookie_sesion(token, segura):
    nombre, base = nombre_cookie(segura), ("Path=/; Secure" if segura else "Path=/api")
    if token is None:   # borrar
        return f"{nombre}=; HttpOnly; SameSite=Strict; {base}; Max-Age=0"
    return f"{nombre}={token}; HttpOnly; SameSite=Strict; {base}; Max-Age={int(MAXIMA.total_seconds())}"

# --------------------------------------------------------------------------- bloqueo por fallos (por IP y por usuario)

# clave -> (fallos seguidos, bloqueado hasta, último fallo). En memoria, como el PIN de antes. Tres claves:
#   ("ip", ip)              la conexión: frena a quien prueba muchos usuarios (hasta 24 h)
#   ("ipu", ip, usuario)    esa conexión contra esa cuenta (hasta 24 h)
#   ("u", usuario)          la cuenta desde cualquier lado: frena un ataque repartido entre muchas IP, pero como mucho
#                           15 min, para que nadie pueda dejar fuera a «admin» por horas fallando a propósito.
# Los fallos se olvidan si pasa un día sin ninguno nuevo.
_fallos, _fallos_lock = {}, threading.Lock()
FALLOS_LIBRES = 5
TOPE_CUENTA = 15 * 60
OLVIDO = 86400


def _espera(n):
    """Tras 5 fallos seguidos: 1 min, 2 min, 4 min… hasta 24 h."""
    return min(60 * 2 ** (n - FALLOS_LIBRES), 86400) if n >= FALLOS_LIBRES else 0


def comprobar_bloqueo(*claves):
    ya = time.time()
    with _fallos_lock:
        hasta = max((_fallos.get(c, (0, 0.0, 0.0))[1] for c in claves), default=0.0)
    if hasta > ya:
        raise ErrorApi(429, "demasiados intentos fallidos; espera unos minutos", k="auth.espera")


def anotar_fallo(*claves):
    ya = time.time()
    with _fallos_lock:
        if len(_fallos) > 10000:          # que la tabla no crezca sin fin
            _fallos.clear()
        for c in claves:
            n, _, ultimo = _fallos.get(c, (0, 0.0, 0.0))
            n = 1 if ya - ultimo > OLVIDO else n + 1
            espera = _espera(n)
            if c[0] == "u":
                espera = min(espera, TOPE_CUENTA)
            _fallos[c] = (n, ya + espera, ya)


def claves_login(ip, usuario):
    return [("ip", ip)] + ([("ipu", ip, usuario), ("u", usuario)] if usuario else [])


def limpiar_fallos(*claves):
    with _fallos_lock:
        for c in claves:
            _fallos.pop(c, None)

# --------------------------------------------------------------------------- Cloudflare Turnstile

# Claves de prueba de Cloudflare («siempre pasa»): solo para desarrollo, cuando faltan las variables
TURNSTILE_SITE_PRUEBA = "1x00000000000000000000AA"
TURNSTILE_SECRETO_PRUEBA = "1x0000000000000000000000000000000AA"
SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def turnstile_site_key():
    return os.environ.get("TURNSTILE_SITE_KEY") or TURNSTILE_SITE_PRUEBA


def _turnstile_secreto():
    return os.environ.get("TURNSTILE_SECRET_KEY") or TURNSTILE_SECRETO_PRUEBA


def captcha_de_prueba():
    return _turnstile_secreto() == TURNSTILE_SECRETO_PRUEBA


def _siteverify(secreto, token, ip):
    datos = urllib.parse.urlencode({"secret": secreto, "response": token, "remoteip": ip or ""}).encode()
    req = urllib.request.Request(SITEVERIFY, data=datos, headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))


def produccion_sin_captcha():
    """Publicado con https pero con la clave de prueba (falta TURNSTILE_SECRET_KEY): el captcha no protegería nada."""
    return captcha_de_prueba() and (os.environ.get("URL_PUBLICA") or "").startswith("https://")


def captcha_ok(token, ip):
    if not isinstance(token, str) or not token or len(token) > 2048:
        return False
    if produccion_sin_captcha():
        # la clave de prueba aprueba a cualquiera: en producción se rechaza el ingreso en vez de abrir la puerta
        print("  [ERROR] URL_PUBLICA es https pero falta TURNSTILE_SECRET_KEY: se rechaza el ingreso al panel")
        return False
    secreto = _turnstile_secreto()
    try:
        return _siteverify(secreto, token, ip).get("success") is True
    except Exception as e:                       # sin red o Cloudflare caído
        if secreto == TURNSTILE_SECRETO_PRUEBA:
            # la clave de prueba siempre aprueba: sin red da lo mismo; así se puede desarrollar sin internet
            print(f"  [aviso] Turnstile sin respuesta ({e.__class__.__name__}); clave de prueba: se acepta")
            return True
        print(f"  [aviso] Turnstile sin respuesta ({e.__class__.__name__}); se rechaza el ingreso")
        return False

# --------------------------------------------------------------------------- auditoría


def auditar(con, usuario_id, accion, detalle=None):
    """Quién, qué y cuándo. Se llama dentro de la transacción de la acción (si la acción falla, no queda rastro falso)."""
    if detalle is not None and not isinstance(detalle, str):
        detalle = json.dumps(detalle, ensure_ascii=False)[:1000]
    con.execute("INSERT INTO auditoria (usuario_id, accion, detalle, creado) VALUES (%s,%s,%s,%s)",
                (usuario_id, accion, detalle, iso(ahora())))


def auditar_suelto(usuario_id, accion, detalle=None):
    with db_escritura() as con:
        auditar(con, usuario_id, accion, detalle)

# --------------------------------------------------------------------------- login, logout y cambio de clave


def login(b, ip):
    """Devuelve (usuario, token). Orden: bloqueo (429) → captcha (400) → credenciales (401) → activo (403)."""
    nombre = b.get("usuario")
    clave = b.get("clave")
    nombre = nombre.strip().lower()[:64] if isinstance(nombre, str) else ""
    claves_bloqueo = claves_login(ip, nombre)
    comprobar_bloqueo(*claves_bloqueo)
    if not captcha_ok(b.get("captcha"), ip):
        raise ErrorApi(400, "no se pudo verificar que eres una persona; vuelve a intentarlo", k="auth.captcha")
    with db() as con:
        r = con.execute("SELECT * FROM usuarios WHERE usuario=%s", (nombre,)).fetchone()
    valida = isinstance(clave, str) and 0 < len(clave) <= CLAVE_MAX
    if not (valida and clave_ok(clave, r["clave"] if r else None) and r):
        anotar_fallo(*claves_bloqueo)
        # se audita igual exista o no el usuario: la misma escritura en los dos casos (que el tiempo de respuesta
        # no diga qué usuarios existen) y queda rastro de quién prueba nombres
        auditar_suelto(r["id"] if r else None, "login.fallo", None if r else {"usuario": nombre[:64]})
        raise ErrorApi(401, "usuario o clave incorrectos", k="auth.credenciales")
    limpiar_fallos(*claves_bloqueo)
    if not r["activo"]:
        raise ErrorApi(403, "este usuario está desactivado", k="auth.inactivo")
    t = iso(ahora())
    with db_escritura() as con:
        con.execute("UPDATE usuarios SET ultimo_ingreso=%s WHERE id=%s", (t, r["id"]))
        auditar(con, r["id"], "login")
        r = con.execute("SELECT * FROM usuarios WHERE id=%s", (r["id"],)).fetchone()
    return usuario_publico(r), crear_sesion(r["id"], ip)


def cambiar_clave(usuario, b, ip):
    """Cambia la clave propia. Cierra todas las sesiones del usuario y devuelve un token nuevo para seguir dentro."""
    actual, nueva = b.get("actual"), b.get("nueva")
    claves_bloqueo = claves_login(ip, usuario["usuario"])
    comprobar_bloqueo(*claves_bloqueo)
    with db() as con:
        r = con.execute("SELECT clave FROM usuarios WHERE id=%s", (usuario["id"],)).fetchone()
    if not (isinstance(actual, str) and 0 < len(actual) <= CLAVE_MAX and r and clave_ok(actual, r["clave"])):
        anotar_fallo(*claves_bloqueo)          # probar claves desde una sesión robada también cuenta
        raise ErrorApi(400, "la clave actual no es correcta", k="auth.clave_actual")
    limpiar_fallos(*claves_bloqueo)
    validar_clave_nueva(nueva, actual)
    h = hash_clave(nueva)
    with db_escritura() as con:
        con.execute("UPDATE usuarios SET clave=%s, debe_cambiar_clave=0 WHERE id=%s", (h, usuario["id"]))
        cerrar_sesiones_de(con, usuario["id"])
        auditar(con, usuario["id"], "clave.cambiar")
    return crear_sesion(usuario["id"], ip)
