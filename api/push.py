"""Web push con Firebase Cloud Messaging: suscripciones, cola de envíos y el hilo que la procesa.

Contrato: specs/014-usuarios-incidentes-push-react/contracts/api.md (§6).

`firebase-admin` es opcional: se importa recién al necesitarlo. Si no está instalado, si faltan las credenciales
o la configuración web, el push queda deshabilitado (`habilitado: false`) y el resto de la API sigue igual.
"""
import datetime as dt
import json
import os
import re
import threading
import time

from comun import ErrorApi, ahora, db, db_escritura, iso, leer_iso

# configuración web del proyecto (pública: va al cliente para inicializar el SDK)
VARS_WEB = {"apiKey": "FIREBASE_API_KEY", "authDomain": "FIREBASE_AUTH_DOMAIN", "projectId": "FIREBASE_PROJECT_ID",
            "messagingSenderId": "FIREBASE_MESSAGING_SENDER_ID", "appId": "FIREBASE_APP_ID"}
LOTE = 500                    # tope de tokens por llamada de send_each_for_multicast
CADA_S = 30                   # el hilo revisa la cola cada 30 s
MAX_TOKENS_IP_HORA = 30
RE_TOKEN = re.compile(r"[A-Za-z0-9_:\-]{20,512}")
BORRAR = {"UNREGISTERED", "INVALID_ARGUMENT"}   # FCM dice que el token ya no sirve

_fb, _fb_lock = {"probado": False, "messaging": None, "app": None}, threading.Lock()


def config_web():
    return {k: os.environ.get(v) or None for k, v in VARS_WEB.items()}


def _firebase():
    """Inicializa firebase-admin una sola vez. Devuelve el módulo `messaging` o None si el push no puede funcionar."""
    with _fb_lock:
        if _fb["probado"]:
            return _fb["messaging"]
        _fb["probado"] = True
        ruta = os.environ.get("FIREBASE_CREDENCIALES")
        if not ruta or not os.path.isfile(ruta):
            return None
        try:
            import firebase_admin
            from firebase_admin import credentials, messaging
        except ImportError:
            print("  [aviso] web push deshabilitado: falta el paquete firebase-admin (pip install -r api/requirements.txt)")
            return None
        try:
            _fb["app"] = firebase_admin.initialize_app(credentials.Certificate(ruta), name="yaguachi-push")
        except Exception as e:      # credenciales mal formadas: solo el tipo de error, nunca su contenido
            print(f"  [aviso] web push deshabilitado: no se pudieron leer las credenciales ({e.__class__.__name__})")
            return None
        _fb["messaging"] = messaging
        return messaging


def habilitado():
    return all(config_web().values()) and bool(os.environ.get("FIREBASE_VAPID_KEY")) and _firebase() is not None


def config_publica():
    return {"habilitado": habilitado(), "firebase": config_web(), "vapid_key": os.environ.get("FIREBASE_VAPID_KEY") or None}

# --------------------------------------------------------------------------- suscripciones


def suscribir(b, dispositivo, ip, recintos_validos, plataforma=None):
    token = b.get("token")
    if not isinstance(token, str) or not RE_TOKEN.fullmatch(token):
        raise ErrorApi(400, "token de notificaciones inválido", k="push.token")
    rid = b.get("recinto_id")
    if rid is not None:
        if isinstance(rid, bool) or not isinstance(rid, (int, str)) or not str(rid).isdigit() \
                or int(rid) not in recintos_validos:
            raise ErrorApi(400, "recinto desconocido", k="push.recinto")
        rid = int(rid)
    idioma = b.get("idioma", "es")
    if idioma not in ("es", "en"):
        raise ErrorApi(400, "idioma inválido (es o en)", k="push.idioma")
    t = ahora()
    with db_escritura() as con:
        # el tope cuenta tokens distintos por IP y hora: renovar el mismo token no suma
        n = con.execute("SELECT COUNT(*) AS n FROM push_tokens WHERE ip=%s AND ultimo_uso>%s AND token<>%s",
                        (ip, iso(t - dt.timedelta(hours=1)), token)).fetchone()["n"]
        if n >= MAX_TOKENS_IP_HORA:
            raise ErrorApi(429, "demasiadas suscripciones desde esta conexión; espera un rato", k="push.limite")
        con.execute("INSERT INTO push_tokens (token, dispositivo, recinto_id, idioma, creado, ultimo_uso, ip, plataforma) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(token) DO UPDATE SET dispositivo=excluded.dispositivo, "
                    "recinto_id=excluded.recinto_id, idioma=excluded.idioma, ultimo_uso=excluded.ultimo_uso, ip=excluded.ip, "
                    "plataforma=excluded.plataforma",
                    (token, dispositivo, rid, idioma, iso(t), iso(t), ip, plataforma))
    return {"ok": True}


