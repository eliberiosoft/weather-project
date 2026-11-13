"""Web push: configuración, suscripción y baja, encolado al publicar un aviso, destinatarios por ámbito, horas de
silencio, lotes de 500 y borrado de tokens inválidos. El envío a FCM se reemplaza: nunca sale nada a la red."""
import datetime as dt
import os
import unittest
import uuid
from unittest import mock

import apoyo
from apoyo import Cliente, push, servidor

apoyo.arrancar()

DISP = {"X-Dispositivo": "telefono-push-0001"}
VARS = {"FIREBASE_API_KEY": "AIza-prueba", "FIREBASE_AUTH_DOMAIN": "p.firebaseapp.com", "FIREBASE_PROJECT_ID": "p",
        "FIREBASE_MESSAGING_SENDER_ID": "123", "FIREBASE_APP_ID": "1:123:web:abc", "FIREBASE_VAPID_KEY": "BOR-prueba"}


def token():
    return "tok_" + uuid.uuid4().hex + ":APA91b" + uuid.uuid4().hex


def reiniciar_firebase():
    push._fb.update(probado=False, messaging=None, app=None)


def vaciar_push():
    with apoyo.db_escritura() as con:
        con.execute("DELETE FROM push_tokens")
        con.execute("DELETE FROM push_cola")


def poner_tokens(*filas):
    """filas: (token, recinto_id)."""
    t = servidor.iso(servidor.ahora())
    with apoyo.db_escritura() as con:
        con.cursor().executemany("INSERT INTO push_tokens (token, dispositivo, recinto_id, idioma, creado, ultimo_uso) "
                                 "VALUES (%s, 'telefono-x', %s, 'es', %s, %s)", [(tk, rid, t, t) for tk, rid in filas])


class EnvioFalso:
    """Reemplaza push.enviar_lote: guarda cada lote y responde UNREGISTERED a los tokens elegidos."""

    def __init__(self, invalidos=()):
        self.lotes, self.invalidos = [], set(invalidos)

    def __call__(self, tokens, datos, ttl_s, urgente):
        self.lotes.append({"tokens": list(tokens), "datos": datos, "ttl": ttl_s, "urgente": urgente})
        return ["UNREGISTERED" if tk in self.invalidos else None for tk in tokens]

    @property
    def tokens(self):
        return [tk for lote in self.lotes for tk in lote["tokens"]]


class Configuracion(unittest.TestCase):
    def setUp(self):
        reiniciar_firebase()
        self.addCleanup(reiniciar_firebase)

    def test_deshabilitado_sin_variables(self):
        codigo, cuerpo, _ = Cliente().get("/api/push/config", csrf=False)
        self.assertEqual(codigo, 200)
        self.assertEqual(cuerpo, {"habilitado": False, "vapid_key": None,
                                  "firebase": {"apiKey": None, "authDomain": None, "projectId": None,
                                               "messagingSenderId": None, "appId": None}})

    def test_deshabilitado_sin_credenciales(self):
        with mock.patch.dict(os.environ, dict(VARS, FIREBASE_CREDENCIALES="/no/existe.json")):
            cuerpo = Cliente().get("/api/push/config", csrf=False)[1]
        self.assertFalse(cuerpo["habilitado"])
        self.assertEqual(cuerpo["firebase"]["projectId"], "p")
        self.assertEqual(cuerpo["vapid_key"], "BOR-prueba")


