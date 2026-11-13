# Contrato HTTP: calles con agua

Fuente: `Manejador.do_GET`/`_api_get`/`do_POST`, `crear_reporte`, `validar_tramo`, `listar_reportes`, `confirmar_reporte` en `api/servidor.py`.

**Comunes**

- JSON `application/json; charset=utf-8`, `Cache-Control: no-store`, cabeceras de `CABECERAS_SEG`.
- Error: `{"error": "<mensaje en español>"}`. Excepción no prevista: `500 {"error": "error interno"}`.
- Cuerpo de los `POST`: JSON; `Content-Length` inválido → `400 "Content-Length inválido"`; negativo o > 3 MiB → `413 "envío demasiado grande"`; JSON mal formado → `400 "JSON inválido"`. nginx limita además a 3 MB (`client_max_body_size 3m`) y 20 s de cuerpo.
- La IP que se guarda es `X-Real-IP` solo si la conexión viene de un proxy de `YAGUACHI_PROXIES`; si no, la IP directa.

---

## `POST /api/reportes` (aviso de calle)

**Cuerpo**:

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `dispositivo` | texto | sí | `^[A-Za-z0-9_-]{8,64}$` |
| `consentimiento` | booleano | sí | Debe ser exactamente `true`. |
| `tipo` | texto | sí | `"calle_inundada"` (uno de los 14 de `TIPOS`). |
| `lat`, `lon` | número | sí | Dentro de `T.bbox` (recintos ± 0,08°). |
| `altura_agua` | entero | sí (calle) | 1, 2 o 3. |
| `gravedad` | entero | no | 1–3 si viene (por defecto 2); en calles se reemplaza por `altura_agua`. |
| `via` | texto | no | Se recorta a 120; vacío → NULL. |
| `tramo` | `[[lat, lon], …]` | no | 2–80 pares dentro de `T.bbox`; vacío/`null`/`[]` → sin tramo. |
| `descripcion` | texto | no | Se recorta a 500. |
| `foto` | texto | no | `data:image/jpeg;base64,…`, ≤ `max_foto_kb` (1500 KB), debe empezar con `FF D8 FF`. |

Ejemplo (hoja del mapa):

```json
{"dispositivo": "d3f1…", "tipo": "calle_inundada", "altura_agua": 2, "gravedad": 2,
 "via": "Av. Malecón", "tramo": [[-2.09211, -79.60130], [-2.09250, -79.60010]],
 "lat": -2.09230, "lon": -79.60070, "consentimiento": true}
```

**201**:

```json
{"ok": true, "id": "a1b2c3d4e5f6", "estado": "pendiente",
 "mensaje": "Gracias. Tu aviso ya está en el mapa como «aviso de vecinos»; otros vecinos pueden confirmarlo."}
```

**Errores** (en el orden en que se comprueban):

| Código | `error` |
|---|---|
| 400 | `identificador de dispositivo inválido` |
| 400 | `falta aceptar el uso de los datos del reporte` |
| 400 | `tipo de reporte desconocido` |
| 400 | `faltan la ubicación o la gravedad` |
| 400 | `gravedad inválida` |
| 400 | `la ubicación está fuera del cantón Yaguachi` |
| 400 | `indica cuánta agua hay (hasta la vereda, sobre la vereda o no cruces)` |
| 400 | `tramo de calle inválido` / `el tramo está fuera del cantón` |
| 400 | `la foto debe ser JPEG` / `la foto es demasiado grande o no es válida` |
| 429 | `ya enviaste varios reportes en la última hora; espera un momento` (≥ 6 por teléfono y hora) |
| 429 | `demasiados reportes desde esta conexión` (≥ 40 por IP y hora) |
| 429 | `ya enviaste muchas fotos hoy; manda el reporte sin foto` (≥ 20 fotos por IP y día) |
| 409 | `ya reportaste lo mismo aquí hace poco` (mismo teléfono y tipo a < 150 m en 30 min) |
| 507 | `no hay espacio para fotos ahora; envía el reporte sin foto` (< 1 GB libre) |
| 500 | `error interno` (p. ej. `tramo` con valores no numéricos o base64 mal formado; ver Brecha 9) |

