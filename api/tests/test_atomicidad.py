"""Los topes siguen siendo atómicos sobre PostgreSQL (spec 016, «comprobaciones atómicas»; spec 012): muchas
peticiones simultáneas no se saltan un límite, y el advisory lock de escritura también frena a otro proceso."""
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest import mock

import apoyo
from apoyo import servidor
from comun import CANDADO_ESCRITURA, conectar_directo

apoyo.arrancar()


class Atomicidad(unittest.TestCase):
    def test_tope_por_dispositivo_con_envios_simultaneos(self):
        lat, lon, _ = apoyo.punto_en_canton()
        disp = "telefono-simultaneo-01"
        tope = servidor.CFG["max_reportes_hora_dispositivo"]

        # una cuenta por envío: así el tope que se prueba es el del teléfono (el de la cuenta es el mismo número)
        vecinos = [apoyo.vecino() for _ in range(12)]

        def enviar(i):     # puntos a ~220 m entre sí: no cuentan como «lo mismo aquí hace poco»
            return vecinos[i].post("/api/reportes", {"dispositivo": disp, "consentimiento": True, "tipo": "otro",
                                                    "descripcion": f"Prueba de tope {i}",
                                                    "lat": lat + 0.002 * (i % 4), "lon": lon + 0.002 * (i // 4),
                                                    "foto": apoyo.FOTO}, csrf=False)[0]

        original = servidor.guardar_foto

        def foto_lenta(crudo):      # agranda la ventana entre el conteo y el INSERT: sin candado, el tope se saltaría
            time.sleep(0.05)
            return original(crudo)

        # 5 a la vez: la cola de conexiones del socket de pruebas es de 5 (request_queue_size)
        with mock.patch.object(servidor, "guardar_foto", foto_lenta), ThreadPoolExecutor(max_workers=5) as ex:
            codigos = list(ex.map(enviar, range(12)))
        self.assertEqual(codigos.count(201), tope, codigos)
        self.assertEqual(codigos.count(429), 12 - tope, codigos)

    def test_otro_proceso_con_el_candado_frena_las_escrituras(self):
        """Una conexión ajena (como otra réplica de la API) con el advisory lock hace esperar a db_escritura()."""
        externa = conectar_directo(apoyo.URL_BASE)
        self.addCleanup(externa.close)
        externa.execute("SELECT pg_advisory_xact_lock(%s)", (CANDADO_ESCRITURA,))     # transacción abierta
        hecho = threading.Event()

        def escribir():
            servidor.fijar_ajuste("prueba_candado", 1)
            hecho.set()

        threading.Thread(target=escribir, daemon=True).start()
        self.assertFalse(hecho.wait(0.5))            # espera mientras el otro tenga el candado
        t0 = time.monotonic()
        externa.commit()                             # suelta el candado
        self.assertTrue(hecho.wait(5))
        self.assertLess(time.monotonic() - t0, 5)
        self.assertEqual(servidor.ajuste("prueba_candado"), 1)


if __name__ == "__main__":
    unittest.main()
