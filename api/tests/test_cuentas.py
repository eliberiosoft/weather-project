"""Cuentas ciudadanas (spec 018): registro propio con cédula, ingreso por correo o cédula, bloqueo, perfil, foto,
eliminar y reportar con o sin cuenta."""
import os
import unittest

import apoyo
from apoyo import Cliente, cuentas

apoyo.arrancar()

def reporte(**extra):
    lat, lon, _ = apoyo.punto_en_canton()
    b = {"dispositivo": "telefono-" + apoyo.nombre_nuevo(), "consentimiento": True, "tipo": "otro",
         "descripcion": "Árbol caído en la vía", "lat": lat, "lon": lon}
    b.update(extra)
    return b


def registrar(c=None, **extra):
    c = c or Cliente()
    d = apoyo.datos_registro(**extra)
    return c, d, c.post("/api/cuenta/registro", d)


class Cedula(unittest.TestCase):
    def test_modulo_10(self):
        self.assertTrue(cuentas.cedula_valida("1710034065"))
        self.assertTrue(cuentas.cedula_valida("0926687856"))
        for mala in ("1710034066", "171003406", "17100340655", "2510034065", "1790034065", "abcdefghij", "", None):
            self.assertFalse(cuentas.cedula_valida(mala), mala)


class Registro(unittest.TestCase):
    def setUp(self):
        apoyo.limpiar_bloqueos()

    def test_registro_crea_cuenta_y_sesion(self):
        c, d, (codigo, r, resp) = registrar(nombre="  Ana   María  Pérez ", email="Ana.Perez@Ejemplo.EC")
        self.assertEqual(codigo, 201, r)
        cz = r["ciudadano"]
        self.assertEqual(set(cz), {"nombre", "cedula", "email", "foto", "creado"})
        self.assertEqual((cz["nombre"], cz["email"], cz["cedula"]), ("Ana María Pérez", "ana.perez@ejemplo.ec", d["cedula"]))
        self.assertFalse(cz["foto"])
        galleta = resp.getheader("Set-Cookie")
        self.assertTrue(galleta.startswith(cuentas.COOKIE + "="))
        self.assertIn("HttpOnly", galleta)
        self.assertIn("SameSite=Strict", galleta)
        self.assertEqual(c.get("/api/cuenta/yo")[1]["ciudadano"]["cedula"], d["cedula"])
        with apoyo.db() as con:
            fila = con.execute("SELECT clave FROM ciudadanos WHERE cedula=%s", (d["cedula"],)).fetchone()
        self.assertTrue(fila["clave"].startswith("scrypt$"))

    def test_validaciones(self):
        casos = [({"nombre": "Ana"}, "cuenta.nombre"), ({"nombre": "Anabella"}, "cuenta.nombre"),
                 ({"nombre": "Ana Pérez3"}, "cuenta.nombre"), ({"nombre": "Ana " + "x" * 117}, "cuenta.nombre"),
                 ({"nombre": "Ana -"}, "cuenta.nombre"), ({"nombre": None}, "cuenta.nombre"),
                 ({"cedula": "1710034066"}, "cuenta.cedula"),
                 ({"cedula": "17100340"}, "cuenta.cedula"), ({"email": "sin-arroba"}, "cuenta.email"),
                 ({"email": "a@b"}, "cuenta.email"), ({"clave": "corta"}, "cuenta.clave"),
                 ({"clave": "x" * 129}, "cuenta.clave"), ({"consentimiento": False}, "cuenta.consentimiento"),
                 ({"consentimiento": "si"}, "cuenta.consentimiento"), ({"foto": "data:image/png;base64,AAAA"}, "foto.formato")]
        for extra, k in casos:
            codigo, r, resp = registrar(**extra)[2]
            self.assertEqual((codigo, r.get("k")), (400, k), extra)
            self.assertIsNone(resp.getheader("Set-Cookie"))

    def test_contrasena_de_6_a_128(self):
        codigo, r, _ = registrar(clave="12345")[2]
        self.assertEqual((codigo, r.get("k"), r.get("error")),
                         (400, "cuenta.clave", "la contraseña debe tener de 6 a 128 caracteres"))
        for buena in ("123456", "x" * 128):
            c, d, (codigo, r, _) = registrar(clave=buena)
            self.assertEqual(codigo, 201, r)
            self.assertEqual(Cliente().post("/api/cuenta/ingresar", {"usuario": d["cedula"], "clave": buena})[0], 200)

    def test_duplicados(self):
        _, d, (codigo, _, _) = registrar()
        self.assertEqual(codigo, 201)
        codigo, r, _ = registrar(cedula=d["cedula"])[2]
        self.assertEqual((codigo, r.get("k")), (409, "cuenta.cedula_existe"))
        codigo, r, _ = registrar(email=d["email"].upper())[2]
        self.assertEqual((codigo, r.get("k")), (409, "cuenta.email_existe"))

    def test_tope_de_cuentas_por_ip(self):
        ip = apoyo.ip_nueva()
        for _ in range(cuentas.CUENTAS_NUEVAS_IP_HORA):
            self.assertEqual(registrar(Cliente(ip))[2][0], 201)
        codigo, r, _ = registrar(Cliente(ip))[2]
        self.assertEqual((codigo, r.get("k")), (429, "cuenta.espera"))

    def test_registro_con_foto(self):
        c, _, (codigo, r, _) = registrar(foto=apoyo.FOTO)
        self.assertEqual((codigo, r["ciudadano"]["foto"]), (201, True))
        codigo, crudo, resp = c.get("/api/cuenta/foto")
        self.assertEqual((codigo, resp.getheader("Content-Type"), resp.getheader("Cache-Control")),
                         (200, "image/jpeg", "private, no-store"))
        self.assertTrue(crudo.startswith(b"\xff\xd8\xff"))


