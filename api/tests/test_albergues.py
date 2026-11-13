"""Albergues (permisos, fotos, eliminación lógica), ruta hasta un albergue, hasta 3 fotos por reporte y
la lista de incidentes por páginas."""
import os
import unittest

import apoyo
from apoyo import Cliente, servidor

apoyo.arrancar()

FOTO2 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA" + "B" * 64


def albergue(**extra):
    lat, lon, _ = apoyo.punto_en_canton()
    b = {"nombre": "Escuela Fiscal Rocafuerte", "descripcion": "Aulas del primer piso, baños y agua.", "lat": lat, "lon": lon}
    b.update(extra)
    return b


def publicos():
    return {a["id"]: a for a in Cliente().get("/api/albergues", csrf=False)[1]["albergues"]}


def archivos(aid):
    with apoyo.db() as con:
        return servidor._lista_json(con.execute("SELECT fotos FROM albergues WHERE id=%s", (aid,)).fetchone()["fotos"])


class Albergues(unittest.TestCase):
    def setUp(self):
        apoyo.limpiar_bloqueos()
        self.an, *_ = apoyo.sesion("analista")

    def test_permisos(self):
        op, *_ = apoyo.sesion("operador")
        self.assertEqual(op.post("/api/panel/albergues", albergue())[0], 403)
        self.assertEqual(op.get("/api/panel/albergues")[0], 403)
        sa, *_ = apoyo.sesion("superadmin")
        self.assertEqual(sa.post("/api/panel/albergues", albergue())[0], 201)
        self.assertEqual(Cliente().post("/api/panel/albergues", albergue())[0], 401)

    def test_crear_con_fotos_y_ver_en_la_app(self):
        codigo, cuerpo, _ = self.an.post("/api/panel/albergues", albergue(fotos=[apoyo.FOTO, FOTO2]))
        self.assertEqual(codigo, 201, cuerpo)
        a = publicos()[cuerpo["id"]]
        self.assertEqual((a["nombre"], a["fotos"]), ("Escuela Fiscal Rocafuerte", 2))
        c = Cliente()
        codigo, datos, r = c.get(f"/api/albergues/{cuerpo['id']}/foto/2", csrf=False)
        self.assertEqual(codigo, 200)
        self.assertEqual(r.getheader("Content-Type"), "image/jpeg")
        self.assertTrue(datos.startswith(b"\xff\xd8\xff"))
        self.assertEqual(c.get(f"/api/albergues/{cuerpo['id']}/foto/3", csrf=False)[0], 404)

    def test_validaciones(self):
        for mal in ({"nombre": "  "}, {"nombre": "x" * 81}, {"descripcion": "y" * 281},
                    {"lat": 0, "lon": 0}, {"fotos": [apoyo.FOTO] * 4}, {"fotos": ["data:image/png;base64,AAAA"]}):
            codigo, cuerpo, _ = self.an.post("/api/panel/albergues", albergue(**mal))
            self.assertEqual(codigo, 400, (mal, cuerpo))

    def test_editar_fotos_conserva_reordena_y_borra(self):
        aid = self.an.post("/api/panel/albergues", albergue(fotos=[apoyo.FOTO, FOTO2]))[1]["id"]
        f1, f2 = archivos(aid)
        # queda la 2.ª primero, se quita la 1.ª y se agrega una nueva
        codigo, cuerpo, _ = self.an.post(f"/api/panel/albergues/{aid}", {"nombre": "Coliseo", "fotos": [2, apoyo.FOTO]})
        self.assertEqual(codigo, 200, cuerpo)
        ahora = archivos(aid)
        self.assertEqual(ahora[0], f2)
        self.assertEqual(len(ahora), 2)
        self.assertFalse(os.path.exists(os.path.join(servidor.FOTOS, f1)))
        self.assertEqual(publicos()[aid]["nombre"], "Coliseo")
        # sin «fotos» no se tocan
        self.an.post(f"/api/panel/albergues/{aid}", {"descripcion": ""})
        self.assertEqual(archivos(aid), ahora)
        self.assertEqual(self.an.post(f"/api/panel/albergues/{aid}", {"fotos": [3]})[0], 400)

    def test_eliminar_es_logico(self):
        aid = self.an.post("/api/panel/albergues", albergue(fotos=[apoyo.FOTO]))[1]["id"]
        (f1,) = archivos(aid)
        self.assertEqual(self.an.post(f"/api/panel/albergues/{aid}/eliminar")[0], 200)
        self.assertNotIn(aid, publicos())
        self.assertNotIn(aid, {a["id"] for a in self.an.get("/api/panel/albergues")[1]["albergues"]})
        with apoyo.db() as con:
            fila = con.execute("SELECT eliminado_en, eliminado_por FROM albergues WHERE id=%s", (aid,)).fetchone()
            accion = con.execute("SELECT accion FROM auditoria WHERE detalle LIKE %s ORDER BY id DESC LIMIT 1",
                                 (f"%{aid}%",)).fetchone()["accion"]
        self.assertIsNotNone(fila["eliminado_en"])
        self.assertEqual(accion, "albergue.eliminar")
        self.assertFalse(os.path.exists(os.path.join(servidor.FOTOS, f1)))
        self.assertEqual(self.an.post(f"/api/panel/albergues/{aid}/eliminar")[0], 404)
        self.assertEqual(Cliente().get(f"/api/albergues/{aid}/foto/1", csrf=False)[0], 404)


