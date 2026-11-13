"""Importador SQLite → PostgreSQL (spec 016, US2): todas las tablas, ids y secuencias, constancia en `meta`, no
reimporta en el segundo arranque, se niega sobre una base con datos salvo con --forzar y nunca toca el archivo SQLite.

Cada prueba usa su propia base PostgreSQL vacía (no la de la API de las otras pruebas) y la borra al terminar."""
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest

import apoyo
import esquema
import importar_sqlite
from comun import conectar_directo

# Esquema de SQLite tal como lo creaba la API antes de la spec 016 (ESQUEMA + COLUMNAS_NUEVAS de servidor.py)
ESQUEMA_SQLITE = """
CREATE TABLE reportes (
  id TEXT PRIMARY KEY, creado TEXT NOT NULL, dispositivo TEXT NOT NULL, ip TEXT,
  tipo TEXT NOT NULL, gravedad INTEGER NOT NULL, descripcion TEXT,
  lat REAL NOT NULL, lon REAL NOT NULL, recinto_id INTEGER, recinto TEXT, en_canton INTEGER,
  foto TEXT, estado TEXT NOT NULL DEFAULT 'pendiente', nota_ugr TEXT, revisado_en TEXT,
  expira TEXT NOT NULL, sigue INTEGER NOT NULL DEFAULT 0, ya_no INTEGER NOT NULL DEFAULT 0,
  altura_agua INTEGER, via TEXT, tramo TEXT, origen TEXT NOT NULL DEFAULT 'vecino', autor_id INTEGER);
CREATE TABLE confirmaciones (
  reporte_id TEXT, dispositivo TEXT, sigue INTEGER, creado TEXT, ip TEXT, PRIMARY KEY (reporte_id, dispositivo));
CREATE TABLE me_gusta (
  reporte_id TEXT, dispositivo TEXT, creado TEXT, ip TEXT, PRIMARY KEY (reporte_id, dispositivo));
CREATE TABLE avisos (
  id INTEGER PRIMARY KEY AUTOINCREMENT, creado TEXT NOT NULL, nivel_cod INTEGER NOT NULL,
  titulo TEXT NOT NULL, texto TEXT NOT NULL, ambito_tipo TEXT NOT NULL, ambito_id TEXT,
  ambito_nombre TEXT, vigente_hasta TEXT NOT NULL, anulado INTEGER NOT NULL DEFAULT 0, autor_id INTEGER);
CREATE TABLE niveles_oficiales (
  id INTEGER PRIMARY KEY AUTOINCREMENT, creado TEXT NOT NULL, ambito_tipo TEXT NOT NULL,
  ambito_id TEXT NOT NULL, nivel_cod INTEGER, motivo TEXT);
CREATE TABLE lecturas (
  id INTEGER PRIMARY KEY AUTOINCREMENT, creado TEXT NOT NULL, punto_id TEXT NOT NULL,
  lectura_m REAL NOT NULL, tendencia TEXT, lluvia INTEGER, vigia TEXT);
CREATE TABLE reglas (punto_id TEXT PRIMARY KEY, borde_m REAL, nota TEXT);
CREATE TABLE ajustes (clave TEXT PRIMARY KEY, valor TEXT);
CREATE TABLE cache (clave TEXT PRIMARY KEY, actualizado REAL NOT NULL, datos TEXT NOT NULL);
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY, usuario TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL, rol TEXT NOT NULL, clave TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1, debe_cambiar_clave INTEGER NOT NULL DEFAULT 1, creado TEXT NOT NULL,
  ultimo_ingreso TEXT);
CREATE TABLE sesiones (
  token_sha TEXT PRIMARY KEY, usuario_id INTEGER NOT NULL, creado TEXT NOT NULL, ultimo_uso TEXT NOT NULL, ip TEXT);
CREATE TABLE auditoria (
  id INTEGER PRIMARY KEY, usuario_id INTEGER, accion TEXT NOT NULL, detalle TEXT, creado TEXT NOT NULL);
CREATE TABLE config (clave TEXT PRIMARY KEY, valor TEXT);
CREATE TABLE push_tokens (
  token TEXT PRIMARY KEY, dispositivo TEXT, recinto_id INTEGER, idioma TEXT, creado TEXT, ultimo_uso TEXT, ip TEXT);
CREATE TABLE push_cola (
  id INTEGER PRIMARY KEY, aviso_id INTEGER NOT NULL, creado TEXT NOT NULL, enviar_desde TEXT NOT NULL,
  enviado TEXT, resultado TEXT);
"""
T0 = "2026-11-08T10:00:00-05:00"


