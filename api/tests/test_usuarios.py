"""Permisos por rol en /api/panel/*, gestión de usuarios (regla del último superadmin), auditoría y configuración."""
import json
import unittest

import apoyo
from apoyo import Cliente, auth

apoyo.arrancar()

NIVEL = {"ambito_tipo": "canton", "ambito_id": "yaguachi", "nivel_cod": None, "motivo": ""}   # retirar: no cambia nada


class PermisosPorRol(unittest.TestCase):
    def test_sin_sesion_401(self):
        for ruta in ("/api/panel/estado", "/api/panel/reportes", "/api/panel/usuarios", "/api/panel/config"):
            codigo, cuerpo, _ = Cliente().get(ruta)
            self.assertEqual((codigo, cuerpo["k"]), (401, "auth.sesion"), ruta)
        codigo, cuerpo, _ = Cliente().post("/api/panel/nivel", NIVEL)
        self.assertEqual((codigo, cuerpo["k"]), (401, "auth.sesion"))

    def test_operador(self):
        c, *_ = apoyo.sesion("operador")
        for ruta in ("/api/panel/reportes", "/api/panel/ajustes", "/api/panel/incidentes"):
            self.assertEqual(c.get(ruta)[0], 200, ruta)
        prohibidas = [("POST", "/api/panel/nivel", NIVEL), ("POST", "/api/panel/aviso", {}),
                      ("POST", "/api/panel/lectura", {}), ("POST", "/api/panel/regla", {}),
                      ("POST", "/api/panel/ajustes", {}), ("POST", "/api/panel/reportes/0123456789ab", {"estado": "validado"}),
                      ("POST", "/api/panel/avisos/1/anular", {}), ("GET", "/api/panel/usuarios", None),
                      ("POST", "/api/panel/usuarios", {}), ("GET", "/api/panel/config", None),
                      ("POST", "/api/panel/config", {"incidentes_anonimos": True})]
        for metodo, ruta, cuerpo in prohibidas:
            codigo, res, _ = c.pedir(metodo, ruta, cuerpo)
            self.assertEqual((codigo, res.get("k")), (403, "auth.permiso"), ruta)

    def test_analista(self):
        c, *_ = apoyo.sesion("analista")
        self.assertEqual(c.post("/api/panel/nivel", NIVEL)[0], 200)
        self.assertEqual(c.get("/api/panel/ajustes")[0], 200)
        for metodo, ruta in (("GET", "/api/panel/usuarios"), ("GET", "/api/panel/config"),
                             ("POST", "/api/panel/usuarios/1/clave")):
            self.assertEqual(c.pedir(metodo, ruta, {} if metodo == "POST" else None)[0], 403, ruta)

    def test_superadmin(self):
        c, *_ = apoyo.sesion("superadmin")
        self.assertEqual(c.get("/api/panel/usuarios")[0], 200)
        self.assertEqual(c.get("/api/panel/config")[0], 200)

    def test_ruta_desconocida_y_login_viejo(self):
        c, *_ = apoyo.sesion("superadmin")
        self.assertEqual(c.get("/api/panel/no-existe")[0], 404)
        self.assertEqual(c.post("/api/panel/login")[0], 404)        # el PIN ya no existe
        # X-PIN ya no abre nada
        codigo, _, _ = Cliente().get("/api/panel/reportes", cabeceras={"X-PIN": "cualquier-cosa-larga"})
        self.assertEqual(codigo, 401)

    def test_foto_con_sesion_panel_ver(self):
        lat, lon, _ = apoyo.punto_en_canton()
        vecino = apoyo.vecino()
        codigo, rep, _ = vecino.post("/api/reportes", {"dispositivo": "telefono-de-prueba-1", "consentimiento": True,
                                                       "tipo": "vivienda_inundada", "gravedad": 2, "lat": lat, "lon": lon,
                                                       "descripcion": "Entró agua a la casa",
                                                       "foto": apoyo.FOTO}, csrf=False)
        self.assertEqual(codigo, 201, rep)
        ruta = f"/api/foto/{rep['id']}"
        self.assertEqual(Cliente().get(ruta, csrf=False)[0], 404)            # pendiente: no es pública
        op, *_ = apoyo.sesion("operador")
        codigo, _, r = op.get(ruta, csrf=False)                              # <img src>: sin cabecera anti-CSRF
        self.assertEqual((codigo, r.getheader("Content-Type")), (200, "image/jpeg"))
        nuevo, *_ = apoyo.sesion("operador", debe_cambiar=True)
        self.assertEqual(nuevo.get(ruta, csrf=False)[0], 404)
        # el marcador de los incidentes del equipo no sirve como id de teléfono
        self.assertEqual(Cliente().get(ruta, csrf=False, cabeceras={"X-Dispositivo": "equipo"})[0], 404)


