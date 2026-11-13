"""Tablero del superadmin (dashboard.ver): mapa en vivo, análisis (zonas, horas pico, sin atender) y su Excel."""
import datetime as dt
import io
import unittest
import uuid
import zipfile

import apoyo
from apoyo import Cliente, servidor

apoyo.arrancar()

TZ = servidor.TZ


def insertar(creado, estado="pendiente", origen="vecino", horas_vigencia=8, recinto="Zona de prueba", revisado_en=None,
             tipo="via_cerrada"):
    """Un reporte con la fecha que se pida (en hora de Ecuador). Devuelve su id."""
    rid = uuid.uuid4().hex[:12]
    lat, lon, _ = apoyo.punto_en_canton()
    with apoyo.db_escritura() as con:
        con.execute("INSERT INTO reportes (id, creado, dispositivo, ip, tipo, gravedad, descripcion, lat, lon, recinto, en_canton, "
                    "expira, estado, origen, revisado_en) VALUES (%s,%s,%s,%s,%s,2,%s,%s,%s,%s,1,%s,%s,%s,%s)",
                    (rid, servidor.iso(creado), "telefono-tablero-1", "10.0.0.1", tipo, "=SUMA(1;2) prueba", lat, lon, recinto,
                     servidor.iso(creado + dt.timedelta(hours=horas_vigencia)), estado, origen,
                     servidor.iso(revisado_en) if revisado_en else None))
    return rid


class Permisos(unittest.TestCase):
    def test_solo_superadmin(self):
        for rol in ("analista", "operador"):
            c, *_ = apoyo.sesion(rol)
            for ruta in ("/api/panel/mapa", "/api/panel/analisis", "/api/panel/analisis.xlsx"):
                codigo, cuerpo, _ = c.get(ruta)
                self.assertEqual((codigo, cuerpo.get("k")), (403, "auth.permiso"), (rol, ruta))
        self.assertEqual(Cliente().get("/api/panel/mapa")[0], 401)
        admin, *_ = apoyo.sesion("superadmin")
        self.assertEqual(admin.get("/api/panel/mapa")[0], 200)

    def test_el_permiso_lo_dice_la_api(self):
        admin, *_ = apoyo.sesion("superadmin")
        analista, *_ = apoyo.sesion("analista")
        self.assertIn("dashboard.ver", admin.get("/api/auth/me")[1]["usuario"]["permisos"])
        self.assertNotIn("dashboard.ver", analista.get("/api/auth/me")[1]["usuario"]["permisos"])


class Mapa(unittest.TestCase):
    def test_solo_eventos_activos(self):
        t = servidor.ahora()
        vivo = insertar(t - dt.timedelta(hours=1))
        verificado = insertar(t - dt.timedelta(hours=1), estado="validado")
        vencido = insertar(t - dt.timedelta(hours=20), horas_vigencia=8)
        descartado = insertar(t - dt.timedelta(hours=1), estado="descartado")
        admin, *_ = apoyo.sesion("superadmin")
        codigo, cuerpo, _ = admin.get("/api/panel/mapa")
        self.assertEqual(codigo, 200)
        ids = {e["id"] for e in cuerpo["eventos"]}
        self.assertTrue({vivo, verificado} <= ids)
        self.assertFalse({vencido, descartado} & ids)
        self.assertIn("generado", cuerpo)
        crudo = str(cuerpo)
        self.assertNotIn("telefono-tablero-1", crudo)      # nunca el identificador del teléfono completo
        self.assertNotIn("10.0.0.1", crudo)


