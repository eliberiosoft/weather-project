"""Sesión del panel: login con Turnstile, cookie, bloqueo por fallos, cambio obligatorio de clave y CSRF."""
import datetime as dt
import io
import unittest
import urllib.error
from contextlib import redirect_stdout
from unittest import mock

import apoyo
from apoyo import Cliente, auth, servidor

apoyo.arrancar()


class Login(unittest.TestCase):
    def setUp(self):
        apoyo.limpiar_bloqueos()

    def test_config_publica_sin_csrf(self):
        codigo, cuerpo, _ = Cliente().get("/api/auth/config", csrf=False)
        self.assertEqual(codigo, 200)
        self.assertEqual(cuerpo, {"captcha": {"proveedor": "turnstile", "site_key": auth.TURNSTILE_SITE_PRUEBA}})

    def test_login_con_captcha_de_prueba_y_cookie(self):
        uid, usuario, clave = apoyo.crear_usuario("analista")
        c = Cliente()
        codigo, cuerpo, _ = c.login(usuario, clave)
        self.assertEqual(codigo, 200, cuerpo)
        u = cuerpo["usuario"]
        self.assertEqual((u["id"], u["usuario"], u["rol"]), (uid, usuario, "analista"))
        self.assertIn("avisos.publicar", u["permisos"])
        self.assertNotIn("usuarios.gestionar", u["permisos"])
        self.assertIsNotNone(u["ultimo_ingreso"])
        self.assertNotIn("clave", u)
        sc = c.ultimo_set_cookie
        for atributo in ("yw_sesion=", "HttpOnly", "SameSite=Strict", "Path=/api"):
            self.assertIn(atributo, sc)
        self.assertNotIn("Secure", sc)
        codigo, cuerpo, _ = c.get("/api/auth/me")
        self.assertEqual((codigo, cuerpo["usuario"]["usuario"]), (200, usuario))
        # en la base solo queda el SHA-256 del token
        with apoyo.db() as con:
            shas = [r["token_sha"] for r in con.execute("SELECT token_sha FROM sesiones WHERE usuario_id=%s", (uid,))]
        self.assertEqual(shas, [auth._sha(c.cookie)])

    def test_cookie_secure_con_https(self):
        _, usuario, clave = apoyo.crear_usuario("operador")
        c = Cliente()
        codigo, _, _ = c.pedir("POST", "/api/auth/login", {"usuario": usuario, "clave": clave, "captcha": apoyo.TOKEN_PRUEBA},
                               cabeceras={"X-Forwarded-Proto": "https"})
        self.assertEqual(codigo, 200)
        self.assertIn("Secure", c.ultimo_set_cookie)

    def test_captcha_invalido(self):
        _, usuario, clave = apoyo.crear_usuario("analista")
        for token in ("", None, "token-falso"):
            codigo, cuerpo, _ = Cliente().login(usuario, clave, captcha=token)
            self.assertEqual((codigo, cuerpo["k"]), (400, "auth.captcha"))

    def test_turnstile_sin_red(self):
        _, usuario, clave = apoyo.crear_usuario("analista")
        caido = mock.patch.object(auth, "_siteverify", side_effect=urllib.error.URLError("sin red"))
        with caido, redirect_stdout(io.StringIO()):
            # con la clave de prueba (siempre aprueba) se puede desarrollar sin internet
            self.assertEqual(Cliente().login(usuario, clave)[0], 200)
            # con una clave real, sin respuesta de Cloudflare no se entra
            with mock.patch.dict("os.environ", {"TURNSTILE_SECRET_KEY": "0x-clave-real"}):
                codigo, cuerpo, _ = Cliente().login(usuario, clave)
        self.assertEqual((codigo, cuerpo["k"]), (400, "auth.captcha"))

    def test_credenciales_mismo_mensaje(self):
        _, usuario, _ = apoyo.crear_usuario("analista")
        a = Cliente().login(usuario, "clave-equivocada-1")
        b = Cliente().login("no-existe-nadie", "clave-equivocada-1")
        self.assertEqual((a[0], a[1]), (401, {"error": "usuario o clave incorrectos", "k": "auth.credenciales"}))
        self.assertEqual((b[0], b[1]), (a[0], a[1]))

    def test_inactivo(self):
        _, usuario, clave = apoyo.crear_usuario("analista", activo=False)
        codigo, cuerpo, _ = Cliente().login(usuario, clave)
        self.assertEqual((codigo, cuerpo["k"]), (403, "auth.inactivo"))
        # con la clave mal, no se revela que existe y está desactivado
        self.assertEqual(Cliente().login(usuario, "otra-clave-cualquiera")[1]["k"], "auth.credenciales")

    def test_bloqueo_por_ip_tras_5_fallos(self):
        _, usuario, clave = apoyo.crear_usuario("analista")
        c = Cliente()
        for _ in range(5):
            self.assertEqual(c.login(usuario, "clave-equivocada-1")[0], 401)
        codigo, cuerpo, _ = c.login(usuario, clave)          # aun con la clave correcta
        self.assertEqual((codigo, cuerpo["k"]), (429, "auth.espera"))
        _, otro, clave_otro = apoyo.crear_usuario("analista")
        self.assertEqual(c.login(otro, clave_otro)[0], 429)  # la IP sigue bloqueada para cualquier usuario

    def test_bloqueo_por_usuario_desde_varias_ip(self):
        _, usuario, clave = apoyo.crear_usuario("analista")
        for _ in range(5):
            self.assertEqual(Cliente().login(usuario, "clave-equivocada-1")[0], 401)
        codigo, cuerpo, _ = Cliente().login(usuario, clave)
        self.assertEqual((codigo, cuerpo["k"]), (429, "auth.espera"))

    def test_espera_exponencial(self):
        self.assertEqual([auth._espera(n) for n in (4, 5, 6, 7, 30)], [0, 60, 120, 240, 86400])

    def test_cookie_host_con_https(self):
        """Con https la sesión va en __Host-yw_sesion (Secure, Path=/, sin Domain) y solo se acepta esa."""
        import os
        from unittest import mock
        _, usuario, clave = apoyo.crear_usuario("analista")
        with mock.patch.dict(os.environ, {"COOKIE_SEGURA": "1"}):
            c = Cliente()
            codigo, _, _ = c.login(usuario, clave)
            self.assertEqual(codigo, 200)
            sc = c.ultimo_set_cookie
            self.assertTrue(sc.startswith("__Host-yw_sesion="), sc)
            for atributo in ("Secure", "Path=/;", "HttpOnly", "SameSite=Strict"):
                self.assertIn(atributo, sc)
            self.assertNotIn("Domain", sc)
            token = c.cookie
            sin = {"X-Requested-With": "yaguachi"}
            r = Cliente().pedir("GET", "/api/auth/me", csrf=False, cabeceras={**sin, "Cookie": f"__Host-yw_sesion={token}"})
            self.assertEqual(r[0], 200)
            # la misma sesión con el nombre simple (p. ej. plantada desde otro subdominio) no vale
            r = Cliente().pedir("GET", "/api/auth/me", csrf=False, cabeceras={**sin, "Cookie": f"yw_sesion={token}"})
            self.assertEqual(r[0], 401)

    def test_produccion_sin_clave_de_turnstile_no_deja_entrar(self):
        import os
        from unittest import mock
        _, usuario, clave = apoyo.crear_usuario("analista")
        with mock.patch.dict(os.environ, {"URL_PUBLICA": "https://ejemplo.ec"}):
            self.assertTrue(auth.produccion_sin_captcha())
            codigo, cuerpo, _ = Cliente().login(usuario, clave)
        self.assertEqual((codigo, cuerpo["k"]), (400, "auth.captcha"))
        self.assertEqual(Cliente().login(usuario, clave)[0], 200)      # en desarrollo (sin https) sigue entrando

    def test_la_cuenta_sola_no_queda_bloqueada_por_horas(self):
        """Quien falla a propósito contra «admin» desde muchas IP lo frena 15 min como mucho; su propia IP, hasta 24 h."""
        import time
        claves = auth.claves_login("10.9.9.9", "admin-prueba")
        for _ in range(30):
            auth.anotar_fallo(*claves)
        ya = time.time()
        _, hasta_cuenta, _ = auth._fallos[("u", "admin-prueba")]
        _, hasta_ip, _ = auth._fallos[("ip", "10.9.9.9")]
        self.assertLessEqual(hasta_cuenta - ya, auth.TOPE_CUENTA + 1)
        self.assertGreater(hasta_ip - ya, 3600)

    def test_los_fallos_se_olvidan_al_dia(self):
        import time
        c = ("u", "olvido-prueba")
        auth._fallos[c] = (9, 0.0, time.time() - auth.OLVIDO - 5)
        auth.anotar_fallo(c)
        self.assertEqual(auth._fallos[c][0], 1)

    def test_fallo_con_usuario_inexistente_tambien_se_audita(self):
        c = Cliente()
        self.assertEqual(c.login("no-existe-nadie", "clave-equivocada-1")[0], 401)
        with apoyo.db() as con:
            fila = con.execute("SELECT usuario_id, accion, detalle FROM auditoria ORDER BY id DESC LIMIT 1").fetchone()
        self.assertEqual((fila["usuario_id"], fila["accion"]), (None, "login.fallo"))
        self.assertIn("no-existe-nadie", fila["detalle"])

    def test_logout(self):
        c, uid, _, _ = apoyo.sesion("operador")
        token = c.cookie
        codigo, cuerpo, _ = c.post("/api/auth/logout")
        self.assertEqual((codigo, cuerpo), (200, {"ok": True}))
        self.assertIn("Max-Age=0", c.ultimo_set_cookie)
        c.cookie = token                                       # reusar la cookie vieja no sirve
        self.assertEqual(c.get("/api/auth/me")[0], 401)

    def test_sesion_vencida_por_inactividad(self):
        c, uid, _, _ = apoyo.sesion("analista")
        viejo = servidor.iso(servidor.ahora() - dt.timedelta(hours=13))
        with apoyo.db_escritura() as con:
            con.execute("UPDATE sesiones SET ultimo_uso=%s WHERE usuario_id=%s", (viejo, uid))
        codigo, cuerpo, _ = c.get("/api/panel/reportes")
        self.assertEqual((codigo, cuerpo["k"]), (401, "auth.sesion"))

    def test_sesion_vencida_a_los_7_dias(self):
        c, uid, _, _ = apoyo.sesion("analista")
        viejo = servidor.iso(servidor.ahora() - dt.timedelta(days=7, minutes=1))
        with apoyo.db_escritura() as con:
            con.execute("UPDATE sesiones SET creado=%s WHERE usuario_id=%s", (viejo, uid))
        self.assertEqual(c.get("/api/auth/me")[0], 401)

    def test_formato_de_la_clave_guardada(self):
        h = auth.hash_clave("una-clave-muy-larga")
        partes = h.split("$")
        self.assertEqual(partes[:4], ["scrypt", "32768", "8", "1"])
        self.assertEqual(len(partes), 6)
        self.assertTrue(auth.clave_ok("una-clave-muy-larga", h))
        self.assertFalse(auth.clave_ok("otra", h))


