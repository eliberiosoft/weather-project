# Contrato HTTP: niveles y lugares

Fuente: `Manejador._api_get` en `api/servidor.py`. Base: `/api/` (en Docker la publica nginx del servicio `cliente`; la API no tiene puerto propio).

**Comunes a todas las rutas**

- Respuesta JSON `application/json; charset=utf-8` con `Cache-Control: no-store` y las cabeceras de `CABECERAS_SEG` (CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `COOP`, `Permissions-Policy`).
- Error: `{"error": "<mensaje en español>"}` con el código indicado. Una excepción no prevista responde `500 {"error": "error interno"}`.
- Ruta desconocida bajo `/api/`: `404 {"error": "ruta desconocida"}`.
- No piden autenticación ni `X-Dispositivo`. Los registros de la API omiten la consulta (`?…`).
- Los diccionarios con claves numéricas en Python llegan con claves de texto en JSON (`"1"`, `"2"`…).

---

## `GET /api/estado`

Estado completo del semáforo. Se recalcula como máximo cada 120 s (`_estado_cache`); el panel puede forzarlo con `GET /api/panel/estado?forzar=1` (requiere PIN).

**Parámetros**: ninguno.

**200**:

```jsonc
{
  "generado": "2026-11-09T10:15:00-05:00",
  "niveles": {"1": "NORMAL", "2": "VIGILANCIA", "3": "PREPARACIÓN", "4": "RESPUESTA"},
  "colores": {"1": "#1a9641", "2": "#ffd92f", "3": "#fd8d3c", "4": "#d7191c"},
  "canton": {"sugerido": 2, "oficial": null, "oficial_motivo": null, "oficial_hora": null},
  "advertencia": {"vigente": true, "texto": "…", "hasta": "…"} | null,
  "aguaje": {"hasta": "2026-11-12", "nota": "…"} | null,
  "rios": [{
    "rio": "Río Yaguachi", "sugerido": 2 | null, "motivo": "P01: GloFAS: …",
    "motivos": [{"k": "glofas.q_p90", "v": {"q": 410, "u": 380}, "src": "glofas", "pid": "P01"}],
    "fuente_sugerido": "modelo" | "medido", "sugerido_pleamar": 3 | null,
    "oficial": null, "oficial_motivo": null, "oficial_hora": null, "puntos": ["P01", "P02"]
  }],
  "puntos": {
    "P01": {
      "glofas": {"id": "P01", "rio": "…", "sitio": "…", "nivel_cod": 1, "motivo": "GloFAS: …", "motivos": [...],
                 "q_hoy": 312.4, "p90": 380, "q2": 520, "q5": 700,
                 "prob": {"Q2_3d": 0.0, "Q5_3d": 0.0, "Q2_30d": 9.8, "Q5_30d": 0.0},
                 "serie_15d": [...], "fechas_15d": [...], "actualizado": 1794200000.0, "desactualizado": false},
      "regla": null | {"lectura_m": 3.45, "hora": "…", "tendencia": "sube", "nivel_cod": 2,
                       "falta_borde_m": 1.55, "motivo": "Regla: …", "motivos": [...]}
    }
  },
  "recintos": {
    "19": {"id": 19, "sugerido": 2, "motivo": "…", "motivos": [{"k": "rio_cerca", "v": {"rio": "Río Yaguachi", "m": 640}}],
           "oficial": null, "oficial_fuente": null, "oficial_motivo": null, "oficial_hora": null,
           "lluvia": {"dias": [{"fecha": "2026-11-07", "mm": 3.1, "prob": 60}], "hoy_indice": 2,
                      "max_dia_3d": 12.0, "suma_3d": 20.4, "prox_24h": 8.2, "ult_24h": 1.0} | null}
  },
  "fuentes": {"lluvia_actualizada": 1794200000.0 | null, "lluvia_desactualizada": false}
}
```

Notas:

- `glofas` sin datos: `{"id", "nivel_cod": null, "motivo", "motivos": [{"k": "glofas.sin_datos" | "glofas.vencido" | "glofas.sin_caudal", "v": {}}], "actualizado"}`.
- Un río sin puntos lleva el motivo `{"k": "sin_punto"}`; con advertencia, `{"k": "adv_texto", "v": {"texto": …}}`.
- `canton.sugerido` es el máximo de `sugerido` de todos los recintos.

