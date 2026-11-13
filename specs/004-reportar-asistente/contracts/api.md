# Contrato HTTP: Reportar

Sacado de `api/servidor.py` (`Manejador.do_GET`, `do_POST`, `crear_reporte`, `listar_reportes`, `reporte_publico`). En Docker, el cliente nginx (`cliente/nginx.conf`) pasa `/api/` a la API con `X-Real-IP` y `client_max_body_size 3m`, y responde 404 a `/api/panel*`.

## Comunes

- Cuerpo de las peticiones: JSON UTF-8. `Content-Length` inválido → 400 «Content-Length inválido»; negativo o > 3 MB → 413 «envío demasiado grande»; JSON mal formado → 400 «JSON inválido».
- Respuestas JSON con `Content-Type: application/json; charset=utf-8` y `Cache-Control: no-store`.
- Errores: `{"error": "<mensaje en español>"}`. Error no previsto: 500 `{"error": "error interno"}`.
- Toda respuesta lleva las cabeceras de seguridad de `CABECERAS_SEG` (CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `COOP`, `Permissions-Policy`).
- Identificador del teléfono: en `GET` va en la cabecera `X-Dispositivo`; en `POST` va en el cuerpo (`dispositivo`). El cliente manda la cabecera en todas sus peticiones (`api()` en `cliente/app.js`).

---

## `POST /api/reportes` — crear un reporte

**Cuerpo**

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `dispositivo` | string | sí | `^[A-Za-z0-9_-]{8,64}$` |
| `consentimiento` | boolean | sí | debe ser exactamente `true` |
| `tipo` | string | sí | una clave de `TIPOS` (ver `data-model.md`) |
| `gravedad` | int | no (2) | 1, 2 o 3. Se ignora en `calle_inundada` |
| `lat`, `lon` | number | sí | dentro de `T.bbox` (recintos ± 0,08°) |
| `descripcion` | string | no | se recorta a 500 caracteres |
| `foto` | string | no | `data:image/jpeg;base64,<…>`; decodificada ≤ `max_foto_kb` (1500 KB) y empieza con `FF D8 FF` |
| `altura_agua` | int | solo `calle_inundada` | 1, 2 o 3 |
| `via` | string | no | solo `calle_inundada`; ≤ 120 caracteres |
| `tramo` | `[[lat, lon], …]` | no | solo `calle_inundada`; 2 a 80 puntos dentro de `T.bbox`; se redondea a 6 decimales |

Ejemplo (lo que envía `enviarReporte()`):

```json
{"dispositivo": "d3f9…", "tipo": "alcantarilla", "gravedad": 2, "descripcion": "frente a la escuela",
 "lat": -2.07651, "lon": -79.69432, "foto": "data:image/jpeg;base64,/9j/4AAQ…", "consentimiento": true}
```

**Respuesta 201**

```json
{"ok": true, "id": "a1b2c3d4e5f6", "estado": "pendiente",
 "mensaje": "Gracias. Vamos a revisar tu reporte; mientras tanto solo lo ves tú."}
```

Para `calle_inundada` el `mensaje` es «Gracias. Tu aviso ya está en el mapa como «aviso de vecinos»; otros vecinos pueden confirmarlo.». El cliente no muestra este texto: usa sus propias claves i18n.

**Errores** (en el orden en que se comprueban)

| Código | `error` | Causa |
|---|---|---|
| 400 | identificador de dispositivo inválido | `dispositivo` ausente o con otro formato |
| 400 | falta aceptar el uso de los datos del reporte | `consentimiento` distinto de `true` |
| 400 | tipo de reporte desconocido | `tipo` fuera de `TIPOS` |
| 400 | faltan la ubicación o la gravedad | `lat`/`lon`/`gravedad` ausentes o no numéricos |
| 400 | gravedad inválida | fuera de 1–3 |
| 400 | la ubicación está fuera del cantón Yaguachi | fuera de `T.bbox` |
| 400 | indica cuánta agua hay (hasta la vereda, sobre la vereda o no cruces) | `calle_inundada` sin `altura_agua` válida |
| 400 | tramo de calle inválido / el tramo está fuera del cantón | `tramo` mal formado o fuera de `T.bbox` |
| 400 | la foto debe ser JPEG | prefijo distinto de `data:image/jpeg;base64,` |
| 400 | la foto es demasiado grande o no es válida | > 1500 KB o sin firma JPEG |
| 429 | ya enviaste varios reportes en la última hora; espera un momento | ≥ 6 del mismo dispositivo en 1 h |
| 429 | demasiados reportes desde esta conexión | ≥ 40 de la misma IP en 1 h |
| 429 | ya enviaste muchas fotos hoy; manda el reporte sin foto | ≥ 20 con foto de la misma IP en 24 h (solo si este trae foto) |
| 409 | ya reportaste lo mismo aquí hace poco | mismo dispositivo y tipo a < 150 m en 30 min |
| 507 | no hay espacio para fotos ahora; envía el reporte sin foto | < 1 GB libre en `datos/fotos` |