class Ingreso(unittest.TestCase):
    def setUp(self):
        apoyo.limpiar_bloqueos()
        _, self.d, (codigo, _, _) = registrar()
        self.assertEqual(codigo, 201)

    def test_por_correo_y_por_cedula(self):
        for usuario in (self.d["email"].upper(), self.d["cedula"]):
            c = Cliente()
            codigo, r, _ = c.post("/api/cuenta/ingresar", {"usuario": usuario, "clave": self.d["clave"]})
            self.assertEqual((codigo, r["ciudadano"]["cedula"]), (200, self.d["cedula"]), usuario)
            self.assertEqual(c.get("/api/cuenta/yo")[0], 200)

    def test_credenciales_malas(self):
        for usuario, clave in ((self.d["email"], "otra-clave-123"), ("nadie@ejemplo.ec", "x" * 10), ("Ana", "x" * 10),
                               (self.d["cedula"], None)):
            codigo, r, resp = Cliente().post("/api/cuenta/ingresar", {"usuario": usuario, "clave": clave})
            self.assertEqual((codigo, r.get("k")), (401, "cuenta.credenciales"))
            self.assertIsNone(resp.getheader("Set-Cookie"))

    def test_bloqueo_por_fallos(self):
        c = Cliente()
        for _ in range(5):
            self.assertEqual(c.post("/api/cuenta/ingresar", {"usuario": self.d["email"], "clave": "mala-mala-1"})[0], 401)
        codigo, r, _ = c.post("/api/cuenta/ingresar", {"usuario": self.d["email"], "clave": self.d["clave"]})
        self.assertEqual((codigo, r.get("k")), (429, "cuenta.espera"))
        # la cuenta también queda en espera desde otra conexión (con tope de 15 min)
        codigo, r, _ = Cliente().post("/api/cuenta/ingresar", {"usuario": self.d["email"], "clave": self.d["clave"]})
        self.assertEqual((codigo, r.get("k")), (429, "cuenta.espera"))

    def test_cuenta_desactivada(self):
        with apoyo.db_escritura() as con:
            con.execute("UPDATE ciudadanos SET activo=0 WHERE cedula=%s", (self.d["cedula"],))
        codigo, r, _ = Cliente().post("/api/cuenta/ingresar", {"usuario": self.d["cedula"], "clave": self.d["clave"]})
        self.assertEqual((codigo, r.get("k")), (403, "cuenta.inactiva"))

    def test_csrf(self):
        codigo, r, _ = Cliente().post("/api/cuenta/ingresar", {"usuario": self.d["email"], "clave": self.d["clave"]},
                                      csrf=False)
        self.assertEqual((codigo, r.get("k")), (403, "auth.csrf"))
        codigo, r, _ = Cliente().post("/api/cuenta/registro", apoyo.datos_registro(), csrf=False)
        self.assertEqual(codigo, 403)