class CambioDeClave(unittest.TestCase):
    def setUp(self):
        apoyo.limpiar_bloqueos()

    def test_cambio_obligatorio(self):
        c, uid, usuario, clave = apoyo.sesion("analista", debe_cambiar=True)
        codigo, cuerpo, _ = c.get("/api/panel/reportes")
        self.assertEqual((codigo, cuerpo["k"]), (403, "auth.cambiar_clave"))
        self.assertTrue(c.get("/api/auth/me")[1]["usuario"]["debe_cambiar_clave"])
        casos = [({"actual": clave, "nueva": "corta"}, "auth.clave_corta"),
                 ({"actual": clave, "nueva": clave}, "auth.clave_igual"),
                 ({"actual": "no-es-la-actual", "nueva": "nueva-clave-segura"}, "auth.clave_actual")]
        for cuerpo_, k in casos:
            codigo, cuerpo, _ = c.post("/api/auth/clave", cuerpo_)
            self.assertEqual((codigo, cuerpo.get("k")), (400, k))
        viejo = c.cookie
        codigo, cuerpo, _ = c.post("/api/auth/clave", {"actual": clave, "nueva": "nueva-clave-segura"})
        self.assertEqual((codigo, cuerpo), (200, {"ok": True}))
        self.assertNotEqual(c.cookie, viejo)                   # sesión nueva; la anterior quedó invalidada
        self.assertEqual(c.get("/api/panel/reportes")[0], 200)
        otro = Cliente()
        otro.cookie = viejo
        self.assertEqual(otro.get("/api/auth/me")[0], 401)
        self.assertEqual(Cliente().login(usuario, "nueva-clave-segura")[0], 200)
        self.assertEqual(Cliente().login(usuario, clave)[0], 401)

    def test_superadmin_inicial(self):
        clave = apoyo.arrancar()["clave_admin"]
        self.assertIsNotNone(clave)
        self.assertEqual(len(clave), 16)
        c = Cliente()
        codigo, cuerpo, _ = c.login("admin", clave)
        self.assertEqual(codigo, 200)
        self.assertEqual(cuerpo["usuario"]["rol"], "superadmin")
        self.assertTrue(cuerpo["usuario"]["debe_cambiar_clave"])
        self.assertEqual(c.get("/api/panel/usuarios")[1]["k"], "auth.cambiar_clave")
        # un segundo arranque no crea otro ni muestra otra clave
        self.assertIsNone(apoyo.usuarios.crear_superadmin_inicial())

    def test_restablecer_desde_consola(self):
        c, uid, usuario, clave = apoyo.sesion("superadmin")
        salida = io.StringIO()
        with redirect_stdout(salida):
            servidor.restablecer_clave(usuario)
        temporal = salida.getvalue().split(": ")[1].split()[0]
        self.assertEqual(c.get("/api/auth/me")[0], 401)       # sus sesiones se cerraron
        codigo, cuerpo, _ = Cliente().login(usuario, temporal)
        self.assertEqual(codigo, 200)
        self.assertTrue(cuerpo["usuario"]["debe_cambiar_clave"])
        with self.assertRaises(SystemExit), redirect_stdout(io.StringIO()):
            servidor.restablecer_clave("no-existe-nadie")