Los 429, 409 y 507 se comprueban y el reporte se guarda bajo el mismo candado (`_db_lock`).

---

## `GET /api/reportes` — lista visible para este teléfono

**Cabeceras**: `X-Dispositivo: <id>` (opcional; si falta se usa `?dispositivo=`; sin ninguno solo se ven los públicos).

**Respuesta 200**

```json
{
  "reportes": [ { "id": "a1b2c3d4e5f6", "tipo": "alcantarilla", "emoji": "🕳️", "etiqueta": "Alcantarilla o canal tapado",
                  "gravedad": 2, "descripcion": "…", "lat": -2.07651, "lon": -79.69432, "recinto": "…",
                  "creado": "2026-11-09T14:05:33-05:00", "expira": "2026-11-12T14:05:33-05:00",
                  "estado": "pendiente", "nota_ugr": null, "foto": true, "sigue": 0, "ya_no": 0, "mio": true,
                  "altura_agua": null, "altura_txt": null, "via": null, "tramo": null, "verificado": false,
                  "likes": 0, "me_gusta": false } ],
  "tipos": { "calle_inundada": {"emoji": "🌊", "etiqueta": "Calle o camino inundado", "horas": 8}, "…": {} },
  "gravedad": {"1": "Leve", "2": "Moderada", "3": "Grave"},
  "altura": {"1": "Hasta el borde de la vereda (menos de 15 cm)", "2": "…", "3": "…"}
}
```

- Incluye: `validado` con `expira` > ahora; `calle_inundada` `pendiente` con `expira` > ahora; todos los del dispositivo pedido.
- Orden: `validado` primero, luego `creado` descendente. Máximo 400.
- `foto` es `true` solo si hay archivo **y** (el reporte está `validado` **o** es del dispositivo que pide).
- El service worker guarda la última respuesta para usarla sin red.

---

## `GET /api/foto/{id}` — foto de un reporte

`{id}` = `[0-9a-f]{12}`. Parámetro `?dispositivo=<id>` (va en la URL porque `<img>` no manda cabeceras) o cabecera `X-PIN`.

- 200 `image/jpeg`, `Cache-Control: private, max-age=3600`, si hay foto y (estado `validado`, o `dispositivo` = dueño, o PIN correcto).
- 404 `{"error": "foto no disponible"}` en cualquier otro caso.
- El service worker no la guarda (`/api/foto` se excluye en `cliente/sw.js`).

---

## `GET /api/territorio` (parte usada por el asistente)

`tipos`: `{clave: {emoji, etiqueta}}` en el orden de `TIPOS` (lo usa `pintarTipos()`); además `gravedad`, `altura`, `recintos` (para `recintoMasCercano`) y otros datos que documenta la spec 002.

---

## Panel (solo por el servicio `admin`, cabecera `X-PIN`)

- `GET /api/panel/reportes?estado=pendiente|validado|descartado|resuelto|todos` → `{"reportes": [...]}` (300 como máximo, más recientes primero; `dispositivo` recortado a 6 caracteres + «…»; `foto` = hay archivo; `en_canton`, `revisado_en`).
- `POST /api/panel/reportes/{id}` con `{"estado": "validado|descartado|resuelto|pendiente", "nota": "…"}` → `{"ok": true}`; 400 «estado inválido»; 404 «reporte no encontrado». Detalle en `specs/008-panel-analista`.
- Sin PIN o PIN incorrecto → 401 «PIN incorrecto»; tras 5 fallos desde una IP, 429 con espera creciente.