def crear_sqlite(ruta):
    """SQLite de ejemplo con filas en las 15 tablas, ids salteados y un aviso borrado (AUTOINCREMENT ya entregó el 9)."""
    con = sqlite3.connect(ruta)
    con.executescript(ESQUEMA_SQLITE)
    con.executemany("INSERT INTO reportes (id, creado, dispositivo, ip, tipo, gravedad, descripcion, lat, lon, recinto_id, "
                    "recinto, en_canton, foto, estado, expira, sigue, ya_no, altura_agua, via, tramo, origen, autor_id) "
                    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
                        ("a1b2c3d4e5f6", T0, "telefono-0001", "10.0.0.1", "calle_inundada", 2, "Agua en la calle", -2.0812345678,
                         -79.6912345678, 7, "Recinto X", 1, None, "pendiente", "2026-11-08T18:00:00-05:00", 1, 0, 2,
                         "Av. Principal", json.dumps([[-79.69, -2.08], [-79.68, -2.07]]), "vecino", None),
                        ("0f0e0d0c0b0a", T0, "equipo", None, "desborde", 3, "Desborde", -2.1, -79.7, None, None, 1,
                         "foto.jpg", "validado", "2026-11-09T10:00:00-05:00", 0, 0, None, None, None, "equipo", 3)])
    con.execute("INSERT INTO confirmaciones VALUES ('a1b2c3d4e5f6', 'telefono-0002', 1, ?, '10.0.0.2')", (T0,))
    con.execute("INSERT INTO me_gusta VALUES ('a1b2c3d4e5f6', 'telefono-0003', ?, NULL)", (T0,))
    for i in (2, 5, 9):
        con.execute("INSERT INTO avisos (id, creado, nivel_cod, titulo, texto, ambito_tipo, ambito_id, ambito_nombre, "
                    "vigente_hasta, anulado, autor_id) VALUES (?,?,3,'Título','Texto','canton','','Todo el cantón',?,0,3)",
                    (i, T0, "2026-11-09T10:00:00-05:00"))
    con.execute("DELETE FROM avisos WHERE id=9")                 # sqlite_sequence queda en 9
    con.executemany("INSERT INTO niveles_oficiales (id, creado, ambito_tipo, ambito_id, nivel_cod, motivo) VALUES (?,?,?,?,?,?)",
                    [(1, T0, "canton", "", 2, "motivo"), (4, T0, "rio", "Río Yaguachi", None, "nivel oficial retirado")])
    con.execute("INSERT INTO lecturas (id, creado, punto_id, lectura_m, tendencia, lluvia, vigia) "
                "VALUES (12, ?, 'PC1', 3.257, 'sube', 1, 'Vigía')", (T0,))
    con.execute("INSERT INTO reglas VALUES ('PC1', 5.5, 'nota')")
    con.execute("INSERT INTO ajustes VALUES ('aguaje', ?)", (json.dumps({"hasta": "2026-11-10"}),))
    con.execute("INSERT INTO cache VALUES ('lluvia_celdas', 1762614000.123456, '{\"x\": 1}')")
    con.execute("INSERT INTO usuarios VALUES (3, 'admin', 'Administrador', 'superadmin', 'scrypt$hash-de-prueba', 1, 0, ?, ?)",
                (T0, T0))
    con.execute("INSERT INTO sesiones VALUES ('sha-de-prueba', 3, ?, ?, '10.0.0.9')", (T0, T0))
    con.execute("INSERT INTO auditoria VALUES (7, 3, 'login', NULL, ?)", (T0,))
    con.execute("INSERT INTO config VALUES ('incidentes_anonimos', 'true')")
    con.execute("INSERT INTO push_tokens VALUES ('tok_prueba_0123456789', 'telefono-0001', 7, 'es', ?, ?, NULL)", (T0, T0))
    con.execute("INSERT INTO push_cola VALUES (4, 2, ?, ?, NULL, NULL)", (T0, T0))
    con.commit()
    con.close()


