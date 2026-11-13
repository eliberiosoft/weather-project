"""Tormentas cerca de Yaguachi (spec 020): satélite, rayos y lluvia de la próxima hora, servidos desde la caché.

Fuentes (todas públicas y sin clave; el teléfono nunca las llama, solo la API, y una vez para todos):
  * Nubes de tormenta: GOES-19 (GOES-East), banda 13 infrarroja, vía NASA GIBS (WMTS), una imagen cada 10 min.
    El color de cada píxel es la temperatura del tope de la nube (tabla «Clean_Longwave_Infrared_Window_Band» de
    NASA Worldview). Se conservan solo las nubes de -41 °C o más frías, en 3 clases, y se arma un mosaico propio
    de 768×768 (3×3 teselas de zoom 6, de Galápagos al oriente) en un PNG de paleta casi todo transparente.
  * Rayos: GOES-19 GLM (Geostationary Lightning Mapper), archivos L2 LCFA de 20 s leídos por OPeNDAP en texto desde
    el THREDDS de Unidata (UCAR): solo latitud y longitud de cada destello (unos 7 KB por archivo).
  * Lluvia de la próxima hora: Open-Meteo, cada 15 min (modelo, no medición).

No es radar ni un nivel de alerta: la app lo dice. Todo pasa por cache.CACHE (Redis), así muchas personas a la vez
no se traducen en muchas descargas.
"""
import datetime as dt
import json
import math
import re
import struct
import threading
import time
import urllib.request
import zlib
from concurrent.futures import ThreadPoolExecutor

from cache import CACHE, TTL_VIEJO, VIEJO, SinDato

UA = {"User-Agent": "YaguachiWeather/0.2 (proyecto independiente)"}

# ---------------------------------------------------------------------------------------------- el mosaico
GIBS = ("https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_Band13_Clean_Infrared/default/"
        "{t}/GoogleMapsCompatible_Level6/6/{y}/{x}.png")
Z = 6
X0, X1, Y0, Y1 = 16, 18, 31, 33               # 3×3 teselas: lon -90 a -73,1; lat 5,6 a -11,2
TES = 256
ANCHO, ALTO = (X1 - X0 + 1) * TES, (Y1 - Y0 + 1) * TES
PASO_MIN = 10                                 # GOES-East manda una imagen de disco completo cada 10 min
N_MARCOS = 12                                 # 2 h de animación
TTL_MARCO = 3 * 3600                          # una imagen de una hora dada no cambia: se guarda 3 h

# radios del aviso (km) desde el centro del cantón
R_ENCIMA, R_CERCA, R_LEJOS = 10, 40, 150
R_RAYOS = 30


def lon_de(xg):
    return xg / (TES * 2 ** Z) * 360 - 180


def lat_de(yg):
    return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * yg / (TES * 2 ** Z)))))


def pixel_de(lat, lon):
    """Píxel (x, y) del mosaico, con decimales."""
    n = TES * 2 ** Z
    xg = (lon + 180) / 360 * n
    yg = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return xg - X0 * TES, yg - Y0 * TES


# [[sur, oeste], [norte, este]] como los pide Leaflet
LIMITES = [[round(lat_de((Y1 + 1) * TES), 4), round(lon_de(X0 * TES), 4)],
           [round(lat_de(Y0 * TES), 4), round(lon_de((X1 + 1) * TES), 4)]]

# color → °C de la tabla «Clean_Longwave_Infrared_Window_Band» de NASA Worldview: solo los colores (los grises van
# aparte). Incluye los verdes y azules de -40 a -19 °C para que un píxel cian no se confunda con uno frío.
_TABLA = ("7f007f:-91 8c0d87:-90 99198e:-89 a52696:-88 b2339d:-87 bf40a5:-86 cc4cad:-85 d959b4:-84 e566bc:-83 "
          "f272c3:-82 ff7fcb:-81 1a0000:-70 330000:-69 4d0000:-68 660000:-67 800000:-66 990000:-65 b30000:-64 "
          "cc0000:-63 e60000:-62 ff0000:-61 ff1a00:-60 ff3300:-59 ff4d00:-58 ff6600:-57 ff8000:-56 ff9900:-55 "
          "ffb300:-54 ffcc00:-53 ffe600:-52 ffff00:-51 e6ff00:-50 ccff00:-49 b3ff00:-48 99ff00:-47 80ff00:-46 "
          "66ff00:-45 4dff00:-44 33ff00:-43 1aff00:-42 00ff00:-41 00ea0a:-40 00d413:-39 00bf1d:-38 00aa26:-37 "
          "009530:-36 00803a:-35 006a43:-34 00554d:-33 004056:-32 002a60:-31 001569:-30 000073:-30 00007d:-29 "
          "000d7a:-29 001a81:-28 002688:-28 00338f:-27 004096:-27 004c9d:-26 0059a4:-26 0066ab:-25 0073b2:-25 "
          "0080b9:-24 008cc0:-24 0099c7:-23 00a6ce:-23 00b2d5:-22 00bfdc:-22 00cce3:-21 00d9ea:-21 00e6f1:-20 "
          "00f2f8:-20 00ffff:-19")