**Errores**: solo `500`.

---

## `GET /api/recinto?id={id}`

Detalle de un recinto para «Mi lugar».

| Parámetro | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | entero | sí | Id de `recintos.geojson`. |

**200**:

```jsonc
{
  "recinto": {"id": 19, "nombre": "…", "parroquia": "…", "prioridad": "…", "riesgo_base": "…", "lon": -79.7, "lat": -2.1,
              "parroquia_nombre": "…", "rio_cercano": "Río Yaguachi", "dist_rio_m": 640, "celda": [-2.1, -79.7],
              "etiqueta": "cabecera parroquial" | null, "...": "resto de propiedades del GeoJSON"},
  "estado": { /* igual que estado.recintos[id] */ },
  "rio": { /* el elemento de estado.rios del río más cercano */ } | null,
  "acciones": {"1": ["…"], "2": [...], "3": [...], "4": [...]},
  "equipamientos": [{"id": …, "nombre": "…", "categoria": "Salud", "parroquia": "…", "riesgo_base": "…", "dist_m": 820, "lon": …, "lat": …}],
  "advertencia": {…} | null, "aguaje": {…} | null, "generado": "…"
}
```

**Errores**: `404 {"error": "recinto no encontrado"}` si `id` falta, no es entero o no existe.

---

## `GET /api/lugar?lat={lat}&lon={lon}&nombre={nombre}`

Mismo detalle que un recinto para cualquier punto (calle del buscador o GPS).

| Parámetro | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `lat` | número | sí | WGS84. |
| `lon` | número | sí | WGS84. |
| `nombre` | texto | no | Se recorta a 120 caracteres; si falta, «Cerca de {recinto}». |

**200**: como `/api/recinto`, pero `recinto` es:

```jsonc
{"id": null, "nombre": "…", "parroquia": "…", "lon": …, "lat": …, "rio_cercano": "…", "dist_rio_m": 900,
 "recinto_cercano": "…", "dist_recinto_m": 450,
 "prioridad": "…" | null,      // solo si el recinto más cercano está a ≤ 1000 m
 "riesgo_base": "…" | null,    // ídem
 "en_canton": true}
```

y `estado` se calcula con `evaluar_punto` para ese punto (celda de lluvia propia; el nivel verificado de recinto aplica si el recinto más cercano está a ≤ 1500 m).

**Errores**:

- `400 {"error": "faltan lat y lon"}`: falta alguno o no es número.
- `400 {"error": "la ubicación está fuera del cantón Yaguachi"}`: fuera de `T.bbox` (rectángulo de los recintos ± 0,08°; no el polígono del cantón).

---

## `GET /api/territorio`

Datos fijos para armar la app. La consulta también la usa el `HEALTHCHECK` de `api/Dockerfile`.

**200**:

```jsonc
{
  "recintos": {"19": { /* recinto completo, ver arriba */ }},
  "calles": [{"nombre": "Av. …", "cerca": "San Jacinto de Yaguachi", "lon": …, "lat": …}],
  "tipos": {"calle_inundada": {"emoji": "🌊", "etiqueta": "Calle o camino inundado"}},
  "gravedad": {"1": "Leve", "2": "Moderada", "3": "Grave"},
  "altura": {"1": "Hasta el borde de la vereda (menos de 15 cm)", "2": "…", "3": "…"},
  "acciones": {"1": [...], "2": [...], "3": [...], "4": [...]},
  "niveles": {"1": "NORMAL"}, "colores": {"1": "#1a9641"}
}
```

`calles`: una entrada por par (nombre de calle OSM, recinto más cercano a su punto medio), ordenadas por nombre.

**Errores**: solo `500`.

---

## `GET /api/cercano?lat={lat}&lon={lon}`

Recinto más cercano a un punto. Hoy no la usa ni la app ni el panel.

**200**: `{"id": 19, "nombre": "…", "dist_m": 450, "en_canton": true}`

**Errores**: `400 {"error": "faltan lat y lon"}`. No valida que el punto esté en el cantón.