def baja(b):
    token = b.get("token")
    if not isinstance(token, str) or not RE_TOKEN.fullmatch(token):
        raise ErrorApi(400, "token de notificaciones inválido", k="push.token")
    with db_escritura() as con:
        con.execute("DELETE FROM push_tokens WHERE token=%s", (token,))
    return {"ok": True}

# --------------------------------------------------------------------------- cola


def fin_silencio(t, horas_silencio):
    """Si `t` cae en las horas de silencio [inicio, fin) (hora de Ecuador), devuelve cuándo terminan; si no, `t`."""
    ini, fin = horas_silencio
    h = t.hour
    en_silencio = (h >= ini or h < fin) if ini > fin else (ini <= h < fin)
    if not en_silencio:
        return t
    hasta = t.replace(hour=fin, minute=0, second=0, microsecond=0)
    return hasta if hasta > t else hasta + dt.timedelta(days=1)


def encolar(con, aviso_id, nivel, horas_silencio, t=None):
    """Se llama dentro de la transacción que guarda el aviso: si el aviso no se guarda, tampoco se encola."""
    t = t or ahora()
    desde = fin_silencio(t, horas_silencio) if nivel <= 2 else t     # PREPARACIÓN y RESPUESTA no esperan
    con.execute("INSERT INTO push_cola (aviso_id, creado, enviar_desde) VALUES (%s,%s,%s)", (aviso_id, iso(t), iso(desde)))


def recibe(aviso, recinto_id, aplica):
    """¿Le llega este aviso a un token? `aplica(aviso, recinto_id)` es la regla de /api/avisos (None = recinto desconocido)."""
    if aviso["ambito_tipo"] == "canton":
        return True
    r = aplica(aviso, recinto_id) if recinto_id is not None else None
    if r is None:                       # sin recinto: solo cantón y avisos de PREPARACIÓN o más
        return aviso["nivel_cod"] >= 3
    return r


def datos_mensaje(aviso):
    """Mensaje solo de datos (FCM exige valores de texto): el service worker arma la notificación en su idioma."""
    d = {"tipo": "aviso", "aviso_id": str(aviso["id"]), "nivel": str(aviso["nivel_cod"]),
         "titulo": aviso["titulo"], "cuerpo": aviso["texto"], "url": f"/#avisos/{aviso['id']}/push"}
    if aviso.get("flyer"):          # spec 021: la notificación muestra el flyer (Android y escritorio)
        d["imagen"] = f"/api/avisos/{aviso['id']}/flyer?v={aviso['flyer'][:8]}"
    return d


def enviar_lote(tokens, datos, ttl_s, urgente):
    """Envía un lote (≤ 500) y devuelve, por token, None si salió o el código de error de FCM."""
    messaging = _firebase()
    msg = messaging.MulticastMessage(
        tokens=tokens, data=datos,
        webpush=messaging.WebpushConfig(headers={"TTL": str(ttl_s), "Urgency": "high" if urgente else "normal"}))
    res = messaging.send_each_for_multicast(msg, app=_fb["app"])
    out = []
    for r in res.responses:
        if r.success:
            out.append(None)
        elif isinstance(r.exception, messaging.UnregisteredError):
            out.append("UNREGISTERED")
        else:
            out.append(getattr(r.exception, "code", None) or "ERROR")
    return out