COLORES = [(tuple(bytes.fromhex(c)), int(t)) for c, t in (x.split(":") for x in _TABLA.split())]
MAX_DIST2 = 3 * 45 ** 2       # más lejos que esto de todo color de la tabla: borde mezclado con el fondo, no cuenta


def clase_de_temp(t):
    """1: nube de tormenta (-41 a -54 °C) · 2: tormenta fuerte (-55 a -69) · 3: muy fuerte (-70 o menos)."""
    return 0 if t > -41 else 3 if t <= -70 else 2 if t <= -55 else 1


def temp_de_color(rgb):
    """°C del color de la tabla más parecido, o None si no se parece a ninguno."""
    d, t = min((sum((a - b) ** 2 for a, b in zip(rgb, c)), t) for c, t in COLORES)
    return t if d <= MAX_DIST2 else None


# paleta del PNG: índigos (no compiten con el semáforo, ni con el azul del agua, ni con el morado de los escenarios)
CLASES = [
    {"c": 1, "color": "#a5b4fc", "alfa": 150, "desde": -41},
    {"c": 2, "color": "#6366f1", "alfa": 195, "desde": -55},
    {"c": 3, "color": "#312e81", "alfa": 225, "desde": -70},
]


# ---------------------------------------------------------------------------------------------- PNG (stdlib)
FIRMA = b"\x89PNG\r\n\x1a\n"


def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    return a if pa <= pb and pa <= pc else b if pb <= pc else c


def png_pixeles(datos):
    """Decodifica un PNG de 8 bits RGB o RGBA sin entrelazar. Devuelve (ancho, alto, bytes_por_píxel, bytes)."""
    if datos[:8] != FIRMA:
        raise ValueError("no es un PNG")
    i, idat, w = 8, [], None
    while i + 8 <= len(datos):
        n, tipo = struct.unpack(">I4s", datos[i:i + 8])
        cuerpo = datos[i + 8:i + 8 + n]
        i += 12 + n
        if tipo == b"IHDR":
            w, h, prof, color, _, _, entrelazado = struct.unpack(">IIBBBBB", cuerpo)
            if prof != 8 or color not in (2, 6) or entrelazado:
                raise ValueError(f"PNG no soportado (profundidad {prof}, color {color})")
            bpp = 4 if color == 6 else 3
        elif tipo == b"IDAT":
            idat.append(cuerpo)
        elif tipo == b"IEND":
            break
    if w is None:
        raise ValueError("PNG sin cabecera")
    crudo = zlib.decompress(b"".join(idat))
    paso = w * bpp
    if len(crudo) != h * (paso + 1):
        raise ValueError("PNG incompleto")
    out = bytearray(h * paso)
    prev = bytearray(paso)
    for y in range(h):
        p = y * (paso + 1)
        f = crudo[p]
        fila = bytearray(crudo[p + 1:p + 1 + paso])
        if f == 1:
            for k in range(bpp, paso):
                fila[k] = (fila[k] + fila[k - bpp]) & 255
        elif f == 2:
            fila = bytearray((a + b) & 255 for a, b in zip(fila, prev))
        elif f == 3:
            for k in range(paso):
                fila[k] = (fila[k] + (((fila[k - bpp] if k >= bpp else 0) + prev[k]) >> 1)) & 255
        elif f == 4:
            for k in range(paso):
                a = fila[k - bpp] if k >= bpp else 0
                c = prev[k - bpp] if k >= bpp else 0
                fila[k] = (fila[k] + _paeth(a, prev[k], c)) & 255
        elif f != 0:
            raise ValueError(f"filtro PNG desconocido {f}")
        out[y * paso:(y + 1) * paso] = fila
        prev = fila
    return w, h, bpp, bytes(out)


def _trozo(tipo, cuerpo):
    return struct.pack(">I", len(cuerpo)) + tipo + cuerpo + struct.pack(">I", zlib.crc32(tipo + cuerpo) & 0xFFFFFFFF)


def png_paleta(w, h, indices, paleta):
    """PNG de paleta de 8 bits. `paleta`: [(r, g, b, alfa)], un índice por píxel en `indices`."""
    filas = b"".join(b"\x00" + indices[y * w:(y + 1) * w] for y in range(h))
    return (FIRMA + _trozo(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 3, 0, 0, 0))
            + _trozo(b"PLTE", b"".join(bytes(c[:3]) for c in paleta))
            + _trozo(b"tRNS", bytes(c[3] for c in paleta))
            + _trozo(b"IDAT", zlib.compress(filas, 9)) + _trozo(b"IEND", b""))


