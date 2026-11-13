# Contrato HTTP: privacidad

La funcionalidad no agrega rutas. Fija las partes del contrato de la API de las que dependen las promesas de la política. Fuente: `api/servidor.py`.

## Identificación del teléfono

- Cabecera `X-Dispositivo: <id>` en todas las peticiones de la app (`api()` en `cliente/app.js`).
- Formato válido: `^[A-Za-z0-9_-]{8,64}$` (`validar_dispositivo`); si no → `400 {"error": "identificador de dispositivo inválido"}`.
- `GET /api/reportes`: si llega `X-Dispositivo`, reemplaza a `?dispositivo=` (la app ya no lo pone en la URL).
- En `POST /api/reportes`, `/confirmar` y `/megusta` el id va en el cuerpo JSON (`dispositivo`).
- Fotos: un `<img>` no manda cabeceras, así que la app pide la foto propia aún no pública con `GET /api/foto/<id>?k=<llave>` (ver abajo), no con el id del teléfono. `?dispositivo=` se sigue aceptando por compatibilidad.

## `POST /api/reportes`: consentimiento

Cuerpo (parte relevante):

```json
{"dispositivo": "d0f3…", "consentimiento": true, "tipo": "…", "lat": -2.08, "lon": -79.7, "foto": "data:image/jpeg;base64,…"}
```

- `consentimiento` debe ser exactamente `true` (no `"true"` ni `1`); si no → `400 {"error": "falta aceptar el uso de los datos del reporte"}`. Se comprueba justo después del id del teléfono y antes que el resto del cuerpo.
- La IP del envío (`X-Real-IP` si la conexión viene de un proxy de confianza) se guarda en `reportes.ip` solo para los límites: 6 reportes por hora y teléfono, 40 por hora e IP, 20 fotos por día e IP (`429`).
- Respuesta `201 {"ok": true, "id": "<12 hex>", "estado": "pendiente", "mensaje": "…"}`.

## `GET /api/foto/{id}`

Sirve la foto (`image/jpeg`, `Cache-Control: private, max-age=3600`) solo si el reporte tiene foto y se cumple una de:

1. `estado = 'validado'`;
2. cabecera `X-PIN` correcta (panel);
3. cabecera `X-Dispositivo` (o `?dispositivo=`) igual al autor del reporte;
4. `?k=` igual a `llave_foto(id)` = primeros 32 hex de HMAC-SHA256(`secreto_fotos`, id), comparado en tiempo constante.

`GET /api/reportes` entrega `foto_k` (la llave) solo al autor y solo mientras la foto no es pública (`estado ≠ 'validado'`); en los demás casos `foto_k` es `null`.

Si no → `404 {"error": "foto no disponible"}` (no distingue «no existe» de «no autorizado»). El service worker no guarda estas respuestas.

## Listas públicas

- `GET /api/reportes` devuelve, por reporte, `foto: true` solo si está `validado` o es del teléfono que pide; `mio` es booleano; nunca devuelve `dispositivo` ni `ip`.
- `GET /r/{id}`: la vista previa (`og:image`) usa la foto solo si el reporte está `validado`; si no, `icono-512.png`. Un reporte no público muestra una página genérica sin datos del reporte.

## Plazos automáticos (sin ruta)

| Proceso | Cuándo | Efecto |
|---|---|---|
| `limpiar_fotos_viejas()` | al arrancar y en cada vuelta de `mantenimiento()` (cada 6 h) | borra los archivos de fotos con `creado` de hace más de `dias_conservar_fotos` (90) y pone `foto = NULL` |
| `mantenimiento()` | cada 6 h (primera vuelta al arrancar) | `UPDATE … SET ip = NULL` en `reportes`, `confirmaciones` y `me_gusta` con `creado` de hace más de 48 h |
| `panel_revisar(estado = "descartado")` | al descartar en el panel | borra el archivo de la foto y pone `foto = NULL` |

## Registros

- La API escribe en su registro solo las líneas de `/api/`, sin la query (`log_message`), y sin la IP.
- nginx (`cliente`, `admin`) usa el `access_log` por defecto: IP y URL completa (brecha PR-01).

## Lo que no existe

- No hay ruta para que un ciudadano borre o corrija un reporte suyo (derechos LOPDP por contacto con el equipo del proyecto; ver P-01 y PR-06).
- No hay cookies: ninguna respuesta lleva `Set-Cookie`.
