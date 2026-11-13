"""Yaguachi Weather: servidor local de la app de alertas de inundación.

Proyecto independiente. No es un canal oficial: las alertas oficiales las emiten
el COE cantonal, la SNGR y el INAMHI.

Usa la biblioteca estándar de Python 3 más `psycopg` 3 (PostgreSQL, obligatorio) y `firebase-admin` para el web
push (opcional: sin él la API funciona igual y el push queda deshabilitado). Versiones en api/requirements.txt.

En Docker es solo la API (/api/* y /r/<id>); la app ciudadana y el panel son contenedores nginx aparte.
Para desarrollar sin Docker, desde la raíz del repositorio:

    python api/servidor.py --estaticos cliente --admin admin
        -> http://localhost:8080          (app ciudadana)
           http://localhost:8080/panel/   (panel del analista)
    python api/servidor.py --offline    -> no consulta Open-Meteo; usa lo último guardado
    python api/servidor.py --restablecer-clave admin   -> imprime una clave temporal nueva para ese usuario
    python api/servidor.py --importar-sqlite datos/yaguachi.db [--forzar]  -> importa la base SQLite de antes

Base de datos: PostgreSQL en DATABASE_URL (sin ella: el servicio `db` del compose en 127.0.0.1:PUERTO_DB, con la
clave de POSTGRES_PASSWORD).

Pruebas (contra un PostgreSQL de pruebas, ver api/tests/apoyo.py): python -m unittest discover api/tests

Qué hace:
  * Expone la API y lee las capas GeoJSON del análisis de riesgo (compartido/capas o YAGUACHI_CAPAS).
  * Cuentas ciudadanas con registro propio (cuentas.py, spec 018): reportar exige una.
  * Guarda reportes ciudadanos (incluidas las calles inundadas), avisos, niveles verificados y
    lecturas de reglas en PostgreSQL (antes SQLite: se importa sola la primera vez).
  * Calcula un nivel ESTIMADO (automático) con los criterios del plan de riesgos (§3.2):
      GloFAS (P90, Q2, Q5 con 51 escenarios), lluvia pronosticada (50/100/150 mm),
      advertencia del INAMHI vigente, aguaje y lecturas de las reglas limnimétricas.
  * El nivel VERIFICADO lo fija el analista desde el panel y manda sobre el estimado.
    (En el código y la base se llama "oficial" por compatibilidad.)
"""
import argparse
import base64
import collections
import datetime as dt
import hmac
import http.cookies
import ipaddress
import html
import json
import math
import mimetypes
import os
import re
import secrets
import shutil
import sys
import threading
import time
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import auth
import comun
import cuentas
import esquema
import importar_sqlite
import push
import tormentas
import usuarios
import xlsx
from cache import CACHE, SinDato
from comun import FOTOS, RAIZ, SQLITE_ANTERIOR, TZ, ErrorApi, ahora, conectar_directo, db, db_escritura, iso, leer_iso

CAPAS = os.path.abspath(os.environ.get("YAGUACHI_CAPAS") or os.path.join(RAIZ, "compartido", "capas"))
# Solo para desarrollo sin Docker (--estaticos / --admin): carpetas desde las que se sirven los archivos.
# En Docker la API no sirve archivos: el cliente y el admin son contenedores nginx aparte.
ESTATICOS = []   # raíces del cliente, en orden de búsqueda
ADMIN = []       # raíces del panel (se monta en /panel/)
# Proxies de confianza: solo de ellos se acepta la cabecera X-Real-IP (la IP real del ciudadano)
PROXIES = [ipaddress.ip_network(x.strip(), strict=False) for x in
           (os.environ.get("YAGUACHI_PROXIES") or "172.16.0.0/12,10.0.0.0/8,192.168.0.0/16,127.0.0.1/32").split(",") if x.strip()]
# DATOS y FOTOS vienen de comun.py (YAGUACHI_DATOS); en Docker apuntan a un volumen. La base es PostgreSQL (comun.py)
CONFIG_PATH = os.environ.get("YAGUACHI_CONFIG") or os.path.join(RAIZ, "config.json")
UA = "YaguachiWeather/0.2 (proyecto independiente)"

NIVELES = {1: "NORMAL", 2: "VIGILANCIA", 3: "PREPARACIÓN", 4: "RESPUESTA"}
COLORES = {1: "#1a9641", 2: "#ffd92f", 3: "#fd8d3c", 4: "#d7191c"}
RIOS_MAREA = {"Río Yaguachi", "Río Babahoyo"}
DIST_RIO_M = 1500           # corredor F de las zonas v3: un recinto hereda el nivel del río si está a <= 1,5 km

# Tipos de reporte ciudadano: clave -> (emoji, etiqueta, horas de vigencia, sugiere RESPUESTA si se valida)
TIPOS = {
    "calle_inundada":    ("🌊", "Calle o camino inundado", 8, False),
    "vivienda_inundada": ("🏠", "Agua dentro de viviendas", 24, True),
    "rio_crecido":       ("📈", "Río o estero creciendo", 12, False),
    "desborde":          ("🚨", "El río se desbordó", 24, True),
    "via_cerrada":       ("⛔", "Vía cerrada o intransitable", 24, False),
    "alcantarilla":      ("🕳️", "Alcantarilla o canal tapado", 72, False),
    "dique_filtracion":  ("🧱", "Filtración o grieta en muro o dique", 72, False),
    "socavon":           ("⚠️", "Socavón o hundimiento", 72, False),
    "arbol_poste":       ("🌳", "Árbol o poste caído", 24, False),
    "sin_luz":           ("💡", "Sin energía eléctrica", 12, False),
    "lluvia_fuerte":     ("🌧️", "Lluvia muy fuerte ahora", 3, False),
    "aislados":          ("🆘", "Familias aisladas o que necesitan evacuar", 24, True),
    "cultivos_ganado":   ("🐄", "Cultivos o ganado afectados", 72, False),
    # problemas de la ciudad (pedido del dueño, 2026-11-10): no suben el nivel de inundación
    "bache":             ("🚧", "Bache en la calle", 168, False),
    "basura":            ("🗑️", "No han recolectado la basura", 48, False),
    "robo":              ("🚔", "Robo o asalto", 24, False),
    "otro":              ("📝", "Otro problema", 24, False),
}
HORAS_AVISO = 96             # vigencia por defecto de un aviso del panel (pedido del dueño, 2026-11-10); se acepta 1–168
GRAVEDAD = {1: "Leve", 2: "Moderada", 3: "Grave"}
# Los vecinos no tipifican la gravedad (pedido del dueño, 2026-11-10: «reportan algo sencillo y lo ponen como grave»):
# su reporte entra «por tipificar» y la fija el analista al verificarlo. La calle inundada sigue la altura del agua.
POR_TIPIFICAR = 0
# Cuánta agua hay en una calle: escala propia con referencias que se ven desde la vereda
ALTURA = {1: "Hasta el borde de la vereda (menos de 15 cm)", 2: "Sobre la vereda (tapa media llanta de moto)",
          3: "No cruces (más de 40 cm o con corriente)"}
# Las calles inundadas se ven al momento como «aviso de vecinos» (sin verificar); el resto espera revisión
PUBLICO_YA = {"calle_inundada"}
# Cabeceras (zona urbana) para que salgan identificadas en el buscador de ubicaciones
CABECERAS = {"San Jacinto de Yaguachi": "cabecera cantonal · zona urbana",
             "Virgen de Fátima": "cabecera parroquial", "General Pedro J. Montero (Boliche)": "cabecera parroquial",
             "Yaguachi Viejo": "cabecera parroquial"}

# Qué hace la gente en cada nivel (versión ciudadana del §3.2 del plan de riesgos)
ACCIONES = {
    1: ["Mantén limpias las cunetas y alcantarillas de tu calle.",
        "Ten a mano tu mochila de emergencia: documentos, agua, linterna, medicinas y cargador.",
        "Conoce el albergue y la ruta segura de tu recinto."],
    2: ["Revisa la app y sigue las indicaciones del COE cantonal, de la Unidad de Riesgos del municipio y de tu presidente de recinto.",
        "Sube a lo alto documentos, semillas, abonos y electrodomésticos.",
        "Si vives junto al río, acuerda con tu familia a dónde irían si hay que salir.",
        "Reporta en la app si ves que el río o el estero sube rápido."],
    3: ["Prepárate para salir: mochila lista y la familia avisada.",
        "Adultos mayores, personas con discapacidad, embarazadas y niños deben salir primero, hacia el albergue o donde un familiar en zona alta.",
        "Lleva el ganado y la maquinaria a zonas altas.",
        "No cruces ríos ni calles con corriente."],
    4: ["Sal ya hacia el albergue o a una zona alta por la ruta segura.",
        "Corta la luz y el gas antes de salir si puedes hacerlo sin riesgo.",
        "No camines ni manejes por agua en movimiento: 15 cm pueden tumbarte y 60 cm arrastran un carro.",
        "Si estás atrapado o hay personas en peligro, llama al ECU 911."],
}

# --------------------------------------------------------------------------- configuración

CONFIG_DEF = {
    "puerto": 8080,
    "cache_lluvia_min": 60,
    "cache_glofas_min": 360,
    "max_reportes_hora_dispositivo": 6,
    "max_foto_kb": 1500,
    "dias_conservar_fotos": 90,
    "avisos_max_24h_por_ambito": 3,    # anti-saturación (no aplica a RESPUESTA)
    "horas_silencio": [22, 6],         # el cliente no hace sonar avisos de nivel <= 2 en este horario
    "lluvia_vigilancia_24h_mm": 50,
    "lluvia_preparacion_24h_mm": 100,
    "lluvia_preparacion_72h_mm": 150,
}


def cargar_config():
    cfg = dict(CONFIG_DEF)
    guardado = {}
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, encoding="utf-8") as fh:
            guardado = json.load(fh)
        cfg.update(guardado)
    # el panel ya no usa PIN (hay usuarios): si config.json trae "pin_panel" de una versión anterior, se ignora
    # solo se reescribe si cambió algo (primer arranque o claves nuevas)
    if not cfg.get("secreto_fotos"):
        cfg["secreto_fotos"] = secrets.token_hex(32)
    if cfg != guardado:
        try:
            os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
            with open(CONFIG_PATH, "w", encoding="utf-8") as fh:
                json.dump(cfg, fh, ensure_ascii=False, indent=2)
        except OSError as e:
            print(f"Aviso: no se pudo guardar {CONFIG_PATH} ({e}); se usa la configuración en memoria")
    return cfg


CFG = {}
OFFLINE = False

# --------------------------------------------------------------------------- base de datos

# El esquema y sus migraciones viven en esquema.py; el importador de la base SQLite anterior, en importar_sqlite.py.


def iniciar_db():
    """Espera a PostgreSQL, aplica las migraciones pendientes y, la primera vez, importa el SQLite de antes
    (datos/yaguachi.db) si existe. El archivo SQLite nunca se borra ni se modifica."""
    os.makedirs(FOTOS, exist_ok=True)
    comun.conectar()                                       # reintenta ~60 s si la base aún no responde
    with conectar_directo(autocommit=True) as con:
        esquema.migrar(con)
        if os.path.isfile(SQLITE_ANTERIOR):
            try:
                conteos = importar_sqlite.importar(con, SQLITE_ANTERIOR, automatico=True)
            except Exception as e:
                sys.exit(f"ERROR: falló la importación automática de {SQLITE_ANTERIOR} a PostgreSQL ({e}). "
                         "PostgreSQL quedó sin cambios y el archivo SQLite está intacto.")
            if conteos is not None:
                print(f"Importada la base SQLite {SQLITE_ANTERIOR} a PostgreSQL (el archivo queda como respaldo):")
                print(importar_sqlite.tabla_conteos(conteos), flush=True)


def importar_desde_consola(ruta, forzar):
    """--importar-sqlite: no levanta el servidor; importa y muestra el conteo por tabla."""
    comun.esperar_base()
    with conectar_directo(autocommit=True) as con:
        esquema.migrar(con)
        try:
            conteos = importar_sqlite.importar(con, ruta, forzar=forzar)
        except (importar_sqlite.ImportacionRechazada, FileNotFoundError) as e:
            sys.exit(f"No se importó: {e}")
    print(f"Importado {ruta} a PostgreSQL en {comun.destino()}" + (" (con --forzar)" if forzar else "") + ":")
    print(importar_sqlite.tabla_conteos(conteos))


def ajuste(clave, defecto=None):
    with db() as con:
        r = con.execute("SELECT valor FROM ajustes WHERE clave=%s", (clave,)).fetchone()
    return json.loads(r["valor"]) if r else defecto


def fijar_ajuste(clave, valor):
    with db_escritura() as con:
        con.execute("INSERT INTO ajustes (clave, valor) VALUES (%s, %s) ON CONFLICT (clave) DO UPDATE SET valor=excluded.valor",
                    (clave, json.dumps(valor, ensure_ascii=False)))


# --------------------------------------------------------------------------- geometría (sin dependencias)


def cargar_geojson(nombre):
    with open(os.path.join(CAPAS, nombre + ".geojson"), encoding="utf-8") as fh:
        return json.load(fh)["features"]


def _xy(lon, lat, lat0):
    return lon * 111320.0 * math.cos(math.radians(lat0)), lat * 110574.0


def dist_m(lon1, lat1, lon2, lat2):
    x1, y1 = _xy(lon1, lat1, lat1)
    x2, y2 = _xy(lon2, lat2, lat1)
    return math.hypot(x2 - x1, y2 - y1)


def dist_punto_lineas(lon, lat, geom):
    lineas = geom["coordinates"] if geom["type"] == "MultiLineString" else [geom["coordinates"]]
    px, py = _xy(lon, lat, lat)
    mejor = float("inf")
    for linea in lineas:
        prev = None
        for c in linea:
            x, y = _xy(c[0], c[1], lat)
            if prev:
                ax, ay = prev
                dx, dy = x - ax, y - ay
                L = dx * dx + dy * dy
                t = 0 if L == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
                mejor = min(mejor, math.hypot(px - (ax + t * dx), py - (ay + t * dy)))
            prev = (x, y)
    return mejor


def punto_en_poligono(lon, lat, geom):
    polis = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    for poli in polis:
        dentro = False
        for anillo_i, anillo in enumerate(poli):
            d = False
            j = len(anillo) - 1
            for i in range(len(anillo)):
                xi, yi = anillo[i][0], anillo[i][1]
                xj, yj = anillo[j][0], anillo[j][1]
                if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
                    d = not d
                j = i
            if anillo_i == 0:
                dentro = d
            elif d:
                dentro = False
        if dentro:
            return True
    return False


def celda_de(lon, lat):
    """Celda de lluvia de 0,05° (la misma grilla del analista)."""
    return (round(round(lat / 0.05) * 0.05, 3), round(round(lon / 0.05) * 0.05, 3))


