# Contrato HTTP: Vecinos

Sacado de `api/servidor.py`. Errores en `{"error": "<mensaje en español>"}`; JSON con `Cache-Control: no-store`; cabeceras de seguridad de `CABECERAS_SEG` en todo. El formato completo de una publicación y de `GET /api/foto/{id}` está en [`specs/004-reportar-asistente/contracts/api.md`](../004-reportar-asistente/contracts/api.md).

## `GET /api/reportes` — lista del muro

- Cabecera `X-Dispositivo: <id>` (o `?dispositivo=`).
- 200 `{"reportes": [<publicación>…], "tipos": {...}, "gravedad": {...}, "altura": {...}}`.
- Contenido: `validado` vigentes + `calle_inundada` `pendiente` vigentes + todos los del teléfono. Orden `(estado='validado') DESC, creado DESC`. `LIMIT 400`.
- Cada publicación trae `likes` (total) y `me_gusta` (si este teléfono votó).
- El filtrado por distancia, «míos» y el buscador se hacen en el cliente.

## `POST /api/reportes/{id}/megusta` — dar o quitar «me gusta»

`{id}` = `[0-9a-f]{12}` (otra forma → 404 «ruta desconocida»).

**Cuerpo**

```json
{"dispositivo": "d3f9…"}
```

**Respuesta 200**

```json
{"ok": true, "likes": 4, "me_gusta": true}
```

`me_gusta: false` si el voto ya existía y se quitó.

**Errores**

| Código | `error` | Causa |
|---|---|---|
| 400 | identificador de dispositivo inválido | `dispositivo` ausente o mal formado |
| 404 | reporte no encontrado | no existe, o este teléfono no puede verlo (`visible_para`: no es `validado`, ni calle `pendiente`, ni propio) |
| 429 | demasiados «me gusta» desde esta conexión; espera un rato | ≥ 60 filas de `me_gusta` con esa IP en la última hora (solo al dar, no al quitar) |

La lectura, el cambio y la cuenta se hacen bajo `_db_lock`.

## `GET /r/{id}` — página para compartir

`{id}` = `[0-9a-f]{12}`. Servida por la API; en Docker, el cliente nginx pasa `/r/` a `api:8080` con `Host` y `X-Real-IP`.

**Respuesta 200** `text/html; charset=utf-8`, `Cache-Control: no-store`:

```html
<!DOCTYPE html><html lang="es-EC"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>{título}</title>
<meta property="og:type" content="article"><meta property="og:site_name" content="Yaguachi Weather">
<meta property="og:title" content="{título}"><meta property="og:description" content="{descripción}">
<meta property="og:image" content="{imagen}"><meta property="og:url" content="{base}/r/{id}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url={destino}"></head>
<body><p><a href="{destino}">{título}</a></p></body></html>
```

| Variable | Reporte público (`validado`, o `calle_inundada` `pendiente`) | No público o inexistente |
|---|---|---|
| `base` | `URL_PUBLICA` sin `/` final, o `http://{Host}` | igual |
| `título` | `{etiqueta del tipo}[: {vía}] · {recinto o «cantón Yaguachi»}` | `Yaguachi Weather` |
| `descripción` | altura del agua (calles) + descripción + «Verificado por el analista.» o «Aviso de vecinos, sin verificar.» + «Yaguachi Weather es un proyecto independiente; no es un canal oficial.» | «Reportes de vecinos sobre inundaciones en el cantón Yaguachi. No es un canal oficial.» |
| `imagen` | `{base}/api/foto/{id}` si tiene foto y está `validado`; si no `{base}/icono-512.png` | `{base}/icono-512.png` |
| `destino` | `/#muro/{id}` | `/#muro` |

Todos los valores pasan por `html.escape(..., quote=True)`. Nunca responde 404: un id inexistente da la página genérica.

## Enlaces que arma el cliente (no son API)

| Destino | URL |
|---|---|
| Enlace de la publicación | `${location.origin}/r/${id}` |
| Facebook | `https://www.facebook.com/sharer/sharer.php?u=<enlace codificado>` |
| WhatsApp | `https://wa.me/?text=<texto_compartir + " " + enlace, codificado>` |
| Sistema | `navigator.share({title, text, url})` si existe |
| Foto | `/api/foto/${id}?dispositivo=${DISP}` |
| Enlace profundo | `/#muro/<id>` (lo lee `iniciar()`) |
