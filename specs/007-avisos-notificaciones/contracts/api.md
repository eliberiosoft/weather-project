# Contrato HTTP: Avisos

Sacado de `api/servidor.py`. Errores en `{"error": "<mensaje en español>"}`; JSON con `Cache-Control: no-store`; cabeceras de seguridad de `CABECERAS_SEG`.

Las rutas `/api/panel/*` exigen la cabecera `X-PIN` (comparación en tiempo constante). Sin PIN o PIN incorrecto → 401 «PIN incorrecto». Tras 5 fallos desde una IP → 429 «demasiados intentos con el PIN; espera unos minutos», con espera creciente (1, 2, 4 min… hasta 24 h). El cliente público (`cliente/nginx.conf`) responde 404 a `/api/panel*`: solo se llega por el servicio `admin` (127.0.0.1:8091).

---

## `GET /api/avisos` — avisos para un lugar (público)

**Parámetros**: `recinto=<id entero>` (opcional). Vacío, no numérico o inexistente → se devuelven todos.

**Respuesta 200**

```json
{
  "vigentes": [
    {"id": 12, "creado": "2026-11-09T06:10:00-05:00", "nivel_cod": 3, "titulo": "Río Milagro en preparación",
     "texto": "…", "ambito_tipo": "rio", "ambito_id": "Río Milagro", "ambito_nombre": "Río Milagro",
     "vigente_hasta": "2026-11-10T06:10:00-05:00", "anulado": 0}
  ],
  "anteriores": [ { "...": "mismos campos" } ],
  "horas_silencio": [22, 6]
}
```

- `vigentes`: `anulado = 0` y `vigente_hasta` > ahora, `creado` descendente, `LIMIT 50`, luego filtrados por ámbito.
- `anteriores`: `anulado = 0` y `vigente_hasta` ≤ ahora, `creado` descendente, `LIMIT 20`, luego filtrados.
- No usa `X-Dispositivo` (el cliente la manda igual).
- El service worker guarda la última respuesta por URL (primero la red; sin red, la copia).

**Errores**: ninguno propio (un `recinto` raro se trata como vacío).

---

## `POST /api/panel/aviso` — publicar (panel)

**Cabeceras**: `X-PIN`, `Content-Type: application/json`.

**Cuerpo**

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `ambito_tipo` | string | sí | `canton`, `parroquia`, `rio`, `recinto` |
| `ambito_id` | string/number | no | se convierte a texto; el panel manda `yaguachi`, el nombre o el id |
| `nivel_cod` | int | sí | 1–4 |
| `titulo` | string | sí | se recorta a 90; no vacío |
| `texto` | string | sí | se recorta a 600; no vacío |
| `horas` | int | no (96) | se limita a 1–168 |
| `forzar` | bool | no | si es verdadero, se saltan las reglas anti-saturación (el panel no lo usa) |

Ejemplo (lo que envía `admin/panel.js`):

```json
{"ambito_tipo": "parroquia", "ambito_id": "YAGUACHI VIEJO", "nivel_cod": 2,
 "titulo": "Río Yaguachi en vigilancia", "texto": "Sube con el aguaje de esta tarde…", "horas": 24}
```

**Respuesta 200**: `{"ok": true, "id": 13}`

**Errores** (en el orden en que se comprueban)

| Código | `error` | Causa |
|---|---|---|
| 400 | nivel u horas inválidos | `nivel_cod` u `horas` no convertibles a entero |
| 400 | nivel inválido | `nivel_cod` fuera de 1–4 |
| 400 | ámbito inválido | `ambito_tipo` desconocido |
| 400 | el aviso necesita título y texto | alguno vacío |
| 409 | ya hay N avisos en 24 h para este ámbito; edita uno o espera (solo RESPUESTA puede pasar este límite) | tope (nivel < 4) |
| 409 | ese mismo aviso ya se publicó hace menos de 6 h | texto idéntico (nivel < 4) |
| 409 | ya hay un aviso del mismo nivel hace menos de 3 h; no repitas, actualízalo | mismo nivel que el último (nivel < 4) |

Las reglas se leen fuera del candado y la inserción va bajo `_db_lock`.

---

## `POST /api/panel/avisos/{id}/anular` — anular (panel)

`{id}` = entero (`\d+`). Cuerpo: `{}` (se ignora).

**Respuesta 200**: `{"ok": true}`, también si el id no existe o ya estaba anulado.

---

## `GET /api/panel/ajustes` (parte de avisos, panel)

Devuelve, entre otros datos que documenta la spec 008:

- `avisos`: los últimos 50 avisos por `id` descendente, **incluidos los anulados y vencidos**, con todas las columnas.
- `parroquias`: nombres de parroquia de los recintos, ordenados (para el selector «Cuál»).
- `recintos`: `[{id, nombre, parroquia}]` ordenados por nombre.

Los ríos del selector salen de `GET /api/panel/estado` (`rios[].rio`).

---

## Notificación local (no es HTTP)

Generada por `pintarAvisos()` en `cliente/app.js` mediante el service worker:

```js
reg.showNotification(`${NIVEL} · ${titulo}`, {
  body: texto.slice(0, 180), icon: "icono-192.png", tag: "aviso-" + id, requireInteraction: nivel_cod >= 4 });
```

Condiciones: `Notification.permission === "granted"`, aviso vigente que no está en `ay_avisos_notificados`, y (`nivel_cod ≥ 3` o la hora del teléfono fuera de `horas_silencio`). Al tocarla, `cliente/sw.js` (`notificationclick`) enfoca una ventana abierta o abre `./#avisos`.
