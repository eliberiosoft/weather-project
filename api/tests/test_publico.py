"""Las rutas públicas mantienen su forma (solo se agregan campos) y las cabeceras de seguridad (spec 012)."""
import unittest

import apoyo
from apoyo import Cliente

apoyo.arrancar()


class RutasPublicas(unittest.TestCase):
    def test_territorio_estado_cercano_recinto(self):
        c = Cliente()
        codigo, t, _ = c.get("/api/territorio", csrf=False)
        self.assertEqual(codigo, 200)
        self.assertTrue({"recintos", "calles", "tipos", "gravedad", "altura", "acciones", "niveles", "colores"} <= set(t))
        codigo, e, _ = c.get("/api/estado", csrf=False)
        self.assertEqual(codigo, 200)
        self.assertTrue({"generado", "canton", "rios", "recintos", "puntos", "fuentes"} <= set(e))
        lat, lon, rid = apoyo.punto_en_canton()
        codigo, cer, _ = c.get(f"/api/cercano?lat={lat}&lon={lon}", csrf=False)
        self.assertEqual((codigo, cer["id"]), (200, rid))
        codigo, rec, _ = c.get(f"/api/recinto?id={rid}", csrf=False)
        self.assertEqual((codigo, rec["recinto"]["id"]), (200, rid))
        codigo, lug, _ = c.get(f"/api/lugar?lat={lat}&lon={lon}", csrf=False)
        self.assertEqual(codigo, 200)
        self.assertTrue(lug["recinto"]["en_canton"])

    def test_no_se_aceptan_reportes_vacios(self):
        lat, lon, _ = apoyo.punto_en_canton()
        base = {"dispositivo": "telefono-vacio-01", "consentimiento": True, "tipo": "via_cerrada", "gravedad": 2,
                "lat": lat, "lon": lon}
        for d in (None, "", "    ", "...", "ok", "!!!!!!!", 12345):
            cuerpo = dict(base, **({} if d is None else {"descripcion": d}))
            codigo, r, _ = apoyo.vecino().post("/api/reportes", cuerpo, csrf=False)
            self.assertEqual((codigo, r.get("k")), (400, "reportes.descripcion"), repr(d))
        codigo, r, _ = apoyo.vecino().post("/api/reportes", dict(base, descripcion="  Árbol caído  "), csrf=False)
        self.assertEqual(codigo, 201, r)

    def test_reportes_crear_listar_confirmar(self):
        lat, lon, _ = apoyo.punto_en_canton()
        c = apoyo.vecino()
        disp = {"X-Dispositivo": "telefono-publico-01"}
        codigo, rep, _ = c.post("/api/reportes", {"dispositivo": "telefono-publico-01", "consentimiento": True,
                                                  "tipo": "calle_inundada", "altura_agua": 1, "lat": lat, "lon": lon,
                                                  "descripcion": "Agua hasta la vereda"},
                                csrf=False)
        self.assertEqual((codigo, rep["estado"]), (201, "pendiente"))
        codigo, lista, _ = c.get("/api/reportes", csrf=False, cabeceras=disp)
        self.assertEqual(codigo, 200)
        self.assertTrue({"reportes", "tipos", "gravedad", "altura"} <= set(lista))
        mio = next(r for r in lista["reportes"] if r["id"] == rep["id"])
        self.assertTrue(mio["mio"])
        campos = {"id", "tipo", "emoji", "etiqueta", "gravedad", "descripcion", "lat", "lon", "recinto", "creado", "expira",
                  "estado", "nota_ugr", "foto", "sigue", "ya_no", "mio", "altura_agua", "altura_txt", "via", "tramo",
                  "verificado", "likes", "me_gusta", "foto_k", "origen", "autor", "n_fotos",
                  "validado_por", "vecinos_n"}                      # spec 022
        self.assertEqual(set(mio), campos)
        otro = Cliente()
        self.assertEqual(otro.post(f"/api/reportes/{rep['id']}/confirmar", {"dispositivo": "telefono-publico-02", "sigue": True},
                                   csrf=False)[1], {"ok": True})
        self.assertEqual(otro.post(f"/api/reportes/{rep['id']}/megusta", {"dispositivo": "telefono-publico-02"},
                                   csrf=False)[1]["likes"], 1)
        codigo, html, r = c.get(f"/r/{rep['id']}", csrf=False)
        self.assertEqual((codigo, r.getheader("Content-Type")), (200, "text/html; charset=utf-8"))
        self.assertIn(b"og:title", html)

    def test_avisos_sin_autor(self):
        analista, *_ = apoyo.sesion("analista")
        aid = analista.post("/api/panel/aviso", {"ambito_tipo": "canton", "ambito_id": "yaguachi", "nivel_cod": 2,
                                                 "titulo": "Lluvias", "texto": "Revisa las cunetas", "forzar": True})[1]["id"]
        codigo, av, _ = Cliente().get("/api/avisos", csrf=False)
        self.assertEqual(codigo, 200)
        self.assertTrue({"vigentes", "anteriores", "horas_silencio"} <= set(av))
        aviso = next(a for a in av["vigentes"] if a["id"] == aid)
        self.assertNotIn("autor_id", aviso)
        with apoyo.db() as con:
            self.assertIsNotNone(con.execute("SELECT autor_id FROM avisos WHERE id=%s", (aid,)).fetchone()["autor_id"])

    def test_errores_de_siempre(self):
        c = apoyo.vecino()
        self.assertEqual(c.get("/api/recinto?id=no", csrf=False)[1], {"error": "recinto no encontrado"})
        codigo, cuerpo, _ = c.post("/api/reportes", {"dispositivo": "x"}, csrf=False)
        self.assertEqual(codigo, 400)
        self.assertIn("error", cuerpo)
        codigo, cuerpo, _ = c.pedir("POST", "/api/reportes", None, csrf=False, cabeceras={"Content-Length": "-5"})
        self.assertEqual(codigo, 413)

    def test_cabeceras_de_seguridad(self):
        for ruta in ("/api/territorio", "/api/auth/config", "/api/push/config"):
            _, _, r = Cliente().get(ruta, csrf=False)
            self.assertEqual(r.getheader("X-Frame-Options"), "DENY")
            self.assertEqual(r.getheader("X-Content-Type-Options"), "nosniff")
            self.assertIn("frame-ancestors 'none'", r.getheader("Content-Security-Policy"))
            self.assertEqual(r.getheader("Cache-Control"), "no-store")
            self.assertEqual(r.getheader("Server").strip(), "YaguachiWeather")      # sin versión de Python


if __name__ == "__main__":
    unittest.main()