class GestionDeUsuarios(unittest.TestCase):
    def setUp(self):
        apoyo.limpiar_bloqueos()
        self.c, self.uid, self.usuario, _ = apoyo.sesion("superadmin")

    def test_crear_y_listar(self):
        nombre = apoyo.nombre_nuevo("ana.")
        codigo, cuerpo, _ = self.c.post("/api/panel/usuarios", {"usuario": nombre, "nombre": "Ana Pérez", "rol": "analista"})
        self.assertEqual(codigo, 201, cuerpo)
        u, clave = cuerpo["usuario"], cuerpo["clave_temporal"]
        self.assertEqual((u["usuario"], u["rol"], u["activo"], u["debe_cambiar_clave"]), (nombre, "analista", True, True))
        self.assertGreaterEqual(len(clave), 12)
        lista = self.c.get("/api/panel/usuarios")[1]["usuarios"]
        self.assertIn(nombre, [x["usuario"] for x in lista])
        self.assertTrue(all("clave" not in x for x in lista))
        codigo, cuerpo, _ = Cliente().login(nombre, clave)
        self.assertEqual((codigo, cuerpo["usuario"]["debe_cambiar_clave"]), (200, True))

    def test_validaciones(self):
        casos = [({"usuario": "AB", "nombre": "Ana", "rol": "analista"}, 400, "usuarios.usuario"),
                 ({"usuario": "con espacio", "nombre": "Ana", "rol": "analista"}, 400, "usuarios.usuario"),
                 ({"usuario": "x" * 33, "nombre": "Ana", "rol": "analista"}, 400, "usuarios.usuario"),
                 ({"usuario": apoyo.nombre_nuevo(), "nombre": "A", "rol": "analista"}, 400, "usuarios.nombre"),
                 ({"usuario": apoyo.nombre_nuevo(), "nombre": "x" * 81, "rol": "analista"}, 400, "usuarios.nombre"),
                 ({"usuario": apoyo.nombre_nuevo(), "nombre": "Ana", "rol": "jefe"}, 400, "usuarios.rol"),
                 ({"usuario": self.usuario, "nombre": "Ana", "rol": "analista"}, 409, "usuarios.existe")]
        for cuerpo_, codigo_, k in casos:
            codigo, cuerpo, _ = self.c.post("/api/panel/usuarios", cuerpo_)
            self.assertEqual((codigo, cuerpo.get("k")), (codigo_, k), cuerpo_)
        self.assertEqual(self.c.post("/api/panel/usuarios/999999", {"nombre": "Nadie"})[1]["k"], "usuarios.no_existe")

    def test_editar_y_cambio_de_rol_cierra_sesiones(self):
        otro, oid, _, _ = apoyo.sesion("analista")
        codigo, cuerpo, _ = self.c.post(f"/api/panel/usuarios/{oid}", {"nombre": "Nombre Nuevo"})
        self.assertEqual((codigo, cuerpo["usuario"]["nombre"]), (200, "Nombre Nuevo"))
        self.assertEqual(otro.get("/api/auth/me")[0], 200)          # cambiar el nombre no cierra la sesión
        codigo, cuerpo, _ = self.c.post(f"/api/panel/usuarios/{oid}", {"rol": "operador"})
        self.assertEqual((codigo, cuerpo["usuario"]["permisos"]), (200, ["panel.ver", "incidentes.crear"]))
        self.assertEqual(otro.get("/api/auth/me")[0], 401)

    def test_desactivar_cierra_sesiones_y_no_a_si_mismo(self):
        otro, oid, ousuario, oclave = apoyo.sesion("operador")
        self.assertEqual(self.c.post(f"/api/panel/usuarios/{oid}", {"activo": False})[0], 200)
        self.assertEqual(otro.get("/api/auth/me")[0], 401)
        self.assertEqual(Cliente().login(ousuario, oclave)[1]["k"], "auth.inactivo")
        self.assertEqual(self.c.post(f"/api/panel/usuarios/{oid}", {"activo": "no"})[0], 400)
        codigo, cuerpo, _ = self.c.post(f"/api/panel/usuarios/{self.uid}", {"activo": False})
        self.assertEqual((codigo, cuerpo["k"]), (409, "usuarios.desactivarse"))

    def test_ultimo_superadmin(self):
        # se deja solo a este superadmin activo (y se restauran los demás al final)
        with apoyo.db_escritura() as con:
            otros = [r["id"] for r in con.execute("SELECT id FROM usuarios WHERE rol='superadmin' AND activo=1 AND id<>%s",
                                                  (self.uid,))]
            con.execute("UPDATE usuarios SET activo=0 WHERE id = ANY(%s)", (otros,))

        def restaurar():
            with apoyo.db_escritura() as con:
                con.execute("UPDATE usuarios SET activo=1 WHERE id = ANY(%s)", (otros,))
        self.addCleanup(restaurar)
        codigo, cuerpo, _ = self.c.post(f"/api/panel/usuarios/{self.uid}", {"rol": "analista"})
        self.assertEqual((codigo, cuerpo["k"]), (409, "usuarios.ultimo_superadmin"))
        # con un segundo superadmin sí se puede; y desactivar a ese segundo deja otra vez uno solo
        _, sid, _, _ = apoyo.sesion("superadmin")
        self.assertEqual(self.c.post(f"/api/panel/usuarios/{sid}", {"activo": False})[0], 200)
        self.assertEqual(self.c.post(f"/api/panel/usuarios/{self.uid}", {"rol": "operador"})[0], 409)
        self.assertEqual(self.c.post(f"/api/panel/usuarios/{sid}", {"activo": True})[0], 200)
        self.assertEqual(self.c.post(f"/api/panel/usuarios/{sid}", {"rol": "analista"})[0], 200)
        self.assertEqual(self.c.post(f"/api/panel/usuarios/{self.uid}", {"rol": "superadmin"})[0], 200)

    def test_restablecer_clave(self):
        otro, oid, ousuario, oclave = apoyo.sesion("analista")
        codigo, cuerpo, _ = self.c.post(f"/api/panel/usuarios/{oid}/clave")
        self.assertEqual(codigo, 200)
        temporal = cuerpo["clave_temporal"]
        self.assertEqual(otro.get("/api/auth/me")[0], 401)
        self.assertEqual(Cliente().login(ousuario, oclave)[0], 401)
        codigo, cuerpo, _ = Cliente().login(ousuario, temporal)
        self.assertEqual((codigo, cuerpo["usuario"]["debe_cambiar_clave"]), (200, True))

    def test_auditoria(self):
        nombre = apoyo.nombre_nuevo()
        uid = self.c.post("/api/panel/usuarios", {"usuario": nombre, "nombre": "Auditado", "rol": "operador"})[1]["usuario"]["id"]
        self.c.post(f"/api/panel/usuarios/{uid}", {"rol": "analista"})
        self.c.post(f"/api/panel/usuarios/{uid}/clave")
        self.c.post("/api/panel/nivel", NIVEL)
        with apoyo.db() as con:
            filas = con.execute("SELECT accion, detalle FROM auditoria WHERE usuario_id=%s ORDER BY id", (self.uid,)).fetchall()
        acciones = [f["accion"] for f in filas]
        for a in ("login", "usuario.crear", "usuario.editar", "usuario.restablecer_clave", "nivel.fijar"):
            self.assertIn(a, acciones)
        # la clave temporal nunca queda en la auditoría
        self.assertFalse(any("clave_temporal" in (f["detalle"] or "") for f in filas))
        self.assertEqual(json.loads(filas[acciones.index("usuario.editar")]["detalle"]), {"id": uid, "rol": "analista"})