def huella(ruta):
    with open(ruta, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest(), os.path.getmtime(ruta)


class Importador(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="yaguachi-importar-")
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.sqlite = os.path.join(self.tmp, "yaguachi.db")
        crear_sqlite(self.sqlite)
        self.base, self.url = apoyo.crear_base("yaguachi_importar")
        self.addCleanup(apoyo.borrar_base, self.base)
        self.con = conectar_directo(self.url, autocommit=True)
        self.addCleanup(self.con.close)
        esquema.migrar(self.con)

    def filas_sqlite(self, tabla, orden):
        con = sqlite3.connect(f"file:{self.sqlite}?mode=ro", uri=True)
        con.row_factory = sqlite3.Row
        try:
            return [dict(r) for r in con.execute(f"SELECT * FROM {tabla} ORDER BY {orden}")]
        finally:
            con.close()

    def test_importa_todo_con_ids_y_secuencias(self):
        antes = huella(self.sqlite)
        conteos = importar_sqlite.importar(self.con, self.sqlite)
        self.assertEqual(set(conteos), set(esquema.TABLAS))
        for t, c in conteos.items():
            self.assertEqual(c["origen"], c["destino"], t)
            self.assertGreater(c["destino"], 0, t)               # la muestra tiene filas en todas las tablas
        self.assertEqual(esquema.filas_por_tabla(self.con), {t: c["destino"] for t, c in conteos.items()})
        # filas idénticas (ids, textos ISO, decimales de lat/lon y de la hora de la caché)
        for tabla, orden in (("reportes", "id"), ("avisos", "id"), ("niveles_oficiales", "id"), ("lecturas", "id"),
                             ("cache", "clave"), ("usuarios", "id"), ("auditoria", "id"), ("push_cola", "id"),
                             ("confirmaciones", "reporte_id"), ("push_tokens", "token")):
            pg = [dict(r) for r in self.con.execute(f"SELECT * FROM {tabla} ORDER BY {orden}")]
            sq = self.filas_sqlite(tabla, orden)
            # columnas agregadas después en PostgreSQL (migraciones 2+): no vienen de SQLite y quedan vacías
            nuevas = set(pg[0]) - set(sq[0]) if pg and sq else set()
            self.assertTrue(all(r[k] is None for r in pg for k in nuevas), tabla)
            self.assertEqual([{k: v for k, v in r.items() if k not in nuevas} for r in pg], sq, tabla)
        # secuencias: después del mayor id y del último que entregó SQLite (el aviso 9 se borró: no se reutiliza)
        nuevo = self.con.execute("INSERT INTO avisos (creado, nivel_cod, titulo, texto, ambito_tipo, vigente_hasta) "
                                 "VALUES (%s, 1, 't', 't', 'canton', %s) RETURNING id", (T0, T0)).fetchone()["id"]
        self.assertEqual(nuevo, 10)
        for tabla, siguiente in (("niveles_oficiales", 5), ("lecturas", 13), ("auditoria", 8), ("push_cola", 5)):
            self.assertEqual(self.con.execute(f"SELECT nextval(pg_get_serial_sequence('{tabla}', 'id')) AS n")
                             .fetchone()["n"], siguiente, tabla)
        # constancia en meta y archivo intacto
        meta = json.loads(esquema.meta_get(self.con, "importado_sqlite"))
        self.assertEqual((meta["modo"], meta["conteos"]), ("manual", conteos))
        self.assertEqual(huella(self.sqlite), antes)

    def test_segundo_arranque_no_reimporta(self):
        self.assertIsNotNone(importar_sqlite.importar(self.con, self.sqlite, automatico=True))
        conteo = esquema.filas_por_tabla(self.con)
        self.assertIsNone(importar_sqlite.importar(self.con, self.sqlite, automatico=True))
        self.assertEqual(esquema.filas_por_tabla(self.con), conteo)
        self.assertEqual(esquema.migrar(self.con), [])           # las migraciones tampoco se repiten

    def test_automatico_no_pisa_una_base_con_datos(self):
        self.con.execute("INSERT INTO ajustes (clave, valor) VALUES ('x', '1')")
        self.assertIsNone(importar_sqlite.importar(self.con, self.sqlite, automatico=True))
        self.assertEqual(esquema.filas_por_tabla(self.con)["reportes"], 0)
        self.assertIsNone(esquema.meta_get(self.con, "importado_sqlite"))

    def test_manual_se_niega_con_datos_salvo_forzar(self):
        importar_sqlite.importar(self.con, self.sqlite)
        self.con.execute("INSERT INTO config (clave, valor) VALUES ('otra', '1')")
        with self.assertRaises(importar_sqlite.ImportacionRechazada):
            importar_sqlite.importar(self.con, self.sqlite)
        self.assertEqual(esquema.filas_por_tabla(self.con)["config"], 2)      # no cambió nada
        conteos = importar_sqlite.importar(self.con, self.sqlite, forzar=True)
        self.assertEqual(esquema.filas_por_tabla(self.con), {t: c["origen"] for t, c in conteos.items()})
        self.assertTrue(json.loads(esquema.meta_get(self.con, "importado_sqlite"))["forzado"])

    def test_si_algo_falla_no_queda_nada(self):
        con = sqlite3.connect(self.sqlite)
        con.execute("INSERT INTO lecturas (creado, punto_id, lectura_m) VALUES (?, 'PC1', 'no es un número')", (T0,))
        con.commit()
        con.close()
        with self.assertRaises(Exception):
            importar_sqlite.importar(self.con, self.sqlite)
        self.assertEqual(sum(esquema.filas_por_tabla(self.con).values()), 0)
        self.assertIsNone(esquema.meta_get(self.con, "importado_sqlite"))

    def test_sqlite_de_una_version_anterior(self):
        """Sin las columnas ni las tablas nuevas: lo que falta toma su valor por defecto."""
        viejo = os.path.join(self.tmp, "viejo.db")
        con = sqlite3.connect(viejo)
        con.execute("CREATE TABLE reportes (id TEXT PRIMARY KEY, creado TEXT NOT NULL, dispositivo TEXT NOT NULL, ip TEXT, "
                    "tipo TEXT NOT NULL, gravedad INTEGER NOT NULL, descripcion TEXT, lat REAL NOT NULL, lon REAL NOT NULL, "
                    "recinto_id INTEGER, recinto TEXT, en_canton INTEGER, foto TEXT, estado TEXT NOT NULL DEFAULT 'pendiente', "
                    "nota_ugr TEXT, revisado_en TEXT, expira TEXT NOT NULL, sigue INTEGER NOT NULL DEFAULT 0, "
                    "ya_no INTEGER NOT NULL DEFAULT 0)")
        con.execute("INSERT INTO reportes (id, creado, dispositivo, tipo, gravedad, lat, lon, expira) "
                    "VALUES ('viejo0000001', ?, 'tel', 'otro', 1, -2.1, -79.7, ?)", (T0, T0))
        con.commit()
        con.close()
        conteos = importar_sqlite.importar(self.con, viejo)
        self.assertEqual(conteos["reportes"], {"origen": 1, "destino": 1})
        self.assertEqual(conteos["usuarios"], {"origen": 0, "destino": 0})
        r = self.con.execute("SELECT origen, autor_id, altura_agua FROM reportes").fetchone()
        self.assertEqual((r["origen"], r["autor_id"], r["altura_agua"]), ("vecino", None, None))


class Consola(unittest.TestCase):
    """El comando manual y el arranque automático, en procesos aparte (como en el contenedor)."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="yaguachi-importar-")
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.sqlite = os.path.join(self.tmp, "yaguachi.db")
        crear_sqlite(self.sqlite)
        self.base, self.url = apoyo.crear_base("yaguachi_importar")
        self.addCleanup(apoyo.borrar_base, self.base)
        self.env = dict(os.environ, DATABASE_URL=self.url, YAGUACHI_DATOS=self.tmp,
                        YAGUACHI_CONFIG=os.path.join(self.tmp, "config.json"))

    def correr(self, *args):
        p = subprocess.run([sys.executable, *args], cwd=apoyo.API, env=self.env, capture_output=True, text=True,
                           timeout=120)
        return p.returncode, p.stdout + p.stderr

    def conteos_pg(self):
        with conectar_directo(self.url) as con:
            return esquema.filas_por_tabla(con)

    def test_comando_manual_y_forzar(self):
        antes = huella(self.sqlite)
        rc, salida = self.correr("servidor.py", "--importar-sqlite", self.sqlite)
        self.assertEqual(rc, 0, salida)
        self.assertIn("reportes", salida)
        self.assertRegex(salida, r"total\s+18\s+18")
        rc, salida = self.correr("servidor.py", "--importar-sqlite", self.sqlite)
        self.assertNotEqual(rc, 0)
        self.assertIn("--forzar", salida)
        rc, salida = self.correr("servidor.py", "--importar-sqlite", self.sqlite, "--forzar")
        self.assertEqual(rc, 0, salida)
        self.assertEqual(sum(self.conteos_pg().values()), 18)
        self.assertEqual(huella(self.sqlite), antes)

    def test_arranque_importa_una_sola_vez(self):
        codigo = "import servidor; servidor.iniciar_db()"
        rc, salida = self.correr("-c", codigo)
        self.assertEqual(rc, 0, salida)
        self.assertIn("Importada la base SQLite", salida)
        primera = self.conteos_pg()
        rc, salida = self.correr("-c", codigo)
        self.assertEqual(rc, 0, salida)
        self.assertNotIn("Importada", salida)
        self.assertEqual(self.conteos_pg(), primera)
        self.assertTrue(os.path.isfile(self.sqlite))

    def test_sin_base_termina_con_mensaje_claro(self):
        self.env["DATABASE_URL"] = "postgresql://nadie:nada@127.0.0.1:9/no_existe"
        rc, salida = self.correr("-c", "import comun; comun.esperar_base(total_s=2)")
        self.assertNotEqual(rc, 0)
        self.assertIn("no hay conexión con PostgreSQL", salida)
        self.assertNotIn("nada@", salida)                        # nunca muestra la clave


if __name__ == "__main__":
    unittest.main()
