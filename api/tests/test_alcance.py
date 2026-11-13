"""Spec 021: flyer de los avisos (en la app, en el push y al compartir) y alcance de avisos e incidentes (cuántos
teléfonos los abrieron, sin decir cuáles)."""
import unittest
import uuid

import apoyo
from apoyo import Cliente

apoyo.arrancar()

import push        # noqa: E402
import servidor    # noqa: E402
from test_incidentes import incidente   # noqa: E402


def telefono():
    return "tel-" + uuid.uuid4().hex[:12]


class Flyer(unittest.TestCase):
    def setUp(self):
        apoyo.limpiar_bloqueos()
        self.analista, *_ = apoyo.sesion("analista")

    def publicar(self, **extra):
        codigo, cuerpo, _ = self.analista.post("/api/panel/aviso", dict({
            "ambito_tipo": "canton", "ambito_id": "yaguachi", "nivel_cod": 3, "titulo": "Aviso " + uuid.uuid4().hex[:6],
            "texto": "Prepárense para salir", "horas": 12, "forzar": True}, **extra))
        self.assertEqual(codigo, 200, cuerpo)
        return cuerpo["id"]

    def test_aviso_con_flyer_en_la_app_el_push_y_al_compartir(self):
        aid = self.publicar(flyer=apoyo.FOTO)
        a = next(x for x in Cliente().get("/api/avisos", csrf=False)[1]["vigentes"] if x["id"] == aid)
        self.assertRegex(a["flyer"], rf"^/api/avisos/{aid}/flyer\?v=[0-9a-f]{{8}}$")
        self.assertNotIn("autor_id", a)
        codigo, datos, r = Cliente().get(a["flyer"], csrf=False)
        self.assertEqual((codigo, r.getheader("Content-Type")), (200, "image/jpeg"))
        self.assertIn("immutable", r.getheader("Cache-Control"))
        self.assertTrue(datos.startswith(b"\xff\xd8\xff"))
        # push: la imagen y el enlace al aviso (con «push» para contar que se abrió desde la notificación)
        with servidor.db() as con:
            fila = con.execute("SELECT * FROM avisos WHERE id=%s", (aid,)).fetchone()
        m = push.datos_mensaje(fila)
        self.assertEqual(m["imagen"], a["flyer"])
        self.assertEqual(m["url"], f"/#avisos/{aid}/push")
        # compartir: Open Graph con el flyer y el aviso en la app
        codigo, html, _ = Cliente().get(f"/a/{aid}", csrf=False)
        self.assertEqual(codigo, 200)
        self.assertIn(f'/api/avisos/{aid}/flyer?v='.encode(), html)
        self.assertIn(f"/#avisos/{aid}".encode(), html)

    def test_sin_flyer_y_flyer_invalido(self):
        aid = self.publicar()
        a = next(x for x in Cliente().get("/api/avisos", csrf=False)[1]["vigentes"] if x["id"] == aid)
        self.assertIsNone(a["flyer"])
        self.assertEqual(Cliente().get(f"/api/avisos/{aid}/flyer", csrf=False)[0], 404)
        codigo, cuerpo, _ = self.analista.post("/api/panel/aviso", {
            "ambito_tipo": "canton", "ambito_id": "yaguachi", "nivel_cod": 3, "titulo": "Con imagen rota",
            "texto": "No debe publicarse", "forzar": True, "flyer": "data:image/png;base64,AAAA"})
        self.assertEqual((codigo, cuerpo.get("k")), (400, "foto.formato"))

    def test_anulado_no_sirve_su_flyer(self):
        aid = self.publicar(flyer=apoyo.FOTO)
        self.analista.post(f"/api/panel/avisos/{aid}/anular", {})
        self.assertEqual(Cliente().get(f"/api/avisos/{aid}/flyer", csrf=False)[0], 404)
        _, html, _ = Cliente().get(f"/a/{aid}", csrf=False)
        self.assertIn(b"/#avisos", html)
        self.assertNotIn(f"/#avisos/{aid}".encode(), html)


