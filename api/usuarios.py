"""Gestión de usuarios del panel (permiso usuarios.gestionar) y configuración general (config.editar).

Contrato: specs/014-usuarios-incidentes-push-react/contracts/api.md (§1 «Primer arranque», §3 y §4).
Los usuarios no se borran: se desactivan, para conservar la autoría de incidentes y avisos.
"""
import json
import re

import auth
from comun import ErrorApi, ahora, db, db_escritura, iso

RE_USUARIO = re.compile(r"[a-z0-9._-]{3,32}")


def _fila(con, uid):
    r = con.execute("SELECT * FROM usuarios WHERE id=%s", (uid,)).fetchone()
    if not r:
        raise ErrorApi(404, "usuario no encontrado", k="usuarios.no_existe")
    return r


def _superadmins_activos(con):
    return con.execute("SELECT COUNT(*) AS n FROM usuarios WHERE rol='superadmin' AND activo=1").fetchone()["n"]


def _validar_nombre(nombre):
    if not isinstance(nombre, str) or not (2 <= len(nombre.strip()) <= 80):
        raise ErrorApi(400, "el nombre debe tener de 2 a 80 caracteres", k="usuarios.nombre")
    return nombre.strip()


def _validar_rol(rol):
    if rol not in auth.ROLES:
        raise ErrorApi(400, "rol inválido (superadmin, analista u operador)", k="usuarios.rol")
    return rol


def listar():
    with db() as con:
        filas = con.execute("SELECT * FROM usuarios ORDER BY activo DESC, usuario").fetchall()
    return {"usuarios": [auth.usuario_publico(r) for r in filas]}


def crear(b, quien):
    usuario = b.get("usuario")
    if not isinstance(usuario, str) or not RE_USUARIO.fullmatch(usuario):
        raise ErrorApi(400, "usuario inválido: de 3 a 32 letras minúsculas, números, punto, guion o guion bajo",
                       k="usuarios.usuario")
    nombre = _validar_nombre(b.get("nombre"))
    rol = _validar_rol(b.get("rol"))
    clave = auth.clave_aleatoria()
    h = auth.hash_clave(clave)                   # fuera del candado: scrypt tarda ~0,1 s
    with db_escritura() as con:
        if con.execute("SELECT 1 FROM usuarios WHERE usuario=%s", (usuario,)).fetchone():
            raise ErrorApi(409, "ese usuario ya existe", k="usuarios.existe")
        nuevo = con.execute("INSERT INTO usuarios (usuario, nombre, rol, clave, activo, debe_cambiar_clave, creado) "
                            "VALUES (%s,%s,%s,%s,1,1,%s) RETURNING id", (usuario, nombre, rol, h, iso(ahora()))).fetchone()["id"]
        auth.auditar(con, quien["id"], "usuario.crear", {"id": nuevo, "usuario": usuario, "rol": rol})
        r = _fila(con, nuevo)
    return {"usuario": auth.usuario_publico(r), "clave_temporal": clave}


def editar(uid, b, quien):
    cambios = {}
    if "nombre" in b:
        cambios["nombre"] = _validar_nombre(b["nombre"])
    if "rol" in b:
        cambios["rol"] = _validar_rol(b["rol"])
    if "activo" in b:
        if not isinstance(b["activo"], bool):
            raise ErrorApi(400, "activo debe ser true o false", k="usuarios.activo")
        cambios["activo"] = int(b["activo"])
    with db_escritura() as con:
        r = _fila(con, uid)
        if cambios.get("activo") == 0 and uid == quien["id"]:
            raise ErrorApi(409, "no puedes desactivarte a ti mismo", k="usuarios.desactivarse")
        pierde_super = r["rol"] == "superadmin" and r["activo"] and (
            cambios.get("rol", "superadmin") != "superadmin" or cambios.get("activo", 1) == 0)
        if pierde_super and _superadmins_activos(con) <= 1:
            raise ErrorApi(409, "debe quedar al menos un superadmin activo", k="usuarios.ultimo_superadmin")
        reales = {c: v for c, v in cambios.items() if r[c] != v}
        if reales:
            con.execute(f"UPDATE usuarios SET {', '.join(c + '=%s' for c in reales)} WHERE id=%s",
                        (*reales.values(), uid))
            # un rol nuevo o la desactivación surten efecto ya: las sesiones abiertas se cierran
            if "rol" in reales or reales.get("activo") == 0:
                auth.cerrar_sesiones_de(con, uid)
            auth.auditar(con, quien["id"], "usuario.editar", {"id": uid, **reales})
        r = _fila(con, uid)
    return {"usuario": auth.usuario_publico(r)}


