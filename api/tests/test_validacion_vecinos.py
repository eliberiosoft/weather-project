"""Validación por vecinos (pedido del dueño, 2026-11-12): si 3 personas distintas reportan lo mismo en el mismo sector,
se publica sin esperar al analista. Se dice «confirmado por vecinos» (no «verificado»), sus fotos siguen privadas y no
cuenta para el nivel hasta que el analista lo verifique."""
import math
import unittest
import uuid
import zlib

import apoyo
from apoyo import Cliente

apoyo.arrancar()

import servidor   # noqa: E402


def cerca_de(lat, lon, metros, rumbo=0):
    """Un punto a `metros` del dado (rumbo en grados: 0 norte, 90 este)."""
    dlat = metros * math.cos(math.radians(rumbo)) / 111_320
    dlon = metros * math.sin(math.radians(rumbo)) / (111_320 * math.cos(math.radians(lat)))
    return lat + dlat, lon + dlon


class ValidacionVecinos(unittest.TestCase):
    def setUp(self):
        apoyo.limpiar_bloqueos()
        self.admin, *_ = apoyo.sesion("superadmin")
        self.analista, *_ = apoyo.sesion("analista")
        self.lat, self.lon, _ = apoyo.punto_en_canton()
        # cada prueba en su propio sector, fijo (crc32 y no hash(): hash() cambia en cada corrida y dos pruebas podían
        # caer en el mismo sector y sumar vecinos entre sí)
        n = zlib.crc32(self._testMethodName.encode())
        self.lat, self.lon = cerca_de(self.lat, self.lon, 900 * (n % 7), 37 * (n % 9))
        self.tipo = "via_cerrada"
        # y sin «vía cerrada» que hayan dejado otras pruebas: cuentan como vecinos si caen a menos de 300 m
        with servidor.db() as con:
            con.execute("UPDATE reportes SET estado='descartado' WHERE tipo=%s AND estado IN ('pendiente','validado')",
                        (self.tipo,))

    def tearDown(self):
        self.admin.post("/api/panel/config", {"validacion_vecinos": True, "validacion_minimo": 3, "validacion_radio_m": 300,
                                               "validacion_horas": 3})

    def reportar(self, lat=None, lon=None, tipo=None, cliente=None, foto=False, **extra):
        c = cliente or apoyo.vecino(apoyo.ip_nueva())
        b = {"dispositivo": "tel-" + uuid.uuid4().hex[:12], "consentimiento": True, "tipo": tipo or self.tipo,
             "lat": lat or self.lat, "lon": lon or self.lon, "descripcion": "Puente cerrado por el agua"}
        if foto:
            b["fotos"] = [apoyo.FOTO]
        b.update(extra)
        codigo, r, _ = c.post("/api/reportes", b, csrf=False)
        self.assertEqual(codigo, 201, r)
        return r, b["dispositivo"]

    def fila(self, rid):
        with servidor.db() as con:
            return con.execute("SELECT * FROM reportes WHERE id=%s", (rid,)).fetchone()

    def test_tres_personas_distintas_lo_publican_sin_el_analista(self):
        r1, _ = self.reportar(foto=True)
        r2, _ = self.reportar(*cerca_de(self.lat, self.lon, 120, 90))
        self.assertEqual((r1["estado"], r2["estado"]), ("pendiente", "pendiente"))
        r3, _ = self.reportar(*cerca_de(self.lat, self.lon, 200, 200))
        self.assertEqual((r3["estado"], r3["vecinos_n"]), ("validado", 3))
        for rid in (r1["id"], r2["id"], r3["id"]):
            f = self.fila(rid)
            self.assertEqual((f["estado"], f["validado_por"], f["vecinos_n"]), ("validado", "vecinos", 3))
        # se ve, pero dice que es de vecinos (no «verificado») y su foto sigue privada
        publico = {x["id"]: x for x in Cliente().get("/api/reportes", csrf=False)[1]["reportes"]}
        p1 = publico[r1["id"]]
        self.assertEqual((p1["verificado"], p1["validado_por"], p1["vecinos_n"], p1["foto"]), (False, "vecinos", 3, False))
        self.assertEqual(Cliente().get(f"/api/foto/{r1['id']}", csrf=False)[0], 404)
        # no cuenta para el nivel
        self.assertNotIn(r1["id"], {g["id"] for g in servidor.reportes_graves_validados()})
        # el panel los encuentra con el filtro «vecinos»
        lista = self.analista.get("/api/panel/reportes?estado=vecinos&origen=todos&tipo=todos&vigencia=todas")[1]["reportes"]
        self.assertIn(r1["id"], {x["id"] for x in lista})
        self.assertTrue(all(x["validado_por"] == "vecinos" for x in lista))
        # un cuarto vecino se suma: queda publicado enseguida
        r4, _ = self.reportar(*cerca_de(self.lat, self.lon, 80, 300))
        self.assertEqual((r4["estado"], r4["vecinos_n"]), ("validado", 4))
        self.assertEqual(self.fila(r1["id"])["vecinos_n"], 4)
        # el analista lo verifica después: pasa a «verificado», su foto se publica
        codigo, _, _ = self.analista.post(f"/api/panel/reportes/{r1['id']}", {"estado": "validado", "gravedad": 2})
        self.assertEqual(codigo, 200)
        self.assertEqual(self.fila(r1["id"])["validado_por"], "analista")
        p1 = {x["id"]: x for x in Cliente().get("/api/reportes", csrf=False)[1]["reportes"]}[r1["id"]]
        self.assertTrue(p1["verificado"] and p1["foto"])
        # queda en la auditoría (sin usuario: lo hizo el sistema)
        with servidor.db() as con:
            self.assertTrue(con.execute("SELECT 1 FROM auditoria WHERE accion='reporte.validado_vecinos' AND usuario_id IS NULL "
                                        "AND detalle LIKE %s", (f"%{r3['id']}%",)).fetchone())

    def test_una_misma_persona_no_se_valida_sola(self):
        ip = apoyo.ip_nueva()
        for i in range(3):                                            # tres teléfonos, la misma conexión
            r, _ = self.reportar(*cerca_de(self.lat, self.lon, 50 * i), cliente=apoyo.vecino(ip))
            self.assertEqual(r["estado"], "pendiente")
        cuenta = apoyo.vecino(apoyo.ip_nueva())                       # una misma cuenta desde dos lugares
        r, _ = self.reportar(cliente=cuenta)
        self.assertEqual(r["estado"], "pendiente")                    # 2 personas: la del wifi y esta cuenta

    def test_otro_tipo_o_lejos_no_cuenta(self):
        self.reportar()
        self.reportar(*cerca_de(self.lat, self.lon, 100), tipo="arbol_caido" if "arbol_caido" in servidor.TIPOS else "otro")
        r, _ = self.reportar(*cerca_de(self.lat, self.lon, 450, 90))   # a 450 m: otro sector
        self.assertEqual(r["estado"], "pendiente")

    def test_el_superadmin_lo_apaga_o_cambia_el_minimo(self):
        self.assertEqual(self.admin.post("/api/panel/config", {"validacion_vecinos": False})[0], 200)
        for i in range(3):
            r, _ = self.reportar(*cerca_de(self.lat, self.lon, 40 * i))
        self.assertEqual(r["estado"], "pendiente")
        self.admin.post("/api/panel/config", {"validacion_vecinos": True, "validacion_minimo": 2})
        r, _ = self.reportar(*cerca_de(self.lat + 0.02, self.lon, 0))
        r, _ = self.reportar(*cerca_de(self.lat + 0.02, self.lon, 60))
        self.assertEqual((r["estado"], r["vecinos_n"]), ("validado", 2))
        for malo in ({"validacion_minimo": 1}, {"validacion_minimo": 11}, {"validacion_radio_m": 10}, {"validacion_horas": 100},
                     {"validacion_minimo": True}, {"validacion_vecinos": 1}):
            codigo, j, _ = self.admin.post("/api/panel/config", malo)
            self.assertEqual(codigo, 400, malo)
        self.assertEqual(self.analista.post("/api/panel/config", {"validacion_vecinos": False})[0], 403)


if __name__ == "__main__":
    unittest.main()
