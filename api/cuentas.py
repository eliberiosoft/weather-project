"""Cuentas ciudadanas con registro propio: nombres y apellidos, cédula, correo, contraseña y foto opcional (se cambia
luego). Se entra con el correo o la cédula y la contraseña. Reportar exige una cuenta.

Contrato: specs/018-cuentas-ciudadanas/contracts/api.md.

- La sesión es una cookie propia (`__Host-yw_ciudadano` con HTTPS), distinta de la del panel.
- La cédula no cambia nunca; el nombre y el correo se pueden corregir (`POST /api/cuenta/perfil`).
- Ningún dato del vecino (nombre, cédula, foto) se publica con sus reportes; el objeto `Ciudadano` solo lo ve su dueño.
"""
import datetime as dt
import hashlib
import os
import re
import secrets
import shutil
import threading
import time
import uuid

import auth
from comun import FOTOS, ErrorApi, ahora, db, db_escritura, iso, leer_iso

# --------------------------------------------------------------------------- validación

NOMBRE_MIN, NOMBRE_MAX = 5, 120
EMAIL_MAX = 254
CLAVE_MIN, CLAVE_MAX = 6, 128
RE_NOMBRE = re.compile(r"(?:[^\W\d_]|[ '\-])+")            # letras (con tildes y ñ), espacios, apóstrofo y guion
RE_EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s.]{2,}")
RE_CEDULA = re.compile(r"\d{10}")


def cedula_valida(c):
    """Cédula ecuatoriana: 10 dígitos, provincia 01–24 o 30, tercer dígito menor que 6 y verificador (módulo 10)."""
    if not isinstance(c, str) or not RE_CEDULA.fullmatch(c):
        return False
    prov = int(c[:2])
    if not (1 <= prov <= 24 or prov == 30) or int(c[2]) >= 6:
        return False
    suma = 0
    for i, d in enumerate(c[:9]):
        v = int(d) * (2 if i % 2 == 0 else 1)
        suma += v - 9 if v > 9 else v
    return (10 - suma % 10) % 10 == int(c[9])


def _nombre(v):
    """Nombres y apellidos en una sola caja: de 5 a 120 caracteres, solo letras (con tildes y ñ), espacios, apóstrofo y
    guion, y al menos dos palabras (nombre y apellido). Se guarda sin espacios dobles."""
    texto = " ".join(v.split()) if isinstance(v, str) else ""
    palabras = [p for p in texto.split(" ") if any(ch.isalpha() for ch in p)]
    if not (NOMBRE_MIN <= len(texto) <= NOMBRE_MAX) or len(palabras) < 2 or not RE_NOMBRE.fullmatch(texto):
        raise ErrorApi(400, "escribe tus nombres y apellidos", k="cuenta.nombre")
    return texto


def _cedula(v):
    c = v.strip() if isinstance(v, str) else ""
    if not cedula_valida(c):
        raise ErrorApi(400, "la cédula no es válida: revisa los 10 dígitos", k="cuenta.cedula")
    return c


def _email(v):
    e = v.strip().lower() if isinstance(v, str) else ""
    if len(e) > EMAIL_MAX or not RE_EMAIL.fullmatch(e):
        raise ErrorApi(400, "el correo no es válido", k="cuenta.email")
    return e


def _clave(v):
    if not isinstance(v, str) or not (CLAVE_MIN <= len(v) <= CLAVE_MAX):
        raise ErrorApi(400, f"la contraseña debe tener de {CLAVE_MIN} a {CLAVE_MAX} caracteres", k="cuenta.clave")
    return v


def _consentimiento(b):
    if b.get("consentimiento") is not True:
        raise ErrorApi(400, "para crear tu cuenta acepta la política de privacidad", k="cuenta.consentimiento")


def datos_registro(b):
    """Valida el cuerpo del registro. Devuelve un dict listo para guardar."""
    d = {"nombre": _nombre(b.get("nombre")),
         "cedula": _cedula(b.get("cedula")), "email": _email(b.get("email")), "clave": _clave(b.get("clave"))}
    _consentimiento(b)
    return d

