"""Tormentas (spec 020): PNG con la biblioteca estándar, clasificación de nubes, aviso «cerca», rayos GLM, caché de
una sola descarga y las rutas públicas. Sin red: las descargas a NASA, UCAR y Open-Meteo se reemplazan."""
import datetime as dt
import json
import math
import random
import struct
import threading
import time
import unittest
import zlib

import apoyo
from apoyo import Cliente

apoyo.arrancar()

import cache          # noqa: E402
import servidor       # noqa: E402
import tormentas as tm  # noqa: E402

AHORA = dt.datetime.now(dt.timezone.utc).replace(second=0, microsecond=0)
ULTIMO = AHORA - dt.timedelta(minutes=AHORA.minute % 10 + 20)


def png_rgba(w, h, px):
    """PNG RGBA que usa los 5 filtros (uno por fila, en ciclo), para probar el decodificador."""
    filas, prev = [], bytearray(w * 4)
    for y in range(h):
        fila = px[y * w * 4:(y + 1) * w * 4]
        f = y % 5
        out = bytearray(len(fila))
        for k, v in enumerate(fila):
            a = fila[k - 4] if k >= 4 else 0
            b = prev[k]
            c = prev[k - 4] if k >= 4 else 0
            pred = [0, a, b, (a + b) >> 1, tm._paeth(a, b, c)][f]
            out[k] = (v - pred) & 255
        filas.append(bytes([f]) + bytes(out))
        prev = fila
    return (tm.FIRMA + tm._trozo(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + tm._trozo(b"IDAT", zlib.compress(b"".join(filas))) + tm._trozo(b"IEND", b""))


def tesela_con_tormenta(x, y, centro_lat, centro_lon):
    """Fondo gris 0x66 (el mismo gris que -75 °C: no debe contar) y, en la tesela del centro, una tormenta: núcleo
    gris oscuro rodeado por un anillo rojo y un borde verde."""
    px = bytearray(b"\x66\x66\x66\xff" * (tm.TES * tm.TES))
    cx, cy = tm.pixel_de(centro_lat, centro_lon)
    cx, cy = cx - (x - tm.X0) * tm.TES, cy - (y - tm.Y0) * tm.TES
    for j in range(tm.TES):
        for i in range(tm.TES):
            r = math.hypot(i - cx, j - cy)
            color = (b"\x36\x36\x36" if r < 3 else b"\x99\x00\x00" if r < 6 else b"\x00\xff\x00" if r < 8 else None)
            if color:
                k = (j * tm.TES + i) * 4
                px[k:k + 3] = color
    return png_rgba(tm.TES, tm.TES, px)


def red_falsa(tormenta_en, rayos_en):
    """Reemplaza tormentas._bajar: GIBS (HEAD y teselas), el catálogo y los archivos de GLM, y Open-Meteo."""
    pedidos, teselas = [], {}

    def bajar(url, timeout=20, metodo="GET"):
        pedidos.append(url)
        if url.startswith("https://gibs."):
            if metodo == "HEAD":
                return {"Layer-Time-Actual": tm._fmt(ULTIMO)}
            partes = url.rstrip(".png").split("/")
            y, x = int(partes[-2]), int(partes[-1])
            if (x, y) not in teselas:
                teselas[(x, y)] = tesela_con_tormenta(x, y, *tormenta_en)
            return teselas[(x, y)]
        if url == tm.CATALOGO:
            filas = []
            for k in range(3):
                t = AHORA - dt.timedelta(minutes=2 + k)
                s = t.strftime("%Y%j%H%M%S") + "0"
                filas.append(f'<dataset urlPath="satellite/goes/east/grb/GLM/LCFA/current/'
                             f'OR_GLM-L2-LCFA_G19_s{s}_e{s}_c{s}.nc"/>')
            viejo = (AHORA - dt.timedelta(hours=2)).strftime("%Y%j%H%M%S") + "0"
            filas.append(f'<dataset urlPath="satellite/goes/east/grb/GLM/LCFA/current/'
                         f'OR_GLM-L2-LCFA_G19_s{viejo}_e{viejo}_c{viejo}.nc"/>')
            return "\n".join(filas).encode()
        if "/dodsC/" in url:
            lat, lon = rayos_en
            return (f"Dataset {{ }} x;\n---\nflash_lat[3]\n{lat}, 45.0, {lat + 0.01}\n\n"
                    f"flash_lon[3]\n{lon}, -100.0, {lon}\n").encode()
        if url.startswith("https://api.open-meteo.com/"):
            ts = [(AHORA + dt.timedelta(minutes=15 * k)).strftime("%Y-%m-%dT%H:%M") for k in range(8)]
            return json.dumps({"minutely_15": {"time": ts, "precipitation": [0.5, 1.2, 0, 0.3, 0, 0, None, 0]}}).encode()
        raise AssertionError("descarga inesperada: " + url)
    return bajar, pedidos


def caché_limpia():
    cache.CACHE.mem = cache._Memoria()


class Png(unittest.TestCase):
    def test_decodifica_los_cinco_filtros(self):
        rnd = random.Random(7)
        px = bytes(rnd.randrange(256) for _ in range(9 * 7 * 4))
        w, h, bpp, out = tm.png_pixeles(png_rgba(9, 7, px))
        self.assertEqual((w, h, bpp, out), (9, 7, 4, px))

    def test_png_de_paleta_se_puede_leer(self):
        datos = tm.png_paleta(3, 2, bytes([0, 1, 2, 3, 0, 1]), [(0, 0, 0, 0), (1, 2, 3, 10), (4, 5, 6, 20), (7, 8, 9, 30)])
        self.assertTrue(datos.startswith(tm.FIRMA))
        self.assertIn(b"PLTE", datos)
        self.assertIn(b"tRNS", datos)

    def test_rechaza_lo_que_no_es_png(self):
        with self.assertRaises(ValueError):
            tm.png_pixeles(b"no soy un png")


class Clasificacion(unittest.TestCase):
    def test_colores_de_la_tabla(self):
        self.assertEqual(tm.clase_de_temp(-30), 0)
        self.assertEqual(tm.clase_de_temp(-45), 1)
        self.assertEqual(tm.clase_de_temp(-60), 2)
        self.assertEqual(tm.clase_de_temp(-75), 3)
        self.assertEqual(tm.temp_de_color((0xff, 0x00, 0x00)), -61)
        self.assertEqual(tm.temp_de_color((0xfd, 0x02, 0x01)), -61)      # remuestreado: el más parecido
        self.assertEqual(tm.temp_de_color((0x00, 0xff, 0xff)), -19)      # cian: cálido, no cuenta
        self.assertIsNone(tm.temp_de_color((0x40, 0x80, 0x80)))          # mezcla rara: no se parece a nada

    def test_gris_solo_cuenta_si_esta_encerrado_por_nube_fria(self):
        w = h = 7
        cl = bytearray(w * h)                                        # 0: fondo
        for y in range(1, 6):
            for x in range(1, 6):
                cl[y * w + x] = 2                                   # anillo rojo
        cl[3 * w + 3] = tm.GRIS_DUDOSO                              # núcleo encerrado
        cl[0] = tm.GRIS_DUDOSO                                      # gris del fondo, pegado al cielo
        cl[6 * w + 3] = tm.GRIS_DUDOSO                              # gris pegado al anillo pero también al fondo
        out = tm.resolver_grises(cl, w, h)
        self.assertEqual(out[3 * w + 3], 3)
        self.assertEqual(out[0], 0)
        self.assertEqual(out[6 * w + 3], 0)
        self.assertNotIn(tm.GRIS_DUDOSO, out)

    def test_aviso_distancia_y_rumbo(self):
        lat0, lon0 = -2.08, -79.68
        cl = bytearray(tm.ANCHO * tm.ALTO)
        x, y = tm.pixel_de(lat0 - 0.25, lon0)                       # unos 28 km al sur
        cl[int(y) * tm.ANCHO + int(x)] = 2
        a = tm.analizar(bytes(cl), lat0, lon0)
        self.assertEqual(a["rumbo"], "s")
        self.assertAlmostEqual(a["dist_km"], 28, delta=3)
        self.assertEqual(a["intensidad"], 2)
        self.assertEqual(tm.estado_de(a["dist_km"]), "cerca")
        self.assertEqual(tm.analizar(bytes(tm.ANCHO * tm.ALTO), lat0, lon0)["dist_km"], None)
        self.assertEqual([tm.estado_de(d) for d in (None, 5, 30, 100, 400)], ["sin", "encima", "cerca", "lejos", "sin"])


class Glm(unittest.TestCase):
    def test_lee_la_respuesta_opendap(self):
        texto = ("Dataset {\n    Float32 flash_lat[number_of_flashes = 2];\n} x;\n---\n"
                 "flash_lat[2]\n-2.1, 10.5\n\nflash_lon[2]\n-79.7, -60.25\n")
        self.assertEqual(tm.leer_glm_ascii(texto), [(-2.1, -79.7), (10.5, -60.25)])
        self.assertEqual(tm.leer_glm_ascii("flash_lat[0]\n\nflash_lon[0]\n\n"), [])
        with self.assertRaises(ValueError):
            tm.leer_glm_ascii("flash_lat[3]\n1, 2\n\nflash_lon[3]\n1, 2, 3\n")

    def test_solo_los_archivos_recientes(self):
        ahora = dt.datetime(2026, 11, 12, 3, 0, tzinfo=dt.timezone.utc)
        cat = ('urlPath="satellite/goes/east/grb/GLM/LCFA/current/OR_GLM-L2-LCFA_G19_s20263160250000_e1_c1.nc"\n'
               'urlPath="satellite/goes/east/grb/GLM/LCFA/current/OR_GLM-L2-LCFA_G19_s20263160159400_e1_c1.nc"\n'
               'urlPath="otra/cosa.nc"')
        lista = tm.archivos_glm(cat, ahora, minutos=30)
        self.assertEqual(len(lista), 1)
        self.assertEqual(lista[0][2], dt.datetime(2026, 11, 12, 2, 50, tzinfo=dt.timezone.utc))


class Radar(unittest.TestCase):
    def test_celdas_de_rayos(self):
        lat0, lon0 = -2.1, -79.7
        pts = [[lat0 + 0.1, lon0, 12], [lat0 + 0.101, lon0, 3], [lat0, lon0 + 2.5, 1]]     # el último, a ~280 km
        self.assertEqual(tm.celdas_rayos(pts, lat0, lon0), [[0, 10, 3]])

    def test_a_km(self):
        x, y = tm.a_km(-2.0, -79.0, -2.0, -78.0)
        self.assertAlmostEqual(x, 111.2, delta=0.5)
        self.assertAlmostEqual(y, 0)


class Movimiento(unittest.TestCase):
    def test_grupos_y_flecha_hacia_el_este(self):
        def mosaico(cx):
            cl = bytearray(tm.ANCHO * tm.ALTO)
            for y in range(400, 412):
                for x in range(cx, cx + 12):
                    cl[y * tm.ANCHO + x] = 2
            return bytes(cl)
        antes, ahora = tm.grupos(mosaico(300)), tm.grupos(mosaico(306))   # 6 px ≈ 14,6 km en 30 min
        self.assertEqual((len(antes), len(ahora)), (1, 1))
        f = tm.emparejar(ahora, antes, 30)
        self.assertEqual(len(f), 1)
        self.assertEqual(f[0]["rumbo"], "e")
        self.assertAlmostEqual(f[0]["km_h"], 29, delta=3)
        self.assertGreater(f[0]["hacia"][1], f[0]["desde"][1])

    def test_sin_flecha_si_esta_quieta_o_salta_lejos(self):
        g = [(0.0, 0.0, 10, 2)]
        self.assertEqual(tm.emparejar([(0.0, 0.01, 10, 2)], g, 30), [])     # ~1 km en 30 min: quieta
        self.assertEqual(tm.emparejar([(0.0, 1.0, 10, 2)], g, 30), [])      # ~111 km en 30 min: no es la misma
        self.assertEqual(tm.emparejar([(0.0, 0.1, 40, 2)], g, 30), [])      # 4 veces más grande: no es la misma


class CacheUnaVez(unittest.TestCase):
    def setUp(self):
        self.c = cache.Cache(url="")

    def test_muchas_peticiones_una_descarga(self):
        llamadas = []

        def lento():
            llamadas.append(1)
            time.sleep(0.3)
            return b"dato"
        res = []
        hilos = [threading.Thread(target=lambda: res.append(self.c.una_vez("k", 60, lento))) for _ in range(8)]
        for h in hilos:
            h.start()
        for h in hilos:
            h.join()
        self.assertEqual(len(llamadas), 1)
        self.assertEqual(res, [(b"dato", False)] * 8)

    def test_si_falla_usa_la_copia_vieja(self):
        self.c.una_vez("k", 1, lambda: b"bueno")
        self.c.mem.delete(cache.PREFIJO + "k")                        # venció la copia fresca

        def falla():
            raise OSError("sin internet")
        self.assertEqual(self.c.una_vez("k", 60, falla), (b"bueno", True))
        with self.assertRaises(cache.SinDato):
            self.c.una_vez("otra", 60, falla)

    def test_un_fallo_no_se_reintenta_enseguida(self):
        llamadas = []

        def falla():
            llamadas.append(1)
            raise OSError("servicio caído")
        for _ in range(5):
            with self.assertRaises(cache.SinDato):
                self.c.una_vez("caido", 60, falla, ttl_fallo=60)
        self.assertEqual(len(llamadas), 1)                             # una visita por minuto, no una por petición
        self.c.mem.delete(cache.PREFIJO + "caido" + cache.FALLO)       # venció la marca
        self.assertEqual(self.c.una_vez("caido", 60, lambda: b"volvio"), (b"volvio", False))

    def test_redis_caido_no_rompe(self):
        c = cache.Cache(url="redis://127.0.0.1:1/0")                 # nadie escucha ahí
        self.assertEqual(c.una_vez("k", 60, lambda: b"x"), (b"x", False))
        self.assertEqual(c.get("k"), b"x")                             # quedó en la memoria del proceso


class Rutas(unittest.TestCase):
    def setUp(self):
        caché_limpia()
        self.lat0, self.lon0 = servidor.centro_canton()
        # tormenta de unos 20 km de radio con el centro a unos 44 km al este (el borde a ~25 km) y rayos casi encima
        self.bajar, self.pedidos = red_falsa((self.lat0, self.lon0 + 0.40), (self.lat0 + 0.05, self.lon0))
        self._orig = tm._bajar, tm.armar_marcos
        tm._bajar = self.bajar
        tm.armar_marcos = lambda ts: None          # la animación se arma aparte (test_animacion_en_segundo_plano)

    def tearDown(self):
        # que terminen los hilos de los rayos antes de devolver la red
        for _ in range(100):
            if not tm._curso:
                break
            time.sleep(0.05)
        tm._bajar, tm.armar_marcos = self._orig
        caché_limpia()

    def esperar_rayos(self, c):
        for _ in range(100):
            _, j, _ = c.get("/api/tormentas", csrf=False)
            if j["rayos"] and not j["rayos"].get("calculando"):
                return j
            time.sleep(0.05)
        self.fail("los rayos no terminaron")

    def test_vista_completa(self):
        c = Cliente()
        codigo, j, _ = c.get("/api/tormentas", csrf=False)
        self.assertEqual(codigo, 200, j)
        self.assertEqual(j["cerca"]["estado"], "cerca")
        self.assertEqual(j["cerca"]["rumbo"], "e")
        self.assertAlmostEqual(j["cerca"]["dist_km"], 25, delta=4)
        self.assertEqual(j["cerca"]["intensidad"], 3)                  # el núcleo gris encerrado (a ~37 km) cuenta
        # la más reciente sale enseguida; las otras 11 se arman en segundo plano
        self.assertEqual([m["id"] for m in j["mosaico"]["marcos"]], [tm.id_de(ULTIMO)])
        self.assertEqual(j["mosaico"]["preparando"], tm.N_MARCOS - 1)
        self.assertEqual(j["mosaico"]["limites"], tm.LIMITES)
        self.assertEqual(j["lluvia"]["proxima_hora_mm"], 2.0)
        self.assertEqual(j["movimiento"]["flechas"], [])                    # la tormenta sintética no se mueve
        j = self.esperar_rayos(c)
        # 2 por archivo × 3 archivos recientes (el de 45° N y -100° queda fuera del mosaico; el de hace 2 h, fuera)
        self.assertEqual(j["rayos"]["cerca_n"], 6)
        self.assertEqual(len(j["rayos"]["puntos"]), 6)
        self.assertTrue(all(len(p) == 3 for p in j["rayos"]["puntos"]))

    def test_animacion_en_segundo_plano(self):
        armadas = []

        def armar_rapido(ts):
            for t in ts:
                armadas.append(t)
                cache.CACHE.set(f"torm:png:{tm.id_de(t)}", b"png", 60)
        tm.armar_marcos = armar_rapido
        c = Cliente()
        _, j, _ = c.get("/api/tormentas", csrf=False)
        self.assertGreater(j["mosaico"]["preparando"], 0)
        for _ in range(100):
            _, j, _ = c.get("/api/tormentas", csrf=False)
            if not j["mosaico"]["preparando"]:
                break
            time.sleep(0.05)
        self.assertEqual(len(j["mosaico"]["marcos"]), tm.N_MARCOS)
        ids = [m["id"] for m in j["mosaico"]["marcos"]]
        self.assertEqual(ids, sorted(ids))                              # de la más vieja a la más nueva

    def test_resumen_sin_puntos(self):
        c = Cliente()
        self.esperar_rayos(c)
        codigo, j, _ = c.get("/api/tormentas/resumen", csrf=False)
        self.assertEqual(codigo, 200)
        self.assertNotIn("mosaico", j)
        self.assertNotIn("puntos", j["rayos"])
        self.assertEqual(j["rayos"]["cerca_n"], 6)
        # radar: la tormenta sintética está al este (x > 0, y ≈ 0) y los rayos casi encima, al norte
        radar = j["radar"]
        self.assertEqual(radar["radio_km"], tm.R_LEJOS)
        self.assertTrue(radar["nubes"])
        self.assertTrue(all(math.hypot(x, y) <= tm.R_LEJOS + tm.CELDA_NUBE and x > 0 for x, y, _ in radar["nubes"]))
        self.assertEqual(max(c for _, _, c in radar["nubes"]), 3)
        self.assertTrue(radar["rayos"] and all(abs(x) <= 5 and 0 <= y <= 10 for x, y, _ in radar["rayos"]))

    def test_una_sola_descarga_para_muchos(self):
        c = Cliente()
        for _ in range(5):
            c.get("/api/tormentas", csrf=False)
        teselas = [u for u in self.pedidos if u.startswith("https://gibs.") and "/default/default/" not in u]
        # 9 teselas de la última imagen y 9 de la de 30 min antes (la tendencia), una sola vez
        self.assertEqual(len(teselas), 18)
        self.assertEqual(sum(u.startswith("https://api.open-meteo.com/") for u in self.pedidos), 1)

    def test_si_la_hora_nueva_no_esta_completa_usa_la_anterior(self):
        import urllib.error
        bajar = self.bajar

        def sin_la_nueva(url, timeout=20, metodo="GET"):
            if tm._fmt(ULTIMO) in url and metodo == "GET":
                raise urllib.error.HTTPError(url, 404, "Not Found", None, None)
            return bajar(url, timeout, metodo)
        tm._bajar = sin_la_nueva
        c = Cliente()
        codigo, j, _ = c.get("/api/tormentas", csrf=False)
        self.assertEqual(codigo, 200)
        self.assertEqual(j["mosaico"]["marcos"][-1]["id"], tm.id_de(ULTIMO - dt.timedelta(minutes=10)))
        self.assertEqual(j["cerca"]["estado"], "cerca")
        antes = len(self.pedidos)
        c.get("/api/tormentas", csrf=False)                            # la nueva no se vuelve a pedir enseguida
        self.assertEqual(len(self.pedidos), antes)

    def test_si_el_satelite_falla_queda_la_ultima_respuesta_buena(self):
        c = Cliente()
        _, bueno, _ = c.get("/api/tormentas", csrf=False)
        self.assertEqual(bueno["cerca"]["estado"], "cerca")
        # llega otra hora (otra clave de imagen) y el satélite deja de responder: no «sin datos», la anterior
        sin_las_ultimas_buenas = [k for k in list(cache.CACHE.mem._d) if ":ultima:" not in k]
        for k in sin_las_ultimas_buenas:
            cache.CACHE.mem.delete(k)

        def caida(url, timeout=20, metodo="GET"):
            raise OSError("sin internet")
        tm._bajar = caida
        codigo, j, _ = c.get("/api/tormentas", csrf=False)
        self.assertEqual(codigo, 200)
        self.assertEqual(j["cerca"]["estado"], "cerca")
        self.assertTrue(j["cerca"]["viejo"])
        self.assertTrue(j["radar"]["nubes"])
        self.assertEqual([m["id"] for m in j["mosaico"]["marcos"]], [m["id"] for m in bueno["mosaico"]["marcos"]])
        _, r, _ = c.get("/api/tormentas/resumen", csrf=False)
        self.assertTrue(r["cerca"]["viejo"])

    def test_si_faltan_varias_horas_usa_la_ultima_completa(self):
        import urllib.error
        bajar = self.bajar
        faltan = {tm._fmt(ULTIMO - dt.timedelta(minutes=10 * k)) for k in range(3)}    # las 3 últimas, en 404

        def sin_las_nuevas(url, timeout=20, metodo="GET"):
            if metodo == "GET" and any(f in url for f in faltan):
                raise urllib.error.HTTPError(url, 404, "Not Found", None, None)
            return bajar(url, timeout, metodo)
        tm._bajar = sin_las_nuevas
        c = Cliente()
        _, j, _ = c.get("/api/tormentas", csrf=False)
        self.assertEqual(j["mosaico"]["marcos"][-1]["id"], tm.id_de(ULTIMO - dt.timedelta(minutes=30)))
        self.assertEqual(j["cerca"]["estado"], "cerca")

    def test_imagen_del_mosaico(self):
        c = Cliente()
        codigo, datos, r = c.get(f"/api/tormentas/marco/{tm.id_de(ULTIMO)}.png", csrf=False)
        self.assertEqual(codigo, 200)
        self.assertEqual(r.getheader("Content-Type"), "image/png")
        self.assertIn("immutable", r.getheader("Cache-Control"))
        self.assertTrue(datos.startswith(tm.FIRMA))
        self.assertLess(len(datos), 60_000)

    def test_imagenes_que_no_se_sirven(self):
        c = Cliente()
        viejo = tm.id_de(ULTIMO - dt.timedelta(hours=4))
        futuro = tm.id_de(ULTIMO + dt.timedelta(minutes=10))
        torcido = tm.id_de(ULTIMO - dt.timedelta(minutes=5))
        for id_ in (viejo, futuro, torcido, "20261399T9999"):
            codigo, j, _ = c.get(f"/api/tormentas/marco/{id_}.png", csrf=False)
            self.assertEqual((codigo, j.get("k")), (404, "tormentas.marco"), id_)
        codigo, _, _ = c.get("/api/tormentas/marco/../../etc.png", csrf=False)
        self.assertEqual(codigo, 404)

    def test_sin_satelite_responde_igual(self):
        def caida(url, timeout=20, metodo="GET"):
            raise OSError("sin internet")
        tm._bajar = caida
        c = Cliente()
        codigo, j, _ = c.get("/api/tormentas", csrf=False)
        self.assertEqual(codigo, 200)
        self.assertIsNone(j["cerca"])
        self.assertIsNone(j["lluvia"])
        self.assertEqual(j["mosaico"]["marcos"], [])
        codigo, j, _ = c.get(f"/api/tormentas/marco/{tm.id_de(ULTIMO)}.png", csrf=False)
        self.assertEqual((codigo, j.get("k")), (503, "tormentas.sin_datos"))


if __name__ == "__main__":
    unittest.main()
