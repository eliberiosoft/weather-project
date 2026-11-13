"""«Reportes» del panel: filtros y paginación, cambiar hasta cuándo se ven uno o varios (superadmin y analista) y
eliminarlos en bloque (solo superadmin)."""
import datetime as dt
import unittest

import apoyo
from apoyo import Cliente, servidor

apoyo.arrancar()


def reporte_vecino(tipo="otro", descripcion="Problema de prueba en la esquina"):
    lat, lon, _ = apoyo.punto_en_canton()
    codigo, r, _ = Cliente().post("/api/reportes", {"dispositivo": "telefono-" + apoyo.nombre_nuevo(), "consentimiento": True,
                                                    "tipo": tipo, "lat": lat, "lon": lon, "descripcion": descripcion}, csrf=False)
    assert codigo == 201, r
    return r["id"]


def incidente(op, tipo="via_cerrada"):
    lat, lon, _ = apoyo.punto_en_canton()
    codigo, r, _ = op.post("/api/panel/incidentes", {"tipo": tipo, "gravedad": 2, "descripcion": "Incidente de prueba del equipo",
                                                      "lat": lat, "lon": lon})
    assert codigo == 201, r
    return r["id"]


def en(horas):
    return (servidor.ahora() + dt.timedelta(hours=horas)).isoformat(timespec="seconds")


def fila(rid):
    with servidor.db() as con:
        return con.execute("SELECT * FROM reportes WHERE id=%s", (rid,)).fetchone()