class Csrf(unittest.TestCase):
    def test_sin_cabecera_403(self):
        c, _, usuario, clave = apoyo.sesion("superadmin")
        for metodo, ruta in (("GET", "/api/panel/reportes"), ("POST", "/api/panel/nivel"), ("GET", "/api/auth/me"),
                             ("POST", "/api/auth/logout"), ("POST", "/api/panel/usuarios")):
            codigo, cuerpo, _ = c.pedir(metodo, ruta, {} if metodo == "POST" else None, csrf=False)
            self.assertEqual((codigo, cuerpo["k"]), (403, "auth.csrf"), ruta)
        codigo, cuerpo, _ = Cliente().pedir("POST", "/api/auth/login", {"usuario": usuario, "clave": clave,
                                                                         "captcha": apoyo.TOKEN_PRUEBA}, csrf=False)
        self.assertEqual((codigo, cuerpo["k"]), (403, "auth.csrf"))
        # sigue con sesión: el POST sin cabecera no hizo nada
        self.assertEqual(c.get("/api/auth/me")[0], 200)

    def test_cabecera_con_otro_valor(self):
        c, _, _, _ = apoyo.sesion("analista")
        codigo, _, _ = c.get("/api/panel/reportes", csrf=False, cabeceras={"X-Requested-With": "XMLHttpRequest"})
        self.assertEqual(codigo, 403)


if __name__ == "__main__":
    unittest.main()