# --------------------------------------------------------------------------- objeto público


def ciudadano_publico(r):
    """Objeto `Ciudadano`: solo lo ve su dueño. Nunca el id interno ni el hash de la clave."""
    return {"nombre": r["nombre"], "cedula": r["cedula"], "email": r["email"],
            "foto": bool(r["foto"]), "creado": r["creado"]}

# --------------------------------------------------------------------------- foto de perfil

PREFIJO_FOTO = "perfil-"    # la limpieza de 90 días de las fotos de reportes no las toca (no están en `reportes`)


def ruta_foto(nombre):
    return os.path.join(FOTOS, nombre) if nombre else None


def _guardar_foto(crudo):
    """Escribe la foto (ya validada como JPEG por la API) y devuelve el nombre del archivo."""
    if shutil.disk_usage(FOTOS).free < 1024 ** 3:
        raise ErrorApi(507, "no hay espacio para fotos ahora; crea la cuenta sin foto", k="foto.espacio")
    nombre = f"{PREFIJO_FOTO}{uuid.uuid4().hex}.jpg"
    with open(os.path.join(FOTOS, nombre), "wb") as fh:
        fh.write(crudo)
    return nombre


def _borrar_foto(nombre):
    ruta = ruta_foto(nombre)
    if ruta and os.path.isfile(ruta):
        try:
            os.remove(ruta)
        except OSError:
            pass


_cambios_foto, _cambios_lock = {}, threading.Lock()
CAMBIOS_FOTO_DIA = 20


def _contar_cambio_foto(cid):
    ya = time.time()
    with _cambios_lock:
        if len(_cambios_foto) > 10000:
            _cambios_foto.clear()
        veces = [x for x in _cambios_foto.get(cid, []) if ya - x < 86400]
        if len(veces) >= CAMBIOS_FOTO_DIA:
            _cambios_foto[cid] = veces
            raise ErrorApi(429, "cambiaste la foto muchas veces hoy; vuelve a intentarlo mañana", k="cuenta.espera")
        _cambios_foto[cid] = veces + [ya]


def limpiar_limites():
    with _cambios_lock:
        _cambios_foto.clear()


def cambiar_foto(ciudadano, crudo):
    """`crudo`: bytes JPEG validados o None (quitar). Borra el archivo anterior. Devuelve el `Ciudadano`."""
    _contar_cambio_foto(ciudadano["id"])
    nuevo = _guardar_foto(crudo) if crudo else None
    try:
        with db_escritura() as con:
            r = con.execute("SELECT foto FROM ciudadanos WHERE id=%s", (ciudadano["id"],)).fetchone()
            anterior = r["foto"] if r else None
            r = con.execute("UPDATE ciudadanos SET foto=%s WHERE id=%s RETURNING *", (nuevo, ciudadano["id"])).fetchone()
    except BaseException:
        _borrar_foto(nuevo)
        raise
    _borrar_foto(anterior)
    return ciudadano_publico(r)

# --------------------------------------------------------------------------- límites

CUENTAS_NUEVAS_IP_HORA = 5


def _tope_cuentas_nuevas(con, ip):
    """Dentro de db_escritura (atómico con el INSERT)."""
    n = con.execute("SELECT COUNT(*) AS n FROM ciudadanos WHERE ip=%s AND creado>%s",
                    (ip, iso(ahora() - dt.timedelta(hours=1)))).fetchone()["n"]
    if n >= CUENTAS_NUEVAS_IP_HORA:
        raise ErrorApi(429, "se crearon muchas cuentas desde esta conexión; espera un rato", k="cuenta.espera")


def _unicos(con, cedula, email):
    if con.execute("SELECT 1 FROM ciudadanos WHERE cedula=%s", (cedula,)).fetchone():
        raise ErrorApi(409, "ya hay una cuenta con esa cédula; inicia sesión", k="cuenta.cedula_existe")
    if con.execute("SELECT 1 FROM ciudadanos WHERE email=%s", (email,)).fetchone():
        raise ErrorApi(409, "ya hay una cuenta con ese correo; inicia sesión", k="cuenta.email_existe")