class Suscripcion(unittest.TestCase):
    def setUp(self):
        vaciar_push()

    def test_suscribir_upsert_y_baja(self):
        c = Cliente()
        tk = token()
        _, _, rid = apoyo.punto_en_canton()
        codigo, cuerpo, _ = c.post("/api/push/suscribir", {"token": tk, "idioma": "es"}, csrf=False, cabeceras=DISP)
        self.assertEqual((codigo, cuerpo), (200, {"ok": True}))
        self.assertEqual(c.post("/api/push/suscribir", {"token": tk, "recinto_id": rid, "idioma": "en"},
                                csrf=False, cabeceras=DISP)[0], 200)
        with apoyo.db() as con:
            filas = con.execute("SELECT * FROM push_tokens").fetchall()
        self.assertEqual([(f["token"], f["recinto_id"], f["idioma"], f["dispositivo"]) for f in filas],
                         [(tk, rid, "en", DISP["X-Dispositivo"])])
        self.assertEqual(c.post("/api/push/baja", {"token": tk}, csrf=False)[1], {"ok": True})
        with apoyo.db() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) AS n FROM push_tokens").fetchone()["n"], 0)

    def test_validaciones(self):
        c = Cliente()
        self.assertEqual(c.post("/api/push/suscribir", {"token": token()}, csrf=False)[0], 400)      # sin X-Dispositivo
        casos = [({"token": "corto"}, "push.token"), ({"token": "con espacios " * 3}, "push.token"),
                 ({"token": token(), "recinto_id": 99999999}, "push.recinto"),
                 ({"token": token(), "recinto_id": True}, "push.recinto"),
                 ({"token": token(), "idioma": "fr"}, "push.idioma")]
        for cuerpo_, k in casos:
            codigo, cuerpo, _ = c.post("/api/push/suscribir", cuerpo_, csrf=False, cabeceras=DISP)
            self.assertEqual((codigo, cuerpo.get("k")), (400, k), cuerpo_)
        self.assertEqual(c.post("/api/push/baja", {}, csrf=False)[0], 400)

    def test_limite_30_por_ip_y_hora(self):
        c = Cliente()
        for _ in range(30):
            self.assertEqual(c.post("/api/push/suscribir", {"token": token()}, csrf=False, cabeceras=DISP)[0], 200)
        codigo, cuerpo, _ = c.post("/api/push/suscribir", {"token": token()}, csrf=False, cabeceras=DISP)
        self.assertEqual((codigo, cuerpo["k"]), (429, "push.limite"))
        self.assertEqual(Cliente().post("/api/push/suscribir", {"token": token()}, csrf=False, cabeceras=DISP)[0], 200)