class Alcance(unittest.TestCase):
    def setUp(self):
        apoyo.limpiar_bloqueos()
        self.analista, *_ = apoyo.sesion("analista")
        self.op, *_ = apoyo.sesion("operador")

    def vista(self, tel, tipo, ids, via="app"):
        return Cliente(apoyo.ip_nueva()).post("/api/vistas", {"tipo": tipo, "ids": ids, "via": via},
                                               cabeceras={"X-Dispositivo": tel})

    def test_avisos_cuentan_telefonos_distintos_y_los_que_abrieron_el_push(self):
        aid = self.analista.post("/api/panel/aviso", {
            "ambito_tipo": "canton", "ambito_id": "yaguachi", "nivel_cod": 2, "titulo": "Alcance " + uuid.uuid4().hex[:6],
            "texto": "Para contar lecturas", "horas": 12, "forzar": True})[1]["id"]
        a, b, c = telefono(), telefono(), telefono()
        for tel in (a, a, b):                       # el mismo teléfono dos veces cuenta una
            self.assertEqual(self.vista(tel, "aviso", [aid])[0], 200)
        self.assertEqual(self.vista(c, "aviso", [aid], via="push")[0], 200)
        self.assertEqual(self.vista(c, "aviso", [aid], via="push")[1]["nuevas"], 0)
        avisos = {x["id"]: x for x in self.analista.get("/api/panel/ajustes")[1]["avisos"]}
        self.assertEqual(avisos[aid]["alcance"]["vistas"], 3)
        self.assertEqual(avisos[aid]["alcance"]["push"], 1)
        # sin nombres ni ids: en la base queda solo la firma (no el id del teléfono)
        with servidor.db() as con:
            quienes = [r["quien"] for r in con.execute("SELECT quien FROM vistas WHERE tipo='aviso' AND item_id=%s", (str(aid),))]
        self.assertNotIn(a, quienes)
        self.assertIn(servidor.quien_vista(a), quienes)

    def test_incidentes_del_equipo(self):
        iid = self.op.post("/api/panel/incidentes", incidente())[1]["id"]
        for tel in (telefono(), telefono()):
            self.assertEqual(self.vista(tel, "incidente", [iid])[0], 200)
        lista = {x["id"]: x for x in self.op.get("/api/panel/incidentes")[1]["incidentes"]}
        self.assertEqual(lista[iid]["alcance"]["vistas"], 2)

    def test_solo_cuenta_lo_que_existe_y_valida_la_entrada(self):
        tel = telefono()
        # un reporte de vecino no es un incidente: no cuenta; ids raros se ignoran
        self.assertEqual(self.vista(tel, "incidente", ["0123456789ab", "../../x"])[1]["nuevas"], 0)
        for cuerpo in ({"tipo": "foto", "ids": [1]}, {"tipo": "aviso", "ids": []}, {"tipo": "aviso", "ids": list(range(31))},
                       {"tipo": "aviso", "ids": [1], "via": "correo"}, {"tipo": "aviso", "ids": "1"}):
            codigo, r, _ = Cliente().post("/api/vistas", cuerpo, cabeceras={"X-Dispositivo": tel})
            self.assertEqual((codigo, r.get("k")), (400, "vistas.invalidas"), cuerpo)
        codigo, _, _ = Cliente().post("/api/vistas", {"tipo": "aviso", "ids": [1]}, cabeceras={"X-Dispositivo": "x"})
        self.assertEqual(codigo, 400)


