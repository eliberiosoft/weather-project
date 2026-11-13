# Contrato HTTP: rutas del panel

Fuente: `Manejador.do_GET`, `Manejador._api_get`, `Manejador.do_POST` y las funciones `panel_*` de `api/servidor.py`. Solo se alcanzan por el servicio `admin` (`127.0.0.1:8091`) o, en desarrollo, por la API directa; el servicio `cliente` responde `404` (de nginx) a `/api/panel` y `/api/panel/*`.

## Reglas comunes

- **Autenticación**: cabecera `X-PIN: <PIN>` en cada petición. Comparación en tiempo constante.
  - Sin cabecera o PIN incorrecto → `401 {"error": "PIN incorrecto"}` (sin cabecera no cuenta como fallo).
  - IP bloqueada (≥ 5 fallos, espera `min(60·2^(n−5), 86400)` s) → `429 {"error": "demasiados intentos con el PIN; espera unos minutos"}`. Durante el bloqueo no se compara el PIN.
- **POST**: cuerpo JSON (`Content-Type: application/json`). El cuerpo se lee **antes** de comprobar el PIN:
  - `Content-Length` no numérico → `400 {"error": "Content-Length inválido"}`; negativo o > 3 MiB → `413 {"error": "envío demasiado grande"}`; JSON mal formado → `400 {"error": "JSON inválido"}`; cuerpo vacío = `{}`.
- **Respuestas**: `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store` y las cabeceras de `CABECERAS_SEG` (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `COOP`, `Permissions-Policy`, CSP). nginx del admin añade `X-Robots-Tag: noindex, nofollow` en `/api/`.
- **Errores** siempre como `{"error": "<mensaje en español>"}`. Ruta `/api/panel/*` desconocida con PIN válido → `404 {"error": "ruta desconocida"}`. Excepción no controlada → `500 {"error": "error interno"}`.
- **Efecto en el estado**: las rutas marcadas «invalida» ponen a 0 la caché de `calcular_estado()`.

---

## `POST /api/panel/login`

Comprueba el PIN. Cuerpo: cualquiera (el panel manda `{}`).

- `200 {"ok": true}` · `401` · `429`

## `GET /api/panel/estado`

Query: `forzar=1` (opcional) recalcula sin la caché de 120 s.

`200`: el mismo objeto que `GET /api/estado`:

```json
{
  "generado": "2026-11-09T10:00:00-05:00",
  "niveles": {"1": "NORMAL", "2": "VIGILANCIA", "3": "PREPARACIÓN", "4": "RESPUESTA"},
  "colores": {"1": "#1a9641", "2": "#ffd92f", "3": "#fd8d3c", "4": "#d7191c"},
  "canton": {"sugerido": 2, "oficial": null, "oficial_motivo": null, "oficial_hora": null},
  "advertencia": {"vigente": true, "texto": "…", "hasta": "…"} ,
  "aguaje": {"hasta": "2026-11-12", "nota": "…"},
  "rios": [{"rio": "Río Yaguachi", "sugerido": 2, "motivo": "P01: GloFAS: …", "motivos": [{"k": "glofas.q_p90", "v": {"q": 1700, "u": 1659}, "src": "glofas", "pid": "P01"}],
            "fuente_sugerido": "modelo", "sugerido_pleamar": 3, "oficial": null, "oficial_motivo": null, "oficial_hora": null, "puntos": ["P01"]}],
  "puntos": {"P01": {"glofas": {…}, "regla": {…} }},
  "recintos": {"1": {"id": 1, "sugerido": 1, "motivo": "…", "motivos": [{"k": "ninguno", "v": {}}], "oficial": null,
                     "oficial_fuente": null, "oficial_motivo": null, "oficial_hora": null, "lluvia": {…}}},
  "fuentes": {"lluvia_actualizada": 1794261892.3, "lluvia_desactualizada": false}
}
```