class Sesion(unittest.TestCase):
    def test_yo_sin_sesion_y_cookie_vieja(self):
        self.assertEqual(Cliente().get("/api/cuenta/yo")[1].get("k"), "cuenta.sesion")
        c = Cliente()
        c.cookie_ciudadano = "token-que-no-existe"
        codigo, r, resp = c.get("/api/cuenta/yo")
        self.assertEqual((codigo, r.get("k")), (401, "cuenta.sesion"))
        self.assertIn("Max-Age=0", resp.getheader("Set-Cookie"))

    def test_salir(self):
        c = apoyo.vecino()
        token = c.cookie_ciudadano
        codigo, _, resp = c.post("/api/cuenta/salir")
        self.assertEqual(codigo, 200)
        self.assertIn("Max-Age=0", resp.getheader("Set-Cookie"))
        otro = Cliente()
        otro.cookie_ciudadano = token
        self.assertEqual(otro.get("/api/cuenta/yo")[0], 401)

    def test_sesion_de_panel_no_sirve(self):
        panel, *_ = apoyo.sesion("superadmin")
        self.assertEqual(panel.get("/api/cuenta/yo")[0], 401)
        self.assertEqual(apoyo.vecino().get("/api/panel/estado")[0], 401)

    def test_sesion_vencida(self):
        c = apoyo.vecino()
        with apoyo.db_escritura() as con:
            con.execute("UPDATE sesiones_ciudadanos SET ultimo_uso='2020-01-01T00:00:00-05:00' WHERE token_sha=%s",
                        (cuentas._sha(c.cookie_ciudadano),))
        self.assertEqual(c.get("/api/cuenta/yo")[0], 401)


class Perfil(unittest.TestCase):
    def setUp(self):
        apoyo.limpiar_bloqueos()

    def test_foto_subir_cambiar_quitar(self):
        c = apoyo.vecino()
        self.assertEqual(c.get("/api/cuenta/foto")[0], 404)
        codigo, r, _ = c.post("/api/cuenta/foto", {"foto": apoyo.FOTO})
        self.assertEqual((codigo, r["ciudadano"]["foto"]), (200, True))
        with apoyo.db() as con:
            primera = con.execute("SELECT foto FROM ciudadanos WHERE cedula=%s", (r["ciudadano"]["cedula"],)).fetchone()["foto"]
        self.assertTrue(primera.startswith(cuentas.PREFIJO_FOTO))
        self.assertTrue(os.path.isfile(cuentas.ruta_foto(primera)))
        c.post("/api/cuenta/foto", {"foto": apoyo.FOTO})
        self.assertFalse(os.path.isfile(cuentas.ruta_foto(primera)))          # la anterior se borra
        codigo, r, _ = c.post("/api/cuenta/foto", {"foto": None})
        self.assertEqual((codigo, r["ciudadano"]["foto"]), (200, False))
        self.assertEqual(c.get("/api/cuenta/foto")[0], 404)
        # la foto es privada: sin sesión no se ve
        self.assertEqual(Cliente().get("/api/cuenta/foto")[0], 401)
        self.assertEqual(c.post("/api/cuenta/foto", {"foto": "no-es-jpeg"})[1].get("k"), "foto.formato")
        self.assertEqual(c.post("/api/cuenta/foto", {})[0], 400)

    def test_tope_de_cambios_de_foto(self):
        c = apoyo.vecino()
        for _ in range(cuentas.CAMBIOS_FOTO_DIA):
            self.assertEqual(c.post("/api/cuenta/foto", {"foto": None})[0], 200)
        self.assertEqual(c.post("/api/cuenta/foto", {"foto": None})[1].get("k"), "cuenta.espera")

    def test_perfil_cambia_nombre_y_correo_pero_nunca_la_cedula(self):
        c, d, _ = registrar()
        cuerpo = {"nombre": "Ana  Vera", "email": "Nueva." + d["email"], "cedula": apoyo.cedula_nueva()}
        codigo, r, _ = c.post("/api/cuenta/perfil", cuerpo)
        self.assertEqual(codigo, 200, r)
        cz = r["ciudadano"]
        self.assertEqual((cz["nombre"], cz["email"], cz["cedula"]),
                         ("Ana Vera", "nueva." + d["email"], d["cedula"]))      # la cédula que llega se ignora
        # el mismo correo propio no es un duplicado
        self.assertEqual(c.post("/api/cuenta/perfil", {"nombre": "Ana Vera", "email": cz["email"]})[0], 200)
        _, otro, _ = registrar()
        codigo, r, _ = c.post("/api/cuenta/perfil", {"nombre": "Ana Vera", "email": otro["email"]})
        self.assertEqual((codigo, r.get("k")), (409, "cuenta.email_existe"))
        for malo, k in (({"nombre": "Ana"}, "cuenta.nombre"), ({"email": "x@y"}, "cuenta.email")):
            cuerpo = {"nombre": "Ana Vera", "email": cz["email"], **malo}
            codigo, r, _ = c.post("/api/cuenta/perfil", cuerpo)
            self.assertEqual((codigo, r.get("k")), (400, k))
        self.assertEqual(c.post("/api/cuenta/perfil", {"nombre": "Ana", "email": cz["email"]})[1].get("error"),
                         "escribe tus nombres y apellidos")
        self.assertEqual(Cliente().post("/api/cuenta/perfil", {"nombre": "Ana Vera"})[0], 401)

    def test_rutas_de_facebook_ya_no_existen(self):
        for ruta in ("/api/cuenta/facebook", "/api/cuenta/facebook/vuelta", "/api/cuenta/config"):
            self.assertEqual(Cliente().get(ruta)[0], 404, ruta)


