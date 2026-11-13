"""Avisos: eliminación lógica (solo superadmin). La fila queda; deja de verse en la app y en el panel."""
import unittest
import uuid

import apoyo
from apoyo import Cliente

apoyo.arrancar()


class EliminarAvisos(unittest.TestCase):
    def setUp(self):
        apoyo.limpiar_bloqueos()
        self.analista, *_ = apoyo.sesion("analista")
        self.admin, self.admin_id, *_ = apoyo.sesion("superadmin")

    def publicar(self):
        titulo = "Aviso " + uuid.uuid4().hex[:8]
        codigo, cuerpo, _ = self.analista.post("/api/panel/aviso", {
            "ambito_tipo": "canton", "ambito_id": "yaguachi", "nivel_cod": 2, "titulo": titulo,
            "texto": "Atentos a la crecida", "horas": 12, "forzar": True})
        self.assertEqual(codigo, 200, cuerpo)
        return cuerpo["id"], titulo

    def publicos(self):
        d = Cliente().get("/api/avisos", csrf=False)[1]
        return {a["id"] for a in d["vigentes"] + d["anteriores"]}

    def del_panel(self, c):
        return {a["id"] for a in c.get("/api/panel/ajustes")[1]["avisos"]}

    def test_sin_horas_vence_a_las_96(self):
        import datetime as dt
        titulo = "Aviso " + uuid.uuid4().hex[:8]
        codigo, cuerpo, _ = self.analista.post("/api/panel/aviso", {
            "ambito_tipo": "canton", "ambito_id": "yaguachi", "nivel_cod": 2, "titulo": titulo,
            "texto": "Sin horas: usa la vigencia por defecto", "forzar": True})
        self.assertEqual(codigo, 200, cuerpo)
        a = next(x for x in Cliente().get("/api/avisos", csrf=False)[1]["vigentes"] if x["id"] == cuerpo["id"])
        dur = dt.datetime.fromisoformat(a["vigente_hasta"]) - dt.datetime.fromisoformat(a["creado"])
        self.assertEqual(dur, dt.timedelta(hours=96))

    def test_no_se_publica_un_aviso_vacio(self):
        base = {"ambito_tipo": "canton", "ambito_id": "yaguachi", "nivel_cod": 2, "horas": 12, "forzar": True}
        for titulo, texto in (("", "Atentos a la crecida"), ("   ", "Atentos a la crecida"), ("Crecida", ""),
                              ("Crecida", "..."), ("..", "Atentos a la crecida")):
            codigo, cuerpo, _ = self.analista.post("/api/panel/aviso", dict(base, titulo=titulo, texto=texto))
            self.assertEqual((codigo, cuerpo.get("k")), (400, "avisos.texto"), (titulo, texto))

    def test_solo_el_superadmin_puede_eliminar(self):
        aid, _ = self.publicar()
        operador, *_ = apoyo.sesion("operador")
        for c in (self.analista, operador):
            codigo, cuerpo, _ = c.post(f"/api/panel/avisos/{aid}/eliminar")
            self.assertEqual((codigo, cuerpo.get("k")), (403, "auth.permiso"))
        self.assertNotIn("avisos.eliminar", self.analista.get("/api/auth/me")[1]["usuario"]["permisos"])
        self.assertIn("avisos.eliminar", self.admin.get("/api/auth/me")[1]["usuario"]["permisos"])

    def test_eliminacion_logica(self):
        aid, titulo = self.publicar()
        self.assertIn(aid, self.publicos())
        self.assertIn(aid, self.del_panel(self.analista))
        codigo, cuerpo, _ = self.admin.post(f"/api/panel/avisos/{aid}/eliminar")
        self.assertEqual((codigo, cuerpo), (200, {"ok": True}))
        # deja de verse en la app y en el panel (para todos los roles)
        self.assertNotIn(aid, self.publicos())
        self.assertNotIn(aid, self.del_panel(self.analista))
        self.assertNotIn(aid, self.del_panel(self.admin))
        # pero la fila sigue, con quién y cuándo, y queda en la auditoría
        with apoyo.db() as con:
            fila = con.execute("SELECT titulo, eliminado_en, eliminado_por FROM avisos WHERE id=%s", (aid,)).fetchone()
            aud = con.execute("SELECT usuario_id, detalle FROM auditoria WHERE accion='aviso.eliminar' ORDER BY id DESC LIMIT 1").fetchone()
        self.assertEqual(fila["titulo"], titulo)
        self.assertIsNotNone(fila["eliminado_en"])
        self.assertEqual(fila["eliminado_por"], self.admin_id)
        self.assertEqual(aud["usuario_id"], self.admin_id)
        self.assertIn(str(aid), aud["detalle"])

    def test_no_se_elimina_dos_veces_ni_se_anula_uno_eliminado(self):
        aid, _ = self.publicar()
        self.assertEqual(self.admin.post(f"/api/panel/avisos/{aid}/eliminar")[0], 200)
        codigo, cuerpo, _ = self.admin.post(f"/api/panel/avisos/{aid}/eliminar")
        self.assertEqual((codigo, cuerpo.get("k")), (404, "avisos.no_existe"))
        self.assertEqual(self.analista.post(f"/api/panel/avisos/{aid}/anular")[0], 404)
        self.assertEqual(self.admin.post("/api/panel/avisos/999999/eliminar")[0], 404)

    def test_se_puede_eliminar_un_aviso_anulado(self):
        aid, _ = self.publicar()
        self.assertEqual(self.analista.post(f"/api/panel/avisos/{aid}/anular")[0], 200)
        self.assertIn(aid, self.del_panel(self.analista))          # anulado: sigue en el panel, marcado
        self.assertEqual(self.admin.post(f"/api/panel/avisos/{aid}/eliminar")[0], 200)
        self.assertNotIn(aid, self.del_panel(self.analista))

    def test_eliminado_no_cuenta_para_el_limite_de_avisos(self):
        with apoyo.db() as con:
            antes = con.execute("SELECT COUNT(*) AS n FROM avisos WHERE eliminado_en IS NULL").fetchone()["n"]
        aid, _ = self.publicar()
        self.admin.post(f"/api/panel/avisos/{aid}/eliminar")
        with apoyo.db() as con:
            despues = con.execute("SELECT COUNT(*) AS n FROM avisos WHERE eliminado_en IS NULL").fetchone()["n"]
        self.assertEqual(antes, despues)


if __name__ == "__main__":
    unittest.main()