class Lista(unittest.TestCase):
    def setUp(self):
        apoyo.limpiar_bloqueos()
        self.an, *_ = apoyo.sesion("analista")

    def test_filtros(self):
        op, *_ = apoyo.sesion("operador")
        clave = "filtro-" + apoyo.nombre_nuevo()
        rv = reporte_vecino("bache", f"Bache {clave} frente a la escuela")
        ri = incidente(op, "basura")
        _, r, _ = self.an.get(f"/api/panel/reportes?estado=todos&q={clave}")
        self.assertEqual([x["id"] for x in r["reportes"]], [rv])
        _, r, _ = self.an.get("/api/panel/reportes?estado=todos&origen=equipo&tipo=basura&n=100")
        self.assertIn(ri, [x["id"] for x in r["reportes"]])
        self.assertTrue(all(x["origen"] == "equipo" and x["tipo"] == "basura" for x in r["reportes"]))
        _, r, _ = self.an.get("/api/panel/reportes?estado=pendiente&origen=vecino&tipo=bache&n=100")
        self.assertIn(rv, [x["id"] for x in r["reportes"]])
        for malo in ("estado=nada", "origen=otro", "tipo=nada", "vigencia=nunca"):
            codigo, r, _ = self.an.get("/api/panel/reportes?" + malo)
            self.assertEqual((codigo, r.get("k")), (400, "reportes.filtro"), malo)

    def test_paginacion(self):
        for _ in range(3):
            reporte_vecino()
        _, p1, _ = self.an.get("/api/panel/reportes?estado=todos&n=2&pagina=1")
        _, p2, _ = self.an.get("/api/panel/reportes?estado=todos&n=2&pagina=2")
        self.assertEqual((len(p1["reportes"]), p1["n"], p1["pagina"]), (2, 2, 1))
        self.assertGreaterEqual(p1["total"], 3)
        self.assertEqual(p1["paginas"], -(-p1["total"] // 2))
        self.assertFalse({x["id"] for x in p1["reportes"]} & {x["id"] for x in p2["reportes"]})

    def test_vigentes_y_vencidos(self):
        rid = reporte_vecino()
        with servidor.db_escritura() as con:
            con.execute("UPDATE reportes SET expira=%s WHERE id=%s", (en(-1), rid))
        _, r, _ = self.an.get("/api/panel/reportes?estado=todos&vigencia=vencidos&n=100")
        self.assertIn(rid, [x["id"] for x in r["reportes"]])
        _, r, _ = self.an.get("/api/panel/reportes?estado=todos&vigencia=vigentes&n=100")
        self.assertNotIn(rid, [x["id"] for x in r["reportes"]])


class Vigencia(unittest.TestCase):
    def setUp(self):
        apoyo.limpiar_bloqueos()

    def test_analista_cambia_varios_y_queda_en_la_auditoria(self):
        an, an_id, *_ = apoyo.sesion("analista")
        op, *_ = apoyo.sesion("operador")
        ids = [reporte_vecino(), incidente(op)]
        hasta = en(72)
        codigo, r, _ = an.post("/api/panel/reportes/vigencia", {"ids": ids, "hasta": hasta})
        self.assertEqual(codigo, 200, r)
        self.assertEqual(r["actualizados"], 2)
        for rid in ids:
            self.assertEqual(servidor.leer_iso(fila(rid)["expira"]), servidor.leer_iso(hasta))
        with servidor.db() as con:
            a = con.execute("SELECT * FROM auditoria WHERE usuario_id=%s AND accion='reportes.vigencia'", (an_id,)).fetchone()
        self.assertIsNotNone(a)

    def test_vuelve_a_verse_uno_vencido(self):
        sa, *_ = apoyo.sesion("superadmin")
        op, *_ = apoyo.sesion("operador")
        rid = incidente(op)
        with servidor.db_escritura() as con:
            con.execute("UPDATE reportes SET expira=%s WHERE id=%s", (en(-2), rid))
        publicos = lambda: [x["id"] for x in Cliente().get("/api/reportes", csrf=False)[1]["reportes"]]
        self.assertNotIn(rid, publicos())
        self.assertEqual(sa.post("/api/panel/reportes/vigencia", {"ids": [rid], "hasta": en(24)})[0], 200)
        self.assertIn(rid, publicos())

    def test_validaciones_y_permisos(self):
        an, *_ = apoyo.sesion("analista")
        op, *_ = apoyo.sesion("operador")
        rid = reporte_vecino()
        self.assertEqual(op.post("/api/panel/reportes/vigencia", {"ids": [rid], "hasta": en(24)})[0], 403)
        for b, k in (({"ids": [], "hasta": en(24)}, "reportes.ids"), ({"ids": ["x"], "hasta": en(24)}, "reportes.ids"),
                     ({"ids": [rid] * 101, "hasta": en(24)}, "reportes.ids"), ({"ids": [rid], "hasta": "ayer"}, "reportes.vigencia_fecha"),
                     ({"ids": [rid], "hasta": en(-1)}, "reportes.vigencia_fecha"),
                     ({"ids": [rid], "hasta": en(24 * 91)}, "reportes.vigencia_fecha")):
            codigo, r, _ = an.post("/api/panel/reportes/vigencia", b)
            self.assertEqual((codigo, r.get("k")), (400, k), b)
        codigo, r, _ = an.post("/api/panel/reportes/vigencia", {"ids": ["0123456789ab"], "hasta": en(24)})
        self.assertEqual((codigo, r.get("k")), (404, "reportes.no_existe"))


class Eliminar(unittest.TestCase):
    def setUp(self):
        apoyo.limpiar_bloqueos()

    def test_superadmin_elimina_varios(self):
        sa, sa_id, *_ = apoyo.sesion("superadmin")
        op, *_ = apoyo.sesion("operador")
        ids = [reporte_vecino(), reporte_vecino("bache"), incidente(op)]
        codigo, r, _ = sa.post("/api/panel/reportes/eliminar", {"ids": ids})
        self.assertEqual((codigo, r.get("eliminados")), (200, 3), r)
        for rid in ids:
            self.assertIsNone(fila(rid))
        with servidor.db() as con:
            self.assertIsNotNone(con.execute("SELECT 1 FROM auditoria WHERE usuario_id=%s AND accion='reportes.eliminar'",
                                             (sa_id,)).fetchone())

    def test_solo_superadmin(self):
        rid = reporte_vecino()
        for rol in ("analista", "operador"):
            c, *_ = apoyo.sesion(rol)
            self.assertEqual(c.post("/api/panel/reportes/eliminar", {"ids": [rid]})[0], 403, rol)
        self.assertIsNotNone(fila(rid))


if __name__ == "__main__":
    unittest.main()