`advertencia` y `aguaje` son `null` si no rigen. `oficial_fuente` ∈ `recinto`, `parroquia`, `rio`, `canton` o `null`. Formato de `motivos`: ver `specs/009-i18n/contracts/api.md`.

## `GET /api/panel/reportes`

Query: `estado` = `pendiente` (por defecto), `validado`, `descartado`, `resuelto` o `todos`. Cualquier otro valor devuelve lista vacía.

`200 {"reportes": [ … ]}` (máx. 300, `creado` descendente). Cada reporte:

```json
{"id": "a1b2c3d4e5f6", "tipo": "vivienda_inundada", "emoji": "🏠", "etiqueta": "Agua dentro de viviendas", "gravedad": 3,
 "descripcion": "…", "lat": -2.08, "lon": -79.7, "recinto": "…", "creado": "…", "expira": "…", "estado": "pendiente",
 "nota_ugr": null, "foto": true, "sigue": 0, "ya_no": 0, "mio": false, "altura_agua": null, "altura_txt": null,
 "via": null, "tramo": null, "verificado": false, "likes": 0, "me_gusta": false,
 "dispositivo": "d3f9a1…", "en_canton": true, "revisado_en": null}
```

`foto` indica si hay archivo (aunque el reporte no esté verificado). No incluye la IP.

## `POST /api/panel/reportes/{id}`

`{id}` = 12 hex. Cuerpo: `{"estado": "validado" | "descartado" | "resuelto" | "pendiente", "nota": "…"}` (`nota` ≤ 300; vacía → `NULL`).

- `200 {"ok": true}` (invalida). Con `descartado`, borra el archivo de la foto y pone `foto = NULL`.
- `400 {"error": "estado inválido"}` · `404 {"error": "reporte no encontrado"}`

## `GET /api/foto/{id}`

Ruta pública que el panel usa con `X-PIN`. Sirve el JPEG si el reporte tiene foto y (está `validado`, o el `X-PIN` es correcto, o `X-Dispositivo`/`?dispositivo=` coincide con el autor, o `?k=` es la llave firmada de esa foto; ver `specs/010-privacidad-cookies/contracts/api.md`).

- `200` `image/jpeg`, `Cache-Control: private, max-age=3600` · `404 {"error": "foto no disponible"}` · `429` si la IP está bloqueada por PIN.
- Un `X-PIN` incorrecto aquí también cuenta como fallo.

## `POST /api/panel/nivel`

Cuerpo: `{"ambito_tipo": "canton" | "rio" | "parroquia" | "recinto", "ambito_id": "yaguachi" | "<río>" | "<parroquia>" | "<id recinto>", "nivel_cod": 1..4 | null, "motivo": "…"}`

- `200 {"ok": true}` (invalida). Agrega una fila a `niveles_oficiales`; con `nivel_cod: null`, `motivo` por defecto «nivel oficial retirado».
- `400 {"error": "ámbito inválido"}` · `400 {"error": "nivel inválido"}` · `400 {"error": "escribe el motivo del nivel (queda registrado)"}`
- `nivel_cod` no convertible a entero → `500` (brecha B-05). `ambito_id` no se valida.

## `POST /api/panel/aviso`

Cuerpo: `{"ambito_tipo": "canton" | "rio" | "parroquia" | "recinto", "ambito_id": "…", "nivel_cod": 1..4, "titulo": "≤ 90", "texto": "≤ 600", "horas": 1..168, "forzar": false}`