def _restablecer(con, uid, h):
    con.execute("UPDATE usuarios SET clave=%s, debe_cambiar_clave=1 WHERE id=%s", (h, uid))
    auth.cerrar_sesiones_de(con, uid)


def restablecer(uid, quien):
    clave = auth.clave_aleatoria()
    h = auth.hash_clave(clave)                   # fuera del candado: scrypt tarda ~0,1 s
    with db_escritura() as con:
        _fila(con, uid)
        _restablecer(con, uid, h)
        auth.auditar(con, quien["id"], "usuario.restablecer_clave", {"id": uid})
    return {"clave_temporal": clave}


def crear_superadmin_inicial():
    """Sin usuarios en la base, crea `admin` con clave aleatoria. Devuelve la clave (para mostrarla una vez) o None."""
    with db_escritura() as con:
        if con.execute("SELECT COUNT(*) AS n FROM usuarios").fetchone()["n"]:
            return None
        clave = auth.clave_aleatoria()
        nuevo = con.execute("INSERT INTO usuarios (usuario, nombre, rol, clave, activo, debe_cambiar_clave, creado) "
                            "VALUES ('admin', 'Administrador', 'superadmin', %s, 1, 1, %s) RETURNING id",
                            (auth.hash_clave(clave), iso(ahora()))).fetchone()["id"]
        auth.auditar(con, None, "usuario.crear", {"id": nuevo, "usuario": "admin", "rol": "superadmin",
                                                  "origen": "primer arranque"})
    return clave


def restablecer_desde_consola(usuario):
    """`python servidor.py --restablecer-clave <usuario>`: devuelve (clave temporal, activo) o None si no existe."""
    clave = auth.clave_aleatoria()
    with db_escritura() as con:
        r = con.execute("SELECT id, activo FROM usuarios WHERE usuario=%s", (usuario,)).fetchone()
        if not r:
            return None
        _restablecer(con, r["id"], auth.hash_clave(clave))
        auth.auditar(con, None, "usuario.restablecer_clave", {"id": r["id"], "origen": "consola"})
    return clave, bool(r["activo"])

# --------------------------------------------------------------------------- configuración (§4)


# operador_valida_directo (pedido del dueño, 2026-11-11): el equipo es de la empresa, así que lo que publica el operador
# sale validado; si el superadmin lo apaga, sus incidentes quedan «pendientes» hasta que el analista o él los verifiquen.
# El superadmin y el analista publican siempre validado.
CONFIG_DEF = {"incidentes_anonimos": False, "operador_valida_directo": True,
              # validación por vecinos (2026-11-12): con `validacion_minimo` personas distintas que reportan lo mismo a
              # `validacion_radio_m` metros o menos en las últimas `validacion_horas` horas, se publica sin el analista
              "validacion_vecinos": True, "validacion_minimo": 3, "validacion_radio_m": 300, "validacion_horas": 3}
# rangos de los ajustes numéricos (lo de fuera se rechaza)
RANGOS = {"validacion_minimo": (2, 10), "validacion_radio_m": (50, 2000), "validacion_horas": (1, 48)}


def publica_validado(quien):
    """¿Lo que publica esta persona del equipo sale ya validado?"""
    return quien["rol"] != "operador" or bool(config_valor("operador_valida_directo"))


def config_valor(clave):
    with db() as con:
        r = con.execute("SELECT valor FROM config WHERE clave=%s", (clave,)).fetchone()
    return json.loads(r["valor"]) if r else CONFIG_DEF[clave]


def config_get():
    return {c: config_valor(c) for c in CONFIG_DEF}


def config_post(b, quien):
    cambios = {}
    for c, defecto in CONFIG_DEF.items():
        if c in b:
            if not isinstance(b[c], type(defecto)) or (isinstance(defecto, int) and isinstance(b[c], bool) != isinstance(defecto, bool)):
                raise ErrorApi(400, f"valor inválido para {c}", k="config.valor")
            if c in RANGOS and not RANGOS[c][0] <= b[c] <= RANGOS[c][1]:
                raise ErrorApi(400, f"{c} va de {RANGOS[c][0]} a {RANGOS[c][1]}", k="config.rango")
            cambios[c] = b[c]
    with db_escritura() as con:
        for c, v in cambios.items():
            con.execute("INSERT INTO config (clave, valor) VALUES (%s,%s) "
                        "ON CONFLICT (clave) DO UPDATE SET valor=excluded.valor", (c, json.dumps(v)))
        if cambios:
            auth.auditar(con, quien["id"], "config.editar", cambios)
    return {"ok": True}