class Eliminar(unittest.TestCase):
    def test_eliminar_borra_cuenta_sesiones_y_foto(self):
        c, d, _ = registrar(foto=apoyo.FOTO)
        self.assertEqual(c.post("/api/reportes", reporte())[0], 201)
        with apoyo.db() as con:
            fila = con.execute("SELECT id, foto FROM ciudadanos WHERE cedula=%s", (d["cedula"],)).fetchone()
        token = c.cookie_ciudadano
        codigo, _, resp = c.post("/api/cuenta/eliminar")
        self.assertEqual(codigo, 200)
        self.assertIn("Max-Age=0", resp.getheader("Set-Cookie"))
        self.assertFalse(os.path.isfile(cuentas.ruta_foto(fila["foto"])))
        with apoyo.db() as con:
            self.assertIsNone(con.execute("SELECT 1 FROM ciudadanos WHERE id=%s", (fila["id"],)).fetchone())
            self.assertEqual(con.execute("SELECT COUNT(*) AS n FROM sesiones_ciudadanos WHERE ciudadano_id=%s",
                                         (fila["id"],)).fetchone()["n"], 0)
            self.assertEqual(con.execute("SELECT COUNT(*) AS n FROM reportes WHERE ciudadano_id=%s",
                                         (fila["id"],)).fetchone()["n"], 0)
        otro = Cliente()
        otro.cookie_ciudadano = token
        self.assertEqual(otro.get("/api/cuenta/yo")[0], 401)
        # la cédula queda libre para volver a registrarse
        self.assertEqual(registrar(cedula=d["cedula"])[2][0], 201)

    def test_eliminar_sin_sesion(self):
        codigo, r, _ = Cliente().post("/api/cuenta/eliminar")
        self.assertEqual((codigo, r.get("k")), (401, "cuenta.sesion"))


class Reportar(unittest.TestCase):
    def test_sin_sesion_es_anonimo(self):
        """La cuenta es opcional: sin sesión el reporte se acepta y queda sin autor."""
        codigo, r, _ = Cliente().post("/api/reportes", reporte())
        self.assertEqual(codigo, 201, r)
        with apoyo.db() as con:
            self.assertIsNone(con.execute("SELECT ciudadano_id FROM reportes WHERE id=%s", (r["id"],)).fetchone()["ciudadano_id"])

    def test_con_sesion_puede_ser_anonimo(self):
        """Con cuenta, «anonimo: true» no lo liga a la cuenta."""
        c, _, _ = registrar()
        codigo, r, _ = c.post("/api/reportes", dict(reporte(), anonimo=True))
        self.assertEqual(codigo, 201, r)
        with apoyo.db() as con:
            self.assertIsNone(con.execute("SELECT ciudadano_id FROM reportes WHERE id=%s", (r["id"],)).fetchone()["ciudadano_id"])

    def test_con_sesion_guarda_el_autor_sin_publicarlo(self):
        c, d, _ = registrar()
        codigo, r, _ = c.post("/api/reportes", reporte())
        self.assertEqual(codigo, 201, r)
        with apoyo.db() as con:
            fila = con.execute("SELECT r.ciudadano_id, c.cedula FROM reportes r JOIN ciudadanos c ON c.id = r.ciudadano_id "
                               "WHERE r.id=%s", (r["id"],)).fetchone()
        self.assertEqual(fila["cedula"], d["cedula"])
        _, lista, _ = Cliente().get("/api/reportes")
        texto = str(lista)
        for dato in (d["cedula"], d["email"], d["nombre"]):
            self.assertNotIn(dato, texto)

    def test_tope_por_cuenta(self):
        c, _, _ = registrar()
        tope = apoyo.servidor.CFG["max_reportes_hora_dispositivo"]
        lat, lon, _ = apoyo.punto_en_canton()
        for i in range(tope):
            # cada reporte desde otro «teléfono» y otro lugar: solo cuenta el tope por cuenta
            b = reporte(lat=lat + 0.002 * (i + 1), dispositivo="telefono-" + apoyo.nombre_nuevo())
            self.assertEqual(c.post("/api/reportes", b)[0], 201)
        self.assertEqual(c.post("/api/reportes", reporte(lat=lat - 0.002))[0], 429)


if __name__ == "__main__":
    unittest.main()