class Configuracion(unittest.TestCase):
    def test_get_y_post(self):
        c, *_ = apoyo.sesion("superadmin")
        vecinos = {"validacion_vecinos": True, "validacion_minimo": 3, "validacion_radio_m": 300, "validacion_horas": 3}   # spec 022
        self.assertEqual(c.get("/api/panel/config")[1], {"incidentes_anonimos": False, "operador_valida_directo": True, **vecinos})
        self.assertEqual(c.post("/api/panel/config", {"incidentes_anonimos": "si"})[1]["k"], "config.valor")
        self.assertEqual(c.post("/api/panel/config", {"incidentes_anonimos": True})[1], {"ok": True})
        self.assertEqual(c.get("/api/panel/config")[1], {"incidentes_anonimos": True, "operador_valida_directo": True, **vecinos})
        self.assertEqual(c.post("/api/panel/config", {"incidentes_anonimos": False})[0], 200)


class Roles(unittest.TestCase):
    def test_tabla_de_permisos(self):
        self.assertEqual(set(auth.ROLES["superadmin"]), set(auth.PERMISOS_TODOS))
        self.assertNotIn("usuarios.gestionar", auth.ROLES["analista"])
        self.assertNotIn("config.editar", auth.ROLES["analista"])
        self.assertIn("incidentes.gestionar", auth.ROLES["analista"])
        self.assertEqual(auth.ROLES["operador"], ("panel.ver", "incidentes.crear"))


if __name__ == "__main__":
    unittest.main()