GRIS_DUDOSO = 4    # gris: puede ser el núcleo de -71 a -80 °C o una nube baja (ver resolver_grises)


def clasificar(w, h, bpp, px):
    """Una clase (0 a 3) por píxel. Las teselas vienen remuestreadas: los colores no son exactos (se busca el más
    parecido de la tabla) y los grises de las nubes bajas pueden coincidir con los de -71 a -80 °C (quedan como
    GRIS_DUDOSO y los decide resolver_grises)."""
    out = bytearray(w * h)
    memo = {}
    for i, j in enumerate(range(0, len(px), bpp)):
        if bpp == 4 and px[j + 3] == 0:
            continue
        r, g, b = px[j], px[j + 1], px[j + 2]
        if max(r, g, b) - min(r, g, b) <= 6:                # gris
            out[i] = GRIS_DUDOSO
            continue
        k = (r, g, b)
        c = memo.get(k)
        if c is None:
            t = temp_de_color(k)
            c = memo[k] = clase_de_temp(t) if t is not None else 0
        out[i] = c
    return out


def resolver_grises(cl, w, h):
    """Un grupo de grises (8 vecinos) es el núcleo de -71 a -80 °C solo si está ENCERRADO por nube fría
    (-55 °C o menos): ese núcleo siempre está rodeado por el anillo rojo de -61 a -70 °C. El fondo gris (nubes bajas,
    mar, suelo) toca nubes cálidas o el borde del mosaico y queda en 0."""
    n = w * h
    vecinos = (-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1)
    for ini in range(n):
        if cl[ini] != GRIS_DUDOSO:
            continue
        grupo, pila, encerrado = [], [ini], True
        cl[ini] = 5                                     # visitado
        while pila:
            i = pila.pop()
            grupo.append(i)
            x = i % w
            if x in (0, w - 1) or i < w or i >= n - w:
                encerrado = False                       # toca el borde del mosaico
            for d in vecinos:
                k = i + d
                if not (0 <= k < n) or abs(k % w - x) > 1:
                    continue
                c = cl[k]
                if c == GRIS_DUDOSO:
                    cl[k] = 5
                    pila.append(k)
                elif c in (0, 1):
                    encerrado = False                   # toca nube cálida o cielo: es fondo
        valor = 3 if encerrado else 6                   # 6: fondo ya revisado
        for i in grupo:
            cl[i] = valor
    return bytearray(c if c <= 3 else 0 for c in cl)


# ---------------------------------------------------------------------------------------------- red
def _bajar(url, timeout=20, metodo="GET"):
    req = urllib.request.Request(url, headers=UA, method=metodo)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read() if metodo == "GET" else dict(r.headers)


def _fmt(t):
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def id_de(t):
    return t.strftime("%Y%m%dT%H%M")


def t_de_id(s):
    if not re.fullmatch(r"\d{8}T\d{4}", s or ""):
        return None
    try:
        return dt.datetime.strptime(s, "%Y%m%dT%H%M").replace(tzinfo=dt.timezone.utc)
    except ValueError:
        return None