class DetalleSuperadmin(unittest.TestCase):
    """US5: el superadmin ve qué teléfonos (por código, sin nombre) tienen notificaciones y cuáles abrieron."""
    ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"
    IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"

    def setUp(self):
        apoyo.limpiar_bloqueos()
        self.admin, self.admin_id, *_ = apoyo.sesion("superadmin")
        self.analista, *_ = apoyo.sesion("analista")

    def suscribir(self, tel, ua, recinto=None):
        cuerpo = {"token": "tk-" + uuid.uuid4().hex + uuid.uuid4().hex, "idioma": "es"}
        if recinto is not None:
            cuerpo["recinto_id"] = recinto
        codigo, r, _ = Cliente(apoyo.ip_nueva()).post("/api/push/suscribir", cuerpo, cabeceras={"X-Dispositivo": tel, "User-Agent": ua})
        self.assertEqual(codigo, 200, r)

    def test_telefonos_con_notificaciones_y_quienes_abrieron(self):
        _, _, rid = apoyo.punto_en_canton()
        con_push, sin_push = telefono(), telefono()
        self.suscribir(con_push, self.ANDROID, rid)
        aid = self.analista.post("/api/panel/aviso", {
            "ambito_tipo": "canton", "ambito_id": "yaguachi", "nivel_cod": 2, "titulo": "Detalle " + uuid.uuid4().hex[:6],
            "texto": "Para ver quién abrió", "horas": 12, "forzar": True})[1]["id"]
        Cliente(apoyo.ip_nueva()).post("/api/vistas", {"tipo": "aviso", "ids": [aid], "via": "push"},
                                       cabeceras={"X-Dispositivo": con_push, "User-Agent": self.ANDROID})
        Cliente(apoyo.ip_nueva()).post("/api/vistas", {"tipo": "aviso", "ids": [aid]},
                                       cabeceras={"X-Dispositivo": sin_push, "User-Agent": self.IPHONE})
        codigo, d, _ = self.admin.get("/api/panel/dispositivos")
        self.assertEqual(codigo, 200, d)
        mio = servidor.codigo_telefono(servidor.quien_vista(con_push))
        tel = next(x for x in d["dispositivos"] if x["codigo"] == mio)
        self.assertEqual(tel["plataforma"], "Android · Chrome")
        self.assertEqual(tel["recinto"], servidor.T.recintos[rid]["nombre"])
        self.assertNotIn(con_push, str(d))                                  # nunca el id del teléfono
        codigo, al, _ = self.admin.get(f"/api/panel/alcance/aviso/{aid}")
        self.assertEqual((codigo, al["total"]), (200, 2))
        por_codigo = {x["codigo"]: x for x in al["dispositivos"]}
        self.assertEqual(por_codigo[mio]["vias"], ["push"])                 # el mismo código en las dos listas
        self.assertTrue(por_codigo[mio]["notificaciones"])
        otro = por_codigo[servidor.codigo_telefono(servidor.quien_vista(sin_push))]
        self.assertEqual((otro["plataforma"], otro["notificaciones"], otro["recinto"]), ("iPhone · Safari", False, None))
        # cada consulta queda en la auditoría
        with servidor.db() as con:
            acciones = [r["accion"] for r in con.execute("SELECT accion FROM auditoria WHERE usuario_id=%s", (self.admin_id,))]
        self.assertIn("alcance.dispositivos", acciones)
        self.assertIn("alcance.detalle", acciones)

    def test_solo_el_superadmin(self):
        op, *_ = apoyo.sesion("operador")
        for c in (self.analista, op):
            self.assertEqual(c.get("/api/panel/dispositivos")[0], 403)
            self.assertEqual(c.get("/api/panel/alcance/aviso/1")[0], 403)
        self.assertNotIn("alcance.detalle", self.analista.get("/api/auth/me")[1]["usuario"]["permisos"])

    def test_tipo_de_telefono_aproximado(self):
        import comun
        self.assertEqual(comun.plataforma(self.ANDROID), "Android · Chrome")
        self.assertEqual(comun.plataforma(self.IPHONE), "iPhone · Safari")
        self.assertEqual(comun.plataforma("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36 Edg/130.0"), "Windows · Edge")
        self.assertEqual(comun.plataforma(None), "otro · otro")