class Ruta(unittest.TestCase):
    def setUp(self):
        self.an, *_ = apoyo.sesion("analista")
        self.aid = self.an.post("/api/panel/albergues", albergue())[1]["id"]
        self.lat, self.lon, _ = apoyo.punto_en_canton()
        self.pedidos = []
        original, servidor.OFFLINE = servidor._pedir_ruta, False

        def falso(modo, lat, lon, alat, alon):
            self.pedidos.append((modo, lat, lon))
            return {"code": "Ok", "routes": [{"distance": 1234.4, "duration": 900.2,
                                              "geometry": {"coordinates": [[lon, lat], [alon, alat]]}}]}
        servidor._pedir_ruta = falso

        def volver():
            servidor._pedir_ruta, servidor.OFFLINE = original, True
            servidor._rutas_cache.clear()
            servidor._rutas_ip.clear()
        self.addCleanup(volver)

    def url(self, **kw):
        q = {"modo": "pie", "lat": self.lat + 0.001234567, "lon": self.lon, "albergue": self.aid}
        q.update(kw)
        return "/api/ruta?" + "&".join(f"{k}={v}" for k, v in q.items())

    def test_ruta_y_cache(self):
        c = Cliente()
        codigo, r, _ = c.get(self.url(), csrf=False)
        self.assertEqual(codigo, 200, r)
        self.assertEqual((r["metros"], r["segundos"], r["modo"]), (1234, 900, "pie"))
        self.assertEqual(len(r["linea"]), 2)
        self.assertEqual(round(self.pedidos[0][1], 4), self.pedidos[0][1])   # el origen sale redondeado
        c.get(self.url(), csrf=False)
        self.assertEqual(len(self.pedidos), 1)                                # la segunda vez, de la caché

    def test_solo_a_albergues_y_con_tope(self):
        c = Cliente()
        self.assertEqual(c.get(self.url(albergue="0" * 12), csrf=False)[0], 404)
        self.assertEqual(c.get(self.url(modo="avion"), csrf=False)[0], 400)
        self.assertEqual(c.get(self.url(lat=0, lon=0), csrf=False)[0], 400)
        for i in range(servidor.RUTAS_POR_IP):
            c.get(self.url(lat=self.lat + i * 0.001), csrf=False)
        self.assertEqual(c.get(self.url(lat=self.lat - 0.05), csrf=False)[0], 429)

    def test_sin_camino(self):
        servidor._pedir_ruta = lambda *a: {"code": "NoRoute", "routes": []}
        codigo, r, _ = Cliente().get(self.url(), csrf=False)
        self.assertEqual((codigo, r.get("k")), (404, "ruta.sin_camino"))