class Envio(unittest.TestCase):
    def setUp(self):
        vaciar_push()
        apoyo.limpiar_bloqueos()
        self.analista, *_ = apoyo.sesion("analista")
        p = mock.patch.object(push, "habilitado", return_value=True)
        p.start()
        self.addCleanup(p.stop)

    def publicar(self, **b):
        aviso = {"ambito_tipo": "canton", "ambito_id": "yaguachi", "nivel_cod": 3, "titulo": "Crecida del río",
                 "texto": "Prepárate para salir " + uuid.uuid4().hex[:6], "horas": 12, "forzar": True}
        aviso.update(b)
        codigo, cuerpo, _ = self.analista.post("/api/panel/aviso", aviso)
        self.assertEqual(codigo, 200, cuerpo)
        return cuerpo["id"]

    def procesar(self, envio):
        with mock.patch.object(push, "enviar_lote", envio):
            push.procesar_cola(servidor.aviso_aplica_a_recinto)

    def test_encola_al_publicar_y_envia_solo_datos(self):
        sobra, tk = token(), token()
        poner_tokens((tk, None), (sobra, None))
        aid = self.publicar(nivel_cod=4)
        with apoyo.db() as con:
            cola = con.execute("SELECT * FROM push_cola WHERE aviso_id=%s", (aid,)).fetchone()
        self.assertIsNotNone(cola)
        self.assertIsNone(cola["enviado"])
        envio = EnvioFalso(invalidos={sobra})
        self.procesar(envio)
        self.assertEqual(sorted(envio.tokens), sorted([tk, sobra]))
        lote = envio.lotes[0]
        self.assertEqual(lote["datos"], {"tipo": "aviso", "aviso_id": str(aid), "nivel": "4", "titulo": "Crecida del río",
                                         "cuerpo": lote["datos"]["cuerpo"], "url": f"/#avisos/{aid}/push"})   # spec 021
        self.assertTrue(all(isinstance(v, str) for v in lote["datos"].values()))
        self.assertTrue(lote["urgente"])
        with apoyo.db() as con:
            cola = con.execute("SELECT * FROM push_cola WHERE aviso_id=%s", (aid,)).fetchone()
            quedan = [r["token"] for r in con.execute("SELECT token FROM push_tokens")]
        self.assertIsNotNone(cola["enviado"])
        self.assertIn('"borrados": 1', cola["resultado"])
        self.assertEqual(quedan, [tk])                       # el token UNREGISTERED se borró
        otro = EnvioFalso()
        self.procesar(otro)                                  # ya enviado: no se repite
        self.assertEqual(otro.lotes, [])

    def test_destinatarios_por_ambito(self):
        _, _, rid = apoyo.punto_en_canton()
        p = servidor.T.recintos[rid]
        lejano = next(k for k, v in servidor.T.recintos.items() if v["parroquia"] != p["parroquia"])
        en_recinto, en_otro, sin_recinto, recinto_borrado = token(), token(), token(), token()
        poner_tokens((en_recinto, rid), (en_otro, lejano), (sin_recinto, None), (recinto_borrado, 987654))
        casos = [({"ambito_tipo": "recinto", "ambito_id": str(rid), "nivel_cod": 2}, {en_recinto}),
                 ({"ambito_tipo": "recinto", "ambito_id": str(rid), "nivel_cod": 3}, {en_recinto, sin_recinto, recinto_borrado}),
                 ({"ambito_tipo": "parroquia", "ambito_id": p["parroquia"], "nivel_cod": 1}, {en_recinto}),
                 ({"ambito_tipo": "canton", "ambito_id": "yaguachi", "nivel_cod": 1},
                  {en_recinto, en_otro, sin_recinto, recinto_borrado})]
        for aviso, esperados in casos:
            with apoyo.db_escritura() as con:
                con.execute("DELETE FROM push_cola")
            with mock.patch.object(push, "fin_silencio", side_effect=lambda t, h: t):   # que salga ya aunque sea de noche
                self.publicar(**aviso)
            envio = EnvioFalso()
            self.procesar(envio)
            self.assertEqual(set(envio.tokens), esperados, aviso)

    def test_rio_usa_la_regla_de_avisos(self):
        _, _, rid = apoyo.punto_en_canton()
        cerca = next(k for k, v in servidor.T.recintos.items() if v["dist_rio_m"] <= servidor.DIST_RIO_M)
        p = servidor.T.recintos[cerca]
        tk = token()
        poner_tokens((tk, cerca))
        self.publicar(ambito_tipo="rio", ambito_id=p["rio_cercano"])
        envio = EnvioFalso()
        self.procesar(envio)
        self.assertEqual(envio.tokens, [tk])

    def test_lotes_de_500(self):
        poner_tokens(*[(token(), None) for _ in range(1203)])
        self.publicar(nivel_cod=4)
        envio = EnvioFalso()
        self.procesar(envio)
        self.assertEqual([len(x["tokens"]) for x in envio.lotes], [500, 500, 203])

    def test_aviso_anulado_no_se_envia(self):
        poner_tokens((token(), None))
        aid = self.publicar(nivel_cod=4)
        self.assertEqual(self.analista.post(f"/api/panel/avisos/{aid}/anular")[0], 200)
        envio = EnvioFalso()
        self.procesar(envio)
        self.assertEqual(envio.lotes, [])
        with apoyo.db() as con:
            self.assertIn("anulado", con.execute("SELECT resultado FROM push_cola WHERE aviso_id=%s", (aid,)).fetchone()["resultado"])

    def test_aviso_eliminado_no_se_envia(self):
        poner_tokens((token(), None))
        aid = self.publicar(nivel_cod=4)
        admin, *_ = apoyo.sesion("superadmin")
        self.assertEqual(admin.post(f"/api/panel/avisos/{aid}/eliminar")[0], 200)
        envio = EnvioFalso()
        self.procesar(envio)
        self.assertEqual(envio.lotes, [])
        with apoyo.db() as con:
            self.assertIn("eliminado", con.execute("SELECT resultado FROM push_cola WHERE aviso_id=%s", (aid,)).fetchone()["resultado"])

    def test_fallo_de_red_se_reintenta(self):
        poner_tokens((token(), None))
        aid = self.publicar(nivel_cod=4)
        with mock.patch.object(push, "enviar_lote", side_effect=OSError("sin red")), \
                mock.patch("builtins.print"):
            push.procesar_cola(servidor.aviso_aplica_a_recinto)
        with apoyo.db() as con:
            self.assertIsNone(con.execute("SELECT enviado FROM push_cola WHERE aviso_id=%s", (aid,)).fetchone()["enviado"])
        envio = EnvioFalso()
        self.procesar(envio)
        self.assertEqual(len(envio.tokens), 1)

    def test_deshabilitado_marca_y_no_envia(self):
        poner_tokens((token(), None))
        aid = self.publicar(nivel_cod=4)
        envio = EnvioFalso()
        with mock.patch.object(push, "habilitado", return_value=False):
            self.procesar(envio)
        self.assertEqual(envio.lotes, [])
        with apoyo.db() as con:
            self.assertIn("deshabilitado", con.execute("SELECT resultado FROM push_cola WHERE aviso_id=%s", (aid,)).fetchone()["resultado"])