class Analisis(unittest.TestCase):
    def setUp(self):
        self.admin, *_ = apoyo.sesion("superadmin")

    def analisis(self, dias=30):
        codigo, cuerpo, _ = self.admin.get(f"/api/panel/analisis?dias={dias}")
        self.assertEqual(codigo, 200, cuerpo)
        return cuerpo

    def test_horas_pico_en_hora_de_ecuador_y_zonas(self):
        antes = self.analisis()
        # tres a las 19:xx de Ecuador (00:xx UTC del día siguiente), uno a las 07:xx
        base = (servidor.ahora() - dt.timedelta(days=2)).astimezone(TZ).replace(hour=19, minute=10)
        for i in range(3):
            insertar(base + dt.timedelta(minutes=i), recinto="Zona pico")
        insertar(base.replace(hour=7), recinto="Zona pico", estado="validado", revisado_en=base.replace(hour=9))
        d = self.analisis()
        self.assertEqual(d["total"] - antes["total"], 4)
        self.assertEqual(d["horas"][19] - antes["horas"][19], 3)
        self.assertEqual(d["horas"][7] - antes["horas"][7], 1)
        self.assertEqual(sum(d["semana"][base.weekday()]) - sum(antes["semana"][base.weekday()]), 4)
        zona = next(z for z in d["zonas"] if z["recinto"] == "Zona pico")
        self.assertEqual((zona["n"], zona["sin_atender"]), (4, 3))
        self.assertGreaterEqual(len(d["puntos"]), 4)
        self.assertIsNotNone(d["atencion"]["mediana_horas"])

    def test_sin_atender(self):
        t = servidor.ahora()
        pendiente = insertar(t - dt.timedelta(hours=30), horas_vigencia=8)                     # vencido sin revisar
        revisado = insertar(t - dt.timedelta(hours=3), estado="validado", revisado_en=t)
        equipo_abierto = insertar(t - dt.timedelta(hours=2), estado="validado", origen="equipo", horas_vigencia=24)
        equipo_resuelto = insertar(t - dt.timedelta(hours=2), estado="resuelto", origen="equipo")
        d = self.analisis()
        ids = {x["id"]: x for x in d["sin_atender"]}
        self.assertIn(pendiente, ids)
        self.assertTrue(ids[pendiente]["vencido"])
        self.assertGreaterEqual(ids[pendiente]["horas"], 29.9)
        self.assertIn(equipo_abierto, ids)
        self.assertNotIn(revisado, ids)
        self.assertNotIn(equipo_resuelto, ids)
        horas = [x["horas"] for x in d["sin_atender"]]
        self.assertEqual(horas, sorted(horas, reverse=True))     # lo que más espera, primero

    def test_periodo(self):
        viejo = insertar(servidor.ahora() - dt.timedelta(days=40), recinto="Zona vieja")
        self.assertNotIn("Zona vieja", [z["recinto"] for z in self.analisis(30)["zonas"]])
        self.assertIn("Zona vieja", [z["recinto"] for z in self.analisis(90)["zonas"]])
        self.assertEqual(self.analisis(12345)["periodo"]["dias"], 30)    # período no permitido → 30
        self.assertTrue(viejo)

    def test_excel(self):
        insertar(servidor.ahora() - dt.timedelta(hours=1), recinto="Zona excel")
        codigo, datos, r = self.admin.get("/api/panel/analisis.xlsx?dias=7")
        self.assertEqual(codigo, 200)
        self.assertEqual(r.getheader("Content-Type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.assertIn('attachment; filename="yaguachi-analisis-7d-', r.getheader("Content-Disposition"))
        z = zipfile.ZipFile(io.BytesIO(datos))
        self.assertIsNone(z.testzip())
        libro = z.read("xl/workbook.xml").decode()
        for hoja in ("Resumen", "Reportes", "Zonas", "Horas pico", "Sin atender"):
            self.assertIn(f'name="{hoja}"', libro)
        reportes = z.read("xl/worksheets/sheet2.xml").decode()
        self.assertIn("Zona excel", reportes)
        self.assertIn("=SUMA(1;2) prueba", reportes)            # texto, nunca fórmula
        self.assertNotIn("<f>", reportes)
        self.assertNotIn("telefono-tablero-1", reportes)
        self.assertNotIn("10.0.0.1", reportes)
        with apoyo.db() as con:
            fila = con.execute("SELECT accion FROM auditoria ORDER BY id DESC LIMIT 1").fetchone()
        self.assertEqual(fila["accion"], "analisis.exportar")

    def test_excel_exige_csrf(self):
        self.assertEqual(self.admin.get("/api/panel/analisis.xlsx", csrf=False)[0], 403)


if __name__ == "__main__":
    unittest.main()