- `horas` se recorta a 1–168 (por defecto 24).
- `200 {"ok": true, "id": 12}` (no invalida el estado: los avisos no cambian el nivel).
- `400 {"error": "nivel u horas inválidos"}` · `400 {"error": "nivel inválido"}` · `400 {"error": "ámbito inválido"}` · `400 {"error": "el aviso necesita título y texto"}`
- Anti-saturación (solo si `nivel_cod < 4` y `forzar` falso; se comprueba y se guarda bajo el mismo candado), contando avisos no anulados del mismo `ambito_tipo` + `ambito_id` en las últimas 24 h:
  - ≥ 3 (`avisos_max_24h_por_ambito`) → `409 {"error": "ya hay N avisos en 24 h para este ámbito; edita uno o espera (solo RESPUESTA puede pasar este límite)"}`
  - mismo `texto` hace < 6 h → `409 {"error": "ese mismo aviso ya se publicó hace menos de 6 h"}`
  - el más reciente tiene el mismo nivel y es de hace < 3 h → `409 {"error": "ya hay un aviso del mismo nivel hace menos de 3 h; no repitas, actualízalo"}`

## `POST /api/panel/avisos/{id}/anular`

`{id}` entero. Cuerpo: `{}`.

- `200 {"ok": true}` · `404 {"error": "aviso no encontrado"}`

## `POST /api/panel/lectura`

Cuerpo: `{"punto_id": "P05", "lectura_m": "3,45" | 3.45, "tendencia": "sube" | "baja" | "igual" | "", "hora": "2026-10-21T11:00:00.000Z" | null, "vigia": "≤ 60", "lluvia": true}`

- `hora` ISO 8601 (se convierte a UTC−5; sin zona se interpreta en la hora local del proceso); `null` = ahora.
- `200 {"ok": true}` (invalida).
- `400 {"error": "punto de control desconocido"}` · `400 {"error": "lectura inválida"}`
- `hora` mal formada (o con `Z` en Python 3.10) → `500` (B-03, B-05).

## `POST /api/panel/regla`

Cuerpo: `{"punto_id": "P05", "borde_m": "4,10" | 4.1 | "" | null, "nota": "≤ 200"}`

- `200 {"ok": true}` (invalida). Reemplaza la fila del punto.
- `400 {"error": "punto de control desconocido"}`; `borde_m` no numérico → `500` (B-05).

## `GET /api/panel/ajustes`

`200`:

```json
{
  "advertencia": {"vigente": true, "texto": "…", "hasta": "…"} ,
  "aguaje": {"hasta": "2026-11-12", "nota": "…"},
  "reglas": {"P05": {"punto_id": "P05", "borde_m": 4.1, "nota": ""}},
  "lecturas": {"P05": [{"id": 3, "creado": "…", "punto_id": "P05", "lectura_m": 3.45, "tendencia": "sube", "lluvia": 1, "vigia": "…"}]},
  "puntos": {"P01": {"id": "P01", "rio": "Río Yaguachi", "sitio": "…", "lat_celda": -2.125, "lon_celda": -79.725, "p90": 1658.59, "t2": 2273.857, "t5": 2670.399, "en_canton": 1}},
  "historial_niveles": [{"id": 7, "creado": "…", "ambito_tipo": "recinto", "ambito_id": "12", "nivel_cod": 2, "motivo": "…"}],
  "avisos": [{"id": 12, "creado": "…", "nivel_cod": 2, "titulo": "…", "texto": "…", "ambito_tipo": "rio", "ambito_id": "Río Milagro", "ambito_nombre": "Río Milagro", "vigente_hasta": "…", "anulado": 0}],
  "parroquias": ["…"],
  "recintos": [{"id": 1, "nombre": "La Puntilla", "parroquia": "VIRGEN DE FÁTIMA"}]
}
```

`advertencia`/`aguaje` son `null` si nunca se guardaron. `lecturas`: hasta 12 por punto, de las 200 más recientes. `historial_niveles` y `avisos`: los 50 últimos por `id`.

## `POST /api/panel/ajustes`

Cuerpo (cada clave es opcional; la que falta no se toca):

```json
{"advertencia": {"vigente": true, "texto": "≤ 200", "hasta": "2026-10-28T23:00:00.000Z" | null},
 "aguaje": {"hasta": "2026-11-12" | null, "nota": "≤ 200"}}
```

- `200 {"ok": true}` (invalida). Sin validación de formato de `hasta` (B-02).
