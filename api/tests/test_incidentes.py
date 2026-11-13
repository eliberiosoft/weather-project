"""Incidentes del equipo: autoría, anonimato al leer, validaciones, permisos de edición y retiro."""
import json
import unittest

import apoyo
from apoyo import Cliente, servidor

apoyo.arrancar()


def incidente(**extra):
    lat, lon, _ = apoyo.punto_en_canton()
    b = {"tipo": "via_cerrada", "gravedad": 2, "descripcion": "Puente cerrado por crecida", "lat": lat, "lon": lon}
    b.update(extra)
    return b


def publicos():
    return {r["id"]: r for r in Cliente().get("/api/reportes", csrf=False)[1]["reportes"]}


class Incidentes(unittest.TestCase):
    def setUp(self):
        apoyo.limpiar_bloqueos()
        self.op, self.op_id, self.op_usuario, _ = apoyo.sesion("operador")

    def test_crear_con_autor(self):
        codigo, cuerpo, _ = self.op.post("/api/panel/incidentes", incidente(foto=apoyo.FOTO))
        self.assertEqual(codigo, 201, cuerpo)
        self.assertEqual(sorted(cuerpo), ["estado", "id"])
        self.assertEqual(cuerpo["estado"], "validado")
        r = publicos()[cuerpo["id"]]
        self.assertEqual(r["origen"], "equipo")
        self.assertEqual(r["autor"], {"nombre": f"Persona {self.op_usuario}", "rol": "operador"})
        self.assertTrue(r["verificado"])
        self.assertTrue(r["foto"])                      # verificado: la foto es pública
        self.assertFalse(r["mio"])
        # ni el id ni el usuario del autor aparecen en la respuesta pública
        crudo = json.dumps(Cliente().get("/api/reportes", csrf=False)[1])
        self.assertNotIn(self.op_usuario + '"', crudo.replace(f"Persona {self.op_usuario}", ""))
        self.assertNotIn("autor_id", crudo)
        with apoyo.db() as con:
            fila = con.execute("SELECT * FROM reportes WHERE id=%s", (cuerpo["id"],)).fetchone()
        self.assertEqual((fila["estado"], fila["origen"], fila["autor_id"], fila["en_canton"]),
                         ("validado", "equipo", self.op_id, 1))
        self.assertEqual(Cliente().get(f"/api/foto/{cuerpo['id']}", csrf=False)[0], 200)

    def test_anonimato_al_leer(self):
        iid = self.op.post("/api/panel/incidentes", incidente())[1]["id"]
        admin, *_ = apoyo.sesion("superadmin")
        self.assertEqual(admin.post("/api/panel/config", {"incidentes_anonimos": True})[0], 200)
        self.addCleanup(admin.post, "/api/panel/config", {"incidentes_anonimos": False})
        r = publicos()[iid]
        self.assertEqual((r["origen"], r["autor"]), ("equipo", None))      # afecta también a lo ya publicado
        # el panel sigue viendo quién lo publicó
        lista = {x["id"]: x for x in self.op.get("/api/panel/incidentes")[1]["incidentes"]}
        self.assertEqual(lista[iid]["autor"]["rol"], "operador")

    def test_reporte_de_vecino(self):
        lat, lon, _ = apoyo.punto_en_canton()
        codigo, rep, _ = apoyo.vecino().post("/api/reportes", {"dispositivo": "telefono-vecino-22", "consentimiento": True,
                                                          "tipo": "calle_inundada", "altura_agua": 2, "lat": lat, "lon": lon,
                                                          "descripcion": "Agua sobre la vereda"},
                                        csrf=False)
        self.assertEqual(codigo, 201)
        r = publicos()[rep["id"]]
        self.assertEqual((r["origen"], r["autor"]), ("vecino", None))

    def test_validaciones(self):
        casos = [(dict(tipo="no-existe"), "incidentes.tipo"), (dict(gravedad=0), "incidentes.gravedad"),
                 (dict(gravedad=4), "incidentes.gravedad"), (dict(gravedad="alta"), "incidentes.gravedad"),
                 (dict(horas=0), "incidentes.horas"), (dict(horas=169), "incidentes.horas"),
                 (dict(descripcion=""), "incidentes.descripcion"), (dict(descripcion="   "), "incidentes.descripcion"),
                 (dict(descripcion="x" * 501), "incidentes.descripcion"), (dict(descripcion="..."), "incidentes.descripcion"),
                 (dict(descripcion="ok"), "incidentes.descripcion"),
                 (dict(lat=-2.0, lon=-80.5), "incidentes.fuera"), (dict(lat=None), "incidentes.ubicacion"),
                 (dict(foto="data:image/png;base64,AAAA"), "foto.formato"), (dict(altura_agua=9), "incidentes.altura")]
        for extra, k in casos:
            codigo, cuerpo, _ = self.op.post("/api/panel/incidentes", incidente(**extra))
            self.assertEqual((codigo, cuerpo.get("k")), (400, k), extra)

    def test_horas_por_defecto_y_explicitas(self):
        # (tipos distintos: el mismo tipo en el mismo punto sería un duplicado, ver test_duplicado)
        for extra, horas in ((dict(tipo="calle_inundada"), 8), (dict(tipo="via_cerrada", horas=30), 30)):
            iid = self.op.post("/api/panel/incidentes", incidente(**extra))[1]["id"]
            with apoyo.db() as con:
                f = con.execute("SELECT creado, expira FROM reportes WHERE id=%s", (iid,)).fetchone()
            dif = servidor.leer_iso(f["expira"]) - servidor.leer_iso(f["creado"])
            self.assertEqual(dif.total_seconds(), horas * 3600)

    def test_duplicado(self):
        """El mismo incidente dos veces (doble toque o reenvío de la cola sin señal) se rechaza; otro tipo, otra
        persona o uno retirado no cuentan."""
        primero = self.op.post("/api/panel/incidentes", incidente())
        self.assertEqual(primero[0], 201, primero[1])
        codigo, cuerpo, _ = self.op.post("/api/panel/incidentes", incidente())
        self.assertEqual((codigo, cuerpo.get("k")), (409, "incidentes.duplicado"))
        self.assertEqual(self.op.post("/api/panel/incidentes", incidente(tipo="socavon"))[0], 201)
        otro, *_ = apoyo.sesion("operador")
        self.assertEqual(otro.post("/api/panel/incidentes", incidente())[0], 201)
        self.assertEqual(self.op.post(f"/api/panel/incidentes/{primero[1]['id']}", {"estado": "retirado"})[0], 200)
        self.assertEqual(self.op.post("/api/panel/incidentes", incidente())[0], 201)

    def test_operador_ve_solo_los_suyos(self):
        mio = self.op.post("/api/panel/incidentes", incidente())[1]["id"]
        otro, *_ = apoyo.sesion("operador")
        ajeno = otro.post("/api/panel/incidentes", incidente())[1]["id"]
        ids = {x["id"] for x in self.op.get("/api/panel/incidentes")[1]["incidentes"]}
        self.assertIn(mio, ids)
        self.assertNotIn(ajeno, ids)
        analista, *_ = apoyo.sesion("analista")
        todos = {x["id"]: x for x in analista.get("/api/panel/incidentes")[1]["incidentes"]}
        self.assertTrue({mio, ajeno} <= set(todos))
        self.assertTrue(todos[mio]["editable"])

    def test_editar_y_retirar(self):
        iid = self.op.post("/api/panel/incidentes", incidente())[1]["id"]
        otro, *_ = apoyo.sesion("operador")
        codigo, cuerpo, _ = otro.post(f"/api/panel/incidentes/{iid}", {"descripcion": "intento ajeno"})
        self.assertEqual((codigo, cuerpo["k"]), (403, "auth.permiso"))
        self.assertEqual(self.op.post(f"/api/panel/incidentes/{iid}", {"descripcion": "Ya pasa una sola vía", "gravedad": 1})[1],
                         {"ok": True})
        r = publicos()[iid]
        self.assertEqual((r["descripcion"], r["gravedad"]), ("Ya pasa una sola vía", 1))
        self.assertEqual(self.op.post(f"/api/panel/incidentes/{iid}", {"estado": "validado"})[1]["k"], "incidentes.estado")
        self.assertEqual(self.op.post("/api/panel/incidentes/0123456789ab", {"gravedad": 1})[0], 404)
        analista, *_ = apoyo.sesion("analista")                 # incidentes.gestionar
        self.assertEqual(analista.post(f"/api/panel/incidentes/{iid}", {"estado": "retirado"})[0], 200)
        self.assertNotIn(iid, publicos())                        # un incidente retirado deja de verse en público
        self.assertEqual(self.op.get("/api/panel/incidentes")[1]["incidentes"][0]["estado"], "retirado")

    def test_reactivar_retirado_solo_superadmin(self):
        lat, lon, _ = apoyo.punto_en_canton()
        iid = self.op.post("/api/panel/incidentes", incidente(lat=lat, lon=lon + 0.0003))[1]["id"]
        creado = publicos()[iid]["creado"]
        admin, *_ = apoyo.sesion("superadmin")
        analista, *_ = apoyo.sesion("analista")
        # solo uno retirado se puede volver a presentar
        self.assertEqual(admin.post(f"/api/panel/incidentes/{iid}/reactivar", {})[1]["k"], "incidentes.no_retirado")
        self.assertEqual(analista.post(f"/api/panel/incidentes/{iid}", {"estado": "retirado"})[0], 200)
        for c in (self.op, analista):
            codigo, cuerpo, _ = c.post(f"/api/panel/incidentes/{iid}/reactivar", {})
            self.assertEqual((codigo, cuerpo.get("k")), (403, "auth.permiso"))
        self.assertNotIn(iid, publicos())
        self.assertTrue(admin.post(f"/api/panel/incidentes/{iid}/reactivar", {})[1]["ok"])
        r = publicos()[iid]
        self.assertEqual((r["estado"], r["creado"]), ("validado", creado))   # conserva la fecha de publicación
        self.assertEqual(admin.post("/api/panel/incidentes/0123456789ab/reactivar", {})[0], 404)

    def test_reactivar_vencido_vuelve_a_vencer_desde_ahora(self):
        lat, lon, _ = apoyo.punto_en_canton()
        iid = self.op.post("/api/panel/incidentes", incidente(lat=lat, lon=lon - 0.0003))[1]["id"]
        with servidor.db_escritura() as con:
            con.execute("UPDATE reportes SET estado='retirado', expira=%s WHERE id=%s", ("2020-01-01T00:00:00-05:00", iid))
        admin, *_ = apoyo.sesion("superadmin")
        expira = admin.post(f"/api/panel/incidentes/{iid}/reactivar", {})[1]["expira"]
        self.assertGreater(servidor.leer_iso(expira), servidor.ahora())
        self.assertIn(iid, publicos())

    def test_eliminar_solo_superadmin_y_definitivo(self):
        lat, lon, _ = apoyo.punto_en_canton()
        iid = self.op.post("/api/panel/incidentes", incidente(lat=lat + 0.0003, lon=lon, foto=apoyo.FOTO))[1]["id"]
        with servidor.db() as con:
            foto = con.execute("SELECT foto FROM reportes WHERE id=%s", (iid,)).fetchone()["foto"]
        self.assertTrue(foto)
        analista, *_ = apoyo.sesion("analista")
        for c in (self.op, analista):
            codigo, cuerpo, _ = c.post(f"/api/panel/incidentes/{iid}/eliminar", {})
            self.assertEqual((codigo, cuerpo.get("k")), (403, "auth.permiso"))
        admin, admin_id, *_ = apoyo.sesion("superadmin")
        self.assertEqual(admin.post(f"/api/panel/incidentes/{iid}/eliminar", {})[1], {"ok": True})
        self.assertNotIn(iid, publicos())
        self.assertNotIn(iid, {r["id"] for r in admin.get("/api/panel/incidentes")[1]["incidentes"]})
        import os
        self.assertFalse(os.path.exists(os.path.join(servidor.FOTOS, foto)))
        with servidor.db() as con:
            self.assertIsNone(con.execute("SELECT 1 FROM reportes WHERE id=%s", (iid,)).fetchone())
            a = con.execute("SELECT usuario_id, detalle FROM auditoria WHERE accion='incidente.eliminar' "
                            "ORDER BY id DESC LIMIT 1").fetchone()
        self.assertEqual(a["usuario_id"], admin_id)
        detalle = json.loads(a["detalle"])
        self.assertEqual(detalle["id"], iid)
        self.assertNotIn("descripcion", detalle)                 # el texto no se guarda en la auditoría
        self.assertEqual(admin.post(f"/api/panel/incidentes/{iid}/eliminar", {})[1]["k"], "incidentes.no_existe")

    def test_permisos(self):
        nuevo, *_ = apoyo.sesion("operador", debe_cambiar=True)
        self.assertEqual(nuevo.post("/api/panel/incidentes", incidente())[1]["k"], "auth.cambiar_clave")
        self.assertEqual(Cliente().post("/api/panel/incidentes", incidente())[0], 401)
        self.assertEqual(self.op.post("/api/panel/incidentes", incidente(), csrf=False)[0], 403)

    def test_cuenta_para_el_nivel(self):
        """Un incidente grave del equipo pesa como un reporte verificado (RESPUESTA a menos de 1,5 km)."""
        lat, lon, rid = apoyo.punto_en_canton()
        self.op.post("/api/panel/incidentes", incidente(tipo="desborde", gravedad=3, lat=lat, lon=lon))
        self.assertEqual(servidor.calcular_estado(forzar=True)["recintos"][rid]["sugerido"], 4)

    def test_operador_publica_pendiente_si_el_superadmin_lo_pide(self):
        """«operador_valida_directo» (configuración, solo superadmin): encendido por defecto, el operador publica
        validado; apagado, su incidente queda pendiente (no se ve en la app) hasta que el analista lo verifique.
        El analista publica validado siempre."""
        sa, *_ = apoyo.sesion("superadmin")
        an, *_ = apoyo.sesion("analista")
        self.assertTrue(self.op.get("/api/auth/me")[1]["publicacion"]["validado_directo"])
        self.assertEqual(sa.post("/api/panel/config", {"operador_valida_directo": False})[0], 200)
        try:
            self.assertFalse(self.op.get("/api/auth/me")[1]["publicacion"]["validado_directo"])
            self.assertTrue(an.get("/api/auth/me")[1]["publicacion"]["validado_directo"])
            codigo, r, _ = self.op.post("/api/panel/incidentes", incidente(tipo="arbol_poste"))
            self.assertEqual((codigo, r["estado"]), (201, "pendiente"), r)
            iid = r["id"]
            self.assertNotIn(iid, publicos())
            _, r2, _ = an.post("/api/panel/incidentes", incidente(tipo="sin_luz"))
            self.assertEqual(r2["estado"], "validado")
            self.assertEqual(an.post(f"/api/panel/reportes/{iid}", {"estado": "validado"})[0], 200)
            self.assertIn(iid, publicos())
            self.assertEqual(sa.post("/api/panel/config", {"operador_valida_directo": "no"})[0], 400)
            self.assertEqual(an.post("/api/panel/config", {"operador_valida_directo": True})[0], 403)
        finally:
            sa.post("/api/panel/config", {"operador_valida_directo": True})

    def test_tipos_de_ciudad(self):
        """Baches, basura sin recoger y robos (pedido del dueño): se reportan, salen en el territorio y nunca suben
        el nivel de inundación aunque estén verificados."""
        lat, lon, rid = apoyo.punto_en_canton()
        antes = servidor.calcular_estado(forzar=True)["recintos"][rid]["sugerido"]
        for tipo in ("bache", "basura", "robo"):
            self.assertIn(tipo, servidor.TIPOS)
            self.assertFalse(servidor.TIPOS[tipo][3])
            codigo, r, _ = self.op.post("/api/panel/incidentes", incidente(tipo=tipo, gravedad=3, lat=lat, lon=lon))
            self.assertEqual(codigo, 201, r)
            disp = f"telefono-ciudad-{tipo}"
            codigo, r, _ = apoyo.vecino().post("/api/reportes", {"dispositivo": disp, "consentimiento": True, "tipo": tipo,
                                                                 "gravedad": 2, "lat": lat, "lon": lon,
                                                                 "descripcion": "Reporte de prueba de la ciudad"}, csrf=False)
            self.assertEqual(codigo, 201, r)
        self.assertEqual(servidor.calcular_estado(forzar=True)["recintos"][rid]["sugerido"], antes)

    def test_vecino_no_tipifica_la_gravedad(self):
        """El vecino no elige la gravedad (pedido del dueño): su reporte entra «por tipificar» aunque la mande, y el
        equipo la fija al verificar; sin fijarla no se puede verificar. La calle inundada sigue la altura del agua."""
        lat, lon, _ = apoyo.punto_en_canton()
        codigo, r, _ = apoyo.vecino().post("/api/reportes", {"dispositivo": "telefono-tipificar-01", "consentimiento": True,
                                                             "tipo": "otro", "gravedad": 3, "lat": lat, "lon": lon,
                                                             "descripcion": "Un problema sencillo en la esquina"}, csrf=False)
        self.assertEqual(codigo, 201, r)
        rid = r["id"]
        with servidor.db() as con:
            self.assertEqual(con.execute("SELECT gravedad FROM reportes WHERE id=%s", (rid,)).fetchone()["gravedad"], 0)
        analista, *_ = apoyo.sesion("analista")
        codigo, r, _ = analista.post(f"/api/panel/reportes/{rid}", {"estado": "validado"})
        self.assertEqual((codigo, r.get("k")), (400, "reportes.tipificar"))
        self.assertEqual(analista.post(f"/api/panel/reportes/{rid}", {"estado": "validado", "gravedad": 9})[0], 400)
        self.assertEqual(analista.post(f"/api/panel/reportes/{rid}", {"estado": "validado", "gravedad": 1})[0], 200)
        with servidor.db() as con:
            self.assertEqual(con.execute("SELECT gravedad, estado FROM reportes WHERE id=%s", (rid,)).fetchone(),
                             {"gravedad": 1, "estado": "validado"})

    def test_motivo_grave_lleva_al_caso(self):
        """El motivo «graves» dice qué caso sube el nivel y de dónde viene, para poder llegar a él y retirarlo."""
        lat, lon, rid = apoyo.punto_en_canton()
        iid = self.op.post("/api/panel/incidentes", incidente(tipo="vivienda_inundada", gravedad=2, lat=lat, lon=lon))[1]["id"]
        def graves():
            ms = servidor.calcular_estado(forzar=True)["recintos"][rid]["motivos"]
            return next((x["v"] for x in ms if x["k"] == "graves"), None)
        g = graves()
        self.assertIn(iid, g["ids"].split(","))
        self.assertGreaterEqual(g["equipo"], 1)
        self.assertEqual(g["equipo"] + g["vecinos"], g["n"])
        # retirado, deja de contar (otras pruebas pueden dejar más casos cerca: se mira solo este)
        self.assertEqual(self.op.post(f"/api/panel/incidentes/{iid}", {"estado": "retirado"})[0], 200)
        g = graves()
        self.assertTrue(g is None or iid not in g["ids"].split(","))


if __name__ == "__main__":
    unittest.main()