def _marcar(cola_id, resultado, enviado=True):
    with db_escritura() as con:
        con.execute("UPDATE push_cola SET enviado=%s, resultado=%s WHERE id=%s",
                    (iso(ahora()) if enviado else None, json.dumps(resultado, ensure_ascii=False)[:1000], cola_id))


def _tokens_a_borrar(tokens, codigos):
    malos = [tk for tk, c in zip(tokens, codigos) if c in BORRAR]
    # si TODO un lote vuelve INVALID_ARGUMENT, el problema es el mensaje y no los tokens: no se borra nada
    if len(tokens) > 1 and all(c == "INVALID_ARGUMENT" for c in codigos):
        return [tk for tk, c in zip(tokens, codigos) if c == "UNREGISTERED"]
    return malos


def _procesar(fila, aplica, t):
    aviso = dict(fila)
    if aviso["id"] is None or aviso["anulado"]:
        return _marcar(fila["cola_id"], {"omitido": "anulado"})
    if aviso.get("eliminado_en"):
        return _marcar(fila["cola_id"], {"omitido": "eliminado"})
    if leer_iso(aviso["vigente_hasta"]) <= t:
        return _marcar(fila["cola_id"], {"omitido": "vencido"})
    if not habilitado():
        return _marcar(fila["cola_id"], {"omitido": "push deshabilitado"})
    with db() as con:
        filas = con.execute("SELECT token, recinto_id FROM push_tokens").fetchall()
    tokens = [r["token"] for r in filas if recibe(aviso, r["recinto_id"], aplica)]
    datos = datos_mensaje(aviso)
    ttl = max(60, min(int((leer_iso(aviso["vigente_hasta"]) - t).total_seconds()), 2419200))
    ok = fallos = 0
    borrar = []
    try:
        for i in range(0, len(tokens), LOTE):
            lote = tokens[i:i + LOTE]
            codigos = enviar_lote(lote, datos, ttl, aviso["nivel_cod"] >= 3)
            ok += sum(c is None for c in codigos)
            fallos += sum(c is not None for c in codigos)
            borrar += _tokens_a_borrar(lote, codigos)
    except Exception as e:                       # sin red o FCM caído: queda en la cola y se reintenta en 30 s
        print(f"  [push] aviso {aviso['id']}: envío fallido ({e.__class__.__name__}); se reintenta")
        return _marcar(fila["cola_id"], {"error": e.__class__.__name__}, enviado=False)
    finally:
        if borrar:
            with db_escritura() as con:
                con.execute("DELETE FROM push_tokens WHERE token = ANY(%s)", (borrar,))
    _marcar(fila["cola_id"], {"destinatarios": len(tokens), "ok": ok, "fallos": fallos, "borrados": len(borrar)})


def procesar_cola(aplica):
    """Envía lo que ya puede salir (fuera de horas de silencio). Sin candado durante las llamadas a FCM."""
    t = ahora()
    with db() as con:
        pendientes = con.execute("SELECT c.id AS cola_id, a.* FROM push_cola c LEFT JOIN avisos a ON a.id = c.aviso_id "
                                 "WHERE c.enviado IS NULL AND c.enviar_desde <= %s ORDER BY c.id", (iso(t),)).fetchall()
    for fila in pendientes:
        _procesar(fila, aplica, t)


def hilo(aplica):
    while True:
        try:
            procesar_cola(aplica)
        except Exception as e:
            print("push:", repr(e))
        time.sleep(CADA_S)


def mantenimiento(con, limite_ip):
    """IP de las suscripciones a las 48 h (igual que en las demás tablas) y cola enviada de más de 30 días."""
    con.execute("UPDATE push_tokens SET ip=NULL WHERE ip IS NOT NULL AND ultimo_uso < %s", (limite_ip,))
    con.execute("DELETE FROM push_cola WHERE enviado IS NOT NULL AND enviado < %s", (iso(ahora() - dt.timedelta(days=30)),))