class HorasDeSilencio(unittest.TestCase):
    def hora(self, h, m=0):
        return dt.datetime(2026, 11, 9, h, m, tzinfo=servidor.TZ)

    def test_fin_silencio(self):
        hs = [22, 6]
        self.assertEqual(push.fin_silencio(self.hora(23, 30), hs), dt.datetime(2026, 11, 10, 6, 0, tzinfo=servidor.TZ))
        self.assertEqual(push.fin_silencio(self.hora(3), hs), self.hora(6))
        self.assertEqual(push.fin_silencio(self.hora(12), hs), self.hora(12))
        self.assertEqual(push.fin_silencio(self.hora(6), hs), self.hora(6))
        self.assertEqual(push.fin_silencio(self.hora(22), hs), dt.datetime(2026, 11, 10, 6, 0, tzinfo=servidor.TZ))
        self.assertEqual(push.fin_silencio(self.hora(13), [13, 15]), self.hora(15))      # franja que no cruza la medianoche

    def test_encolar_respeta_nivel(self):
        noche = self.hora(23)
        with apoyo.db_escritura() as con:
            con.execute("DELETE FROM push_cola")
            push.encolar(con, 1, 2, [22, 6], noche)      # VIGILANCIA espera a las 06:00
            push.encolar(con, 2, 3, [22, 6], noche)      # PREPARACIÓN sale ya
            filas = {r["aviso_id"]: r["enviar_desde"] for r in con.execute("SELECT * FROM push_cola")}
            con.execute("DELETE FROM push_cola")
        self.assertEqual(filas, {1: "2026-11-10T06:00:00-05:00", 2: "2026-11-09T23:00:00-05:00"})


class Mantenimiento(unittest.TestCase):
    def test_ip_48h_y_sesiones_vencidas(self):
        viejo = servidor.iso(servidor.ahora() - dt.timedelta(hours=49))
        muy_viejo = servidor.iso(servidor.ahora() - dt.timedelta(days=8))
        tk = token()
        with apoyo.db_escritura() as con:
            con.execute("INSERT INTO push_tokens (token, dispositivo, creado, ultimo_uso, ip) VALUES (%s,%s,%s,%s,%s)",
                        (tk, "telefono-x", viejo, viejo, "10.1.1.1"))
            con.execute("INSERT INTO sesiones VALUES ('sha-vieja', 1, %s, %s, '10.1.1.1')", (muy_viejo, muy_viejo))
            con.execute("INSERT INTO sesiones VALUES ('sha-con-ip', 1, %s, %s, '10.1.1.2')", (viejo, servidor.iso(servidor.ahora())))
        servidor.mantenimiento_una_vez()
        with apoyo.db() as con:
            self.assertIsNone(con.execute("SELECT ip FROM push_tokens WHERE token=%s", (tk,)).fetchone()["ip"])
            self.assertIsNone(con.execute("SELECT 1 FROM sesiones WHERE token_sha='sha-vieja'").fetchone())
            self.assertIsNone(con.execute("SELECT ip FROM sesiones WHERE token_sha='sha-con-ip'").fetchone()["ip"])


class EnvioRealDeFirebase(unittest.TestCase):
    """enviar_lote con el SDK real (si está instalado), sin red: se reemplaza solo la llamada a FCM."""

    def test_clasifica_errores(self):
        try:
            from firebase_admin import exceptions, messaging
        except ImportError:
            self.skipTest("firebase-admin no está instalado")
        ok = mock.Mock(success=True, exception=None)
        baja = mock.Mock(success=False, exception=messaging.UnregisteredError("x"))
        malo = mock.Mock(success=False, exception=exceptions.InvalidArgumentError("x"))
        otro = mock.Mock(success=False, exception=exceptions.UnavailableError("x"))
        respuesta = mock.Mock(responses=[ok, baja, malo, otro])
        with mock.patch.object(push, "_firebase", return_value=messaging), \
                mock.patch.object(messaging, "send_each_for_multicast", return_value=respuesta) as enviar:
            codigos = push.enviar_lote(["a" * 30, "b" * 30, "c" * 30, "d" * 30], {"tipo": "aviso"}, 3600, True)
        self.assertEqual(codigos, [None, "UNREGISTERED", "INVALID_ARGUMENT", "UNAVAILABLE"])
        msg = enviar.call_args[0][0]
        self.assertIsNone(msg.notification)                      # solo datos
        self.assertEqual(msg.webpush.headers, {"TTL": "3600", "Urgency": "high"})
        # si TODO el lote vuelve INVALID_ARGUMENT el problema es el mensaje: no se borran tokens
        self.assertEqual(push._tokens_a_borrar(["a", "b"], ["INVALID_ARGUMENT"] * 2), [])
        self.assertEqual(push._tokens_a_borrar(["a", "b"], ["INVALID_ARGUMENT", None]), ["a"])


if __name__ == "__main__":
    unittest.main()