---

## `GET /api/reportes`

Lista pública más los reportes propios.

| Entrada | Dónde | Notas |
|---|---|---|
| `X-Dispositivo` | cabecera | La que usa la app; manda sobre la consulta. |
| `dispositivo` | consulta | Compatibilidad; no se valida. |

**200**:

```jsonc
{
  "reportes": [{
    "id": "a1b2c3d4e5f6", "tipo": "calle_inundada", "emoji": "🌊", "etiqueta": "Calle o camino inundado",
    "gravedad": 2, "descripcion": "", "lat": -2.0923, "lon": -79.6007, "recinto": "San Jacinto de Yaguachi",
    "creado": "…", "expira": "…", "estado": "pendiente", "nota_ugr": null,
    "foto": false,            // true solo si hay foto y (verificado o es tuyo)
    "sigue": 0, "ya_no": 1, "mio": false,
    "altura_agua": 2, "altura_txt": "Sobre la vereda (tapa media llanta de moto)",
    "via": "Av. Malecón", "tramo": [[-2.09211, -79.6013], …] | null,
    "verificado": false, "likes": 0, "me_gusta": false
  }],
  "tipos": {"calle_inundada": {"emoji": "🌊", "etiqueta": "Calle o camino inundado", "horas": 8}},
  "gravedad": {"1": "Leve", "2": "Moderada", "3": "Grave"},
  "altura": {"1": "…", "2": "…", "3": "…"}
}
```

Incluye: `validado` con `expira > ahora`; `pendiente` de tipo `calle_inundada` con `expira > ahora`; y todos los del teléfono que pregunta (cualquier estado y vigencia). Orden: verificados primero, luego por `creado` descendente. Máximo 400.

---

## `POST /api/reportes/{id}/confirmar`

`{id}`: 12 hex. Voto de un vecino o cierre por el autor.

**Cuerpo**: `{"dispositivo": "d3f1…", "sigue": true | false}` (`sigue` se toma como verdadero/falso de Python).

**200**:

- Voto guardado: `{"ok": true}`.
- El autor cerró su aviso de calle: `{"ok": true, "resuelto": true}`.

**Reglas** (en orden):

1. El aviso debe existir y ser `validado`, o `pendiente` de tipo `calle_inundada`; si no → 404. No se mira `expira`.
2. Si el teléfono es el autor: tipo distinto de calle → 409; `sigue: true` → 409; `sigue: false` → el aviso pasa a `resuelto` (sin mirar si está verificado).
3. Si la IP ya tiene ≥ 30 confirmaciones en la última hora → 429.
4. Se guarda o reemplaza el voto del teléfono, se recalculan `sigue` y `ya_no`.
5. Si el aviso es `pendiente`, al menos 3 IP distintas (o teléfonos sin IP) votaron «ya no» y `ya_no > 2 × sigue` → `resuelto` con « [cerrado por vecinos]».

**Errores**:

| Código | `error` |
|---|---|
| 400 | `identificador de dispositivo inválido` |
| 404 | `reporte no encontrado` |
| 409 | `este reporte lo cierra el analista` |
| 409 | `no puedes confirmar tu propio reporte` |
| 429 | `demasiadas confirmaciones desde esta conexión; espera un rato` |

---

## Relacionadas (fuera de esta funcionalidad)

- `POST /api/panel/reportes/{id}` (panel, `X-PIN`): `{"estado": "validado" | "descartado" | "resuelto" | "pendiente", "nota": "…"}` — revisión del analista.
- `GET /r/{id}`: página corta con Open Graph para compartir; para un aviso de calle el título es «Calle o camino inundado: {via} · {recinto}» y la descripción incluye la altura y «Aviso de vecinos, sin verificar.».