def ultimo_tiempo():
    """Hora de la imagen más reciente en GIBS (HEAD de una tesela: la cabecera Layer-Time-Actual). Caché de 2 min."""
    def preguntar():
        h = _bajar(GIBS.format(t="default", x=17, y=32), timeout=15, metodo="HEAD")
        t = next((v for k, v in h.items() if k.lower() == "layer-time-actual"), "")
        if not re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", t):
            raise ValueError(f"GIBS no dijo la hora ({t!r})")
        return t.encode()
    v, _ = CACHE.una_vez("torm:ultimo", 120, preguntar, espera=20)
    return dt.datetime.strptime(v.decode(), "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)


ATRAS_LISTO = 3          # cuántas imágenes anteriores se prueban si la anunciada todavía no está completa (30 min)


def ultimo_listo():
    """La imagen más reciente que ya se pudo armar. GIBS anuncia la hora nueva en una tesela antes de tenerla en todas
    (las otras dan 404 hasta 30 min): se prueban las anteriores, y una hora que falló no se vuelve a pedir en 5 min
    (clases_marco). Si ninguna se puede armar ahora, la última que sí se armó (de las últimas 3 h)."""
    u = ultimo_tiempo()
    for k in range(ATRAS_LISTO + 1):
        t = u - dt.timedelta(minutes=PASO_MIN * k)
        try:
            clases_marco(t)
            CACHE.set("torm:listo", id_de(t).encode(), TTL_MARCO)
            return t
        except SinDato:
            continue
    v = CACHE.get("torm:listo")
    t = t_de_id(v.decode()) if v else None
    if t and u - t <= dt.timedelta(hours=3):
        return t
    raise SinDato("torm:ultimo_listo")


def marcos():
    """Las últimas N_MARCOS horas, de la más vieja a la más nueva."""
    u = ultimo_listo()
    return [u - dt.timedelta(minutes=PASO_MIN * k) for k in range(N_MARCOS - 1, -1, -1)]


def marco_valido(id_):
    """Solo se sirven horas de las últimas 3 h en múltiplos de 10 min (nadie puede pedir cualquier cosa a NASA)."""
    t = t_de_id(id_)
    if not t or t.minute % PASO_MIN:
        return None
    u = ultimo_tiempo()
    return t if u - dt.timedelta(hours=3) <= t <= u else None


def _clases_bajadas(t):
    """Baja las 9 teselas de la hora t (3 a la vez, para no cargar a GIBS) y las clasifica en el mosaico."""
    mosaico = bytearray(ANCHO * ALTO)
    pedidos = [(x, y) for y in range(Y0, Y1 + 1) for x in range(X0, X1 + 1)]

    def una(xy):
        x, y = xy
        w, h, bpp, px = png_pixeles(_bajar(GIBS.format(t=_fmt(t), x=x, y=y)))
        if (w, h) != (TES, TES):
            raise ValueError("tesela de tamaño inesperado")
        return xy, clasificar(w, h, bpp, px)

    with ThreadPoolExecutor(3) as ex:
        for (x, y), cl in ex.map(una, pedidos):
            ox, oy = (x - X0) * TES, (y - Y0) * TES
            for fila in range(TES):
                ini = (oy + fila) * ANCHO + ox
                mosaico[ini:ini + TES] = cl[fila * TES:(fila + 1) * TES]
    return zlib.compress(bytes(resolver_grises(mosaico, ANCHO, ALTO)), 6)


def clases_marco(t):
    # una hora que dio 404 (GIBS aún no la tiene completa) no se vuelve a pedir en 5 min
    v, _ = CACHE.una_vez(f"torm:clases:{id_de(t)}", TTL_MARCO, lambda: _clases_bajadas(t), espera=60, ttl_fallo=300)
    return zlib.decompress(v)


def png_marco(t):
    """El PNG del mosaico de la hora t (de la caché, o se arma una vez)."""
    def armar():
        paleta = [(0, 0, 0, 0)] + [(*bytes.fromhex(c["color"][1:]), c["alfa"]) for c in CLASES]
        return png_paleta(ANCHO, ALTO, clases_marco(t), paleta)
    v, _ = CACHE.una_vez(f"torm:png:{id_de(t)}", TTL_MARCO, armar, espera=60)
    return v


# ---------------------------------------------------------------------------------------------- aviso «cerca»
RUMBOS = ["n", "ne", "e", "se", "s", "so", "o", "no"]


def _km(lat1, lon1, lat2, lon2):
    x = math.radians(lon2 - lon1) * math.cos(math.radians((lat1 + lat2) / 2))
    y = math.radians(lat2 - lat1)
    return 6371 * math.hypot(x, y)


def _rumbo(lat0, lon0, lat, lon):
    x = math.radians(lon - lon0) * math.cos(math.radians(lat0))
    y = math.radians(lat - lat0)
    ang = (math.degrees(math.atan2(x, y)) + 360) % 360
    return RUMBOS[int((ang + 22.5) // 45) % 8]


def analizar(clases, lat0, lon0):
    """La nube de tormenta más cercana al punto (km y rumbo) y la más fuerte a menos de R_CERCA km."""
    if clases.count(0) == len(clases):
        return {"dist_km": None, "rumbo": None, "intensidad": 0}
    lats = [lat_de(Y0 * TES + y + 0.5) for y in range(ALTO)]
    lons = [lon_de(X0 * TES + x + 0.5) for x in range(ANCHO)]
    mejor, donde, fuerte = None, None, 0
    for k, c in enumerate(clases):
        if not c:
            continue
        lat, lon = lats[k // ANCHO], lons[k % ANCHO]
        dlat = abs(lat - lat0) * 111.2          # cota inferior de la distancia: si ya es mayor, no hace falta medir
        if mejor is not None and dlat > mejor and dlat > R_CERCA:
            continue
        d = _km(lat0, lon0, lat, lon)
        if mejor is None or d < mejor:
            mejor, donde = d, (lat, lon)
        if d <= R_CERCA and c > fuerte:
            fuerte = c
    return {"dist_km": round(mejor, 1), "rumbo": _rumbo(lat0, lon0, *donde) if mejor > 1 else None,
            "intensidad": fuerte}


def estado_de(dist):
    if dist is None or dist > R_LEJOS:
        return "sin"
    return "encima" if dist <= R_ENCIMA else "cerca" if dist <= R_CERCA else "lejos"


def cerca(lat0, lon0):
    """Aviso de la imagen más reciente, con tendencia contra la de 30 min antes. Caché por imagen."""
    ts = marcos()
    ahora, antes = ts[-1], ts[-4]

    def calcular():
        a = analizar(clases_marco(ahora), lat0, lon0)
        try:
            b = analizar(clases_marco(antes), lat0, lon0)
        except Exception:
            b = None
        tend = None
        if b is not None and a["dist_km"] is not None:
            if b["dist_km"] is None:
                tend = "nueva"
            elif a["dist_km"] - b["dist_km"] <= -5:
                tend = "acercandose"
            elif a["dist_km"] - b["dist_km"] >= 5:
                tend = "alejandose"
            else:
                tend = "quieta"
        return dict(a, estado=estado_de(a["dist_km"]), tendencia=tend, t=_fmt(ahora))
    v, _ = CACHE.una_vez_json(f"torm:cerca:{id_de(ahora)}:{lat0:.3f},{lon0:.3f}", TTL_MARCO, calcular, espera=60)
    return v


# ---------------------------------------------------------------------------------------------- radar de «Mi lugar»
CELDA_NUBE, CELDA_RAYO = 10, 5           # km: celdas del radar (liviano: cientos de números, no la imagen)


def a_km(lat0, lon0, lat, lon):
    """(x, y) en km: x al este y y al norte del punto."""
    return (lon - lon0) * 111.32 * math.cos(math.radians(lat0)), (lat - lat0) * 110.57


def celdas_nubes(clases, lat0, lon0, radio=R_LEJOS):
    """Nubes de tormenta a ≤ radio km en celdas de CELDA_NUBE km: [[x_km, y_km, clase]] con la clase más fuerte."""
    px0, py0 = pixel_de(lat0, lon0)
    km_px = 40075 * math.cos(math.radians(lat0)) / (TES * 2 ** Z)
    m = int(radio / km_px) + 2
    celdas = {}
    for py in range(max(0, int(py0) - m), min(ALTO, int(py0) + m + 1)):
        lat = lat_de(Y0 * TES + py + 0.5)
        fila = py * ANCHO
        for px in range(max(0, int(px0) - m), min(ANCHO, int(px0) + m + 1)):
            c = clases[fila + px]
            if not c:
                continue
            x, y = a_km(lat0, lon0, lat, lon_de(X0 * TES + px + 0.5))
            if math.hypot(x, y) > radio:
                continue
            k = (round(x / CELDA_NUBE), round(y / CELDA_NUBE))
            if c > celdas.get(k, 0):
                celdas[k] = c
    return [[kx * CELDA_NUBE, ky * CELDA_NUBE, c] for (kx, ky), c in sorted(celdas.items())]


def celdas_rayos(puntos, lat0, lon0, radio=R_LEJOS):
    """Destellos a ≤ radio km en celdas de CELDA_RAYO km: [[x_km, y_km, minutos del más reciente]]."""
    celdas = {}
    for lat, lon, hace in puntos:
        x, y = a_km(lat0, lon0, lat, lon)
        if math.hypot(x, y) > radio:
            continue
        k = (round(x / CELDA_RAYO), round(y / CELDA_RAYO))
        celdas[k] = min(hace, celdas.get(k, hace))
    return [[kx * CELDA_RAYO, ky * CELDA_RAYO, m] for (kx, ky), m in sorted(celdas.items())]


def radar_nubes(lat0, lon0):
    """Las celdas de nubes de la imagen más reciente (caché por imagen)."""
    t = marcos()[-1]
    v, _ = CACHE.una_vez_json(f"torm:radar:{id_de(t)}:{lat0:.3f},{lon0:.3f}", TTL_MARCO,
                              lambda: {"t": _fmt(t), "nubes": celdas_nubes(clases_marco(t), lat0, lon0)}, espera=60)
    return v


# ---------------------------------------------------------------------------------------------- hacia dónde van
PASO_GRUPO = 3            # px por celda al agrupar (unos 7 km): rápido y suficiente para seguir una tormenta
MIN_CELDAS = 4            # grupos más chicos (≈ 200 km²) no se siguen: se mueven «al azar» al crecer o deshacerse
MAX_KM_H = 100            # más rápido que esto es un emparejamiento equivocado, no una tormenta
MIN_KM_H = 6              # más lento: casi quieta, no se dibuja flecha
MAX_FLECHAS = 30


def grupos(clases):
    """Grupos de nube de tormenta (8 vecinos) en una grilla de PASO_GRUPO px: [(lat, lon, celdas, clase máxima)]."""
    w, h = ANCHO // PASO_GRUPO, ALTO // PASO_GRUPO
    g = bytearray(w * h)
    for y in range(h):
        fila = (y * PASO_GRUPO + PASO_GRUPO // 2) * ANCHO
        for x in range(w):
            g[y * w + x] = clases[fila + x * PASO_GRUPO + PASO_GRUPO // 2]
    visto = bytearray(w * h)
    out = []
    for ini in range(w * h):
        if not g[ini] or visto[ini]:
            continue
        pila, sx, sy, n, cmax = [ini], 0, 0, 0, 0
        visto[ini] = 1
        while pila:
            i = pila.pop()
            x, y = i % w, i // w
            sx, sy, n, cmax = sx + x, sy + y, n + 1, max(cmax, g[i])
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < w and 0 <= yy < h:
                        k = yy * w + xx
                        if g[k] and not visto[k]:
                            visto[k] = 1
                            pila.append(k)
        if n >= MIN_CELDAS:
            cx, cy = (sx / n + 0.5) * PASO_GRUPO, (sy / n + 0.5) * PASO_GRUPO
            out.append((lat_de(Y0 * TES + cy), lon_de(X0 * TES + cx), n, cmax))
    return out


def emparejar(ahora, antes, minutos):
    """Cada grupo de ahora con el más cercano de antes (tamaño parecido). Devuelve las flechas: de dónde está a dónde
    estaría en 1 h si sigue igual, con su velocidad y rumbo."""
    flechas = []
    for lat, lon, n, c in sorted(ahora, key=lambda g: -g[2])[:MAX_FLECHAS]:
        mejor = None
        for la, lo, m, _ in antes:
            if not (n / 3 <= m <= n * 3):
                continue
            d = _km(lat, lon, la, lo)
            if mejor is None or d < mejor[0]:
                mejor = (d, la, lo)
        if mejor is None:
            continue
        km_h = mejor[0] * 60 / minutos
        if not (MIN_KM_H <= km_h <= MAX_KM_H):
            continue
        f = 60 / minutos                                            # de 30 min a 1 h
        hacia = (lat + (lat - mejor[1]) * f, lon + (lon - mejor[2]) * f)
        flechas.append({"desde": [round(lat, 3), round(lon, 3)], "hacia": [round(hacia[0], 3), round(hacia[1], 3)],
                        "km_h": round(km_h), "rumbo": _rumbo(mejor[1], mejor[2], lat, lon), "clase": c})
    return flechas


def movimiento():
    """Flechas de la imagen más reciente contra la de 30 min antes (caché por imagen)."""
    ts = marcos()
    ahora, antes = ts[-1], ts[-4]
    minutos = (ahora - antes).total_seconds() / 60
    v, _ = CACHE.una_vez_json(f"torm:mov:{id_de(ahora)}", TTL_MARCO,
                              lambda: {"t": _fmt(ahora), "desde_min": round(minutos),
                                       "flechas": emparejar(grupos(clases_marco(ahora)), grupos(clases_marco(antes)), minutos)},
                              espera=60)
    return v


# ---------------------------------------------------------------------------------------------- rayos (GLM)
THREDDS = "https://thredds.ucar.edu/thredds"
CATALOGO = THREDDS + "/catalog/satellite/goes/east/grb/GLM/LCFA/current/catalog.xml"
VENTANA_RAYOS = 30                        # minutos
MAX_PUNTOS = 3000
RE_GLM = re.compile(r'urlPath="(satellite/goes/east/grb/GLM/LCFA/current/'
                    r'(OR_GLM-L2-LCFA_G\d+_s(\d{4})(\d{3})(\d{2})(\d{2})(\d{2})\d*_e\d+_c\d+\.nc))"')


def leer_glm_ascii(texto):
    """[(lat, lon)] de la respuesta OPeNDAP .ascii?flash_lat,flash_lon."""
    def serie(nombre):
        m = re.search(nombre + r"\[(\d+)\][ \t]*\r?\n([^\r\n]*)", texto)
        if not m:
            raise ValueError(f"falta {nombre}")
        n = int(m.group(1))
        if n == 0:
            return []
        vals = [float(x) for x in m.group(2).split(",") if x.strip()]
        if len(vals) != n:
            raise ValueError(f"{nombre}: {len(vals)} valores de {n}")
        return vals
    return list(zip(serie("flash_lat"), serie("flash_lon")))


def archivos_glm(texto_catalogo, ahora, minutos=VENTANA_RAYOS):
    """[(ruta, nombre, inicio)] de los archivos de los últimos `minutos`, del más viejo al más nuevo."""
    out = []
    for ruta, nombre, a, dj, h, m, s in RE_GLM.findall(texto_catalogo):
        t = (dt.datetime(int(a), 1, 1, tzinfo=dt.timezone.utc)
             + dt.timedelta(days=int(dj) - 1, hours=int(h), minutes=int(m), seconds=int(s)))
        if ahora - dt.timedelta(minutes=minutos) <= t <= ahora + dt.timedelta(minutes=2):
            out.append((ruta, nombre, t))
    return sorted(set(out), key=lambda x: x[2])


def _en_mosaico(lat, lon):
    (s, o), (n, e) = LIMITES
    return s <= lat <= n and o <= lon <= e


def _glm_archivo(ruta):
    texto = _bajar(f"{THREDDS}/dodsC/{ruta}.ascii?flash_lat,flash_lon", timeout=20).decode("utf-8", "replace")
    return [[round(la, 3), round(lo, 3)] for la, lo in leer_glm_ascii(texto) if _en_mosaico(la, lo)]


def rayos(lat0, lon0):
    """Destellos de los últimos 30 min en el área del mosaico. Cada archivo se baja una sola vez (queda 45 min en
    la caché); el resumen se rehace cada 2 min."""
    def armar():
        ahora = dt.datetime.now(dt.timezone.utc)
        lista = archivos_glm(_bajar(CATALOGO, timeout=20).decode("utf-8", "replace"), ahora)
        if not lista:
            raise ValueError("el catálogo de GLM no trae archivos recientes")
        faltan = [x for x in lista if CACHE.get("torm:glm:" + x[1]) is None]

        def una(x):
            try:
                return x, _glm_archivo(x[0])
            except Exception as e:
                print(f"  [aviso] GLM {x[1]}: {e.__class__.__name__}")
                return x, None
        with ThreadPoolExecutor(4) as ex:
            for x, pts in ex.map(una, faltan):
                if pts is not None:
                    CACHE.set("torm:glm:" + x[1], json.dumps(pts, separators=(",", ":")).encode(), 45 * 60)
        puntos, leidos = [], 0
        for _, nombre, t in lista:
            v = CACHE.get("torm:glm:" + nombre)
            if v is None:
                continue
            leidos += 1
            hace = max(0, round((ahora - t).total_seconds() / 60))
            puntos.extend([la, lo, hace] for la, lo in json.loads(v))
        if not leidos:
            raise ValueError("no se pudo leer ningún archivo de GLM")
        puntos = puntos[-MAX_PUNTOS:]
        cerca_ = [p for p in puntos if _km(lat0, lon0, p[0], p[1]) <= R_RAYOS and p[2] <= 15]
        dmin = min((_km(lat0, lon0, p[0], p[1]) for p in puntos if p[2] <= 15), default=None)
        return {"desde_min": VENTANA_RAYOS, "n": len(puntos), "cerca_n": len(cerca_),
                "cerca_km": round(dmin, 1) if dmin is not None else None,
                "completo": leidos == len(lista), "t": _fmt(lista[-1][2]), "puntos": puntos}
    v, viejo = CACHE.una_vez_json(f"torm:rayos:{lat0:.3f},{lon0:.3f}", 120, armar, espera=60)
    return dict(v, viejo=viejo)


# ---------------------------------------------------------------------------------------------- lluvia (Open-Meteo)
def lluvia_hora(lat0, lon0):
    """Lluvia de las próximas 2 h en tramos de 15 min (modelo Open-Meteo, no medición). Caché de 15 min."""
    def bajar():
        url = (f"https://api.open-meteo.com/v1/forecast?latitude={lat0:.3f}&longitude={lon0:.3f}"
               "&minutely_15=precipitation&forecast_minutely_15=8&timezone=GMT")
        j = json.loads(_bajar(url, timeout=20))
        m = j["minutely_15"]
        serie = [{"t": t + ":00Z", "mm": round(v or 0, 1)} for t, v in zip(m["time"], m["precipitation"])][:8]
        hora = serie[:4]
        return {"proxima_hora_mm": round(sum(x["mm"] for x in hora), 1),
                "max_15_mm": max((x["mm"] for x in hora), default=0), "serie": serie}
    v, viejo = CACHE.una_vez_json(f"torm:lluvia:{lat0:.3f},{lon0:.3f}", 15 * 60, bajar, espera=30)
    return dict(v, viejo=viejo)


# ---------------------------------------------------------------------------------------------- en segundo plano
_curso = set()
_curso_l = threading.Lock()


def en_fondo(nombre, fn):
    """Corre fn en un hilo, una sola vez a la vez por nombre."""
    with _curso_l:
        if nombre in _curso:
            return
        _curso.add(nombre)

    def correr():
        try:
            fn()
        except Exception as e:
            print(f"  [aviso] tormentas: {nombre}: {e.__class__.__name__}: {e}")
        finally:
            with _curso_l:
                _curso.discard(nombre)
    threading.Thread(target=correr, name=nombre, daemon=True).start()


def rayos_sin_esperar(lat0, lon0):
    """Los rayos de la caché sin hacer esperar a nadie: la primera lectura (unos 90 archivos) tarda ~20 s. Si no
    hay una copia fresca, se rehace en segundo plano y mientras tanto se da la vieja o {"calculando": true}."""
    clave = f"torm:rayos:{lat0:.3f},{lon0:.3f}"
    v = CACHE.get(clave)
    if v is not None:
        return dict(json.loads(v), viejo=False)
    en_fondo(clave, lambda: rayos(lat0, lon0))
    v = CACHE.get(clave + VIEJO)
    return dict(json.loads(v), viejo=True) if v is not None else {"calculando": True}


def armar_marcos(ts):
    """Arma los PNG que falten, del más nuevo al más viejo (unos segundos de CPU cada uno)."""
    for t in reversed(ts):
        if CACHE.get(f"torm:png:{id_de(t)}") is None:
            try:
                png_marco(t)
            except SinDato:
                continue


def marcos_listos(ts):
    """Las horas cuyo PNG ya está armado (más la más reciente, que sale al instante de sus clases). Las que faltan se
    arman en segundo plano: nadie espera a que se armen las 12 para ver la animación."""
    listos = [t for t in ts if CACHE.get(f"torm:png:{id_de(t)}") is not None]
    if ts and ts[-1] not in listos:
        png_marco(ts[-1])
        listos.append(ts[-1])
    if len(listos) < len(ts):
        en_fondo("torm:armar", lambda: armar_marcos(ts))
    return listos, len(ts) - len(listos)


def _marcos_de_la_vista():
    listos, faltan = marcos_listos(marcos())
    return {"marcos": [{"id": id_de(t), "t": _fmt(t)} for t in listos], "preparando": faltan}


DEMANDA = "torm:demanda"
MINUTOS_DEMANDA = 30


def marcar_demanda():
    CACHE.set(DEMANDA, b"1", MINUTOS_DEMANDA * 60)


def hilo(lat0, lon0, cada=60):
    """Mientras alguien miró «Tormentas» en los últimos 30 min, mantiene la caché al día (la imagen nueva, el aviso,
    los rayos y la lluvia), así nadie espera la descarga. Sin nadie mirando no baja nada."""
    while True:
        try:
            if CACHE.get(DEMANDA) is not None:
                rayos(lat0, lon0)
                cerca(lat0, lon0)
                movimiento()
                radar_nubes(lat0, lon0)
                armar_marcos(marcos())
                lluvia_hora(lat0, lon0)
        except Exception as e:
            print(f"  [aviso] tormentas: mantener la caché: {e.__class__.__name__}: {e}")
        time.sleep(cada)


# ---------------------------------------------------------------------------------------------- respuestas
def ultima_buena(nombre, fn):
    """El resultado de fn y, si falla, el último bueno (de hasta 6 h) con viejo=True. La clave es fija (no depende de
    la hora de la imagen): cuando la imagen nueva todavía no se puede armar, la app sigue mostrando la anterior en
    vez de «sin datos»."""
    clave = "torm:ultima:" + nombre
    try:
        v = fn()
    except Exception:
        guardado = CACHE.get(clave)
        if guardado is None:
            raise
        return dict(json.loads(guardado), viejo=True)
    CACHE.set(clave, json.dumps(v, separators=(",", ":")).encode(), TTL_VIEJO)
    return dict(v, viejo=False)


def _seguro(fn, *a):
    """Cada parte falla sola: si una fuente está caída, las otras se muestran igual."""
    try:
        return fn(*a)
    except Exception as e:
        quien = a[0] if a and isinstance(a[0], str) else fn.__name__
        print(f"  [aviso] tormentas: {quien}: {e.__class__.__name__}: {e}")
        return None


def resumen(lat0, lon0, puntos=False):
    """Lo liviano para la ficha de «Mi lugar»: el aviso, los rayos cerca (sin los puntos, salvo puntos=True), la
    lluvia de la próxima hora y el radar (nubes y rayos a ≤ 150 km en celdas, en km desde el centro)."""
    lugar = f"{lat0:.3f},{lon0:.3f}"
    r = _seguro(rayos_sin_esperar, lat0, lon0)
    nubes = _seguro(ultima_buena, "radar:" + lugar, lambda: radar_nubes(lat0, lon0))
    radar = None if nubes is None else {
        "radio_km": R_LEJOS, "t": nubes["t"], "nubes": nubes["nubes"],
        "rayos": celdas_rayos(r["puntos"], lat0, lon0) if r and "puntos" in r else None}
    if r and not puntos:
        r = {k: v for k, v in r.items() if k != "puntos"}
    return {"cerca": _seguro(ultima_buena, "cerca:" + lugar, lambda: cerca(lat0, lon0)), "rayos": r,
            "lluvia": _seguro(lluvia_hora, lat0, lon0), "radar": radar,
            "centro": [lat0, lon0], "radios": {"encima": R_ENCIMA, "cerca": R_CERCA, "lejos": R_LEJOS, "rayos": R_RAYOS}}


def completo(lat0, lon0):
    """La vista «Tormentas»: el resumen con los rayos, las horas del mosaico, sus límites y la leyenda."""
    out = resumen(lat0, lon0, puntos=True)
    m = _seguro(ultima_buena, "marcos", _marcos_de_la_vista) or {"marcos": [], "preparando": 0}
    out["movimiento"] = _seguro(ultima_buena, "movimiento", movimiento)
    out["mosaico"] = {"limites": LIMITES, "clases": CLASES, "preparando": 0 if m.get("viejo") else m["preparando"],
                      "marcos": m["marcos"]}
    return out
