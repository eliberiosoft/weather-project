"""Importador de la base SQLite de antes (datos/yaguachi.db) a PostgreSQL (spec 016, US2).

  * Automático: al arrancar, si PostgreSQL no tiene datos ni una importación registrada y existe el SQLite.
  * Manual: python servidor.py --importar-sqlite <ruta> [--forzar]
    Sin --forzar se niega si PostgreSQL ya tiene datos; con --forzar vacía las tablas y vuelve a importar.

Todo va en UNA transacción (si algo falla, PostgreSQL queda como estaba), conserva los ids, ajusta las
secuencias y deja constancia en `meta` (clave `importado_sqlite`). El archivo SQLite se abre en solo lectura:
nunca se borra ni se modifica (queda en el volumen como respaldo).

Es el único lugar de la API que usa sqlite3.
"""
import json
import os
import sqlite3
import urllib.parse

from psycopg import sql

import esquema
from comun import CANDADO_MIGRACION, ahora, iso


class ImportacionRechazada(Exception):
    """PostgreSQL ya tiene datos y no se pidió --forzar."""


def _abrir_sqlite(ruta):
    # mode=ro: SQLite no escribe nada en el archivo (ni siquiera recupera un diario pendiente)
    return sqlite3.connect(f"file:{urllib.parse.quote(os.path.abspath(ruta))}?mode=ro", uri=True)


def _columnas_pg(con, tabla):
    return [r["column_name"] for r in con.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name=%s "
        "ORDER BY ordinal_position", (tabla,))]


def importar(con, ruta, forzar=False, automatico=False):
    """Importa el SQLite de `ruta` en la base de `con` (conexión en autocommit; el esquema ya migrado).

    Devuelve {tabla: {"origen": n, "destino": n}}, o None si `automatico` y no corresponde importar.
    Lanza ImportacionRechazada si PostgreSQL ya tiene datos y no se pidió `forzar`."""
    if not os.path.isfile(ruta):
        raise FileNotFoundError(f"no existe el archivo SQLite {ruta}")
    src = _abrir_sqlite(ruta)
    try:
        en_sqlite = {r[0] for r in src.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        secuencias = dict(src.execute("SELECT name, seq FROM sqlite_sequence").fetchall()) \
            if "sqlite_sequence" in en_sqlite else {}
        conteos = {}
        with con.transaction():
            # el mismo candado que las migraciones: dos arranques a la vez no importan dos veces
            con.execute("SELECT pg_advisory_xact_lock(%s)", (CANDADO_MIGRACION,))
            if automatico and esquema.meta_get(con, "importado_sqlite"):
                return None
            con_datos = {t: n for t, n in esquema.filas_por_tabla(con).items() if n}
            if con_datos:
                if automatico:
                    print(f"Aviso: existe {ruta} pero PostgreSQL ya tiene datos ({', '.join(con_datos)}); no se importa "
                          "solo. Para reemplazarlos: python servidor.py --importar-sqlite <ruta> --forzar")
                    return None
                if not forzar:
                    raise ImportacionRechazada(
                        "PostgreSQL ya tiene datos en: " + ", ".join(f"{t} ({n})" for t, n in con_datos.items())
                        + ". No se importa para no mezclar datos; usa --forzar para vaciar esas tablas y reimportar.")
                con.execute(sql.SQL("TRUNCATE {} RESTART IDENTITY").format(
                    sql.SQL(", ").join(sql.Identifier(t) for t in esquema.TABLAS)))
            for t in esquema.TABLAS:
                if t not in en_sqlite:            # SQLite de una versión anterior, sin esta tabla
                    conteos[t] = {"origen": 0, "destino": 0}
                    continue
                destino = set(_columnas_pg(con, t))
                # solo las columnas que existen en los dos lados; las que faltan en un SQLite viejo toman su DEFAULT
                cols = [r[1] for r in src.execute(f"PRAGMA table_info({t})") if r[1] in destino]
                filas = src.execute(f"SELECT {', '.join(cols)} FROM {t}").fetchall() if cols else []
                if filas:
                    consulta = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                        sql.Identifier(t), sql.SQL(", ").join(sql.Identifier(c) for c in cols),
                        sql.SQL(", ").join(sql.Placeholder() * len(cols)))
                    with con.cursor() as cur:
                        cur.executemany(consulta, filas)
                n_pg = con.execute(sql.SQL("SELECT COUNT(*) AS n FROM {}").format(sql.Identifier(t))).fetchone()["n"]
                conteos[t] = {"origen": len(filas), "destino": n_pg}
                if n_pg != len(filas):
                    raise RuntimeError(f"la tabla {t} no cuadra: {len(filas)} filas en SQLite y {n_pg} en PostgreSQL")
            for t in esquema.CON_IDENTIDAD:
                # el próximo id: después del mayor importado y del último que entregó SQLite (AUTOINCREMENT no
                # reutiliza ids de filas borradas; aquí tampoco)
                con.execute(sql.SQL("SELECT setval(pg_get_serial_sequence(%s, 'id'), "
                                    "GREATEST(COALESCE(MAX(id), 0), %s) + 1, false) FROM {}").format(sql.Identifier(t)),
                            (t, int(secuencias.get(t) or 0)))
            esquema.meta_set(con, "importado_sqlite", json.dumps(
                {"fecha": iso(ahora()), "archivo": os.path.abspath(ruta), "modo": "automatico" if automatico else "manual",
                 "forzado": bool(forzar), "conteos": conteos}, ensure_ascii=False))
        return conteos
    finally:
        src.close()


def tabla_conteos(conteos):
    """Texto con el conteo origen/destino por tabla (lo que se imprime al terminar)."""
    lineas = [f"{'tabla':<20}{'SQLite':>8}{'PostgreSQL':>12}"]
    for t, c in conteos.items():
        marca = "" if c["origen"] == c["destino"] else "   <- no cuadra"
        lineas.append(f"{t:<20}{c['origen']:>8}{c['destino']:>12}{marca}")
    tot_o = sum(c["origen"] for c in conteos.values())
    tot_d = sum(c["destino"] for c in conteos.values())
    lineas.append(f"{'total':<20}{tot_o:>8}{tot_d:>12}")
    return "\n".join(lineas)