def _claves_bloqueo(ip, usuario):
    # se reusa el bloqueo del panel (auth) con claves propias: ("u", …) lleva el tope de 15 min por cuenta
    return [("cip", ip)] + ([("u", "ciudadano:" + usuario)] if usuario else [])

# --------------------------------------------------------------------------- registro e ingreso


def _crear(con, d, ip, foto):
    t = iso(ahora())
    return con.execute(
        "INSERT INTO ciudadanos (nombre, cedula, email, clave, foto, activo, consentimiento, "
        "creado, ultimo_ingreso, ip) VALUES (%s,%s,%s,%s,%s,1,%s,%s,%s,%s) RETURNING *",
        (d["nombre"], d["cedula"], d["email"], d["clave_hash"], foto, t, t, t, ip)
    ).fetchone()


def registrar(b, ip, foto_crudo):
    """Registro propio. Devuelve (ciudadano, token)."""
    d = datos_registro(b)
    d["clave_hash"] = auth.hash_clave(d.pop("clave"))        # fuera del candado: scrypt tarda ~0,1 s
    foto = _guardar_foto(foto_crudo) if foto_crudo else None
    try:
        with db_escritura() as con:
            _tope_cuentas_nuevas(con, ip)
            _unicos(con, d["cedula"], d["email"])
            r = _crear(con, d, ip, foto)
            token = _crear_sesion(con, r["id"])
    except BaseException:
        _borrar_foto(foto)
        raise
    return ciudadano_publico(r), token


def ingresar(b, ip):
    """Ingreso con correo o cédula y contraseña. Orden: bloqueo (429) → credenciales (401) → activa (403)."""
    usuario, clave = b.get("usuario"), b.get("clave")
    usuario = usuario.strip().lower()[:EMAIL_MAX] if isinstance(usuario, str) else ""
    claves = _claves_bloqueo(ip, usuario)
    try:
        auth.comprobar_bloqueo(*claves)
    except ErrorApi:
        raise ErrorApi(429, "demasiados intentos fallidos; espera unos minutos", k="cuenta.espera")
    r = None
    if "@" in usuario:
        campo = "email"
    elif RE_CEDULA.fullmatch(usuario):
        campo = "cedula"
    else:
        campo = None
    if campo:
        with db() as con:
            r = con.execute(f"SELECT * FROM ciudadanos WHERE {campo}=%s", (usuario,)).fetchone()
    valida = isinstance(clave, str) and 0 < len(clave) <= CLAVE_MAX
    # sin cuenta: clave_ok igual calcula un hash (mismo tiempo de respuesta)
    if not (valida and auth.clave_ok(clave, r["clave"] if r else None) and r):
        auth.anotar_fallo(*claves)
        raise ErrorApi(401, "correo, cédula o contraseña incorrectos", k="cuenta.credenciales")
    auth.limpiar_fallos(*claves)
    if not r["activo"]:
        raise ErrorApi(403, "esta cuenta está desactivada", k="cuenta.inactiva")
    with db_escritura() as con:
        r = con.execute("UPDATE ciudadanos SET ultimo_ingreso=%s WHERE id=%s RETURNING *", (iso(ahora()), r["id"])).fetchone()
        token = _crear_sesion(con, r["id"])
    return ciudadano_publico(r), token


def eliminar(ciudadano_id):
    """Baja: se borran la cuenta, sus sesiones y su foto; sus reportes quedan, pero sin autor."""
    with db_escritura() as con:
        r = con.execute("SELECT foto FROM ciudadanos WHERE id=%s", (ciudadano_id,)).fetchone()
        con.execute("UPDATE reportes SET ciudadano_id=NULL WHERE ciudadano_id=%s", (ciudadano_id,))
        con.execute("DELETE FROM sesiones_ciudadanos WHERE ciudadano_id=%s", (ciudadano_id,))
        con.execute("DELETE FROM ciudadanos WHERE id=%s", (ciudadano_id,))
    if r:
        _borrar_foto(r["foto"])

