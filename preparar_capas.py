"""Exporta las capas del análisis de riesgo (EPSG:32717) a GeoJSON WGS84 para el mapa de la app.

Se corre una vez, o cada vez que cambien las capas de origen:
    python preparar_capas.py

Usa el ogr2ogr de QGIS 3.44 (no hace falta instalar nada en Python).
Las capas salen en compartido/capas/; la API las lee y el cliente las sirve tal cual.
"""
import json
import os
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, "..", ".."))           # 18_GESTION_DE_RIESGO
RES = os.path.join(RAIZ, "yaguachi_riesgo", "resultados")
SALIDA = os.path.join(AQUI, "compartido", "capas")
QGIS = r"C:\Program Files\QGIS 3.44.11"
OGR2OGR = os.path.join(QGIS, "bin", "ogr2ogr.exe")

ESC = os.path.join(RES, "escenario_riesgo", "escenario_riesgo.gpkg")
RIOS = os.path.join(RES, "rios.gpkg")
SIT25 = os.path.join(RES, "situacion_20261025", "zonas_criticas_20261025.gpkg")
SIT26 = os.path.join(RES, "situacion_20261026", "situacion_20261026.gpkg")

# (archivo de salida, gpkg, SQL, tolerancia de simplificación en metros o None)
CAPAS = [
    ("limite_canton", ESC,
     "SELECT geom, DPA_DESCAN AS canton, AREA_HA AS area_ha FROM limite_canton", 15),
    ("parroquias", ESC,
     "SELECT geom, DPA_PARROQ AS codigo, DPA_DESPAR AS parroquia, TIPO AS tipo, AREA_HA AS area_ha FROM parroquias", 15),
    ("recintos", ESC,
     "SELECT geom, ID_REC AS id, RECINTO AS nombre, PARROQUIA AS parroquia, PRIORIDAD AS prioridad, "
     "PRIOR_COD AS prioridad_cod, NIV_RIE_A AS riesgo_base, NIV_RIE_300 AS riesgo_300m, HAND_M AS hand_m, "
     "ESC_MIN AS escenario_min_m, POB_300M AS pob_300m FROM recintos_prioridad_conali", None),
    ("equipamientos", ESC,
     "SELECT geom, ID_EQ AS id, NOMBRE AS nombre, CATEGORIA AS categoria, PARROQUIA AS parroquia, "
     "NIVEL_RIESGO_A AS riesgo_base FROM equipamientos", None),
    # Solo el riesgo MUY ALTO del escenario A (NIV_RIE 4); el 5 es cuerpo de agua
    ("riesgo_muy_alto", ESC,
     "SELECT ST_Buffer(ST_Buffer(geom, 30), -30) AS geom, NIV_RIE AS nivel_cod, NIV_TXT AS nivel, AREA_HA AS area_ha "
     "FROM riesgo_A WHERE NIV_RIE = 4", 45),
    ("rios", RIOS,
     "SELECT geom, rio, km_dentro FROM rios_principales", 10),
    ("tramos_criticos", RIOS,
     "SELECT geom, id_tramo, rio, km, alt_orilla_min, margen_baja, escenario_desborde_m, confiabilidad, "
     "recinto_cercano, dist_recinto_m FROM tramos_desborde WHERE alt_orilla_min <= 1.5", None),
    ("puntos_control", RIOS,
     "SELECT p.geom, p.id, p.rio, p.sitio, p.lat_celda, p.lon_celda, p.p90, p.t2, p.t5, c.en_canton "
     "FROM puntos_control_caudal p JOIN puntos_control c ON c.id = p.id", None),
    # calles y caminos del cantón (OSM) para buscar ubicaciones y reportar calles con agua
    ("calles", os.path.join(RES, "yaguachi.gpkg"),
     "SELECT geom, osm_id AS id, name AS nombre, highway AS clase FROM vias_canton", 3),
    ("zonas_criticas", SIT25,
     "SELECT geom, cod, prioridad, zona, motivo, recintos, area_ha, poblacion FROM zonas_criticas", 15),
    ("huellas_desborde", SIT26,
     "SELECT geom, cod, rio, nivel, aplicabilidad, area_ha, poblacion, recintos, recintos_300m FROM huellas_desborde_27_28oct", 15),
]


def entorno_gdal():
    env = dict(os.environ)
    env["PATH"] = os.path.join(QGIS, "bin") + os.pathsep + os.path.join(QGIS, "apps", "gdal", "bin") + os.pathsep + env.get("PATH", "")
    env["GDAL_DATA"] = os.path.join(QGIS, "apps", "gdal", "share", "gdal")
    env["PROJ_DATA"] = env["PROJ_LIB"] = os.path.join(QGIS, "share", "proj")
    return env


def exportar(nombre, gpkg, sql, tol, env):
    destino = os.path.join(SALIDA, nombre + ".geojson")
    if os.path.exists(destino):
        os.remove(destino)
    cmd = [OGR2OGR, "-f", "GeoJSON", destino, gpkg, "-dialect", "SQLite", "-sql", sql,
           "-t_srs", "EPSG:4326", "-lco", "RFC7946=YES", "-lco", "COORDINATE_PRECISION=6", "-nln", nombre]
    if tol:
        cmd += ["-simplify", str(tol)]
    r = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"ERROR {nombre}: {r.stderr.strip()}")
        return False
    with open(destino, encoding="utf-8") as fh:
        n = len(json.load(fh)["features"])
    kb = os.path.getsize(destino) / 1024
    print(f"  {nombre:18s} {n:4d} elementos  {kb:8.1f} KB")
    return True


def main():
    if not os.path.exists(OGR2OGR):
        sys.exit(f"No encuentro ogr2ogr en {OGR2OGR}. Ajusta la variable QGIS.")
    os.makedirs(SALIDA, exist_ok=True)
    env = entorno_gdal()
    print(f"Exportando a {SALIDA}")
    ok = all([exportar(*c, env) for c in CAPAS])
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