class FotosDeReportes(unittest.TestCase):
    def reporte(self, **extra):
        lat, lon, _ = apoyo.punto_en_canton()
        b = {"dispositivo": "telefono-" + apoyo.nombre_nuevo(), "consentimiento": True, "tipo": "vivienda_inundada",
             "gravedad": 2, "descripcion": "Entró agua a la casa", "lat": lat, "lon": lon}
        b.update(extra)
        return b

    def test_tres_fotos(self):
        b = self.reporte(fotos=[apoyo.FOTO, FOTO2, apoyo.FOTO])
        codigo, r, _ = apoyo.vecino().post("/api/reportes", b)
        self.assertEqual(codigo, 201, r)
        c = Cliente()
        mio = {x["id"]: x for x in c.get("/api/reportes", csrf=False, cabeceras={"X-Dispositivo": b["dispositivo"]})[1]["reportes"]}[r["id"]]
        self.assertEqual(mio["n_fotos"], 3)
        for n in (1, 2, 3):
            self.assertEqual(c.get(f"/api/foto/{r['id']}/{n}", csrf=False, cabeceras={"X-Dispositivo": b["dispositivo"]})[0], 200)
        # otro teléfono no ve las fotos de un reporte sin verificar
        self.assertEqual(Cliente().get(f"/api/foto/{r['id']}/2", csrf=False)[0], 404)
        # al descartarlo se borran las tres
        with apoyo.db() as con:
            fila = con.execute("SELECT * FROM reportes WHERE id=%s", (r["id"],)).fetchone()
        nombres = servidor.fotos_de(fila)
        self.assertEqual(len(nombres), 3)
        an, *_ = apoyo.sesion("analista")
        self.assertEqual(an.post(f"/api/panel/reportes/{r['id']}", {"estado": "descartado"})[0], 200)
        self.assertFalse(any(os.path.exists(os.path.join(servidor.FOTOS, n)) for n in nombres))

    def test_foto_suelta_de_antes_y_tope(self):
        codigo, r, _ = apoyo.vecino().post("/api/reportes", self.reporte(foto=apoyo.FOTO))
        self.assertEqual(codigo, 201, r)
        with apoyo.db() as con:
            fila = con.execute("SELECT * FROM reportes WHERE id=%s", (r["id"],)).fetchone()
        self.assertEqual(len(servidor.fotos_de(fila)), 1)
        codigo, r, _ = apoyo.vecino().post("/api/reportes", self.reporte(fotos=[apoyo.FOTO] * 4))
        self.assertEqual((codigo, r.get("k")), (400, "foto.demasiadas"))


class IncidentesPorPaginas(unittest.TestCase):
    def test_paginas_sin_repetir(self):
        sa, sa_id, *_ = apoyo.sesion("superadmin")
        lat, lon, _ = apoyo.punto_en_canton()
        with apoyo.db_escritura() as con:          # 7 incidentes con la misma hora: el id desempata
            for i in range(7):
                con.execute("INSERT INTO reportes (id, creado, dispositivo, tipo, gravedad, descripcion, lat, lon, estado, "
                            "expira, origen, autor_id) VALUES (%s,'2099-01-01T00:00:00-05:00','equipo','via_cerrada',2,"
                            "'Prueba de páginas',%s,%s,'validado','2099-01-02T00:00:00-05:00','equipo',%s)",
                            (f"ffff{i:08x}", lat, lon, sa_id))

        def borrar():
            with apoyo.db_escritura() as con:
                con.execute("DELETE FROM reportes WHERE id LIKE 'ffff%%'")
        self.addCleanup(borrar)
        vistos, q = [], "n=3"
        while True:
            codigo, cuerpo, _ = sa.get(f"/api/panel/incidentes?{q}")
            self.assertEqual(codigo, 200, cuerpo)
            vistos += [x["id"] for x in cuerpo["incidentes"]]
            if not cuerpo["mas"]:
                break
            u = cuerpo["incidentes"][-1]
            q = f"n=3&antes={u['creado']}&antes_id={u['id']}".replace("+", "%2B").replace(":", "%3A")
        self.assertEqual(len(vistos), len(set(vistos)))
        self.assertEqual([v for v in vistos if v.startswith("ffff")], [f"ffff{i:08x}" for i in range(6, -1, -1)])
        self.assertEqual(sa.get("/api/panel/incidentes?antes=x&antes_id=nada")[0], 400)


if __name__ == "__main__":
    unittest.main()