class Territorio:
    """Capas base cargadas en memoria al arrancar."""

    def __init__(self):
        self.limite = cargar_geojson("limite_canton")[0]["geometry"]
        self.parroquias = cargar_geojson("parroquias")
        self.rios = cargar_geojson("rios")
        self.puntos = {f["properties"]["id"]: f["properties"] for f in cargar_geojson("puntos_control")}
        self.equip = cargar_geojson("equipamientos")
        self.recintos = {}
        for f in cargar_geojson("recintos"):
            p = dict(f["properties"])
            p["lon"], p["lat"] = f["geometry"]["coordinates"][:2]
            p["parroquia_nombre"] = p.get("parroquia")
            # río principal más cercano
            dmin, rio = min((dist_punto_lineas(p["lon"], p["lat"], r["geometry"]), r["properties"]["rio"]) for r in self.rios)
            p["rio_cercano"], p["dist_rio_m"] = rio, round(dmin)
            # celda de lluvia (0,05°, la misma grilla del analista)
            p["celda"] = celda_de(p["lon"], p["lat"])
            p["etiqueta"] = CABECERAS.get(p["nombre"])
            self.recintos[int(p["id"])] = p
        lons = [p["lon"] for p in self.recintos.values()]
        lats = [p["lat"] for p in self.recintos.values()]
        self.bbox = (min(lons) - 0.08, min(lats) - 0.08, max(lons) + 0.08, max(lats) + 0.08)
        self.lugares_calles = self._calles_con_nombre()

    def _calles_con_nombre(self):
        """Calles con nombre de OSM agrupadas por nombre y recinto cercano (para el buscador)."""
        grupos = {}
        for f in cargar_geojson("calles"):
            nom = (f["properties"].get("nombre") or "").strip()
            if not nom:
                continue
            g = f["geometry"]
            lineas = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
            linea = max(lineas, key=len)
            lon, lat = linea[len(linea) // 2][:2]
            rid, d = self.recinto_cercano(lon, lat)
            clave = (nom, rid)
            if clave not in grupos:
                cerca = self.recintos[rid]["nombre"]
                grupos[clave] = {"nombre": nom, "cerca": cerca, "lon": lon, "lat": lat}
        return sorted(grupos.values(), key=lambda x: (x["nombre"], x["cerca"]))

    def recinto_cercano(self, lon, lat):
        d, rid = min((dist_m(lon, lat, p["lon"], p["lat"]), rid) for rid, p in self.recintos.items())
        return rid, d

    def parroquia_de(self, lon, lat):
        for f in self.parroquias:
            if punto_en_poligono(lon, lat, f["geometry"]):
                return f["properties"]["parroquia"]
        return None

    def rio_cercano(self, lon, lat):
        dmin, rio = min((dist_punto_lineas(lon, lat, r["geometry"]), r["properties"]["rio"]) for r in self.rios)
        return rio, round(dmin)

    def en_canton(self, lon, lat):
        return punto_en_poligono(lon, lat, self.limite)

    def equipamientos_cercanos(self, lon, lat, n=3):
        lst = []
        for f in self.equip:
            x, y = f["geometry"]["coordinates"][:2]
            lst.append((dist_m(lon, lat, x, y), f["properties"], x, y))
        lst.sort(key=lambda t: t[0])
        return [dict(p, dist_m=round(d), lon=x, lat=y) for d, p, x, y in lst[:n]]


T = None


def centro_canton():
    """(lat, lon) del centro del cantón: desde ahí se miden las tormentas y los rayos (spec 020)."""
    x0, y0, x1, y1 = T.bbox
    return round((y0 + y1) / 2, 3), round((x0 + x1) / 2, 3)

# --------------------------------------------------------------------------- datos externos con caché


def _get_json(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def con_cache(clave, minutos, fn):
    """Devuelve (datos, actualizado_epoch, desactualizado). Si falla la red usa lo último guardado."""
    with db() as con:
        r = con.execute("SELECT actualizado, datos FROM cache WHERE clave=%s", (clave,)).fetchone()
    if r and (OFFLINE or time.time() - r["actualizado"] < minutos * 60):
        return json.loads(r["datos"]), r["actualizado"], OFFLINE and time.time() - r["actualizado"] > minutos * 60
    if OFFLINE:
        return None, None, True
    try:
        datos = fn()
    except Exception as e:                                     # sin internet, API caída, etc.
        print(f"  [aviso] no se pudo actualizar {clave}: {e}")
        if r:
            return json.loads(r["datos"]), r["actualizado"], True
        return None, None, True
    t = time.time()
    with db_escritura() as con:
        con.execute("INSERT INTO cache (clave, actualizado, datos) VALUES (%s, %s, %s) ON CONFLICT (clave) DO UPDATE "
                    "SET actualizado=excluded.actualizado, datos=excluded.datos", (clave, t, json.dumps(datos)))
    return datos, t, False


def lluvia_celdas():
    """Lluvia diaria (2 días pasados + hoy + 3 de pronóstico) en cada celda de 0,05° con recintos."""
    celdas = sorted({p["celda"] for p in T.recintos.values()})

    def bajar():
        lat = ",".join(f"{c[0]:.3f}" for c in celdas)
        lon = ",".join(f"{c[1]:.3f}" for c in celdas)
        url = ("https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
               "&daily=precipitation_sum,precipitation_probability_max&hourly=precipitation"
               "&past_days=2&forecast_days=4&timezone=America%2FGuayaquil")
        j = _get_json(url)
        j = j if isinstance(j, list) else [j]
        out = {}
        for c, d in zip(celdas, j):
            out[f"{c[0]:.3f},{c[1]:.3f}"] = {"daily": d["daily"], "hourly": d["hourly"]}
        return out

    return con_cache("lluvia_celdas", CFG["cache_lluvia_min"], bajar)


def glofas_punto(pid):
    p = T.puntos[pid]

    def bajar():
        url = (f"https://flood-api.open-meteo.com/v1/flood?latitude={p['lat_celda']}&longitude={p['lon_celda']}"
               "&daily=river_discharge&forecast_days=30&ensemble=true")
        return _get_json(url, timeout=120)

    return con_cache(f"glofas_{pid}", CFG["cache_glofas_min"], bajar)

# --------------------------------------------------------------------------- reglas del semáforo


def pc(v):
    return f"{v:g}".replace(".", ",")


# Motivos: además del texto en español (lo que siempre devolvió la API), cada motivo va como clave + valores
# crudos para que la app y el panel lo traduzcan (web/i18n.js, claves motivo.*) y formateen los números.
def M(k, es, **v):
    return {"k": k, "v": v, "es": es}


def unir(ms, sep="; "):
    return sep.join(m["es"] for m in ms)


def sin_es(ms, **extra):
    return [dict({kk: vv for kk, vv in m.items() if kk != "es"}, **extra) for m in ms]


def nivel_glofas(pid):
    """Mismo criterio que el script 22 del analista (51 escenarios GloFAS)."""
    p = T.puntos[pid]
    j, act, viejo = glofas_punto(pid)
    if not j:
        return {"id": pid, "nivel_cod": None, "motivo": "sin datos de GloFAS", "motivos": [{"k": "glofas.sin_datos", "v": {}}], "actualizado": None}
    d = j["daily"]
    t = d["time"]
    hoy = ahora().date().isoformat()
    claves = [k for k in d if k.startswith("river_discharge")]
    fut = [i for i in range(len(t)) if t[i] >= hoy]
    if not fut:
        return {"id": pid, "nivel_cod": None, "motivo": "pronóstico GloFAS vencido", "motivos": [{"k": "glofas.vencido", "v": {}}], "actualizado": act}
    q = d["river_discharge"][fut[0]]
    if q is None:                                   # sin miembro de control: usa la mediana de los escenarios
        v = sorted(x for x in (d[k][fut[0]] for k in claves) if x is not None)
        if not v:
            return {"id": pid, "nivel_cod": None, "motivo": "GloFAS sin caudal para hoy", "motivos": [{"k": "glofas.sin_caudal", "v": {}}], "actualizado": act}
        q = v[len(v) // 2]
    p90, t2, t5 = p["p90"], p["t2"], p["t5"]
    prob = {}
    for hz in (3, 30):
        idx = fut[:hz]
        mx = [max((d[k][i] for i in idx if d[k][i] is not None), default=0) for k in claves]
        for nom, u in (("Q2", t2), ("Q5", t5)):
            prob[f"{nom}_{hz}d"] = round(100 * sum(m > u for m in mx) / len(mx), 1)
    serie = [round(d["river_discharge"][i], 1) if d["river_discharge"][i] is not None else None for i in fut[:15]]
    pq2, pq5, pq5c = prob["Q2_30d"], prob["Q5_30d"], prob["Q5_3d"]
    if q > t5 or pq5c >= 50:
        n = 4
        ms = [M("glofas.q_q5", f"caudal {q:.0f} > Q5 {t5:.0f}", q=round(q), u=round(t5))] if q > t5 \
            else [M("glofas.p_q5_72", f"P(>Q5) {pc(pq5c)} % en 72 h", p=pq5c)]
    else:
        ms = []
        if q > t2: ms.append(M("glofas.q_q2", f"caudal {q:.0f} > Q2 {t2:.0f}", q=round(q), u=round(t2)))
        if pq2 >= 50: ms.append(M("glofas.p_q2_30", f"P(>Q2) {pc(pq2)} % en 30 d", p=pq2))
        if pq5 >= 20: ms.append(M("glofas.p_q5_30", f"P(>Q5) {pc(pq5)} % en 30 d", p=pq5))
        if ms:
            n = 3
        else:
            if q > p90: ms.append(M("glofas.q_p90", f"caudal {q:.0f} > P90 {p90:.0f}", q=round(q), u=round(p90)))
            if pq2 >= 20: ms.append(M("glofas.p_q2_30", f"P(>Q2) {pc(pq2)} % en 30 d", p=pq2))
            if ms:
                n = 2
            else:
                n = 1
                ms = [M("glofas.normal", f"caudal {q:.0f} < P90 {p90:.0f} y P(>Q2) {pc(pq2)} % < 20 %", q=round(q), u=round(p90), p=pq2)]
    return {"id": pid, "rio": p["rio"], "sitio": p["sitio"], "nivel_cod": n, "motivo": "GloFAS: " + unir(ms),
            "motivos": sin_es(ms, src="glofas"),
            "q_hoy": round(q, 1), "p90": p90, "q2": t2, "q5": t5, "prob": prob, "serie_15d": serie,
            "fechas_15d": [t[i] for i in fut[:15]], "actualizado": act, "desactualizado": viejo}


def nivel_regla(pid):
    """Nivel MEDIDO con la última lectura de la regla limnimétrica (últimas 12 h)."""
    with db() as con:
        regla = con.execute("SELECT borde_m FROM reglas WHERE punto_id=%s", (pid,)).fetchone()
        ult = con.execute("SELECT * FROM lecturas WHERE punto_id=%s ORDER BY creado DESC LIMIT 1", (pid,)).fetchone()
        if not ult or leer_iso(ult["creado"]) < ahora() - dt.timedelta(hours=12):
            return None
        hace24 = iso(leer_iso(ult["creado"]) - dt.timedelta(hours=24))
        ref24 = con.execute("SELECT lectura_m FROM lecturas WHERE punto_id=%s AND creado<=%s ORDER BY creado DESC LIMIT 1",
                            (pid, hace24)).fetchone()
        hace1 = iso(leer_iso(ult["creado"]) - dt.timedelta(minutes=70))
        ref1 = con.execute("SELECT lectura_m, creado FROM lecturas WHERE punto_id=%s AND creado>=%s AND creado<%s "
                           "ORDER BY creado ASC LIMIT 1", (pid, hace1, ult["creado"])).fetchone()
    res = {"lectura_m": ult["lectura_m"], "hora": ult["creado"], "tendencia": ult["tendencia"], "nivel_cod": None}
    ms = []
    n = 1
    if regla and regla["borde_m"] is not None:
        falta = regla["borde_m"] - ult["lectura_m"]
        res["falta_borde_m"] = round(falta, 2)
        n = 4 if falta <= 0.5 else 3 if falta <= 1.0 else 2 if falta <= 2.0 else 1
        ms.append(M("regla.borde", f"regla a {pc(round(falta, 2))} m del borde de desborde", m=round(falta, 2)))
    if ref24 and ult["lectura_m"] - ref24["lectura_m"] >= 1.0:
        n = max(n, 2)
        sub24 = round(ult["lectura_m"] - ref24["lectura_m"], 2)
        ms.append(M("regla.24h", f"subió {pc(sub24)} m en 24 h", m=sub24))
    if ref1:
        horas = max((leer_iso(ult["creado"]) - leer_iso(ref1["creado"])).total_seconds() / 3600, 0.25)
        vel = (ult["lectura_m"] - ref1["lectura_m"]) / horas
        if vel >= 0.3:
            n = max(n, 3)
            ms.append(M("regla.hora", f"sube {pc(round(vel, 2))} m por hora", m=round(vel, 2)))
    if not ms and not (regla and regla["borde_m"] is not None):
        return None                                   # sin borde definido y sin subidas: no hay criterio medido
    res["nivel_cod"] = n
    res["motivo"] = "Regla: " + unir(ms)
    res["motivos"] = sin_es(ms, src="regla")
    return res


def lluvia_resumen(celda_clave, datos):
    d = datos.get(celda_clave) if datos else None
    if not d:
        return None
    dd = d["daily"]
    hoy = ahora().date().isoformat()
    i0 = dd["time"].index(hoy) if hoy in dd["time"] else 2
    dias = [{"fecha": dd["time"][i], "mm": round(dd["precipitation_sum"][i] or 0, 1),
             "prob": dd["precipitation_probability_max"][i]} for i in range(len(dd["time"]))]
    prox = [x["mm"] for x in dias[i0:i0 + 3]]
    h = d["hourly"]
    hora_ahora = ahora().strftime("%Y-%m-%dT%H:00")
    j0 = h["time"].index(hora_ahora) if hora_ahora in h["time"] else 0
    prox24 = round(sum(v or 0 for v in h["precipitation"][j0:j0 + 24]), 1)
    ult24 = round(sum(v or 0 for v in h["precipitation"][max(0, j0 - 24):j0]), 1)
    return {"dias": dias, "hoy_indice": i0, "max_dia_3d": max(prox) if prox else 0, "suma_3d": round(sum(prox), 1),
            "prox_24h": prox24, "ult_24h": ult24}


def nivel_lluvia(ll):
    if not ll:
        return None, None
    c = CFG
    if ll["max_dia_3d"] >= c["lluvia_preparacion_24h_mm"] or ll["suma_3d"] >= c["lluvia_preparacion_72h_mm"]:
        return 3, M("lluvia.prep", f"lluvia pronosticada {pc(ll['max_dia_3d'])} mm en un día / {pc(ll['suma_3d'])} mm en 3 días",
                    dia=ll["max_dia_3d"], tres=ll["suma_3d"])
    if ll["max_dia_3d"] >= c["lluvia_vigilancia_24h_mm"]:
        return 2, M("lluvia.vig", f"lluvia pronosticada {pc(ll['max_dia_3d'])} mm en un día", dia=ll["max_dia_3d"])
    return 1, None


def advertencia_vigente():
    a = ajuste("advertencia")
    if a and a.get("vigente") and (not a.get("hasta") or leer_iso(a["hasta"]) > ahora()):
        return a
    return None


def aguaje_vigente():
    a = ajuste("aguaje")
    if a and a.get("hasta") and dt.date.fromisoformat(a["hasta"]) >= ahora().date():
        return a
    return None


def oficiales():
    """Último nivel oficial vigente por ámbito (canton, rio, parroquia, recinto). nivel_cod NULL = retirado."""
    with db() as con:
        filas = con.execute("SELECT * FROM niveles_oficiales n WHERE id = (SELECT MAX(id) FROM niveles_oficiales m "
                            "WHERE m.ambito_tipo=n.ambito_tipo AND m.ambito_id=n.ambito_id)").fetchall()
    return {(r["ambito_tipo"], r["ambito_id"]): dict(r) for r in filas if r["nivel_cod"] is not None}


def reportes_graves_validados():
    """Reportes VERIFICADOS de tipos graves (vivienda inundada, desborde, aislados) y vigentes: los de vecinos que validó
    el analista y los incidentes del equipo (que se publican ya verificados)."""
    with db() as con:
        # los validados por vecinos no cuentan para el nivel hasta que el analista los verifique (constitución II)
        filas = con.execute("SELECT id, origen, lat, lon, tipo FROM reportes WHERE estado='validado' AND expira>%s "
                            "AND COALESCE(validado_por, '') <> 'vecinos'", (iso(ahora()),)).fetchall()
    return [dict(r) for r in filas if TIPOS.get(r["tipo"], (0, 0, 0, False))[3]]


def lluvia_en(celda, ll_datos):
    """Resumen de lluvia de la celda; si no se pidió esa celda, la más cercana disponible."""
    if not ll_datos:
        return None
    clave = f"{celda[0]:.3f},{celda[1]:.3f}"
    if clave not in ll_datos:
        def d(k):
            la, lo = map(float, k.split(","))
            return (la - celda[0]) ** 2 + (lo - celda[1]) ** 2
        clave = min(ll_datos, key=d)
    return lluvia_resumen(clave, ll_datos)


def evaluar_punto(lon, lat, rio_cercano, dist_rio, parroquia, celda, rid_oficial, ctx):
    """Nivel estimado y verificado de un recinto o de cualquier punto (calle, ubicación GPS)."""
    adv, rios, ofi = ctx["adv"], ctx["rios"], ctx["ofi"]
    motivos, sug = [], 1
    if adv:
        sug = 2
        motivos.append(M("adv", "Advertencia INAMHI vigente"))
    r = rios.get(rio_cercano)
    if r and dist_rio <= DIST_RIO_M and r["sugerido"]:
        nr = r["sugerido_pleamar"] or r["sugerido"]
        if nr > sug:
            sug = nr
            motivos.append(M("rio_cerca", f"{rio_cercano} a {dist_rio} m", rio=rio_cercano, m=dist_rio))
    ll = lluvia_en(celda, ctx["ll_datos"])
    nl, ml = nivel_lluvia(ll)
    if nl and nl > 1 and ml:
        motivos.append(ml)
        sug = max(sug, nl)
    graves = [g for g in ctx["graves"] if dist_m(lon, lat, g["lon"], g["lat"]) <= DIST_RIO_M]
    if graves:
        sug = 4
        # ids: para que la app y el panel lleven al caso (retirarlo o revisarlo); equipo/vecinos: de dónde vienen
        eq = sum(1 for g in graves if g["origen"] == "equipo")
        motivos.append(M("graves", f"{len(graves)} caso(s) grave(s) verificado(s) a menos de 1,5 km", n=len(graves),
                         ids=",".join(g["id"] for g in graves[:10]), equipo=eq, vecinos=len(graves) - eq))
    # verificado: recinto > parroquia > río (si está en su corredor) > cantón
    oficial, o_fuente = None, None
    for clave, cond in ((("recinto", str(rid_oficial)), rid_oficial is not None), (("parroquia", parroquia or ""), True),
                        (("rio", rio_cercano), dist_rio <= DIST_RIO_M), (("canton", "yaguachi"), True)):
        if cond and clave in ofi:
            oficial, o_fuente = ofi[clave], clave[0]
            break
    return {"sugerido": sug, "motivo": unir(motivos) or "sin disparadores activos",
            "motivos": sin_es(motivos) or [{"k": "ninguno", "v": {}}],
            "oficial": oficial["nivel_cod"] if oficial else None, "oficial_fuente": o_fuente,
            "oficial_motivo": oficial["motivo"] if oficial else None,
            "oficial_hora": oficial["creado"] if oficial else None, "lluvia": ll}


_estado_lock = threading.Lock()
_estado_cache = {"t": 0, "datos": None}


def calcular_estado(forzar=False):
    with _estado_lock:
        if not forzar and _estado_cache["datos"] and time.time() - _estado_cache["t"] < 120:
            return _estado_cache["datos"]
        adv = advertencia_vigente()
        agu = aguaje_vigente()
        ofi = oficiales()
        # --- ríos
        por_rio = {}
        for pid, p in T.puntos.items():
            g = nivel_glofas(pid)
            m = nivel_regla(pid)
            por_rio.setdefault(p["rio"], []).append({"glofas": g, "regla": m, "id": pid, "sitio": p["sitio"]})
        rios = {}
        for f in T.rios:
            nombre = f["properties"]["rio"]
            pts = por_rio.get(nombre, [])
            n, motivos, fuente, ms = None, [], "modelo", []
            for x in pts:
                g, m = x["glofas"], x["regla"]
                if m and m["nivel_cod"]:
                    nx = m["nivel_cod"]
                    if g and g.get("nivel_cod") == 4:
                        nx = max(nx, 3)                   # excepción: GloFAS anuncia Q5 con alta probabilidad
                    motivos.append(f"{x['id']}: {m['motivo']}")
                    ms += [dict(it, pid=x["id"]) for it in m.get("motivos", [])]
                    fuente = "medido"
                elif g and g.get("nivel_cod"):
                    nx = g["nivel_cod"]
                    motivos.append(f"{x['id']}: {g['motivo']}")
                    ms += [dict(it, pid=x["id"]) for it in g.get("motivos", [])]
                else:
                    nx = None
                if nx:
                    n = max(n or 0, nx)
            if adv and (n or 1) < 2:
                n = 2
                motivos.append(f"Advertencia INAMHI vigente ({adv.get('texto', '')})")
                ms.append({"k": "adv_texto", "v": {"texto": adv.get("texto", "")}})
            if not pts:
                motivos.append("sin punto GloFAS ni regla")
                ms.append({"k": "sin_punto", "v": {}})
            n_pleamar = min(4, (n or 1) + 1) if (agu and nombre in RIOS_MAREA) else None
            o = ofi.get(("rio", nombre))
            rios[nombre] = {"rio": nombre, "sugerido": n, "motivo": " / ".join(motivos), "motivos": ms, "fuente_sugerido": fuente,
                            "sugerido_pleamar": n_pleamar, "oficial": o["nivel_cod"] if o else None,
                            "oficial_motivo": o["motivo"] if o else None, "oficial_hora": o["creado"] if o else None,
                            "puntos": [x["id"] for x in pts]}
        # --- lluvia
        ll_datos, ll_act, ll_viejo = lluvia_celdas()
        # --- recintos
        o_canton = ofi.get(("canton", "yaguachi"))
        ctx = {"adv": adv, "rios": rios, "ofi": ofi, "ll_datos": ll_datos, "graves": reportes_graves_validados()}
        recintos = {}
        for rid, p in T.recintos.items():
            recintos[rid] = dict(id=rid, **evaluar_punto(p["lon"], p["lat"], p["rio_cercano"], p["dist_rio_m"],
                                                         p["parroquia"], p["celda"], rid, ctx))
        sug_canton = max(x["sugerido"] for x in recintos.values())
        datos = {
            "generado": iso(ahora()),
            "niveles": {str(k): v for k, v in NIVELES.items()}, "colores": {str(k): v for k, v in COLORES.items()},
            "canton": {"sugerido": sug_canton, "oficial": o_canton["nivel_cod"] if o_canton else None,
                       "oficial_motivo": o_canton["motivo"] if o_canton else None,
                       "oficial_hora": o_canton["creado"] if o_canton else None},
            "advertencia": adv, "aguaje": agu,
            "rios": list(rios.values()),
            "puntos": {pid: {"glofas": x["glofas"], "regla": x["regla"]} for v in por_rio.values() for x in v for pid in [x["id"]]},
            "recintos": recintos,
            "fuentes": {"lluvia_actualizada": ll_act, "lluvia_desactualizada": ll_viejo},
        }
        _estado_cache.update(t=time.time(), datos=datos, ctx=ctx)
        return datos


def estado_lugar(lon, lat, nombre=None):
    """Mismo detalle que un recinto, para una calle o una ubicación GPS."""
    e = calcular_estado()
    ctx = _estado_cache["ctx"]
    rio, drio = T.rio_cercano(lon, lat)
    parroquia = T.parroquia_de(lon, lat)
    rid, drec = T.recinto_cercano(lon, lat)
    rec = T.recintos[rid]
    # el nivel verificado de un recinto se aplica si el punto está a <= 1,5 km de él
    rid_of = rid if drec <= DIST_RIO_M else None
    est = evaluar_punto(lon, lat, rio, drio, parroquia, celda_de(lon, lat), rid_of, ctx)
    lugar = {"id": None, "nombre": nombre or f"Cerca de {rec['nombre']}", "parroquia": parroquia or rec["parroquia"],
             "lon": lon, "lat": lat, "rio_cercano": rio, "dist_rio_m": drio, "recinto_cercano": rec["nombre"],
             "dist_recinto_m": round(drec), "prioridad": rec["prioridad"] if drec <= 1000 else None,
             "riesgo_base": rec["riesgo_base"] if drec <= 1000 else None, "en_canton": T.en_canton(lon, lat)}
    rio_d = next((x for x in e["rios"] if x["rio"] == rio), None)
    return {"recinto": lugar, "estado": est, "rio": rio_d, "acciones": ACCIONES,
            "equipamientos": T.equipamientos_cercanos(lon, lat), "advertencia": e["advertencia"],
            "aguaje": e["aguaje"], "generado": e["generado"]}


def invalidar_estado():
    _estado_cache["t"] = 0

# --------------------------------------------------------------------------- reportes y avisos


def limpiar_fotos_viejas():
    limite = iso(ahora() - dt.timedelta(days=CFG["dias_conservar_fotos"]))
    with db_escritura() as con:
        for r in con.execute("SELECT id FROM reportes WHERE foto IS NOT NULL AND creado < %s", (limite,)).fetchall():
            quitar_fotos(con, r["id"])


def llave_foto(rid):
    """Firma corta de una foto: la URL de una foto propia lleva esto y no el id del teléfono."""
    return hmac.new(CFG["secreto_fotos"].encode(), rid.encode(), "sha256").hexdigest()[:32]


def autores_publicos(con, filas, anonimos=None):
    """id -> {"nombre", "rol"} de los autores de incidentes del equipo; vacío si `incidentes_anonimos` está activo.
    El anonimato se aplica al leer: cambiarlo afecta también a lo ya publicado."""
    if anonimos is None:
        anonimos = usuarios.config_valor("incidentes_anonimos")
    ids = {r["autor_id"] for r in filas if r["autor_id"] is not None}
    if anonimos or not ids:
        return {}
    return {u["id"]: {"nombre": u["nombre"], "rol": u["rol"]}
            for u in con.execute("SELECT id, nombre, rol FROM usuarios WHERE id = ANY(%s)", (sorted(ids),))}


def foto_publica(r):
    """La foto de un reporte se publica solo si lo verificó una persona del equipo (constitución V): uno validado por
    vecinos se ve, pero sus fotos no, hasta que el analista lo revise."""
    return r["estado"] == "validado" and r.get("validado_por") != "vecinos"


def reporte_publico(r, dispositivo=None, likes=None, mios=None, autores=None):
    """`autores`: ver autores_publicos. Del autor solo salen nombre y rol: nunca su id ni su usuario."""
    e, et, _, _ = TIPOS.get(r["tipo"], ("📝", r["tipo"], 0, False))
    try:
        tramo = json.loads(r["tramo"]) if r["tramo"] else None
    except (TypeError, ValueError):
        tramo = None
    return {"id": r["id"], "tipo": r["tipo"], "emoji": e, "etiqueta": et, "gravedad": r["gravedad"],
            "descripcion": r["descripcion"], "lat": r["lat"], "lon": r["lon"], "recinto": r["recinto"],
            "creado": r["creado"], "expira": r["expira"], "estado": r["estado"], "nota_ugr": r["nota_ugr"],
            "foto": bool(r["foto"]) and (foto_publica(r) or r["dispositivo"] == dispositivo),
            # cuántas fotos se pueden pedir (/api/foto/<id>, /api/foto/<id>/2, /api/foto/<id>/3)
            "n_fotos": len(fotos_de(r)) if r["foto"] and (foto_publica(r) or r["dispositivo"] == dispositivo) else 0,
            "sigue": r["sigue"], "ya_no": r["ya_no"], "mio": r["dispositivo"] == dispositivo,
            "altura_agua": r["altura_agua"], "altura_txt": ALTURA.get(r["altura_agua"]), "via": r["via"], "tramo": tramo,
            # «verificado» es del equipo; validado por vecinos se ve, pero se dice así (constitución II)
            "verificado": foto_publica(r), "validado_por": r.get("validado_por"), "vecinos_n": r.get("vecinos_n"),
            "origen": r["origen"] or "vecino", "autor": (autores or {}).get(r["autor_id"]),
            "likes": (likes or {}).get(r["id"], 0), "me_gusta": r["id"] in (mios or set()),
            # foto propia aún no pública: llave para pedirla sin poner el id del teléfono en la URL
            "foto_k": llave_foto(r["id"]) if (r["foto"] and not foto_publica(r) and dispositivo
                                              and r["dispositivo"] == dispositivo) else None}


def validar_tramo(t, x0, y0, x1, y1):
    """Tramo de calle dibujado por el cliente: lista de [lat, lon], máx. 80 puntos, dentro del cantón ampliado."""
    if t in (None, "", []):
        return None
    if not isinstance(t, list) or not (2 <= len(t) <= 80):
        raise ErrorApi(400, "tramo de calle inválido")
    out = []
    for p in t:
        if not (isinstance(p, list) and len(p) == 2):
            raise ErrorApi(400, "tramo de calle inválido")
        try:
            la, lo = float(p[0]), float(p[1])
        except (TypeError, ValueError):
            raise ErrorApi(400, "tramo de calle inválido")
        if not (x0 <= lo <= x1 and y0 <= la <= y1):
            raise ErrorApi(400, "el tramo está fuera del cantón")
        out.append([round(la, 6), round(lo, 6)])
    return json.dumps(out)


def validar_dispositivo(d):
    if not isinstance(d, str) or not re.fullmatch(r"[A-Za-z0-9_-]{8,64}", d):
        raise ErrorApi(400, "identificador de dispositivo inválido", k="dispositivo.invalido")
    return d


def disp_o_vacio(d):
    """Id de teléfono para LEER: si no tiene el formato válido se ignora. Así nadie se hace pasar por el
    marcador de los incidentes del equipo (dispositivo «equipo») para ver lo retirado o sus fotos."""
    return d if isinstance(d, str) and re.fullmatch(r"[A-Za-z0-9_-]{8,64}", d) else ""


MAX_FOTOS = 3


def _jpeg(v):
    """Foto JPEG en data URL → bytes (validada: formato, tamaño y cabecera)."""
    m = re.fullmatch(r"data:image/jpeg;base64,([A-Za-z0-9+/=]+)", v) if isinstance(v, str) else None
    if not m:
        raise ErrorApi(400, "la foto debe ser JPEG", k="foto.formato")
    try:
        crudo = base64.b64decode(m.group(1), validate=True)
    except ValueError:                      # binascii.Error: base64 mal formado
        raise ErrorApi(400, "la foto no es válida", k="foto.invalida")
    if len(crudo) > CFG["max_foto_kb"] * 1024 or crudo[:3] != b"\xff\xd8\xff":
        raise ErrorApi(400, "la foto es demasiado grande o no es válida", k="foto.invalida")
    return crudo


def validar_foto(b):
    """Una foto (`foto`) → bytes, o None si no viene. La usan los incidentes del equipo."""
    return _jpeg(b["foto"]) if b.get("foto") else None


def validar_fotos(b):
    """Hasta MAX_FOTOS fotos (`fotos`: lista de data URL) → lista de bytes. Acepta también la `foto` suelta de
    antes (los reportes guardados sin señal en teléfonos con la versión anterior de la app)."""
    fotos = b.get("fotos")
    if fotos in (None, []):
        crudo = validar_foto(b)
        return [crudo] if crudo else []
    if not isinstance(fotos, list):
        raise ErrorApi(400, "fotos inválidas", k="foto.invalida")
    if len(fotos) > MAX_FOTOS:
        raise ErrorApi(400, f"puedes enviar hasta {MAX_FOTOS} fotos", k="foto.demasiadas")
    return [_jpeg(f) for f in fotos]


def guardar_foto(crudo):
    """Escribe la foto (ya validada) y devuelve su nombre. Se llama dentro de db_escritura(), junto con el INSERT."""
    if shutil.disk_usage(FOTOS).free < 1024 ** 3:
        raise ErrorApi(507, "no hay espacio para fotos ahora; envía el reporte sin foto", k="foto.espacio")
    foto = f"{uuid.uuid4().hex}.jpg"
    with open(os.path.join(FOTOS, foto), "wb") as fh:
        fh.write(crudo)
    return foto


def guardar_fotos(crudos):
    """Guarda varias; si una falla, borra las ya escritas (no quedan archivos sueltos)."""
    hechas = []
    try:
        for c in crudos:
            hechas.append(guardar_foto(c))
    except BaseException:
        borrar_archivos(hechas)
        raise
    return hechas


def borrar_archivos(nombres):
    for n in nombres:
        ruta = os.path.join(FOTOS, n) if n else None
        if ruta and os.path.isfile(ruta):
            os.remove(ruta)


def _lista_json(v):
    try:
        x = json.loads(v) if v else []
    except (TypeError, ValueError):
        return []
    return [n for n in x if isinstance(n, str)] if isinstance(x, list) else []


def fotos_de(r):
    """Nombres de archivo de las fotos de un reporte, en orden (la primera en `foto`, las demás en `fotos_extra`)."""
    if not r["foto"]:
        return []
    return [r["foto"]] + _lista_json(r.get("fotos_extra"))[:MAX_FOTOS - 1]


def quitar_fotos(con, rid):
    """Borra las fotos de un reporte (archivos y columnas). Devuelve cuántas había."""
    r = con.execute("SELECT foto, fotos_extra FROM reportes WHERE id=%s", (rid,)).fetchone()
    fotos = fotos_de(r) if r else []
    if fotos:
        borrar_archivos(fotos)
        con.execute("UPDATE reportes SET foto=NULL, fotos_extra=NULL WHERE id=%s", (rid,))
    return len(fotos)


MIN_DESCRIPCION = 5


def texto_con_sentido(v, minimo=MIN_DESCRIPCION, maximo=500):
    """El texto sin espacios de los bordes si dice algo (al menos `minimo` caracteres y 3 letras o números: «.» o
    «...» no cuentan); si no, None. Nada se publica vacío."""
    t = v.strip() if isinstance(v, str) else ""
    if len(t) < minimo or len(re.findall(r"[^\W_]", t)) < 3:
        return None
    return t[:maximo]


def validar_por_vecinos(con, tipo, lat, lon, t):
    """Si al menos `validacion_minimo` personas DISTINTAS reportaron lo mismo (mismo tipo) a `validacion_radio_m`
    metros o menos en las últimas `validacion_horas` horas, sus reportes pendientes se publican «validados por vecinos»
    sin esperar al analista. Persona distinta = otro teléfono, otra conexión y otra cuenta: una sola persona con varios
    teléfonos en el mismo wifi no se valida a sí misma. Se llama dentro de la transacción del reporte nuevo.
    Devuelve cuántas personas lo confirman (0 si no alcanza o si está apagado)."""
    if not usuarios.config_valor("validacion_vecinos"):
        return 0
    minimo, radio = usuarios.config_valor("validacion_minimo"), usuarios.config_valor("validacion_radio_m")
    desde = iso(t - dt.timedelta(hours=usuarios.config_valor("validacion_horas")))
    filas = con.execute("SELECT id, dispositivo, ip, ciudadano_id, lat, lon, creado, estado FROM reportes "
                        "WHERE tipo=%s AND creado>=%s AND expira>%s AND COALESCE(origen,'vecino')='vecino' "
                        "AND (estado='pendiente' OR (estado='validado' AND validado_por='vecinos')) ORDER BY creado",
                        (tipo, desde, iso(t))).fetchall()
    cerca = [r for r in filas if dist_m(lon, lat, r["lon"], r["lat"]) <= radio]
    telefonos, conexiones, cuentas, personas = set(), set(), set(), []
    for r in cerca:
        if r["dispositivo"] in telefonos or (r["ip"] and r["ip"] in conexiones) or (r["ciudadano_id"] and r["ciudadano_id"] in cuentas):
            continue                     # la misma persona otra vez: no suma (y ese reporte queda para el analista)
        telefonos.add(r["dispositivo"])
        if r["ip"]:
            conexiones.add(r["ip"])
        if r["ciudadano_id"]:
            cuentas.add(r["ciudadano_id"])
        personas.append(r)
    if len(personas) < minimo:
        return 0
    ids = [r["id"] for r in personas]
    con.execute("UPDATE reportes SET estado='validado', validado_por='vecinos', vecinos_n=%s, "
                "revisado_en=COALESCE(revisado_en, %s) WHERE id = ANY(%s) AND (estado='pendiente' OR validado_por='vecinos')",
                (len(personas), iso(t), ids))
    auth.auditar(con, None, "reporte.validado_vecinos", {"tipo": tipo, "personas": len(personas), "ids": ids[:20]})
    return len(personas)


def crear_reporte(b, ip, ciudadano_id=None):
    """Reporte de un vecino: anónimo (ciudadano_id None) o ligado a su cuenta (spec 018; la cuenta es opcional)."""
    disp = validar_dispositivo(b.get("dispositivo"))
    if b.get("consentimiento") is not True:
        raise ErrorApi(400, "falta aceptar el uso de los datos del reporte")
    tipo = b.get("tipo")
    if tipo not in TIPOS:
        raise ErrorApi(400, "tipo de reporte desconocido")
    try:
        lat, lon = float(b["lat"]), float(b["lon"])
    except (KeyError, TypeError, ValueError):
        raise ErrorApi(400, "falta la ubicación")
    grav = POR_TIPIFICAR          # la «gravedad» que mande el teléfono (versiones viejas de la app) no se usa
    x0, y0, x1, y1 = T.bbox
    if not (x0 <= lon <= x1 and y0 <= lat <= y1):
        raise ErrorApi(400, "la ubicación está fuera del cantón Yaguachi")
    desc = texto_con_sentido(b.get("descripcion"))
    if desc is None:
        raise ErrorApi(400, "describe qué pasa: al menos 5 caracteres", k="reportes.descripcion")
    altura, via, tramo = None, None, None
    if tipo == "calle_inundada":
        try:
            altura = int(b.get("altura_agua"))
        except (TypeError, ValueError):
            altura = None
        if altura not in ALTURA:
            raise ErrorApi(400, "indica cuánta agua hay (hasta la vereda, sobre la vereda o no cruces)")
        grav = {1: 1, 2: 2, 3: 3}[altura]
        via = (b.get("via") or "").strip()[:120] or None
        tramo = validar_tramo(b.get("tramo"), x0, y0, x1, y1)
    t = ahora()
    crudos = validar_fotos(b)
    rid_cerca, d_cerca = T.recinto_cercano(lon, lat)
    rec = T.recintos[rid_cerca]["nombre"] if d_cerca <= 3000 else None
    rid = uuid.uuid4().hex[:12]
    expira = iso(t + dt.timedelta(hours=TIPOS[tipo][2]))
    # límites y guardado bajo el mismo candado: varios envíos simultáneos no se saltan los topes
    with db_escritura() as con:
        n = con.execute("SELECT COUNT(*) AS n FROM reportes WHERE dispositivo=%s AND creado>%s",
                        (disp, iso(t - dt.timedelta(hours=1)))).fetchone()["n"]
        if n >= CFG["max_reportes_hora_dispositivo"]:
            raise ErrorApi(429, "ya enviaste varios reportes en la última hora; espera un momento")
        # el mismo tope por cuenta: cambiar de teléfono no lo salta
        n_cta = con.execute("SELECT COUNT(*) AS n FROM reportes WHERE ciudadano_id=%s AND creado>%s",
                            (ciudadano_id, iso(t - dt.timedelta(hours=1)))).fetchone()["n"] if ciudadano_id else 0
        if n_cta >= CFG["max_reportes_hora_dispositivo"]:
            raise ErrorApi(429, "ya enviaste varios reportes en la última hora; espera un momento")
        n_ip = con.execute("SELECT COUNT(*) AS n FROM reportes WHERE ip=%s AND creado>%s",
                           (ip, iso(t - dt.timedelta(hours=1)))).fetchone()["n"]
        if n_ip >= 40:
            raise ErrorApi(429, "demasiados reportes desde esta conexión")
        if crudos and con.execute("SELECT COUNT(*) AS n FROM reportes WHERE ip=%s AND foto IS NOT NULL AND creado>%s",
                                 (ip, iso(t - dt.timedelta(days=1)))).fetchone()["n"] >= 20:
            raise ErrorApi(429, "ya enviaste muchas fotos hoy; manda el reporte sin foto")
        for r in con.execute("SELECT lat, lon FROM reportes WHERE dispositivo=%s AND tipo=%s AND creado>%s",
                             (disp, tipo, iso(t - dt.timedelta(minutes=30)))).fetchall():
            if dist_m(lon, lat, r["lon"], r["lat"]) < 150:
                raise ErrorApi(409, "ya reportaste lo mismo aquí hace poco")
        fotos = guardar_fotos(crudos)
        try:
            con.execute("INSERT INTO reportes (id, creado, dispositivo, ip, tipo, gravedad, descripcion, lat, lon, recinto_id, "
                        "recinto, en_canton, foto, fotos_extra, expira, altura_agua, via, tramo, ciudadano_id) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                        (rid, iso(t), disp, ip, tipo, grav, desc, lat, lon, rid_cerca if rec else None, rec,
                         int(T.en_canton(lon, lat)), fotos[0] if fotos else None,
                         json.dumps(fotos[1:]) if len(fotos) > 1 else None, expira, altura, via, tramo,
                         ciudadano_id))
        except BaseException:
            borrar_archivos(fotos)
            raise
        vecinos = validar_por_vecinos(con, tipo, lat, lon, t)
    if vecinos:
        invalidar_estado()
        return {"ok": True, "id": rid, "estado": "validado", "vecinos_n": vecinos,
                "mensaje": f"Gracias. Con tu reporte ya son {vecinos} vecinos en este sector: quedó confirmado y se ve en el mapa."}
    if tipo in PUBLICO_YA:
        msg = "Gracias. Tu aviso ya está en el mapa como «aviso de vecinos»; otros vecinos pueden confirmarlo."
    else:
        msg = "Gracias. Vamos a revisar tu reporte; mientras tanto solo lo ves tú."
    return {"ok": True, "id": rid, "estado": "pendiente", "mensaje": msg}


def listar_reportes(q):
    disp = disp_o_vacio(q.get("dispositivo", [""])[0])
    t = iso(ahora())
    ya = ",".join(f"'{k}'" for k in PUBLICO_YA)
    with db() as con:
        filas = con.execute("SELECT * FROM reportes WHERE (estado='validado' AND expira>%s) "
                            f"OR (estado='pendiente' AND tipo IN ({ya}) AND expira>%s) OR dispositivo=%s "
                            "ORDER BY (estado='validado') DESC, creado DESC LIMIT 400", (t, t, disp)).fetchall()
        likes = {x["reporte_id"]: x["n"] for x in
                 con.execute("SELECT reporte_id, COUNT(*) AS n FROM me_gusta GROUP BY reporte_id")}
        mios = {x["reporte_id"] for x in con.execute("SELECT reporte_id FROM me_gusta WHERE dispositivo=%s", (disp,))} if disp else set()
        autores = autores_publicos(con, filas)
    return {"reportes": [reporte_publico(r, disp, likes, mios, autores) for r in filas],
            "tipos": {k: {"emoji": v[0], "etiqueta": v[1], "horas": v[2]} for k, v in TIPOS.items()},
            "gravedad": GRAVEDAD, "altura": ALTURA}


def visible_para(r, disp):
    """Un reporte se ve en el muro si está verificado, si es una calle inundada aún vigente o si es tuyo."""
    if not r:
        return False
    if r["dispositivo"] == disp:
        return True
    return r["expira"] > iso(ahora()) and (r["estado"] == "validado" or (r["estado"] == "pendiente" and r["tipo"] in PUBLICO_YA))


def me_gusta_reporte(rid, b, ip=None):
    """Me gusta / ya no me gusta (un voto por teléfono, sin cuentas)."""
    disp = validar_dispositivo(b.get("dispositivo"))
    with db_escritura() as con:
        r = con.execute("SELECT * FROM reportes WHERE id=%s", (rid,)).fetchone()
        if not visible_para(r, disp):
            raise ErrorApi(404, "reporte no encontrado")
        ya = con.execute("SELECT 1 FROM me_gusta WHERE reporte_id=%s AND dispositivo=%s", (rid, disp)).fetchone()
        if ya:
            con.execute("DELETE FROM me_gusta WHERE reporte_id=%s AND dispositivo=%s", (rid, disp))
        else:
            n_ip = con.execute("SELECT COUNT(*) AS n FROM me_gusta WHERE ip=%s AND creado>%s",
                               (ip, iso(ahora() - dt.timedelta(hours=1)))).fetchone()["n"] if ip else 0
            if n_ip >= 60:
                raise ErrorApi(429, "demasiados «me gusta» desde esta conexión; espera un rato")
            con.execute("INSERT INTO me_gusta (reporte_id, dispositivo, creado, ip) VALUES (%s,%s,%s,%s)", (rid, disp, iso(ahora()), ip))
        n = con.execute("SELECT COUNT(*) AS n FROM me_gusta WHERE reporte_id=%s", (rid,)).fetchone()["n"]
    return {"ok": True, "likes": n, "me_gusta": not ya}


def pagina_compartida(rid, host):
    """Página corta para los enlaces compartidos (Facebook, WhatsApp): lleva las etiquetas Open Graph
    para la vista previa y luego abre el reporte en el muro de la app."""
    with db() as con:
        r = con.execute("SELECT * FROM reportes WHERE id=%s", (rid,)).fetchone()
    base = (os.environ.get("URL_PUBLICA") or "").rstrip("/") or f"http://{host}"
    destino = f"/#muro/{rid}"
    publico = r and r["expira"] > iso(ahora()) and (r["estado"] == "validado" or (r["estado"] == "pendiente" and r["tipo"] in PUBLICO_YA))
    if not publico:
        titulo, desc, imagen, destino = ("Yaguachi Weather", "Reportes de vecinos sobre inundaciones en el cantón Yaguachi. No es un canal oficial.",
                                         f"{base}/icono-512.png", "/#muro")
    else:
        et = TIPOS.get(r["tipo"], ("", r["tipo"]))[1]
        if r["tipo"] == "calle_inundada" and r["via"]:
            et = f"{et}: {r['via']}"
        titulo = f"{et} · {r['recinto'] or 'cantón Yaguachi'}"
        partes = [ALTURA.get(r["altura_agua"]) if r["tipo"] == "calle_inundada" else None, r["descripcion"],
                  ("Publicado por el equipo de riesgo." if r["origen"] == "equipo" else
                   f"Confirmado por {r['vecinos_n']} vecinos, sin revisión del equipo." if r.get("validado_por") == "vecinos" else
                   "Verificado por el analista." if r["estado"] == "validado" else "Aviso de vecinos, sin verificar."),
                  "Yaguachi Weather es un proyecto independiente; no es un canal oficial."]
        desc = " ".join(x for x in partes if x)
        imagen = f"{base}/api/foto/{rid}" if (r["foto"] and foto_publica(r)) else f"{base}/icono-512.png"
    e = lambda x: html.escape(str(x), quote=True)
    return f"""<!DOCTYPE html><html lang="es-EC"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>{e(titulo)}</title>
<meta property="og:type" content="article"><meta property="og:site_name" content="Yaguachi Weather">
<meta property="og:title" content="{e(titulo)}"><meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{e(imagen)}"><meta property="og:url" content="{e(base + '/r/' + rid)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url={e(destino)}"></head>
<body><p><a href="{e(destino)}">{e(titulo)}</a></p></body></html>""".encode("utf-8")


def confirmar_reporte(rid, b, ip=None):
    disp = validar_dispositivo(b.get("dispositivo"))
    sigue = 1 if b.get("sigue") else 0
    with db_escritura() as con:
        r = con.execute("SELECT * FROM reportes WHERE id=%s", (rid,)).fetchone()
        if not r or not (r["estado"] == "validado" or (r["estado"] == "pendiente" and r["tipo"] in PUBLICO_YA)):
            raise ErrorApi(404, "reporte no encontrado")
        if r["expira"] <= iso(ahora()):
            raise ErrorApi(409, "este aviso ya venció")
        if r["dispositivo"] == disp:
            if r["tipo"] not in PUBLICO_YA or r["estado"] != "pendiente":
                raise ErrorApi(409, "este reporte lo cierra el analista")
            if sigue:
                raise ErrorApi(409, "no puedes confirmar tu propio reporte")
            con.execute("UPDATE reportes SET estado='resuelto', nota_ugr=COALESCE(nota_ugr,'') || ' [quien avisó dijo que el agua ya pasó]' "
                        "WHERE id=%s", (rid,))
            invalidar_estado()
            return {"ok": True, "resuelto": True}
        if ip and con.execute("SELECT COUNT(*) AS n FROM confirmaciones WHERE ip=%s AND creado>%s",
                              (ip, iso(ahora() - dt.timedelta(hours=1)))).fetchone()["n"] >= 30:
            raise ErrorApi(429, "demasiadas confirmaciones desde esta conexión; espera un rato")
        con.execute("INSERT INTO confirmaciones (reporte_id, dispositivo, sigue, creado, ip) VALUES (%s,%s,%s,%s,%s) "
                    "ON CONFLICT (reporte_id, dispositivo) DO UPDATE SET sigue=excluded.sigue, creado=excluded.creado, "
                    "ip=excluded.ip",
                    (rid, disp, sigue, iso(ahora()), ip))
        s = con.execute("SELECT COALESCE(SUM(sigue), 0) AS si, COALESCE(SUM(1-sigue), 0) AS no FROM confirmaciones "
                        "WHERE reporte_id=%s", (rid,)).fetchone()
        # para cerrar cuenta una sola voz por conexión: tres teléfonos inventados en la misma red no bastan
        ya_no_ips = con.execute("SELECT COUNT(DISTINCT COALESCE(ip, dispositivo)) AS n FROM confirmaciones "
                                "WHERE reporte_id=%s AND sigue=0", (rid,)).fetchone()["n"]
        con.execute("UPDATE reportes SET sigue=%s, ya_no=%s WHERE id=%s", (s["si"], s["no"], rid))
        # tres vecinos dicen "ya no" y nadie "sigue" en la última hora -> se cierra solo
        if r["estado"] == "pendiente" and ya_no_ips >= 3 and s["no"] > 2 * s["si"]:   # lo verificado solo lo cierra el analista
            con.execute("UPDATE reportes SET estado='resuelto', nota_ugr=COALESCE(nota_ugr,'') || ' [cerrado por vecinos]' "
                        "WHERE id=%s", (rid,))
    invalidar_estado()
    return {"ok": True}


def aviso_aplica(a, p):
    """¿El aviso `a` le toca al recinto `p`? Misma regla en /api/avisos y en los destinatarios del web push."""
    if a["ambito_tipo"] == "canton":
        return True
    if a["ambito_tipo"] == "recinto":
        return a["ambito_id"] == str(p["id"])
    if a["ambito_tipo"] == "parroquia":
        return a["ambito_id"] == (p["parroquia"] or "")
    if a["ambito_tipo"] == "rio":
        return a["ambito_id"] == p["rio_cercano"] and p["dist_rio_m"] <= DIST_RIO_M
    return False


def aviso_aplica_a_recinto(a, rid):
    """Para push.recibe: None si el recinto ya no existe en las capas (se trata como un token sin recinto)."""
    p = T.recintos.get(rid)
    return aviso_aplica(a, p) if p else None


FLYERS = os.path.join(FOTOS, "avisos")     # fuera de la limpieza de fotos de reportes (que es por reporte)


def url_flyer(a):
    """URL del flyer de un aviso, con el nombre del archivo como versión (si cambia, el teléfono baja el nuevo)."""
    return f"/api/avisos/{a['id']}/flyer?v={a['flyer'][:8]}" if a.get("flyer") else None


def aviso_publico(a):
    d = {k: v for k, v in dict(a).items() if k not in ("autor_id", "eliminado_en", "eliminado_por")}   # quién no se expone
    d["flyer"] = url_flyer(a)
    return d


def ruta_flyer(aid):
    """Archivo del flyer de un aviso visible (no anulado ni eliminado); si no hay, None."""
    with db() as con:
        r = con.execute("SELECT flyer FROM avisos WHERE id=%s AND anulado=0 AND eliminado_en IS NULL", (aid,)).fetchone()
    return os.path.join(FLYERS, r["flyer"]) if r and r["flyer"] else None


def guardar_flyer(crudo):
    """Escribe el flyer (JPEG ya validado) en datos/fotos/avisos y devuelve su nombre."""
    os.makedirs(FLYERS, exist_ok=True)
    if shutil.disk_usage(FLYERS).free < 1024 ** 3:
        raise ErrorApi(507, "no hay espacio para el flyer ahora; publica el aviso sin imagen", k="foto.espacio")
    nombre = f"{uuid.uuid4().hex}.jpg"
    with open(os.path.join(FLYERS, nombre), "wb") as fh:
        fh.write(crudo)
    return nombre


# --------------------------------------------------------------------------- alcance (spec 021)
TIPOS_VISTA = ("aviso", "incidente")
VIAS_VISTA = ("app", "push")
MAX_VISTAS_LOTE = 30
MAX_VISTAS_IP_HORA = 600


def quien_vista(disp):
    """Firma de una sola vía del id del teléfono: sirve para contar teléfonos distintos sin poder saber cuál es."""
    return hmac.new(CFG["secreto_fotos"].encode(), ("vistas:" + disp).encode(), "sha256").hexdigest()[:32]


def registrar_vistas(b, disp, ip=None, plat=None):
    """POST /api/vistas {tipo, ids, via}: «este teléfono abrió estos avisos o incidentes». Una vez por teléfono, ítem
    y vía (lo repetido no cuenta). Solo cuenta lo que existe y se ve: avisos no eliminados e incidentes del equipo."""
    disp = validar_dispositivo(disp)
    tipo, via, ids = b.get("tipo"), b.get("via", "app"), b.get("ids")
    if tipo not in TIPOS_VISTA or via not in VIAS_VISTA or not isinstance(ids, list) or not 0 < len(ids) <= MAX_VISTAS_LOTE:
        raise ErrorApi(400, "vistas inválidas", k="vistas.invalidas")
    patron = r"\d{1,9}" if tipo == "aviso" else r"[0-9a-f]{12}"
    ids = sorted({str(i) for i in ids if re.fullmatch(patron, str(i))})
    if not ids:
        raise ErrorApi(400, "vistas inválidas", k="vistas.invalidas")
    t = iso(ahora())
    with db_escritura() as con:
        if ip:
            n_ip = con.execute("SELECT COUNT(*) AS n FROM vistas WHERE ip=%s AND creado>%s",
                               (ip, iso(ahora() - dt.timedelta(hours=1)))).fetchone()["n"]
            if n_ip >= MAX_VISTAS_IP_HORA:
                raise ErrorApi(429, "demasiadas lecturas desde esta conexión; espera un rato", k="vistas.limite")
        if tipo == "aviso":
            validos = [str(r["id"]) for r in con.execute("SELECT id FROM avisos WHERE id = ANY(%s) AND eliminado_en IS NULL",
                                                         ([int(i) for i in ids],))]
        else:
            validos = [r["id"] for r in con.execute("SELECT id FROM reportes WHERE id = ANY(%s) AND origen='equipo'", (ids,))]
        q = quien_vista(disp)
        nuevas = 0
        for i in validos:
            nuevas += con.execute("INSERT INTO vistas (tipo, item_id, quien, via, creado, ip, plataforma) "
                                  "VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING", (tipo, i, q, via, t, ip, plat)).rowcount
    return {"ok": True, "nuevas": nuevas}


def codigo_telefono(quien):
    """«7F3A2C»: los primeros 6 caracteres de la firma del teléfono. Sirve para reconocer el mismo teléfono en varios
    avisos sin saber cuál es (ni su número, ni su id, ni el nombre de nadie)."""
    return (quien or "")[:6].upper()


MAX_TELEFONOS_IP_HORA = 30          # teléfonos distintos que una conexión puede anotar por hora
DIAS_CONSERVAR_TELEFONOS = 180
PERIODOS = {"hoy": 1, "7d": 7, "30d": 30, "todos": None}
# marcas que se aceptan (la app la deduce del modelo, que nunca se envía); cualquier otra cosa no se guarda
MARCAS = ("Samsung", "Xiaomi", "Motorola", "Apple", "Google", "Huawei", "realme", "OPPO", "vivo", "Tecno", "Infinix",
          "Nokia", "LG", "ZTE", "Otra")
FORMATOS = ("telefono", "tablet", "computadora")


def registrar_actividad(b, disp, ip=None, plat=None):
    """POST /api/actividad: «este teléfono está usando la app». Una fila por teléfono (por su firma, nunca el id)."""
    disp = validar_dispositivo(disp)
    idioma = b.get("idioma") if b.get("idioma") in ("es", "en") else None
    version = b.get("version") if isinstance(b.get("version"), str) and re.fullmatch(r"[0-9A-Za-z._-]{1,40}", b["version"]) else None
    instalada = 1 if b.get("instalada") is True else 0
    marca = b.get("marca") if b.get("marca") in MARCAS else None
    so_v = b.get("so_version")
    so_v = so_v if isinstance(so_v, int) and not isinstance(so_v, bool) and 1 <= so_v <= 99 else None
    formato = b.get("formato") if b.get("formato") in FORMATOS else None
    q, t = quien_vista(disp), iso(ahora())
    with db_escritura() as con:
        if ip:
            n = con.execute("SELECT COUNT(*) AS n FROM dispositivos WHERE ip=%s AND ultima>%s AND quien<>%s",
                            (ip, iso(ahora() - dt.timedelta(hours=1)), q)).fetchone()["n"]
            if n >= MAX_TELEFONOS_IP_HORA:
                raise ErrorApi(429, "demasiados teléfonos desde esta conexión; espera un rato", k="actividad.limite")
        # un día nuevo de uso suma a `dias` (las fechas son de Ecuador: los 10 primeros caracteres son el día)
        con.execute("INSERT INTO dispositivos (quien, plataforma, instalada, idioma, version, creado, ultima, dias, ip, "
                    "marca, so_version, formato) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,1,%s,%s,%s,%s) ON CONFLICT (quien) DO UPDATE SET "
                    "plataforma=COALESCE(excluded.plataforma, dispositivos.plataforma), instalada=excluded.instalada, "
                    "marca=COALESCE(excluded.marca, dispositivos.marca), "
                    "so_version=COALESCE(excluded.so_version, dispositivos.so_version), "
                    "formato=COALESCE(excluded.formato, dispositivos.formato), "
                    "idioma=COALESCE(excluded.idioma, dispositivos.idioma), version=COALESCE(excluded.version, dispositivos.version), "
                    "dias=dispositivos.dias + CASE WHEN left(dispositivos.ultima, 10) <> left(excluded.ultima, 10) THEN 1 ELSE 0 END, "
                    "ultima=excluded.ultima, ip=excluded.ip",
                    (q, plat, instalada, idioma, version, t, t, ip, marca, so_v, formato))
    return {"ok": True}


POR_PAGINA_TELEFONOS = 25


def panel_dispositivos(q=None):
    """Pestaña «Dispositivos» (superadmin): los teléfonos que usan la app y los que tienen notificaciones, por código.
    Filtros: `periodo` (hoy, 7d, 30d por defecto, todos; según la última actividad), `push=1` (solo con notificaciones)
    y `codigo` (empieza o contiene). Por páginas: `pagina` (desde 1) y `n` (10 a 100, 25 por defecto). El resumen
    cuenta todos los teléfonos, sin filtros."""
    q = q or {}
    periodo = q.get("periodo", ["30d"])[0]
    if periodo not in PERIODOS:
        raise ErrorApi(400, "periodo inválido", k="dispositivos.periodo")
    try:
        pagina = max(1, int(q.get("pagina", ["1"])[0]))
        n = max(10, min(100, int(q.get("n", [str(POR_PAGINA_TELEFONOS)])[0])))
    except ValueError:
        raise ErrorApi(400, "página inválida", k="dispositivos.pagina")
    solo_push = q.get("push", ["0"])[0] == "1"
    codigo = re.sub(r"[^0-9A-F]", "", q.get("codigo", [""])[0].upper())[:6]
    with db() as con:
        uso = con.execute("SELECT * FROM dispositivos").fetchall()
        tokens = con.execute("SELECT dispositivo, recinto_id, idioma, creado, ultimo_uso, plataforma FROM push_tokens").fetchall()
    tels = {}
    for r in uso:
        tels[r["quien"]] = {"codigo": codigo_telefono(r["quien"]), "plataforma": r["plataforma"], "instalada": bool(r["instalada"]),
                            "marca": r["marca"], "so_version": r["so_version"], "formato": r["formato"],
                            "idioma": r["idioma"], "version": r["version"], "notificaciones": False, "recinto": None,
                            "alta": r["creado"], "ultimo_uso": r["ultima"], "dias": r["dias"]}
    for r in tokens:                      # con notificaciones: se suma su recinto (o aparece aunque no haya avisado uso)
        disp = disp_o_vacio(r["dispositivo"])
        if not disp:
            continue
        qq = quien_vista(disp)
        d = tels.setdefault(qq, {"codigo": codigo_telefono(qq), "plataforma": r["plataforma"], "instalada": None,
                                 "marca": None, "so_version": None, "formato": None,
                                 "idioma": r["idioma"], "version": None, "notificaciones": True, "recinto": None,
                                 "alta": r["creado"], "ultimo_uso": r["ultimo_uso"], "dias": None})
        d["notificaciones"] = True
        d["recinto"] = d["recinto"] or (T.recintos.get(r["recinto_id"], {}).get("nombre") if r["recinto_id"] else None)
        d["plataforma"] = d["plataforma"] or r["plataforma"]
        d["alta"] = min(d["alta"], r["creado"])
        d["ultimo_uso"] = max(d["ultimo_uso"] or "", r["ultimo_uso"] or "")
    todos = list(tels.values())
    limite = lambda dias: iso(ahora() - dt.timedelta(days=dias))
    resumen = {"total": len(todos), "hoy": sum(d["ultimo_uso"] >= limite(1) for d in todos),
               "semana": sum(d["ultimo_uso"] >= limite(7) for d in todos), "mes": sum(d["ultimo_uso"] >= limite(30) for d in todos),
               "con_notificaciones": sum(d["notificaciones"] for d in todos), "instaladas": sum(bool(d["instalada"]) for d in todos),
               # cuántos por marca y por formato (las marcas, de la más usada a la menos)
               "marcas": sorted(({"marca": m, "n": n} for m, n in collections.Counter(d["marca"] or "?" for d in todos).items()),
                                key=lambda x: (-x["n"], x["marca"])),
               "formatos": dict(collections.Counter(d["formato"] or "?" for d in todos))}
    dias = PERIODOS[periodo]
    lista = [d for d in todos if (dias is None or d["ultimo_uso"] >= limite(dias)) and (not solo_push or d["notificaciones"])
             and (not codigo or codigo in d["codigo"])]
    lista.sort(key=lambda d: (d["ultimo_uso"] or "", d["codigo"]), reverse=True)
    paginas = max(1, -(-len(lista) // n))
    pagina = min(pagina, paginas)
    return {"resumen": resumen, "periodo": periodo, "dispositivos": lista[(pagina - 1) * n: pagina * n], "total": len(lista),
            "pagina": pagina, "paginas": paginas, "n": n}


def panel_alcance_detalle(tipo, item_id):
    """Qué teléfonos (por código, sin nombre) abrieron un aviso o incidente, cuándo y por dónde (superadmin)."""
    if tipo not in TIPOS_VISTA:
        raise ErrorApi(404, "tipo desconocido")
    with db() as con:
        filas = con.execute("SELECT quien, via, creado, plataforma FROM vistas WHERE tipo=%s AND item_id=%s ORDER BY creado",
                            (tipo, str(item_id))).fetchall()
        tokens = con.execute("SELECT dispositivo, recinto_id, plataforma FROM push_tokens").fetchall()
    # los que tienen notificaciones: su firma da el mismo código, así se suman su recinto y su tipo de teléfono
    con_push = {}
    for r in tokens:
        disp = disp_o_vacio(r["dispositivo"])
        if disp:
            con_push[quien_vista(disp)] = r
    tels = {}
    for f in filas:
        d = tels.setdefault(f["quien"], {"codigo": codigo_telefono(f["quien"]), "vias": [], "primera": f["creado"],
                                         "plataforma": f["plataforma"], "notificaciones": f["quien"] in con_push, "recinto": None})
        d["vias"].append(f["via"])
        d["plataforma"] = d["plataforma"] or f["plataforma"]
        p = con_push.get(f["quien"])
        if p:
            d["plataforma"] = d["plataforma"] or p["plataforma"]
            d["recinto"] = T.recintos.get(p["recinto_id"], {}).get("nombre") if p["recinto_id"] else None
    return {"dispositivos": sorted(tels.values(), key=lambda d: d["primera"]), "total": len(tels)}


def alcance(con, tipo, ids):
    """id -> {"vistas": teléfonos distintos que lo abrieron, "push": cuántos lo abrieron desde la notificación}."""
    if not ids:
        return {}
    filas = con.execute("SELECT item_id, COUNT(DISTINCT quien) AS vistas, COUNT(DISTINCT quien) FILTER (WHERE via='push') AS push "
                        "FROM vistas WHERE tipo=%s AND item_id = ANY(%s) GROUP BY item_id", (tipo, [str(i) for i in ids]))
    return {r["item_id"]: {"vistas": r["vistas"], "push": r["push"]} for r in filas}


def enviados_push(con, ids):
    """aviso_id -> a cuántos teléfonos les llegó la notificación (último envío)."""
    out = {}
    if not ids:
        return out
    for r in con.execute("SELECT aviso_id, resultado FROM push_cola WHERE aviso_id = ANY(%s) AND enviado IS NOT NULL "
                         "ORDER BY id", (list(ids),)):
        try:
            res = json.loads(r["resultado"] or "{}")
        except ValueError:
            continue
        if "ok" in res:
            out[r["aviso_id"]] = res["ok"]
    return out


def pagina_aviso_compartido(aid, host):
    """Página corta para compartir un aviso (WhatsApp, Facebook): Open Graph con el flyer y luego el aviso en la app."""
    with db() as con:
        a = con.execute("SELECT * FROM avisos WHERE id=%s AND anulado=0 AND eliminado_en IS NULL", (aid,)).fetchone()
    base = (os.environ.get("URL_PUBLICA") or "").rstrip("/") or f"http://{host}"
    if not a:
        titulo, desc, imagen, destino = ("Yaguachi Weather", "Avisos de inundación para el cantón Yaguachi. No es un canal oficial.",
                                         f"{base}/icono-512.png", "/#avisos")
    else:
        titulo = f"{NIVELES.get(a['nivel_cod'], '')} · {a['titulo']}".strip(" ·")
        desc = f"{a['texto'][:240]} — {a['ambito_nombre'] or 'cantón Yaguachi'}. Yaguachi Weather es un proyecto independiente; no es un canal oficial."
        imagen = base + url_flyer(a) if a["flyer"] else f"{base}/icono-512.png"
        destino = f"/#avisos/{aid}"
    e = lambda x: html.escape(str(x), quote=True)
    return f"""<!DOCTYPE html><html lang="es-EC"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>{e(titulo)}</title>
<meta property="og:type" content="article"><meta property="og:site_name" content="Yaguachi Weather">
<meta property="og:title" content="{e(titulo)}"><meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{e(imagen)}"><meta property="og:url" content="{e(base + '/a/' + str(aid))}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url={e(destino)}"></head>
<body><p><a href="{e(destino)}">{e(titulo)}</a></p></body></html>""".encode("utf-8")


def avisos_para(q):
    rid = q.get("recinto", [""])[0]
    t = iso(ahora())
    with db() as con:
        filas = con.execute("SELECT * FROM avisos WHERE anulado=0 AND eliminado_en IS NULL AND vigente_hasta>%s ORDER BY creado DESC LIMIT 50",
                            (t,)).fetchall()
        historicos = con.execute("SELECT * FROM avisos WHERE anulado=0 AND eliminado_en IS NULL AND vigente_hasta<=%s ORDER BY creado DESC LIMIT 20",
                                 (t,)).fetchall()
    p = T.recintos.get(int(rid)) if rid.isdigit() else None

    def aplica(a):
        return not p or aviso_aplica(a, p)          # sin recinto elegido se ven todos

    return {"vigentes": [aviso_publico(a) for a in filas if aplica(a)],
            "anteriores": [aviso_publico(a) for a in historicos if aplica(a)],
            "horas_silencio": CFG["horas_silencio"]}

# --------------------------------------------------------------------------- panel del analista


PAGINA_REPORTES = 20
ESTADOS_REPORTE = ("pendiente", "validado", "descartado", "resuelto", "retirado")
VIGENCIA_MAX_DIAS = 90


def _filtros_reportes(q):
    """WHERE de la lista del panel: estado, origen (vecino/equipo), tipo, vigencia (visibles/vencidos) y texto."""
    donde, args = [], []
    estado = q.get("estado", ["pendiente"])[0]
    if estado == "vecinos":                 # publicados por vecinos que el equipo todavía no revisó
        donde.append("estado='validado' AND validado_por='vecinos'")
    elif estado != "todos":
        if estado not in ESTADOS_REPORTE:
            raise ErrorApi(400, "filtro de estado inválido", k="reportes.filtro")
        donde.append("estado=%s")
        args.append(estado)
    origen = q.get("origen", ["todos"])[0]
    if origen in ("vecino", "equipo"):
        donde.append("origen=%s")
        args.append(origen)
    elif origen != "todos":
        raise ErrorApi(400, "filtro de origen inválido", k="reportes.filtro")
    tipo = q.get("tipo", ["todos"])[0]
    if tipo != "todos":
        if tipo not in TIPOS:
            raise ErrorApi(400, "filtro de tipo inválido", k="reportes.filtro")
        donde.append("tipo=%s")
        args.append(tipo)
    vigencia, t = q.get("vigencia", ["todas"])[0], iso(ahora())
    if vigencia == "vigentes":
        donde.append("expira>%s")
        args.append(t)
    elif vigencia == "vencidos":
        donde.append("expira<=%s")
        args.append(t)
    elif vigencia != "todas":
        raise ErrorApi(400, "filtro de vigencia inválido", k="reportes.filtro")
    texto = (q.get("q", [""])[0] or "").strip()[:80]
    if texto:
        like = "%" + texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        donde.append("(descripcion ILIKE %s OR recinto ILIKE %s OR via ILIKE %s OR id=%s)")
        args += [like, like, like, texto.lower()]
    return donde, args


def _entero_q(q, k, defecto, minimo, maximo):
    try:
        return max(minimo, min(maximo, int(q.get(k, [defecto])[0])))
    except ValueError:
        return defecto


def panel_reportes(q):
    """Reportes de vecinos e incidentes del equipo, con filtros y por páginas (del más nuevo al más viejo).
    `pagina` empieza en 1; `n` va de 1 a 100 (20 por defecto). Devuelve también el total para la paginación."""
    donde, args = _filtros_reportes(q)
    n = _entero_q(q, "n", PAGINA_REPORTES, 1, 100)
    pagina = _entero_q(q, "pagina", 1, 1, 100000)
    w = f"WHERE {' AND '.join(donde)}" if donde else ""
    with db() as con:
        total = con.execute(f"SELECT COUNT(*) AS n FROM reportes {w}", args).fetchone()["n"]
        filas = con.execute(f"SELECT * FROM reportes {w} ORDER BY creado DESC, id DESC LIMIT %s OFFSET %s",
                            (*args, n, (pagina - 1) * n)).fetchall()
        autores = autores_publicos(con, filas, anonimos=False)    # el equipo siempre ve quién lo publicó
    out = []
    for r in filas:
        d = reporte_publico(r, autores=autores)
        d.update(foto=bool(r["foto"]), n_fotos=len(fotos_de(r)), dispositivo=r["dispositivo"][:6] + "…", en_canton=bool(r["en_canton"]),
                 revisado_en=r["revisado_en"])
        out.append(d)
    return {"reportes": out, "total": total, "pagina": pagina, "n": n, "paginas": max(1, -(-total // n))}


def panel_vigencia(b, quien):
    """Cambia hasta cuándo se ven uno o varios reportes o incidentes (permiso reportes.vigencia: superadmin y
    analista). `ids`: de 1 a 100; `hasta`: fecha y hora ISO entre 5 minutos y 90 días desde ahora. Si ya habían
    vencido y siguen verificados, vuelven a verse. Queda en la auditoría."""
    ids = _ids_lote(b)
    try:
        hasta = leer_iso(b.get("hasta"))
    except (TypeError, ValueError, AttributeError):
        raise ErrorApi(400, "fecha inválida", k="reportes.vigencia_fecha")
    t = ahora()
    if not t + dt.timedelta(minutes=5) <= hasta <= t + dt.timedelta(days=VIGENCIA_MAX_DIAS):
        raise ErrorApi(400, f"la fecha debe ser futura y de hasta {VIGENCIA_MAX_DIAS} días", k="reportes.vigencia_fecha")
    hasta_txt = iso(hasta.astimezone(t.tzinfo))      # misma zona que el resto: se compara como texto ISO
    with db_escritura() as con:
        n = con.execute("UPDATE reportes SET expira=%s WHERE id = ANY(%s)", (hasta_txt, ids)).rowcount
        if not n:
            raise ErrorApi(404, "no se encontró ningún reporte", k="reportes.no_existe")
        auth.auditar(con, quien["id"], "reportes.vigencia", {"n": n, "hasta": hasta_txt, "ids": ids[:20]})
    invalidar_estado()
    return {"ok": True, "actualizados": n, "hasta": hasta_txt}


def _ids_lote(b):
    ids = b.get("ids")
    if (not isinstance(ids, list) or not 1 <= len(ids) <= 100
            or not all(isinstance(i, str) and re.fullmatch(r"[0-9a-f]{12}", i) for i in ids)):
        raise ErrorApi(400, "elige de 1 a 100 reportes", k="reportes.ids")
    return list(dict.fromkeys(ids))


def panel_eliminar_reportes(b, quien):
    """Solo superadmin (reportes.eliminar): borra DEFINITIVAMENTE de 1 a 100 reportes de vecinos o incidentes del
    equipo, con sus confirmaciones, «me gusta» y fotos (como eliminar un incidente: el texto puede ser ofensivo o tener
    datos personales). En la auditoría queda qué era cada uno (id, tipo, origen, recinto, fecha, estado), sin el texto."""
    ids = _ids_lote(b)
    with db_escritura() as con:
        filas = con.execute("SELECT id, tipo, origen, recinto, creado, estado, foto, fotos_extra FROM reportes "
                            "WHERE id = ANY(%s)", (ids,)).fetchall()
        if not filas:
            raise ErrorApi(404, "no se encontró ningún reporte", k="reportes.no_existe")
        encontrados = [r["id"] for r in filas]
        con.execute("DELETE FROM confirmaciones WHERE reporte_id = ANY(%s)", (encontrados,))
        con.execute("DELETE FROM me_gusta WHERE reporte_id = ANY(%s)", (encontrados,))
        con.execute("DELETE FROM reportes WHERE id = ANY(%s)", (encontrados,))
        auth.auditar(con, quien["id"], "reportes.eliminar",
                     {"n": len(filas), "reportes": [{c: r[c] for c in ("id", "tipo", "origen", "estado")} for r in filas[:20]]})
    for r in filas:
        borrar_archivos(fotos_de(r))
    invalidar_estado()
    return {"ok": True, "eliminados": len(filas)}


# --------------------------------------------------------------------------- tablero del superadmin (dashboard.ver)

class Descarga:
    """Respuesta de archivo de una ruta del panel (en vez de JSON)."""
    def __init__(self, datos, tipo, nombre):
        self.datos, self.tipo, self.nombre = datos, tipo, nombre


MAX_MAPA = 3000


def panel_mapa():
    """Eventos activos para el mapa en vivo: reportes por revisar o verificados y vigentes, e incidentes del equipo."""
    t = ahora()
    with db() as con:
        filas = con.execute("SELECT * FROM reportes WHERE estado IN ('pendiente','validado') AND expira>%s "
                            "ORDER BY creado DESC LIMIT %s", (iso(t), MAX_MAPA)).fetchall()
        autores = autores_publicos(con, filas, anonimos=False)
    out = []
    for r in filas:
        d = reporte_publico(r, autores=autores)
        d.update(foto=bool(r["foto"]), n_fotos=len(fotos_de(r)), en_canton=bool(r["en_canton"]), revisado_en=r["revisado_en"])
        out.append(d)
    return {"generado": iso(t), "eventos": out}


PERIODOS_ANALISIS = (7, 30, 90, 365)
MAX_ANALISIS = 50000
DIAS_SEMANA = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")


def _periodo(q):
    try:
        dias = int(q.get("dias", ["30"])[0])
    except (TypeError, ValueError):
        dias = 30
    return dias if dias in PERIODOS_ANALISIS else 30


def _sin_atender(r, t):
    """Vecinos: nadie lo revisó. Equipo: sigue publicado (vigente) y nadie lo marcó resuelto."""
    if (r["origen"] or "vecino") == "equipo":
        return r["estado"] == "validado" and leer_iso(r["expira"]) > t
    # validado por vecinos: se publica, pero el analista todavía no lo revisó
    return r["estado"] == "pendiente" or (r["estado"] == "validado" and r.get("validado_por") == "vecinos")


def analisis_datos(dias):
    """Todo lo del análisis en un solo lugar (lo usan la pantalla y el Excel). Horas en hora de Ecuador."""
    t = ahora()
    desde = t - dt.timedelta(days=dias)
    with db() as con:
        filas = con.execute("SELECT id, creado, revisado_en, expira, tipo, estado, origen, gravedad, altura_agua, lat, lon, "
                            "recinto, via, descripcion, validado_por FROM reportes WHERE creado>%s ORDER BY creado DESC LIMIT %s",
                            (iso(desde), MAX_ANALISIS)).fetchall()
    por_estado, por_tipo, zonas = {}, {}, {}
    horas, semana = [0] * 24, [[0] * 24 for _ in range(7)]
    puntos, sin_atender, demoras = [], [], []
    equipo = 0
    for r in filas:
        c = leer_iso(r["creado"]).astimezone(TZ)
        horas[c.hour] += 1
        semana[c.weekday()][c.hour] += 1
        por_vecinos = r["estado"] == "validado" and r["validado_por"] == "vecinos"
        clave_estado = "validado_vecinos" if por_vecinos else r["estado"]
        por_estado[clave_estado] = por_estado.get(clave_estado, 0) + 1
        por_tipo[r["tipo"]] = por_tipo.get(r["tipo"], 0) + 1
        origen = r["origen"] or "vecino"
        equipo += origen == "equipo"
        puntos.append([round(r["lat"], 5), round(r["lon"], 5)])
        z = zonas.setdefault(r["recinto"] or "", {"recinto": r["recinto"], "n": 0, "sin_atender": 0, "lat": 0.0, "lon": 0.0})
        z["n"] += 1
        z["lat"] += r["lat"]
        z["lon"] += r["lon"]
        if origen == "vecino" and r["revisado_en"] and not por_vecinos:      # lo que validaron los vecinos no lo revisó nadie
            demoras.append((leer_iso(r["revisado_en"]) - leer_iso(r["creado"])).total_seconds() / 3600)
        if _sin_atender(r, t):
            z["sin_atender"] += 1
            sin_atender.append({
                "id": r["id"], "tipo": r["tipo"], "etiqueta": TIPOS.get(r["tipo"], ("", r["tipo"]))[1], "origen": origen,
                "estado": r["estado"], "creado": r["creado"], "recinto": r["recinto"], "lat": r["lat"], "lon": r["lon"],
                "descripcion": r["descripcion"] or "", "vencido": leer_iso(r["expira"]) <= t,
                "horas": round((t - leer_iso(r["creado"])).total_seconds() / 3600, 1)})
    for z in zonas.values():          # centro de la zona: promedio de sus reportes
        z["lat"], z["lon"] = round(z["lat"] / z["n"], 5), round(z["lon"] / z["n"], 5)
    sin_atender.sort(key=lambda x: -x["horas"])
    demoras.sort()
    pico = max(range(24), key=lambda h: horas[h]) if filas else None
    pico_dia = max(((d, h) for d in range(7) for h in range(24)), key=lambda x: semana[x[0]][x[1]]) if filas else None
    return {
        "periodo": {"dias": dias, "desde": iso(desde), "hasta": iso(t)},
        "total": len(filas), "equipo": equipo, "vecinos": len(filas) - equipo, "limitado": len(filas) >= MAX_ANALISIS,
        "por_estado": por_estado,
        "por_tipo": sorted(({"tipo": k, "etiqueta": TIPOS.get(k, ("", k))[1], "n": v} for k, v in por_tipo.items()),
                           key=lambda x: -x["n"]),
        "puntos": puntos,
        "zonas": sorted(zonas.values(), key=lambda z: (-z["n"], z["recinto"] or "")),
        "horas": horas, "semana": semana,
        "pico": {"hora": pico, "dia": pico_dia[0] if pico_dia else None, "hora_dia": pico_dia[1] if pico_dia else None},
        "sin_atender": sin_atender,
        "atencion": {"revisados": len(demoras),
                     "mediana_horas": round(demoras[len(demoras) // 2], 1) if demoras else None,
                     "promedio_horas": round(sum(demoras) / len(demoras), 1) if demoras else None},
        "_filas": filas,      # solo para el Excel (se quita antes de responder JSON)
    }


def panel_analisis(q):
    d = analisis_datos(_periodo(q))
    d.pop("_filas")
    return d


def _local(s):
    return leer_iso(s).astimezone(TZ).strftime("%Y-%m-%d %H:%M") if s else ""


def panel_analisis_xlsx(u, q):
    """Excel con el análisis del período: resumen, todos los reportes, zonas, horas pico y sin atender.
    No lleva el identificador del teléfono ni la IP de nadie. Cada exportación queda en la auditoría."""
    d = analisis_datos(_periodo(q))
    t = ahora()
    ESTADOS = {"pendiente": "por revisar", "validado": "verificado", "validado_vecinos": "confirmado por vecinos",
               "descartado": "descartado", "resuelto": "resuelto",
               "retirado": "retirado"}
    resumen = [["Dato", "Valor"],
               ["Período", f"últimos {d['periodo']['dias']} días"],
               ["Desde", _local(d["periodo"]["desde"])], ["Hasta", _local(d["periodo"]["hasta"])],
               ["Reportes e incidentes", d["total"]], ["De vecinos", d["vecinos"]], ["Del equipo", d["equipo"]],
               ["Sin atender", len(d["sin_atender"])],
               ["Hora pico", f"{d['pico']['hora']:02d}:00" if d["pico"]["hora"] is not None else ""],
               ["Mediana hasta revisar (horas)", d["atencion"]["mediana_horas"]],
               ["Promedio hasta revisar (horas)", d["atencion"]["promedio_horas"]]]
    resumen += [[f"Estado: {ESTADOS.get(k, k)}", v] for k, v in sorted(d["por_estado"].items())]
    resumen += [[f"Tipo: {x['etiqueta']}", x["n"]] for x in d["por_tipo"]]
    if d["limitado"]:
        resumen.append(["Aviso", f"Se exportaron los {MAX_ANALISIS} más recientes; el período tiene más."])
    reportes = [["Fecha y hora", "Día", "Hora", "Tipo", "Estado", "Origen", "Gravedad (1-3)", "Altura del agua (1-3)",
                 "Recinto cercano", "Calle o vía", "Latitud", "Longitud", "Descripción", "Revisado", "Horas hasta revisar",
                 "Sin atender"]]
    for r in d["_filas"]:
        c = leer_iso(r["creado"]).astimezone(TZ)
        vecinos = r["estado"] == "validado" and r["validado_por"] == "vecinos"
        demora = round((leer_iso(r["revisado_en"]) - leer_iso(r["creado"])).total_seconds() / 3600, 1) \
            if r["revisado_en"] and (r["origen"] or "vecino") == "vecino" and not vecinos else None
        reportes.append([c.strftime("%Y-%m-%d %H:%M"), DIAS_SEMANA[c.weekday()], c.hour,
                         TIPOS.get(r["tipo"], ("", r["tipo"]))[1], ESTADOS["validado_vecinos" if vecinos else r["estado"]]
                         if (vecinos or r["estado"] in ESTADOS) else r["estado"],
                         "equipo" if r["origen"] == "equipo" else "vecino", r["gravedad"], r["altura_agua"],
                         r["recinto"] or "", r["via"] or "", r["lat"], r["lon"], r["descripcion"] or "",
                         "" if vecinos else _local(r["revisado_en"]), demora, "sí" if _sin_atender(r, t) else "no"])
    zonas = [["Recinto cercano", "Reportes", "Sin atender", "Latitud (centro)", "Longitud (centro)"]]
    zonas += [[z["recinto"] or "(sin recinto cercano)", z["n"], z["sin_atender"], z["lat"], z["lon"]] for z in d["zonas"]]
    horas = [["Hora"] + [x.capitalize() for x in DIAS_SEMANA] + ["Total"]]
    horas += [[f"{h:02d}:00"] + [d["semana"][dia][h] for dia in range(7)] + [d["horas"][h]] for h in range(24)]
    pend = [["Desde", "Horas esperando", "Tipo", "Origen", "Qué falta", "Recinto cercano", "Latitud", "Longitud",
             "Descripción", "Ya no se ve en la app"]]
    pend += [[_local(x["creado"]), x["horas"], x["etiqueta"], x["origen"],
              "marcar resuelto" if x["origen"] == "equipo" else "revisar", x["recinto"] or "", x["lat"], x["lon"],
              x["descripcion"], "sí" if x["vencido"] else "no"] for x in d["sin_atender"]]
    datos = xlsx.libro([("Resumen", resumen), ("Reportes", reportes), ("Zonas", zonas), ("Horas pico", horas),
                        ("Sin atender", pend)])
    auth.auditar_suelto(u["id"], "analisis.exportar", {"dias": d["periodo"]["dias"], "filas": d["total"]})
    nombre = f"yaguachi-analisis-{d['periodo']['dias']}d-{t:%Y%m%d-%H%M}.xlsx"
    return Descarga(datos, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nombre)


def panel_revisar(rid, b):
    """Revisar un reporte de vecino. `gravedad` (1–3) lo tipifica: solo lo hace el equipo, y es obligatoria para
    verificar uno que llegó «por tipificar» (la calle inundada no: su gravedad es la altura del agua)."""
    estado = b.get("estado")
    if estado not in ("validado", "descartado", "resuelto", "pendiente"):
        raise ErrorApi(400, "estado inválido")
    grav = None
    if b.get("gravedad") is not None:
        grav = _entero_en(b.get("gravedad"), 1, 3, "reportes.gravedad", "la gravedad va de 1 a 3")
    with db_escritura() as con:
        r = con.execute("SELECT tipo, gravedad FROM reportes WHERE id=%s", (rid,)).fetchone()
        if not r:
            raise ErrorApi(404, "reporte no encontrado")
        if r["tipo"] == "calle_inundada":
            grav = None
        elif estado == "validado" and grav is None and r["gravedad"] == POR_TIPIFICAR:
            raise ErrorApi(400, "tipifica la gravedad antes de verificar", k="reportes.tipificar")
        # si el analista lo verifica, deja de ser «validado por vecinos» (sus fotos se publican y cuenta para el nivel)
        n = con.execute("UPDATE reportes SET estado=%s, nota_ugr=%s, revisado_en=%s, gravedad=COALESCE(%s, gravedad), "
                        "validado_por=CASE WHEN %s='validado' THEN 'analista' ELSE validado_por END WHERE id=%s",
                        (estado, (b.get("nota") or "").strip()[:300] or None, iso(ahora()), grav, estado, rid)).rowcount
        if n and estado == "descartado":           # un reporte descartado no guarda sus fotos
            quitar_fotos(con, rid)
    if not n:
        raise ErrorApi(404, "reporte no encontrado")
    invalidar_estado()
    return {"ok": True}


def panel_nivel(b):
    tipo, aid = b.get("ambito_tipo"), str(b.get("ambito_id") or "")
    if tipo not in ("canton", "rio", "parroquia", "recinto"):
        raise ErrorApi(400, "ámbito inválido")
    n = b.get("nivel_cod")
    if n is not None and int(n) not in NIVELES:
        raise ErrorApi(400, "nivel inválido")
    motivo = (b.get("motivo") or "").strip()[:300]
    if n is not None and not motivo:
        raise ErrorApi(400, "escribe el motivo del nivel (queda registrado)")
    with db_escritura() as con:
        con.execute("INSERT INTO niveles_oficiales (creado, ambito_tipo, ambito_id, nivel_cod, motivo) VALUES (%s,%s,%s,%s,%s)",
                    (iso(ahora()), tipo, aid, int(n) if n is not None else None, motivo or "nivel oficial retirado"))
    invalidar_estado()
    return {"ok": True}


def panel_aviso(b, quien=None):
    """Publica un aviso con reglas anti-saturación y encola su web push (sale en ≤ 30 s, o al terminar las horas
    de silencio si es de nivel 1–2)."""
    try:
        n = int(b.get("nivel_cod"))
        horas = max(1, min(int(b.get("horas", HORAS_AVISO)), 168))
    except (TypeError, ValueError):
        raise ErrorApi(400, "nivel u horas inválidos")
    if n not in NIVELES:
        raise ErrorApi(400, "nivel inválido")
    tipo, aid = b.get("ambito_tipo"), str(b.get("ambito_id") or "")
    if tipo not in ("canton", "rio", "parroquia", "recinto"):
        raise ErrorApi(400, "ámbito inválido")
    titulo = texto_con_sentido(b.get("titulo"), minimo=3, maximo=90)
    texto = texto_con_sentido(b.get("texto"), maximo=600)
    if not titulo or not texto:
        raise ErrorApi(400, "el aviso necesita título y texto", k="avisos.texto")
    flyer = _jpeg(b["flyer"]) if b.get("flyer") else None        # imagen tipo flyer (opcional, spec 021)
    t = ahora()
    nombre = {"canton": "Todo el cantón", "rio": aid, "parroquia": aid}.get(tipo)
    if tipo == "recinto":
        nombre = T.recintos.get(int(aid), {}).get("nombre", aid) if aid.isdigit() else aid
    # reglas y guardado bajo el mismo candado: dos clics seguidos no publican dos avisos
    with db_escritura() as con:
        previos = con.execute("SELECT * FROM avisos WHERE anulado=0 AND eliminado_en IS NULL AND ambito_tipo=%s AND ambito_id=%s AND creado>%s "
                              "ORDER BY creado DESC", (tipo, aid, iso(t - dt.timedelta(hours=24)))).fetchall()
        if n < 4 and not b.get("forzar"):
            if len(previos) >= CFG["avisos_max_24h_por_ambito"]:
                raise ErrorApi(409, f"ya hay {len(previos)} avisos en 24 h para este ámbito; edita uno o espera "
                                    "(solo RESPUESTA puede pasar este límite)")
            for a in previos:
                if a["texto"] == texto and leer_iso(a["creado"]) > t - dt.timedelta(hours=6):
                    raise ErrorApi(409, "ese mismo aviso ya se publicó hace menos de 6 h")
            if previos and previos[0]["nivel_cod"] == n and leer_iso(previos[0]["creado"]) > t - dt.timedelta(hours=3):
                raise ErrorApi(409, "ya hay un aviso del mismo nivel hace menos de 3 h; no repitas, actualízalo")
        nuevo = con.execute("INSERT INTO avisos (creado, nivel_cod, titulo, texto, ambito_tipo, ambito_id, ambito_nombre, "
                            "vigente_hasta, autor_id, flyer) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                            (iso(t), n, titulo, texto, tipo, aid, nombre, iso(t + dt.timedelta(hours=horas)),
                             quien["id"] if quien else None, guardar_flyer(flyer) if flyer else None)).fetchone()["id"]
        push.encolar(con, nuevo, n, CFG["horas_silencio"], t)
    return {"ok": True, "id": nuevo}


def panel_anular_aviso(aid):
    with db_escritura() as con:
        if not con.execute("UPDATE avisos SET anulado=1 WHERE id=%s AND eliminado_en IS NULL", (aid,)).rowcount:
            raise ErrorApi(404, "aviso no encontrado")
    return {"ok": True}


def panel_eliminar_aviso(u, aid):
    """Eliminación lógica (solo superadmin): deja de verse en la app y en el panel y su push pendiente no sale.
    La fila se queda con quién y cuándo lo eliminó; la ruta lo deja además en la auditoría."""
    with db_escritura() as con:
        if not con.execute("UPDATE avisos SET eliminado_en=%s, eliminado_por=%s WHERE id=%s AND eliminado_en IS NULL",
                           (iso(ahora()), u["id"], aid)).rowcount:
            raise ErrorApi(404, "aviso no encontrado", k="avisos.no_existe")
    return {"ok": True}


def panel_lectura(b):
    pid = b.get("punto_id")
    if pid not in T.puntos:
        raise ErrorApi(400, "punto de control desconocido")
    try:
        lect = float(str(b.get("lectura_m")).replace(",", "."))
    except (TypeError, ValueError):
        raise ErrorApi(400, "lectura inválida")
    tend = b.get("tendencia") if b.get("tendencia") in ("sube", "baja", "igual") else None
    hora = b.get("hora")
    t = leer_iso(hora).astimezone(TZ) if hora else ahora()
    with db_escritura() as con:
        con.execute("INSERT INTO lecturas (creado, punto_id, lectura_m, tendencia, lluvia, vigia) VALUES (%s,%s,%s,%s,%s,%s)",
                    (iso(t), pid, lect, tend, 1 if b.get("lluvia") else 0, (b.get("vigia") or "")[:60]))
    invalidar_estado()
    return {"ok": True}


def panel_regla(b):
    pid = b.get("punto_id")
    if pid not in T.puntos:
        raise ErrorApi(400, "punto de control desconocido")
    borde = b.get("borde_m")
    borde = None if borde in (None, "") else float(str(borde).replace(",", "."))
    with db_escritura() as con:
        con.execute("INSERT INTO reglas (punto_id, borde_m, nota) VALUES (%s,%s,%s) ON CONFLICT (punto_id) DO UPDATE "
                    "SET borde_m=excluded.borde_m, nota=excluded.nota", (pid, borde, (b.get("nota") or "")[:200]))
    invalidar_estado()
    return {"ok": True}


def panel_ajustes_get():
    with db() as con:
        reglas = {r["punto_id"]: dict(r) for r in con.execute("SELECT * FROM reglas")}
        lect = {}
        for r in con.execute("SELECT * FROM lecturas ORDER BY creado DESC LIMIT 200"):
            lect.setdefault(r["punto_id"], []).append(dict(r))
        hist = [dict(r) for r in con.execute("SELECT * FROM niveles_oficiales ORDER BY id DESC LIMIT 50")]
        avisos = [dict(r) for r in con.execute("SELECT * FROM avisos WHERE eliminado_en IS NULL ORDER BY id DESC LIMIT 50")]
        vistos = alcance(con, "aviso", [a["id"] for a in avisos])
        llegaron = enviados_push(con, [a["id"] for a in avisos])
    for a in avisos:            # alcance: cuántos teléfonos lo abrieron, sin decir cuáles (spec 021)
        a["alcance"] = dict(vistos.get(str(a["id"]), {"vistas": 0, "push": 0}), enviados=llegaron.get(a["id"]))
        a["flyer"] = url_flyer(a)
    return {"advertencia": ajuste("advertencia"), "aguaje": ajuste("aguaje"), "reglas": reglas,
            "lecturas": {k: v[:12] for k, v in lect.items()}, "puntos": T.puntos, "historial_niveles": hist,
            "avisos": avisos, "parroquias": sorted({p["parroquia"] for p in T.recintos.values() if p["parroquia"]}),
            "recintos": sorted(({"id": k, "nombre": v["nombre"], "parroquia": v["parroquia"]} for k, v in T.recintos.items()),
                               key=lambda x: x["nombre"] or "")}


def panel_ajustes_post(b):
    # las fechas se validan aquí: una fecha mal escrita guardada rompería /api/estado para todo el cantón
    if "advertencia" in b:
        a = b["advertencia"] or {}
        hasta = a.get("hasta") or None
        if hasta:
            try:
                hasta = iso(leer_iso(str(hasta)))
            except ValueError:
                raise ErrorApi(400, "fecha de la advertencia inválida")
        fijar_ajuste("advertencia", {"vigente": bool(a.get("vigente")), "texto": str(a.get("texto") or "")[:200],
                                     "hasta": hasta})
    if "aguaje" in b:
        a = b["aguaje"] or {}
        hasta = a.get("hasta") or None
        if hasta:
            try:
                hasta = dt.date.fromisoformat(str(hasta)[:10]).isoformat()
            except ValueError:
                raise ErrorApi(400, "fecha del aguaje inválida")
        fijar_ajuste("aguaje", {"hasta": hasta, "nota": str(a.get("nota") or "")[:200]})
    invalidar_estado()
    return {"ok": True}

# --------------------------------------------------------------------------- incidentes del equipo (spec 014 §5)

# Los incidentes son reportes con origen 'equipo': entran ya verificados y cuentan para el nivel estimado igual
# que un reporte validado por el analista. `dispositivo` es NOT NULL; «equipo» no pasa validar_dispositivo, así
# que ningún teléfono puede hacerse pasar por él.
DISP_EQUIPO = "equipo"
MAX_INCIDENTES_HORA_USUARIO = 60


def _entero_en(v, minimo, maximo, k, mensaje):
    if isinstance(v, bool):
        raise ErrorApi(400, mensaje, k=k)
    try:
        n = int(v)
    except (TypeError, ValueError):
        raise ErrorApi(400, mensaje, k=k)
    if not (minimo <= n <= maximo) or (isinstance(v, float) and v != n):
        raise ErrorApi(400, mensaje, k=k)
    return n


def _descripcion_incidente(v):
    d = texto_con_sentido(v)
    if d is None or len(v.strip()) > 500:
        raise ErrorApi(400, "la descripción debe tener de 5 a 500 caracteres", k="incidentes.descripcion")
    return d


def crear_incidente(b, quien):
    tipo = b.get("tipo")
    if tipo not in TIPOS:
        raise ErrorApi(400, "tipo de incidente desconocido", k="incidentes.tipo")
    grav = _entero_en(b.get("gravedad"), 1, 3, "incidentes.gravedad", "la gravedad va de 1 a 3")
    horas = TIPOS[tipo][2] if b.get("horas") in (None, "") else \
        _entero_en(b.get("horas"), 1, 168, "incidentes.horas", "las horas de vigencia van de 1 a 168")
    desc = _descripcion_incidente(b.get("descripcion"))
    try:
        lat, lon = float(b["lat"]), float(b["lon"])
    except (KeyError, TypeError, ValueError):
        raise ErrorApi(400, "falta la ubicación", k="incidentes.ubicacion")
    if not (math.isfinite(lat) and math.isfinite(lon)) or not T.en_canton(lon, lat):
        raise ErrorApi(400, "la ubicación está fuera del cantón Yaguachi", k="incidentes.fuera")
    altura = None
    if b.get("altura_agua") not in (None, ""):
        altura = _entero_en(b.get("altura_agua"), 1, 3, "incidentes.altura", "altura del agua inválida")
    via = b.get("via")
    via = via.strip()[:120] or None if isinstance(via, str) else None
    x0, y0, x1, y1 = T.bbox
    tramo = validar_tramo(b.get("tramo"), x0, y0, x1, y1)
    crudo = validar_foto(b)
    t = ahora()
    rid_cerca, d_cerca = T.recinto_cercano(lon, lat)
    rec = T.recintos[rid_cerca]["nombre"] if d_cerca <= 3000 else None
    iid = uuid.uuid4().hex[:12]
    validado = usuarios.publica_validado(quien)
    with db_escritura() as con:
        n = con.execute("SELECT COUNT(*) AS n FROM reportes WHERE origen='equipo' AND autor_id=%s AND creado>%s",
                        (quien["id"], iso(t - dt.timedelta(hours=1)))).fetchone()["n"]
        if n >= MAX_INCIDENTES_HORA_USUARIO:
            raise ErrorApi(429, "publicaste muchos incidentes en la última hora; espera un momento", k="incidentes.limite")
        # el mismo incidente dos veces (doble toque, o el reenvío de uno guardado sin señal que ya había llegado):
        # mismo autor y tipo a menos de 150 m en 30 min. Uno retirado no cuenta: se puede volver a publicar corregido
        for r in con.execute("SELECT lat, lon FROM reportes WHERE origen='equipo' AND autor_id=%s AND tipo=%s AND creado>%s "
                             "AND estado<>'retirado'", (quien["id"], tipo, iso(t - dt.timedelta(minutes=30)))).fetchall():
            if dist_m(lon, lat, r["lon"], r["lat"]) < 150:
                raise ErrorApi(409, "ya publicaste lo mismo aquí hace poco", k="incidentes.duplicado")
        foto = guardar_foto(crudo) if crudo else None
        # validado al publicar, salvo el operador cuando el superadmin apagó «operador_valida_directo»
        estado = "validado" if validado else "pendiente"
        con.execute("INSERT INTO reportes (id, creado, dispositivo, ip, tipo, gravedad, descripcion, lat, lon, recinto_id, "
                    "recinto, en_canton, foto, estado, revisado_en, expira, altura_agua, via, tramo, origen, autor_id) "
                    "VALUES (%s,%s,%s,NULL,%s,%s,%s,%s,%s,%s,%s,1,%s,%s,%s,%s,%s,%s,%s,'equipo',%s)",
                    (iid, iso(t), DISP_EQUIPO, tipo, grav, desc, lat, lon, rid_cerca if rec else None, rec, foto, estado,
                     iso(t) if validado else None, iso(t + dt.timedelta(hours=horas)), altura, via, tramo, quien["id"]))
        auth.auditar(con, quien["id"], "incidente.crear", {"id": iid, "tipo": tipo, "gravedad": grav, "estado": estado})
    invalidar_estado()
    return {"id": iid, "estado": estado}


PAGINA_INCIDENTES = 30


def listar_incidentes(quien, q=None):
    """El operador ve solo los suyos; quien puede gestionar, todos (incluidos los resueltos y retirados).
    Por páginas, del más nuevo al más viejo: `?antes=<creado>&antes_id=<id>` (del último ya mostrado) trae la
    siguiente tanda; `mas` dice si quedan. `n`: cuántos por página (hasta 100)."""
    q = q or {}
    todos = "incidentes.gestionar" in quien["permisos"]
    try:
        n = max(1, min(100, int(q.get("n", [PAGINA_INCIDENTES])[0])))
    except ValueError:
        n = PAGINA_INCIDENTES
    donde, args = ["origen='equipo'"], []
    if not todos:
        donde.append("autor_id=%s")
        args.append(quien["id"])
    antes, antes_id = q.get("antes", [""])[0], q.get("antes_id", [""])[0]
    if antes:
        if not re.fullmatch(r"[0-9a-f]{12}", antes_id or "") or len(antes) > 40:
            raise ErrorApi(400, "página inválida")
        donde.append("(creado, id) < (%s, %s)")
        args += [antes, antes_id]
    with db() as con:
        filas = con.execute(f"SELECT * FROM reportes WHERE {' AND '.join(donde)} ORDER BY creado DESC, id DESC LIMIT %s",
                            (*args, n + 1)).fetchall()
        mas = len(filas) > n
        filas = filas[:n]
        autores = autores_publicos(con, filas, anonimos=False)
        vistos = alcance(con, "incidente", [r["id"] for r in filas])
    out = []
    for r in filas:
        d = reporte_publico(r, autores=autores)
        d.update(foto=bool(r["foto"]), n_fotos=len(fotos_de(r)), revisado_en=r["revisado_en"],
                 alcance=vistos.get(r["id"], {"vistas": 0, "push": 0}),
                 editable=todos or (r["autor_id"] == quien["id"] and "incidentes.crear" in quien["permisos"]))
        out.append(d)
    return {"incidentes": out, "mas": mas}


def editar_incidente(iid, b, quien):
    cambios = {}
    if "descripcion" in b:
        cambios["descripcion"] = _descripcion_incidente(b["descripcion"])
    if "gravedad" in b:
        cambios["gravedad"] = _entero_en(b["gravedad"], 1, 3, "incidentes.gravedad", "la gravedad va de 1 a 3")
    if "estado" in b:
        if b["estado"] not in ("resuelto", "retirado"):
            raise ErrorApi(400, "estado inválido (resuelto o retirado)", k="incidentes.estado")
        cambios["estado"] = b["estado"]
    with db_escritura() as con:
        r = con.execute("SELECT autor_id FROM reportes WHERE id=%s AND origen='equipo'", (iid,)).fetchone()
        if not r:
            raise ErrorApi(404, "incidente no encontrado", k="incidentes.no_existe")
        propio = r["autor_id"] == quien["id"] and "incidentes.crear" in quien["permisos"]
        if not (propio or "incidentes.gestionar" in quien["permisos"]):
            raise ErrorApi(403, "no tienes permiso para esta acción", k="auth.permiso")
        if cambios:
            if "estado" in cambios:
                cambios["revisado_en"] = iso(ahora())
            con.execute(f"UPDATE reportes SET {', '.join(c + '=%s' for c in cambios)} WHERE id=%s", (*cambios.values(), iid))
            auth.auditar(con, quien["id"], "incidente.editar", {"id": iid, **{c: v for c, v in cambios.items()
                                                                              if c != "descripcion"}})
    invalidar_estado()
    return {"ok": True}


def eliminar_incidente(iid, quien):
    """Solo superadmin (incidentes.eliminar). A diferencia de los avisos, el borrado es DEFINITIVO: el texto de un
    incidente puede ser ofensivo o tener datos personales (LOPDP). Se borran la fila, sus confirmaciones y «me gusta»
    y la foto. En la auditoría queda quién, cuándo y qué era (tipo, vía, fecha y autor), pero no la descripción."""
    with db_escritura() as con:
        r = con.execute("SELECT id, tipo, via, recinto, creado, estado, autor_id, foto, fotos_extra FROM reportes "
                        "WHERE id=%s AND origen='equipo'", (iid,)).fetchone()
        if not r:
            raise ErrorApi(404, "incidente no encontrado", k="incidentes.no_existe")
        con.execute("DELETE FROM confirmaciones WHERE reporte_id=%s", (iid,))
        con.execute("DELETE FROM me_gusta WHERE reporte_id=%s", (iid,))
        con.execute("DELETE FROM reportes WHERE id=%s", (iid,))
        auth.auditar(con, quien["id"], "incidente.eliminar",
                     {c: r[c] for c in ("id", "tipo", "via", "recinto", "creado", "estado", "autor_id")})
    borrar_archivos(fotos_de(r))
    invalidar_estado()
    return {"ok": True}


def reactivar_incidente(iid, quien):
    """Solo superadmin (incidentes.reactivar): vuelve a presentar un incidente RETIRADO. Conserva la fecha de
    publicación (`creado`); si ya venció, vuelve a vencer según su tipo, contado desde ahora."""
    t = ahora()
    with db_escritura() as con:
        r = con.execute("SELECT tipo, estado, expira FROM reportes WHERE id=%s AND origen='equipo'", (iid,)).fetchone()
        if not r:
            raise ErrorApi(404, "incidente no encontrado", k="incidentes.no_existe")
        if r["estado"] != "retirado":
            raise ErrorApi(400, "solo se puede volver a presentar un incidente retirado", k="incidentes.no_retirado")
        expira = r["expira"]
        if leer_iso(expira) <= t:
            expira = iso(t + dt.timedelta(hours=TIPOS[r["tipo"]][2] if r["tipo"] in TIPOS else 24))
        con.execute("UPDATE reportes SET estado='validado', revisado_en=%s, expira=%s WHERE id=%s", (iso(t), expira, iid))
        auth.auditar(con, quien["id"], "incidente.reactivar", {"id": iid, "expira": expira})
    invalidar_estado()
    return {"ok": True, "expira": expira}

# --------------------------------------------------------------------------- albergues

MAX_ALBERGUES = 200


def _albergue_publico(r):
    return {"id": r["id"], "nombre": r["nombre"], "descripcion": r["descripcion"], "lat": r["lat"], "lon": r["lon"],
            "fotos": len(_lista_json(r["fotos"])), "actualizado": r["actualizado"]}


def listar_albergues():
    """Albergues vigentes (no eliminados), para la app y el panel."""
    with db() as con:
        filas = con.execute("SELECT * FROM albergues WHERE eliminado_en IS NULL ORDER BY nombre LIMIT %s",
                            (MAX_ALBERGUES,)).fetchall()
    return {"albergues": [_albergue_publico(r) for r in filas]}


def _datos_albergue(b, parcial=False):
    """Valida nombre (3–80), descripción corta (hasta 280) y ubicación dentro del cantón."""
    d = {}
    if not parcial or "nombre" in b:
        nombre = texto_con_sentido(b.get("nombre"), minimo=3, maximo=80)
        if nombre is None or len(b["nombre"].strip()) > 80:
            raise ErrorApi(400, "el título debe tener de 3 a 80 caracteres", k="albergues.nombre")
        d["nombre"] = nombre
    if not parcial or "descripcion" in b:
        desc = b.get("descripcion")
        desc = desc.strip() if isinstance(desc, str) else ""
        if len(desc) > 280:
            raise ErrorApi(400, "la descripción corta llega hasta 280 caracteres", k="albergues.descripcion")
        d["descripcion"] = desc or None
    if not parcial or "lat" in b or "lon" in b:
        try:
            lat, lon = float(b["lat"]), float(b["lon"])
        except (KeyError, TypeError, ValueError):
            raise ErrorApi(400, "falta la ubicación", k="albergues.ubicacion")
        if not (math.isfinite(lat) and math.isfinite(lon)) or not T.en_canton(lon, lat):
            raise ErrorApi(400, "la ubicación está fuera del cantón Yaguachi", k="albergues.fuera")
        d["lat"], d["lon"] = round(lat, 6), round(lon, 6)
    return d


def _fotos_albergue(b, actuales):
    """`fotos`: lista ordenada (hasta 3) donde cada elemento es una foto nueva (data URL JPEG) o el número
    (1, 2 o 3) de una foto que ya tiene el albergue. Devuelve (lista final con None en las nuevas, bytes nuevos)."""
    fotos = b.get("fotos", [])
    if not isinstance(fotos, list) or len(fotos) > MAX_FOTOS:
        raise ErrorApi(400, f"puedes subir hasta {MAX_FOTOS} fotos", k="foto.demasiadas")
    final, nuevas, usadas = [], [], set()
    for f in fotos:
        if isinstance(f, int) and not isinstance(f, bool) and 1 <= f <= len(actuales) and f not in usadas:
            usadas.add(f)
            final.append(actuales[f - 1])
        elif isinstance(f, str):
            nuevas.append(_jpeg(f))
            final.append(None)
        else:
            raise ErrorApi(400, "fotos inválidas", k="foto.invalida")
    return final, nuevas


def crear_albergue(b, quien):
    d = _datos_albergue(b)
    final, nuevas = _fotos_albergue(b, [])
    aid, t = uuid.uuid4().hex[:12], iso(ahora())
    with db_escritura() as con:
        if con.execute("SELECT COUNT(*) AS n FROM albergues WHERE eliminado_en IS NULL").fetchone()["n"] >= MAX_ALBERGUES:
            raise ErrorApi(400, f"hay {MAX_ALBERGUES} albergues; elimina alguno antes de agregar otro", k="albergues.tope")
        fotos = guardar_fotos(nuevas)
        try:
            con.execute("INSERT INTO albergues (id, nombre, descripcion, lat, lon, fotos, creado, autor_id, actualizado, "
                        "actualizado_por) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                        (aid, d["nombre"], d["descripcion"], d["lat"], d["lon"], json.dumps(fotos), t, quien["id"], t, quien["id"]))
            auth.auditar(con, quien["id"], "albergue.crear", {"id": aid, "nombre": d["nombre"], "fotos": len(fotos)})
        except BaseException:
            borrar_archivos(fotos)
            raise
    return {"id": aid}


def editar_albergue(aid, b, quien):
    d = _datos_albergue(b, parcial=True)
    sobran = []
    with db_escritura() as con:
        r = con.execute("SELECT * FROM albergues WHERE id=%s AND eliminado_en IS NULL", (aid,)).fetchone()
        if not r:
            raise ErrorApi(404, "albergue no encontrado", k="albergues.no_existe")
        actuales = _lista_json(r["fotos"])
        if "fotos" in b:
            final, nuevas = _fotos_albergue(b, actuales)
            escritas = guardar_fotos(nuevas)
            it = iter(escritas)
            d["fotos"] = json.dumps([n if n is not None else next(it) for n in final])
            sobran = [n for n in actuales if n not in final]
        else:
            escritas = []
        d["actualizado"], d["actualizado_por"] = iso(ahora()), quien["id"]
        try:
            cols = ", ".join(f"{k}=%s" for k in d)
            con.execute(f"UPDATE albergues SET {cols} WHERE id=%s", (*d.values(), aid))
            auth.auditar(con, quien["id"], "albergue.editar",
                         {"id": aid, "campos": sorted(k for k in d if k not in ("actualizado", "actualizado_por"))})
        except BaseException:
            borrar_archivos(escritas)
            raise
    borrar_archivos(sobran)                 # las fotos quitadas no se guardan
    return {"ok": True}


def eliminar_albergue(aid, quien):
    """Eliminación lógica: deja de verse en la app y en el panel; la fila queda para la auditoría.
    Las fotos sí se borran (no hacen falta para nada más)."""
    with db_escritura() as con:
        r = con.execute("SELECT nombre, fotos FROM albergues WHERE id=%s AND eliminado_en IS NULL", (aid,)).fetchone()
        if not r:
            raise ErrorApi(404, "albergue no encontrado", k="albergues.no_existe")
        con.execute("UPDATE albergues SET eliminado_en=%s, eliminado_por=%s, fotos='[]' WHERE id=%s",
                    (iso(ahora()), quien["id"], aid))
        auth.auditar(con, quien["id"], "albergue.eliminar", {"id": aid, "nombre": r["nombre"]})
    borrar_archivos(_lista_json(r["fotos"]))
    return {"ok": True}


def foto_albergue(aid, n):
    with db() as con:
        r = con.execute("SELECT fotos FROM albergues WHERE id=%s AND eliminado_en IS NULL", (aid,)).fetchone()
    fotos = _lista_json(r["fotos"]) if r else []
    if not 1 <= n <= len(fotos):
        raise ErrorApi(404, "foto no disponible")
    return os.path.join(FOTOS, fotos[n - 1])


# Ruta hasta un albergue: la API la pide a OSRM de OpenStreetMap Alemania (FOSSGIS, sin clave), el mismo servidor
# del tablero del panel. Así el teléfono no habla con terceros (ni su IP ni su ubicación exacta salen de aquí:
# el punto de partida va redondeado a ~10 m) y el destino solo puede ser un albergue (no es un proxy abierto).
URL_RUTAS = os.environ.get("YAGUACHI_RUTAS") or "https://routing.openstreetmap.de"
_rutas_lock = threading.Lock()
_rutas_cache = {}           # clave -> (epoch, respuesta)
_rutas_ip = {}              # ip -> [epochs]
RUTAS_POR_IP = 30           # cada 10 minutos


def _pedir_ruta(modo, lat, lon, alat, alon):
    srv = "routed-car" if modo == "auto" else "routed-foot"
    url = (f"{URL_RUTAS}/{srv}/route/v1/driving/{lon:.4f},{lat:.4f};{alon:.6f},{alat:.6f}"
           "?overview=full&geometries=geojson")
    return _get_json(url, timeout=12)


def ruta_a_albergue(q, ip):
    modo = q.get("modo", ["pie"])[0]
    if modo not in ("pie", "auto"):
        raise ErrorApi(400, "modo inválido")
    try:
        lat, lon = round(float(q["lat"][0]), 4), round(float(q["lon"][0]), 4)
    except (KeyError, ValueError):
        raise ErrorApi(400, "faltan lat y lon")
    x0, y0, x1, y1 = T.bbox
    if not (math.isfinite(lat) and math.isfinite(lon) and x0 - 0.2 <= lon <= x1 + 0.2 and y0 - 0.2 <= lat <= y1 + 0.2):
        raise ErrorApi(400, "estás lejos del cantón Yaguachi", k="ruta.lejos")
    aid = q.get("albergue", [""])[0]
    if not re.fullmatch(r"[0-9a-f]{12}", aid):
        raise ErrorApi(404, "albergue no encontrado", k="albergues.no_existe")
    with db() as con:
        a = con.execute("SELECT lat, lon FROM albergues WHERE id=%s AND eliminado_en IS NULL", (aid,)).fetchone()
    if not a:
        raise ErrorApi(404, "albergue no encontrado", k="albergues.no_existe")
    clave, ahora_s = (modo, lat, lon, aid, a["lat"], a["lon"]), time.time()
    with _rutas_lock:
        hit = _rutas_cache.get(clave)
        if hit and ahora_s - hit[0] < 3600:
            return hit[1]
        veces = [x for x in _rutas_ip.get(ip, []) if ahora_s - x < 600]
        if len(veces) >= RUTAS_POR_IP:
            raise ErrorApi(429, "pediste muchas rutas seguidas; espera unos minutos", k="ruta.limite")
        _rutas_ip[ip] = veces + [ahora_s]
        if len(_rutas_ip) > 5000:
            _rutas_ip.clear()
    if OFFLINE:
        raise ErrorApi(503, "no se pudo calcular la ruta ahora", k="ruta.no_disponible")
    try:
        j = _pedir_ruta(modo, lat, lon, a["lat"], a["lon"])
    except Exception as e:                                  # sin internet, servidor caído o lento
        print("  [aviso] ruta:", repr(e))
        raise ErrorApi(502, "no se pudo calcular la ruta ahora", k="ruta.no_disponible")
    r = (j.get("routes") or [None])[0] if isinstance(j, dict) and j.get("code") == "Ok" else None
    coords = (r or {}).get("geometry", {}).get("coordinates") or []
    if not r or len(coords) < 2:
        raise ErrorApi(404, "no encontramos un camino por las calles hasta ese albergue", k="ruta.sin_camino")
    res = {"modo": modo, "linea": [[round(c[1], 5), round(c[0], 5)] for c in coords[:4000]],
           "metros": round(r.get("distance") or 0), "segundos": round(r.get("duration") or 0)}
    with _rutas_lock:
        if len(_rutas_cache) > 2000:
            _rutas_cache.clear()
        _rutas_cache[clave] = (ahora_s, res)
    return res

# --------------------------------------------------------------------------- HTTP


TIPOS_MIME = {".geojson": "application/geo+json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
              ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json"}


def _detalle_auditoria(m, b, res):
    """Lo justo para saber qué se hizo, sin textos largos ni fotos."""
    d = {k: b[k] for k in ("estado", "ambito_tipo", "ambito_id", "nivel_cod", "punto_id") if k in b}
    if len(m.groups()) > 1:
        d["id"] = "/".join(m.groups())        # p. ej. «aviso/12» (detalle del alcance)
    elif m.groups():
        d["id"] = m.group(1)
    elif isinstance(res, dict) and "id" in res:
        d["id"] = res["id"]
    return d


# Rutas del panel: (método, patrón, permiso, función(usuario, match, query, cuerpo), código, acción para auditoría).
# Las acciones None se auditan dentro de su función (usuarios, configuración, incidentes).
RUTAS_PANEL = [
    ("GET", r"/api/panel/estado", "panel.ver",
     lambda u, m, q, b: calcular_estado(forzar=q.get("forzar", ["0"])[0] == "1"), 200, None),
    ("GET", r"/api/panel/reportes", "panel.ver", lambda u, m, q, b: panel_reportes(q), 200, None),
    ("GET", r"/api/panel/ajustes", "panel.ver", lambda u, m, q, b: panel_ajustes_get(), 200, None),
    ("GET", r"/api/panel/incidentes", "panel.ver", lambda u, m, q, b: listar_incidentes(u, q), 200, None),
    ("GET", r"/api/panel/mapa", "dashboard.ver", lambda u, m, q, b: panel_mapa(), 200, None),
    ("GET", r"/api/panel/analisis", "dashboard.ver", lambda u, m, q, b: panel_analisis(q), 200, None),
    ("GET", r"/api/panel/analisis\.xlsx", "dashboard.ver", lambda u, m, q, b: panel_analisis_xlsx(u, q), 200, None),
    ("GET", r"/api/panel/albergues", "albergues.gestionar", lambda u, m, q, b: listar_albergues(), 200, None),
    ("GET", r"/api/panel/usuarios", "usuarios.gestionar", lambda u, m, q, b: usuarios.listar(), 200, None),
    # spec 021: qué teléfonos (por código, sin nombre) tienen notificaciones y cuáles abrieron algo; solo superadmin
    # y cada consulta queda en la auditoría
    ("GET", r"/api/panel/dispositivos", "alcance.detalle", lambda u, m, q, b: panel_dispositivos(q), 200, "alcance.dispositivos"),
    ("GET", r"/api/panel/alcance/(aviso|incidente)/([0-9a-f]{12}|\d{1,9})", "alcance.detalle",
     lambda u, m, q, b: panel_alcance_detalle(m.group(1), m.group(2)), 200, "alcance.detalle"),
    ("GET", r"/api/panel/config", "config.editar", lambda u, m, q, b: usuarios.config_get(), 200, None),
    # uno o varios a la vez; la auditoría la escribe la función (con cuántos y hasta cuándo)
    ("POST", r"/api/panel/reportes/vigencia", "reportes.vigencia", lambda u, m, q, b: panel_vigencia(b, u), 200, None),
    ("POST", r"/api/panel/reportes/eliminar", "reportes.eliminar",
     lambda u, m, q, b: panel_eliminar_reportes(b, u), 200, None),
    ("POST", r"/api/panel/reportes/([0-9a-f]{12})", "reportes.revisar",
     lambda u, m, q, b: panel_revisar(m.group(1), b), 200, "reporte.revisar"),
    ("POST", r"/api/panel/avisos/(\d+)/anular", "avisos.publicar",
     lambda u, m, q, b: panel_anular_aviso(int(m.group(1))), 200, "aviso.anular"),
    ("POST", r"/api/panel/avisos/(\d+)/eliminar", "avisos.eliminar",
     lambda u, m, q, b: panel_eliminar_aviso(u, int(m.group(1))), 200, "aviso.eliminar"),
    ("POST", r"/api/panel/nivel", "niveles.fijar", lambda u, m, q, b: panel_nivel(b), 200, "nivel.fijar"),
    ("POST", r"/api/panel/aviso", "avisos.publicar", lambda u, m, q, b: panel_aviso(b, u), 200, "aviso.publicar"),
    ("POST", r"/api/panel/lectura", "reglas.editar", lambda u, m, q, b: panel_lectura(b), 200, "lectura.agregar"),
    ("POST", r"/api/panel/regla", "reglas.editar", lambda u, m, q, b: panel_regla(b), 200, "regla.editar"),
    ("POST", r"/api/panel/ajustes", "ajustes.editar", lambda u, m, q, b: panel_ajustes_post(b), 200, "ajustes.editar"),
    ("POST", r"/api/panel/incidentes", "incidentes.crear", lambda u, m, q, b: crear_incidente(b, u), 201, None),
    # autor o incidentes.gestionar: se decide dentro (hace falta saber de quién es el incidente)
    ("POST", r"/api/panel/incidentes/([0-9a-f]{12})", "panel.ver",
     lambda u, m, q, b: editar_incidente(m.group(1), b, u), 200, None),
    # solo superadmin; la auditoría la escribe cada función (con el detalle del incidente)
    ("POST", r"/api/panel/incidentes/([0-9a-f]{12})/eliminar", "incidentes.eliminar",
     lambda u, m, q, b: eliminar_incidente(m.group(1), u), 200, None),
    ("POST", r"/api/panel/incidentes/([0-9a-f]{12})/reactivar", "incidentes.reactivar",
     lambda u, m, q, b: reactivar_incidente(m.group(1), u), 200, None),
    # albergues: la auditoría la escribe cada función
    ("POST", r"/api/panel/albergues", "albergues.gestionar", lambda u, m, q, b: crear_albergue(b, u), 201, None),
    ("POST", r"/api/panel/albergues/([0-9a-f]{12})", "albergues.gestionar",
     lambda u, m, q, b: editar_albergue(m.group(1), b, u), 200, None),
    ("POST", r"/api/panel/albergues/([0-9a-f]{12})/eliminar", "albergues.gestionar",
     lambda u, m, q, b: eliminar_albergue(m.group(1), u), 200, None),
    ("POST", r"/api/panel/usuarios", "usuarios.gestionar", lambda u, m, q, b: usuarios.crear(b, u), 201, None),
    ("POST", r"/api/panel/usuarios/(\d+)", "usuarios.gestionar",
     lambda u, m, q, b: usuarios.editar(int(m.group(1)), b, u), 200, None),
    ("POST", r"/api/panel/usuarios/(\d+)/clave", "usuarios.gestionar",
     lambda u, m, q, b: usuarios.restablecer(int(m.group(1)), u), 200, None),
    ("POST", r"/api/panel/config", "config.editar", lambda u, m, q, b: usuarios.config_post(b, u), 200, None),
]

# Cabeceras de seguridad para todo lo que responde la API (las páginas las pone nginx; aquí cubren JSON, fotos, /r/ y el modo sin Docker)
CABECERAS_SEG = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
    "Content-Security-Policy": (
        "default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; "
        "img-src 'self' data: blob: https://tile.openstreetmap.org https://server.arcgisonline.com https://unpkg.com; "
        "connect-src 'self' https://tile.openstreetmap.org https://server.arcgisonline.com https://unpkg.com; "
        "font-src 'self' data:; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; "
        "form-action 'self'; frame-ancestors 'none'"),
}


class Manejador(BaseHTTPRequestHandler):
    server_version = "YaguachiWeather"
    sys_version = ""          # no anunciar la versión de Python
    timeout = 20              # una conexión que no envía nada se cierra (evita ocupar hilos sin fin)

    def end_headers(self):
        for k, v in CABECERAS_SEG.items():
            self.send_header(k, v)
        super().end_headers()

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            linea = re.sub(r"\?[^ ]*", "", str(args[0]))       # sin ?dispositivo=… ni coordenadas
            sys.stderr.write(f"{ahora():%H:%M:%S} {linea} {' '.join(str(a) for a in args[1:])}\n")

    # -- utilidades
    def _json(self, codigo, datos, cookie=None):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        for c in ([cookie] if isinstance(cookie, str) else cookie or []):
            self.send_header("Set-Cookie", c)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def _descarga(self, d):
        nombre = re.sub(r"[^A-Za-z0-9._-]", "_", d.nombre)
        self.send_response(200)
        self.send_header("Content-Type", d.tipo)
        self.send_header("Content-Disposition", f'attachment; filename="{nombre}"')
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(d.datos)))
        self.end_headers()
        self.wfile.write(d.datos)

    def _archivo(self, ruta, cache="no-cache"):
        if not os.path.isfile(ruta):
            return self._json(404, {"error": "no encontrado"})
        ext = os.path.splitext(ruta)[1].lower()
        tipo = TIPOS_MIME.get(ext) or mimetypes.guess_type(ruta)[0] or "application/octet-stream"
        with open(ruta, "rb") as fh:
            datos = fh.read()
        self.send_response(200)
        self.send_header("Content-Type", tipo + ("; charset=utf-8" if tipo.startswith(("text/", "application/j", "application/geo")) else ""))
        self.send_header("Content-Length", str(len(datos)))
        self.send_header("Cache-Control", cache)
        self.end_headers()
        self.wfile.write(datos)

    def _binario(self, datos, tipo, cache):
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(datos)))
        self.send_header("Cache-Control", cache)
        self.end_headers()
        self.wfile.write(datos)

    def _cuerpo(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            raise ErrorApi(400, "Content-Length inválido")
        if n < 0 or n > 7 * 1024 * 1024:        # hasta 3 fotos (la app las reduce a ~300 KB cada una)
            raise ErrorApi(413, "envío demasiado grande")
        try:
            return json.loads(self.rfile.read(n).decode("utf-8") or "{}")
        except json.JSONDecodeError:
            raise ErrorApi(400, "JSON inválido")

    # -- sesión del panel (cookie yw_sesion) y anti-CSRF
    def _leer_cookie(self, nombre):
        c = http.cookies.SimpleCookie()
        try:
            c.load(self.headers.get("Cookie") or "")
        except http.cookies.CookieError:
            return None
        m = c.get(nombre)
        return m.value if m else None

    def _token(self):
        # con https solo vale la cookie __Host- (una «yw_sesion» plantada desde otro subdominio no sirve)
        return self._leer_cookie(auth.nombre_cookie(self._segura()))

    # -- sesión ciudadana (cookie yw_ciudadano, spec 018): aparte de la del panel
    def _token_ciudadano(self):
        return self._leer_cookie(cuentas.nombre_cookie(self._segura()))

    def _cookie_ciudadano(self, token):
        return cuentas.cookie_sesion(token, self._segura())

    def _exigir_ciudadano(self, k="cuenta.sesion", mensaje="inicia sesión"):
        c = cuentas.ciudadano_de_sesion(self._token_ciudadano())
        if not c:
            raise ErrorApi(401, mensaje, k=k)
        return c

    def _cuenta_get(self, ruta):
        self._exigir_csrf()
        if ruta == "/api/cuenta/yo":
            c = cuentas.ciudadano_de_sesion(self._token_ciudadano())
            if not c:
                borrar = self._cookie_ciudadano(None) if self._token_ciudadano() else None
                e = ErrorApi(401, "inicia sesión", k="cuenta.sesion")
                return self._json(e.codigo, e.cuerpo(), cookie=borrar)
            return self._json(200, {"ciudadano": cuentas.ciudadano_publico(c)})
        if ruta == "/api/cuenta/foto":
            c = self._exigir_ciudadano()
            if not c["foto"]:
                raise ErrorApi(404, "no tienes foto")
            return self._archivo(cuentas.ruta_foto(c["foto"]), cache="private, no-store")
        raise ErrorApi(404, "ruta desconocida")

    def _cuenta_post(self, ruta, b):
        self._exigir_csrf()
        if ruta == "/api/cuenta/registro":
            foto = validar_foto(b)
            ciudadano, token = cuentas.registrar(b, self._ip(), foto)
            return self._json(201, {"ciudadano": ciudadano}, cookie=self._cookie_ciudadano(token))
        if ruta == "/api/cuenta/ingresar":
            ciudadano, token = cuentas.ingresar(b, self._ip())
            return self._json(200, {"ciudadano": ciudadano}, cookie=self._cookie_ciudadano(token))
        if ruta == "/api/cuenta/salir":
            cuentas.cerrar_sesion(self._token_ciudadano())
            return self._json(200, {"ok": True}, cookie=self._cookie_ciudadano(None))
        c = self._exigir_ciudadano()
        if ruta == "/api/cuenta/perfil":
            return self._json(200, {"ciudadano": cuentas.actualizar_perfil(c, b)})
        if ruta == "/api/cuenta/foto":
            if "foto" not in b:
                raise ErrorApi(400, "falta la foto (o null para quitarla)", k="foto.formato")
            return self._json(200, {"ciudadano": cuentas.cambiar_foto(c, validar_foto(b))})
        if ruta == "/api/cuenta/eliminar":
            cuentas.eliminar(c["id"])
            return self._json(200, {"ok": True}, cookie=self._cookie_ciudadano(None))
        raise ErrorApi(404, "ruta desconocida")

    def _segura(self):
        """¿Cookie segura? Si se pidió, si la dirección pública es https (producción) o si el proxy dice que llegó por https."""
        return (os.environ.get("COOKIE_SEGURA") == "1" or (os.environ.get("URL_PUBLICA") or "").startswith("https://")
                or self.headers.get("X-Forwarded-Proto") == "https")

    def _cookie(self, token):
        return auth.cookie_sesion(token, self._segura())

    def _exigir_csrf(self):
        """Un formulario de otro sitio no puede poner cabeceras propias: exigir una frena el CSRF."""
        if self.headers.get("X-Requested-With") != "yaguachi":
            raise ErrorApi(403, "falta la cabecera X-Requested-With", k="auth.csrf")

    def _exigir_sesion(self, permitir_cambio=False):
        u = auth.usuario_de_sesion(self._token())
        if not u:
            raise ErrorApi(401, "inicia sesión", k="auth.sesion")
        if u["debe_cambiar_clave"] and not permitir_cambio:
            raise ErrorApi(403, "debes cambiar tu clave antes de seguir", k="auth.cambiar_clave")
        return u

    def _puede(self, permiso):
        """Para rutas públicas que además aceptan una sesión del panel (fotos). Nunca lanza error."""
        u = auth.usuario_de_sesion(self._token())
        return bool(u and not u["debe_cambiar_clave"] and permiso in u["permisos"])

    def _panel(self, metodo, ruta, q=None, b=None):
        """Orden: CSRF (403) → sesión (401) → clave por cambiar (403) → ruta (404) → permiso (403)."""
        self._exigir_csrf()
        u = self._exigir_sesion()
        for met, patron, permiso, fn, codigo, accion in RUTAS_PANEL:
            m = re.fullmatch(patron, ruta) if met == metodo else None
            if not m:
                continue
            if permiso not in u["permisos"]:
                raise ErrorApi(403, "no tienes permiso para esta acción", k="auth.permiso")
            res = fn(u, m, q or {}, b or {})
            if isinstance(res, Descarga):
                return self._descarga(res)
            if accion:
                auth.auditar_suelto(u["id"], accion, _detalle_auditoria(m, b or {}, res))
            return self._json(codigo, res)
        raise ErrorApi(404, "ruta desconocida")

    def _auth_get(self, ruta):
        if ruta == "/api/auth/config":           # pública: el login necesita la site key antes de tener sesión
            return self._json(200, {"captcha": {"proveedor": "turnstile", "site_key": auth.turnstile_site_key()}})
        self._exigir_csrf()
        if ruta == "/api/auth/me":
            # «incidentes_anonimos» y «validado_directo» van aquí para que cualquier rol sepa cómo se publicará su
            # incidente (leer o cambiar toda la configuración sigue siendo solo del superadmin)
            u = self._exigir_sesion(permitir_cambio=True)
            return self._json(200, {"usuario": u,
                                    "publicacion": {"incidentes_anonimos": bool(usuarios.config_valor("incidentes_anonimos")),
                                                    "validado_directo": usuarios.publica_validado(u)}})
        raise ErrorApi(404, "ruta desconocida")

    def _auth_post(self, ruta, b):
        self._exigir_csrf()
        if ruta == "/api/auth/login":
            usuario, token = auth.login(b, self._ip())
            return self._json(200, {"usuario": usuario}, cookie=self._cookie(token))
        if ruta == "/api/auth/logout":
            token = self._token()
            u = auth.usuario_de_sesion(token)
            auth.cerrar_sesion(token)
            if u:
                auth.auditar_suelto(u["id"], "logout")
            return self._json(200, {"ok": True}, cookie=self._cookie(None))
        if ruta == "/api/auth/clave":
            u = self._exigir_sesion(permitir_cambio=True)
            token = auth.cambiar_clave(u, b, self._ip())
            return self._json(200, {"ok": True}, cookie=self._cookie(token))
        raise ErrorApi(404, "ruta desconocida")

    def _ip(self):
        """IP del cliente. Detrás de nginx llega en X-Real-IP, pero solo se cree si la conexión viene de un proxy de confianza."""
        directa = self.client_address[0]
        try:
            if any(ipaddress.ip_address(directa) in red for red in PROXIES):
                real = (self.headers.get("X-Real-IP") or "").strip()
                if real:
                    return str(ipaddress.ip_address(real))
        except ValueError:
            pass
        return directa

    def _estatico(self, raices, rel):
        """Sirve un archivo de la primera raíz que lo tenga, sin salir de esa raíz (sin recorrer carpetas hacia arriba)."""
        rel = os.path.normpath(urllib.parse.unquote(rel).lstrip("/"))
        if rel in ("", "."):
            rel = "index.html"
        for raiz in raices:
            raiz = os.path.abspath(raiz)
            destino = os.path.abspath(os.path.join(raiz, rel))
            if os.path.commonpath([destino, raiz]) != raiz:
                return self._json(403, {"error": "prohibido"})
            if os.path.isfile(destino):
                return self._archivo(destino)
        raise ErrorApi(404, "no encontrado")

    # -- rutas
    def do_GET(self):
        try:
            u = urllib.parse.urlparse(self.path)
            q = urllib.parse.parse_qs(u.query)
            ruta = u.path
            if ruta.startswith("/api/"):
                return self._api_get(ruta, q)
            m = re.fullmatch(r"/a/(\d{1,9})", ruta)
            if m:   # enlace compartido de un aviso (spec 021)
                cuerpo = pagina_aviso_compartido(int(m.group(1)), self.headers.get("Host") or f"localhost:{CFG['puerto']}")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(cuerpo)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(cuerpo)
                return
            m = re.fullmatch(r"/r/([0-9a-f]{12})", ruta)
            if m:   # enlace compartido de un reporte
                cuerpo = pagina_compartida(m.group(1), self.headers.get("Host") or f"localhost:{CFG['puerto']}")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(cuerpo)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(cuerpo)
                return
            # archivos: solo en desarrollo (--estaticos / --admin); en Docker los sirve nginx
            if ADMIN and ruta == "/panel":
                self.send_response(301)
                self.send_header("Location", "/panel/")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            if ADMIN and ruta.startswith("/panel/"):
                return self._estatico(ADMIN, ruta[len("/panel/"):])
            if ESTATICOS:
                return self._estatico(ESTATICOS, ruta)
            raise ErrorApi(404, "ruta desconocida")
        except ErrorApi as e:
            self._json(e.codigo, e.cuerpo())
        except Exception as e:
            print("ERROR GET", self.path, repr(e))
            self._json(500, {"error": "error interno"})

    def _api_get(self, ruta, q):
        if ruta == "/api/estado":
            e = calcular_estado()
            # versión liviana para el ciudadano: sin series largas
            return self._json(200, e)
        if ruta == "/api/territorio":
            return self._json(200, {"recintos": T.recintos, "calles": T.lugares_calles,
                                    "tipos": {k: {"emoji": v[0], "etiqueta": v[1]} for k, v in TIPOS.items()},
                                    "gravedad": GRAVEDAD, "altura": ALTURA, "acciones": ACCIONES,
                                    "niveles": NIVELES, "colores": COLORES,
                                    "url_publica": (os.environ.get("URL_PUBLICA") or "").rstrip("/") or None})
        if ruta == "/api/lugar":
            try:
                lat, lon = float(q["lat"][0]), float(q["lon"][0])
            except (KeyError, ValueError):
                raise ErrorApi(400, "faltan lat y lon")
            x0, y0, x1, y1 = T.bbox
            if not (x0 <= lon <= x1 and y0 <= lat <= y1):
                raise ErrorApi(400, "la ubicación está fuera del cantón Yaguachi")
            nombre = (q.get("nombre", [""])[0] or "").strip()[:120] or None
            return self._json(200, estado_lugar(lon, lat, nombre))
        if ruta == "/api/recinto":
            try:
                rid = int(q.get("id", [""])[0])
                p = T.recintos[rid]
            except (ValueError, KeyError):
                raise ErrorApi(404, "recinto no encontrado")
            e = calcular_estado()
            r = e["recintos"][rid]
            rio = next((x for x in e["rios"] if x["rio"] == p["rio_cercano"]), None)
            return self._json(200, {"recinto": p, "estado": r, "rio": rio, "acciones": ACCIONES,
                                    "equipamientos": T.equipamientos_cercanos(p["lon"], p["lat"]),
                                    "advertencia": e["advertencia"], "aguaje": e["aguaje"], "generado": e["generado"]})
        if ruta == "/api/cercano":
            try:
                lat, lon = float(q["lat"][0]), float(q["lon"][0])
            except (KeyError, ValueError):
                raise ErrorApi(400, "faltan lat y lon")
            rid, d = T.recinto_cercano(lon, lat)
            return self._json(200, {"id": rid, "nombre": T.recintos[rid]["nombre"], "dist_m": round(d),
                                    "en_canton": T.en_canton(lon, lat)})
        if ruta == "/api/reportes":
            if self.headers.get("X-Dispositivo"):          # la app lo manda en cabecera (no queda en registros)
                q["dispositivo"] = [self.headers["X-Dispositivo"]]
            return self._json(200, listar_reportes(q))
        if ruta == "/api/avisos":
            return self._json(200, avisos_para(q))
        m = re.fullmatch(r"/api/avisos/(\d{1,9})/flyer", ruta)
        if m:
            # el nombre del archivo va en ?v=: si cambia, cambia la URL; se puede guardar mucho tiempo
            arch = ruta_flyer(int(m.group(1)))
            if not arch:
                raise ErrorApi(404, "aviso sin imagen", k="avisos.sin_flyer")
            return self._archivo(arch, cache="public, max-age=2592000, immutable")
        if ruta == "/api/albergues":
            return self._json(200, listar_albergues())
        m = re.fullmatch(r"/api/albergues/([0-9a-f]{12})/foto/([1-3])", ruta)
        if m:
            # el nombre del archivo cambia si cambia la foto, y la app pide con ?v=<actualizado>: se puede guardar un día
            return self._archivo(foto_albergue(m.group(1), int(m.group(2))), cache="public, max-age=86400")
        if ruta == "/api/ruta":
            return self._json(200, ruta_a_albergue(q, self._ip()))
        if ruta in ("/api/tormentas", "/api/tormentas/resumen"):   # spec 020: satélite, rayos y lluvia (de la caché)
            tormentas.marcar_demanda()
            lat0, lon0 = centro_canton()
            return self._json(200, tormentas.completo(lat0, lon0) if ruta == "/api/tormentas"
                              else tormentas.resumen(lat0, lon0))
        m = re.fullmatch(r"/api/tormentas/marco/(\d{8}T\d{4})\.png", ruta)
        if m:
            try:
                t = tormentas.marco_valido(m.group(1))
                if not t:
                    raise ErrorApi(404, "imagen no disponible", k="tormentas.marco")
                datos = tormentas.png_marco(t)
            except SinDato:
                raise ErrorApi(503, "sin datos del satélite por ahora", k="tormentas.sin_datos")
            # la imagen de una hora dada no cambia: el teléfono la puede guardar
            return self._binario(datos, "image/png", "public, max-age=10800, immutable")
        m = re.fullmatch(r"/api/foto/([0-9a-f]{12})(?:/([1-3]))?", ruta)
        if m:
            with db() as con:
                r = con.execute("SELECT foto, fotos_extra, estado, dispositivo, origen, validado_por FROM reportes WHERE id=%s",
                                (m.group(1),)).fetchone()
            # ?dispositivo= queda por compatibilidad
            disp = disp_o_vacio(self.headers.get("X-Dispositivo") or q.get("dispositivo", [""])[0])
            k = q.get("k", [""])[0]
            permitido = r and r["foto"] and (foto_publica(r)
                                             or (disp and disp == r["dispositivo"])
                                             or (k and hmac.compare_digest(k, llave_foto(m.group(1))))
                                             or self._puede("panel.ver"))
            fotos = fotos_de(r) if permitido else []
            n = int(m.group(2) or 1)
            if n > len(fotos):
                raise ErrorApi(404, "foto no disponible")
            return self._archivo(os.path.join(FOTOS, fotos[n - 1]), cache="private, max-age=3600")
        if ruta.startswith("/api/panel/"):
            return self._panel("GET", ruta, q=q)
        if ruta.startswith("/api/auth/"):
            return self._auth_get(ruta)
        if ruta.startswith("/api/cuenta/"):
            return self._cuenta_get(ruta)
        if ruta == "/api/push/config":
            return self._json(200, push.config_publica())
        raise ErrorApi(404, "ruta desconocida")

    def do_POST(self):
        try:
            ruta = urllib.parse.urlparse(self.path).path
            b = self._cuerpo()
            if ruta == "/api/reportes":
                # la cuenta es opcional (pedido del dueño, 2026-11-10): sin sesión, o con «anonimo», el reporte va
                # sin autor; con sesión, queda ligado a la cuenta (que nunca se publica)
                c = None if b.get("anonimo") is True else cuentas.ciudadano_de_sesion(self._token_ciudadano())
                return self._json(201, crear_reporte(b, self._ip(), c["id"] if c else None))
            m = re.fullmatch(r"/api/reportes/([0-9a-f]{12})/confirmar", ruta)
            if m:
                return self._json(200, confirmar_reporte(m.group(1), b, self._ip()))
            m = re.fullmatch(r"/api/reportes/([0-9a-f]{12})/megusta", ruta)
            if m:
                return self._json(200, me_gusta_reporte(m.group(1), b, self._ip()))
            if ruta == "/api/actividad":  # «este teléfono usa la app» (pestaña Dispositivos del superadmin, spec 021)
                return self._json(200, registrar_actividad(b, self.headers.get("X-Dispositivo") or b.get("dispositivo"), self._ip(),
                                                           comun.plataforma(self.headers.get("User-Agent"))))
            if ruta == "/api/vistas":     # alcance de avisos e incidentes (spec 021): el id del teléfono va en cabecera
                return self._json(200, registrar_vistas(b, self.headers.get("X-Dispositivo") or b.get("dispositivo"), self._ip(),
                                                        comun.plataforma(self.headers.get("User-Agent"))))
            if ruta.startswith("/api/panel/"):
                return self._panel("POST", ruta, b=b)
            if ruta.startswith("/api/auth/"):
                return self._auth_post(ruta, b)
            if ruta.startswith("/api/cuenta/"):
                return self._cuenta_post(ruta, b)
            if ruta == "/api/push/suscribir":
                disp = validar_dispositivo(self.headers.get("X-Dispositivo"))
                return self._json(200, push.suscribir(b, disp, self._ip(), T.recintos, comun.plataforma(self.headers.get("User-Agent"))))
            if ruta == "/api/push/baja":
                return self._json(200, push.baja(b))
            raise ErrorApi(404, "ruta desconocida")
        except ErrorApi as e:
            self._json(e.codigo, e.cuerpo())
        except (ValueError, TypeError, KeyError, AttributeError) as e:   # cuerpo con datos mal formados
            print("POST inválido", self.path.split("?")[0], repr(e))
            self._json(400, {"error": "datos inválidos"})
        except Exception as e:
            print("ERROR POST", self.path, repr(e))
            self._json(500, {"error": "error interno"})


class Servidor(ThreadingHTTPServer):
    """Hasta 200 conexiones a la vez; las demás se cierran en vez de crear hilos sin límite."""
    daemon_threads = True
    _cupos = threading.BoundedSemaphore(200)

    def process_request(self, request, client_address):
        if not self._cupos.acquire(blocking=False):
            return self.shutdown_request(request)
        try:
            super().process_request(request, client_address)
        except Exception:
            self._cupos.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._cupos.release()


def mantenimiento_una_vez():
    """Borra las fotos de más de 90 días, la IP de lo que tiene más de 48 h (solo sirve para frenar abusos)
    y las sesiones vencidas."""
    limpiar_fotos_viejas()
    limite = iso(ahora() - dt.timedelta(hours=48))
    with db_escritura() as con:
        for tabla in ("reportes", "confirmaciones", "me_gusta", "sesiones", "ciudadanos", "vistas"):
            con.execute(f"UPDATE {tabla} SET ip=NULL WHERE ip IS NOT NULL AND creado < %s", (limite,))
        # teléfonos que usan la app: la IP a las 48 h de su último uso; la fila, a los 180 días sin uso
        con.execute("UPDATE dispositivos SET ip=NULL WHERE ip IS NOT NULL AND ultima < %s", (limite,))
        con.execute("DELETE FROM dispositivos WHERE ultima < %s", (iso(ahora() - dt.timedelta(days=DIAS_CONSERVAR_TELEFONOS)),))
        push.mantenimiento(con, limite)
        auth.borrar_sesiones_vencidas(con)
        cuentas.mantenimiento(con)


def mantenimiento():
    """Cada 6 h."""
    while True:
        try:
            mantenimiento_una_vez()
        except Exception as e:
            print("mantenimiento:", repr(e))
        time.sleep(6 * 3600)


def preparar(offline=False):
    """Configuración, base, capas y superadmin inicial. Devuelve la clave inicial del superadmin si se acaba de
    crear (para mostrarla UNA vez) o None. Las pruebas la usan para levantar la API en un directorio temporal."""
    global CFG, OFFLINE, T
    OFFLINE = offline
    CFG = cargar_config()
    iniciar_db()
    if not os.path.exists(os.path.join(CAPAS, "recintos.geojson")):
        sys.exit(f"Faltan las capas en {CAPAS}. Corre primero: python preparar_capas.py (o define YAGUACHI_CAPAS)")
    T = Territorio()
    limpiar_fotos_viejas()
    return usuarios.crear_superadmin_inicial()


def restablecer_clave(usuario):
    """--restablecer-clave: no levanta el servidor; imprime una clave temporal que hay que cambiar al entrar."""
    iniciar_db()
    res = usuarios.restablecer_desde_consola(usuario)
    if not res:
        sys.exit(f"No existe el usuario '{usuario}'")
    clave, activo = res
    print(f"Clave temporal de '{usuario}': {clave}   (se pide cambiarla al entrar; no la pegues en chats ni tickets)")
    if not activo:
        print(f"Ojo: '{usuario}' está desactivado; otro superadmin debe reactivarlo desde el panel")


def main():
    ap = argparse.ArgumentParser(description="Servidor local de Yaguachi Weather")
    ap.add_argument("--offline", action="store_true", help="no consulta Open-Meteo; usa la caché")
    ap.add_argument("--puerto", type=int, default=None)
    ap.add_argument("--estaticos", metavar="DIR", help="desarrollo: sirve también la app ciudadana desde esta carpeta (p. ej. cliente)")
    ap.add_argument("--admin", metavar="DIR", help="desarrollo: sirve también el panel en /panel/ desde esta carpeta (p. ej. admin)")
    ap.add_argument("--restablecer-clave", metavar="USUARIO",
                    help="imprime una clave temporal nueva para ese usuario (p. ej. el superadmin que perdió la suya) y sale")
    ap.add_argument("--importar-sqlite", metavar="RUTA",
                    help="importa una base SQLite de antes (p. ej. datos/yaguachi.db) a PostgreSQL y sale; "
                         "se niega si PostgreSQL ya tiene datos")
    ap.add_argument("--forzar", action="store_true",
                    help="con --importar-sqlite: vacía las tablas de PostgreSQL y vuelve a importar")
    args = ap.parse_args()
    if args.forzar and not args.importar_sqlite:
        ap.error("--forzar solo sirve junto con --importar-sqlite")
    if args.importar_sqlite:
        return importar_desde_consola(args.importar_sqlite, args.forzar)
    if args.restablecer_clave:
        return restablecer_clave(args.restablecer_clave.strip().lower())
    compartido = os.path.join(RAIZ, "compartido")
    if args.estaticos:   # el cliente busca primero en su carpeta y después en compartido/ (i18n.js, capas/)
        ESTATICOS[:] = [args.estaticos, compartido]
    if args.admin:       # el panel usa además i18n.js de compartido/ y los íconos del cliente
        ADMIN[:] = [args.admin, compartido] + ([args.estaticos] if args.estaticos else [os.path.join(RAIZ, "cliente")])
    clave_inicial = preparar(args.offline)
    puerto = args.puerto or CFG["puerto"]
    srv = Servidor(("0.0.0.0", puerto), Manejador)
    threading.Thread(target=mantenimiento, daemon=True).start()
    threading.Thread(target=push.hilo, args=(aviso_aplica_a_recinto,), name="push", daemon=True).start()
    if not OFFLINE:
        threading.Thread(target=tormentas.hilo, args=centro_canton(), name="tormentas", daemon=True).start()
    print(f"Yaguachi Weather · API en http://localhost:{puerto}/api/" + (f"   app: http://localhost:{puerto}/" if ESTATICOS else "")
          + (f"   panel: http://localhost:{puerto}/panel/" if ADMIN else ""))
    # la clave inicial se muestra una sola vez: en los arranques siguientes no aparece en los registros
    if clave_inicial:
        print(f"CLAVE INICIAL del superadmin 'admin': {clave_inicial}   (se pide cambiarla al entrar)", flush=True)
    if auth.captcha_de_prueba():
        print("Aviso: Turnstile con las claves de PRUEBA de Cloudflare (siempre pasan). En producción define "
              "TURNSTILE_SITE_KEY y TURNSTILE_SECRET_KEY")
    print("Web push: " + ("habilitado" if push.habilitado() else "deshabilitado (faltan firebase-admin, "
                                                                  "FIREBASE_CREDENCIALES o la configuración web)"))
    print("Caché de tormentas: " + ("Redis" if CACHE.usa_redis() else "memoria del proceso (sin REDIS_URL o Redis no responde)"))
    print(f"{len(T.recintos)} recintos, {len(T.puntos)} puntos de control, {len({p['celda'] for p in T.recintos.values()})} celdas de lluvia")
    threading.Thread(target=lambda: calcular_estado(forzar=True), daemon=True).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")


if __name__ == "__main__":
    main()