# --------------------------------------------------------------------------- perfil


def actualizar_perfil(ciudadano, b):
    """Nombre (nombres y apellidos) y correo. La cédula no cambia nunca: si llega, se ignora. Devuelve el `Ciudadano`."""
    nombre = _nombre(b.get("nombre"))
    email = _email(b.get("email"))
    with db_escritura() as con:
        if con.execute("SELECT 1 FROM ciudadanos WHERE email=%s AND id<>%s", (email, ciudadano["id"])).fetchone():
            raise ErrorApi(409, "ya hay una cuenta con ese correo", k="cuenta.email_existe")
        r = con.execute("UPDATE ciudadanos SET nombre=%s, email=%s WHERE id=%s RETURNING *",
                        (nombre, email, ciudadano["id"])).fetchone()
    return ciudadano_publico(r)


# --------------------------------------------------------------------------- sesiones y cookies

COOKIE = "yw_ciudadano"
COOKIE_HOST = "__Host-yw_ciudadano"     # con HTTPS: solo Secure, Path=/ y sin Domain (como la del panel)
INACTIVIDAD = dt.timedelta(days=30)
MAXIMA = dt.timedelta(days=90)


def nombre_cookie(segura):
    return COOKIE_HOST if segura else COOKIE


def _sha(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _crear_sesion(con, ciudadano_id):
    """Dentro de una transacción abierta. El token en claro va solo en la cookie; en la base queda su SHA-256."""
    token = secrets.token_urlsafe(32)
    t = iso(ahora())
    con.execute("INSERT INTO sesiones_ciudadanos (token_sha, ciudadano_id, creado, ultimo_uso) VALUES (%s,%s,%s,%s)",
                (_sha(token), ciudadano_id, t, t))
    return token


def cerrar_sesion(token):
    if token:
        with db_escritura() as con:
            con.execute("DELETE FROM sesiones_ciudadanos WHERE token_sha=%s", (_sha(token),))


def ciudadano_de_sesion(token):
    """Fila del ciudadano activo dueño de la sesión, o None si no hay sesión válida."""
    if not token or len(token) > 200:
        return None
    sha = _sha(token)
    with db() as con:
        r = con.execute("SELECT s.creado AS s_creado, s.ultimo_uso AS s_uso, c.* FROM sesiones_ciudadanos s "
                        "JOIN ciudadanos c ON c.id = s.ciudadano_id WHERE s.token_sha=%s", (sha,)).fetchone()
    if not r:
        return None
    t = ahora()
    if not r["activo"] or leer_iso(r["s_uso"]) < t - INACTIVIDAD or leer_iso(r["s_creado"]) < t - MAXIMA:
        cerrar_sesion(token)
        return None
    if leer_iso(r["s_uso"]) < t - dt.timedelta(minutes=1):     # no se escribe en cada petición
        with db_escritura() as con:
            con.execute("UPDATE sesiones_ciudadanos SET ultimo_uso=%s WHERE token_sha=%s", (iso(t), sha))
    return r


def mantenimiento(con):
    """Borra las sesiones vencidas (dentro de la transacción del mantenimiento)."""
    t = ahora()
    con.execute("DELETE FROM sesiones_ciudadanos WHERE ultimo_uso < %s OR creado < %s",
                (iso(t - INACTIVIDAD), iso(t - MAXIMA)))


def cookie_sesion(token, segura):
    nombre, base = nombre_cookie(segura), ("Path=/; Secure" if segura else "Path=/api")
    if token is None:   # borrar
        return f"{nombre}=; HttpOnly; SameSite=Strict; {base}; Max-Age=0"
    return f"{nombre}={token}; HttpOnly; SameSite=Strict; {base}; Max-Age={int(MAXIMA.total_seconds())}"