class PestanaDispositivos(unittest.TestCase):
    """Pestaña «Dispositivos» (superadmin): los teléfonos que usan la app, con o sin notificaciones."""
    UA = DetalleSuperadmin.ANDROID

    def setUp(self):
        apoyo.limpiar_bloqueos()
        self.admin, *_ = apoyo.sesion("superadmin")

    def actividad(self, tel, **cuerpo):
        return Cliente(apoyo.ip_nueva()).post("/api/actividad", dict({"instalada": True, "idioma": "es", "version": "20261112-1552-24912ed3"}, **cuerpo),
                                               cabeceras={"X-Dispositivo": tel, "User-Agent": self.UA})

    def test_usa_la_app_y_aparece_en_la_pestana(self):
        usa, con_push = telefono(), telefono()
        for _ in range(3):                                      # el mismo teléfono varias veces: una fila, un día
            self.assertEqual(self.actividad(usa)[0], 200)
        Cliente(apoyo.ip_nueva()).post("/api/push/suscribir", {"token": "tk-" + uuid.uuid4().hex * 2, "idioma": "en"},
                                       cabeceras={"X-Dispositivo": con_push, "User-Agent": DetalleSuperadmin.IPHONE})
        codigo, d, _ = self.admin.get("/api/panel/dispositivos")
        self.assertEqual(codigo, 200, d)
        tels = {x["codigo"]: x for x in d["dispositivos"]}
        a = tels[servidor.codigo_telefono(servidor.quien_vista(usa))]
        self.assertEqual((a["plataforma"], a["instalada"], a["idioma"], a["dias"], a["notificaciones"]),
                         ("Android · Chrome", True, "es", 1, False))
        self.assertEqual(a["version"], "20261112-1552-24912ed3")
        b = tels[servidor.codigo_telefono(servidor.quien_vista(con_push))]     # con notificaciones aunque no avisó uso
        self.assertTrue(b["notificaciones"])
        self.assertGreaterEqual(d["resumen"]["hoy"], 2)
        self.assertGreaterEqual(d["resumen"]["con_notificaciones"], 1)
        self.assertNotIn(usa, str(d))
        with servidor.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) AS n FROM dispositivos WHERE quien=%s",
                                         (servidor.quien_vista(usa),)).fetchone()["n"], 1)

    def test_periodos_y_validacion(self):
        tel = telefono()
        self.actividad(tel)
        with servidor.db_escritura() as con:                    # hace 20 días
            con.execute("UPDATE dispositivos SET ultima=%s WHERE quien=%s",
                        (servidor.iso(servidor.ahora() - servidor.dt.timedelta(days=20)), servidor.quien_vista(tel)))
        cod = servidor.codigo_telefono(servidor.quien_vista(tel))
        en = lambda periodo: cod in {x["codigo"] for x in self.admin.get(f"/api/panel/dispositivos?periodo={periodo}")[1]["dispositivos"]}
        self.assertEqual((en("hoy"), en("7d"), en("30d"), en("todos")), (False, False, True, True))
        self.assertEqual(self.admin.get("/api/panel/dispositivos?periodo=siempre")[0], 400)
        self.assertEqual(Cliente().post("/api/actividad", {}, cabeceras={"X-Dispositivo": "x"})[0], 400)
        # datos raros no se guardan tal cual
        self.assertEqual(self.actividad(telefono(), idioma="fr", version="<script>")[0], 200)

    def test_paginas_y_filtros_en_el_servidor(self):
        tels = [telefono() for _ in range(13)]
        for tel in tels:
            self.actividad(tel)
        Cliente(apoyo.ip_nueva()).post("/api/push/suscribir", {"token": "tk-" + uuid.uuid4().hex * 2, "idioma": "es"},
                                       cabeceras={"X-Dispositivo": tels[0], "User-Agent": self.UA})
        p1 = self.admin.get("/api/panel/dispositivos?periodo=todos&n=10&pagina=1")[1]
        p2 = self.admin.get("/api/panel/dispositivos?periodo=todos&n=10&pagina=2")[1]
        self.assertEqual((len(p1["dispositivos"]), p1["pagina"], p1["n"]), (10, 1, 10))
        self.assertEqual(p1["paginas"], -(-p1["total"] // 10))
        self.assertFalse({d["codigo"] for d in p1["dispositivos"]} & {d["codigo"] for d in p2["dispositivos"]})
        lejos = self.admin.get("/api/panel/dispositivos?periodo=todos&n=10&pagina=999")[1]
        self.assertEqual(lejos["pagina"], lejos["paginas"])                         # una página de más: la última
        cod = servidor.codigo_telefono(servidor.quien_vista(tels[0]))
        busca = self.admin.get(f"/api/panel/dispositivos?periodo=todos&codigo={cod.lower()}")[1]
        self.assertIn(cod, [d["codigo"] for d in busca["dispositivos"]])
        push = self.admin.get("/api/panel/dispositivos?periodo=todos&push=1&n=100")[1]
        self.assertTrue(all(d["notificaciones"] for d in push["dispositivos"]))
        self.assertEqual(self.admin.get("/api/panel/dispositivos?pagina=x")[0], 400)

    def test_marca_version_y_formato_sin_modelo(self):
        tel = telefono()
        self.assertEqual(self.actividad(tel, marca="Samsung", so_version=14, formato="telefono")[0], 200)
        self.actividad(tel, marca="SM-A146M", so_version=True, formato="nevera")       # nada de esto se guarda
        cod = servidor.codigo_telefono(servidor.quien_vista(tel))
        d = self.admin.get("/api/panel/dispositivos?periodo=todos")[1]
        x = next(t for t in d["dispositivos"] if t["codigo"] == cod)
        self.assertEqual((x["marca"], x["so_version"], x["formato"]), ("Samsung", 14, "telefono"))
        self.assertNotIn("SM-A146M", str(d))
        self.assertIn({"marca": "Samsung", "n": next(m["n"] for m in d["resumen"]["marcas"] if m["marca"] == "Samsung")},
                      d["resumen"]["marcas"])
        self.assertGreaterEqual(d["resumen"]["formatos"]["telefono"], 1)


if __name__ == "__main__":
    unittest.main()
