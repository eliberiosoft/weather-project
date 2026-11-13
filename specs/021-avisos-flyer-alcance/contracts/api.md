# Contrato: flyer de avisos, compartir y alcance (spec 021)

## Avisos

- `POST /api/panel/aviso` (`avisos.publicar`) acepta además `flyer`: un data URL JPEG con el mismo tope que las fotos (`max_foto_kb`). Es opcional.
- `GET /api/avisos` → cada aviso trae `flyer: "/api/avisos/<id>/flyer?v=<8 hex>" | null`. Ya no expone `autor_id`, `eliminado_en` ni `eliminado_por`.
- `GET /api/avisos/<id>/flyer` → `image/jpeg`, con `Cache-Control: public, max-age=2592000, immutable`. Responde 404 (`avisos.sin_flyer`) si no tiene flyer o está anulado o eliminado.
- `GET /a/<id>` → HTML con Open Graph (`og:image` = flyer o ícono) y `refresh` a `/#avisos/<id>`.
- **Push** (datos FCM): suma `imagen` (la URL del flyer) cuando hay, y `url` pasa a ser `/#avisos/<id>/push`.

## Alcance

`POST /api/vistas`, pública, con el id del teléfono en la cabecera `X-Dispositivo`:

```json
{ "tipo": "aviso" | "incidente", "ids": [12, 13] | ["0123456789ab"], "via": "app" | "push" }
```

- Devuelve `200 {"ok": true, "nuevas": n}`: las ya contadas no suman.
- Devuelve `400 vistas.invalidas` si la entrada no es válida y `429 vistas.limite` si una conexión pasa de 600 en una hora.

**Panel**
- `GET /api/panel/ajustes` → cada aviso trae `alcance: {vistas, push, enviados}`. `enviados` sale de `push_cola.resultado.ok` y es null si el push no salió.
- `GET /api/panel/incidentes` → cada incidente trae `alcance: {vistas, push}`.

**Tabla `vistas`**

| Columna | Contenido |
|---|---|
| `tipo` | `aviso` o `incidente` |
| `item_id` | el id del aviso o del incidente |
| `quien` | HMAC-SHA256 (`secreto_fotos`, `"vistas:" + id del teléfono`), primeros 32 caracteres hex |
| `via` | `app` o `push` |
| `creado` | fecha y hora |
| `ip` | se borra a las 48 h |

La clave primaria es `(tipo, item_id, quien, via)`.

## Detalle para el superadmin (US5)

Las dos rutas piden el permiso `alcance.detalle`, que solo tiene el superadmin, y se auditan (`alcance.dispositivos` y `alcance.detalle`). Ninguna devuelve el id del teléfono.

- `GET /api/panel/dispositivos?periodo=hoy|7d|30d|todos&push=1&codigo=7F3A&pagina=1&n=25` acepta estos parámetros:
  - `periodo`: por defecto `30d`;
  - `push=1`: solo los teléfonos con notificaciones;
  - `codigo`: el código contiene ese texto (solo hex);
  - `pagina`: desde 1; si se pasa de la última, devuelve la última;
  - `n`: de 10 a 100, 25 por defecto.

  Devuelve:

  ```jsonc
  {
    "resumen": {"total", "hoy", "semana", "mes", "con_notificaciones", "instaladas"},
    "dispositivos": [{"codigo", "plataforma", "instalada", "idioma", "version", "notificaciones", "recinto", "alta", "ultimo_uso", "dias"}],
    "total": 0, "pagina": 1, "paginas": 1, "n": 25
  }
  ```

  Son los teléfonos que avisaron uso (tabla `dispositivos`) más los que tienen notificaciones, uno por teléfono. El periodo se aplica a `ultimo_uso`. Un periodo inválido responde 400 (`dispositivos.periodo`) y una página inválida, 400 (`dispositivos.pagina`). `resumen` cuenta todos los teléfonos, sin filtros; `total` y `dispositivos` son los filtrados y paginados.
- `GET /api/panel/alcance/(aviso|incidente)/<id>` → `{dispositivos: [{codigo, vias: ["app"|"push"], primera, plataforma, notificaciones, recinto}], total}`.
- `codigo` son los primeros 6 caracteres de `quien`, en mayúsculas.
- `plataforma` se toma de `push_tokens.plataforma` y de `vistas.plataforma` (migración 6): solo sistema y navegador.

## Uso de la app (US6)

`POST /api/actividad`, pública. Lleva `X-Dispositivo` en la cabecera, y `User-Agent` para el tipo de teléfono.

```json
{ "instalada": true, "idioma": "es" | "en", "version": "20261112-1552-24912ed3",
  "marca": "Samsung", "so_version": 14, "formato": "telefono" | "tablet" | "computadora" }
```

- Devuelve `200 {"ok": true}`. Responde `400` si el id del teléfono es inválido y `429 actividad.limite` si la conexión pasa de 30 teléfonos distintos por hora.
- Un idioma o una versión con formato raro no se guardan. Tampoco una marca fuera de la lista fija (Samsung, Xiaomi, Motorola, Apple, Google, Huawei, realme, OPPO, vivo, Tecno, Infinix, Nokia, LG, ZTE, Otra), una versión fuera de 1–99 ni un formato desconocido.
- En el panel, cada teléfono suma `marca`, `so_version` y `formato`. El `resumen` suma `marcas: [{marca, n}]` y `formatos: {telefono, tablet, computadora, "?"}`.
- Tabla `dispositivos` (migración 7): `quien` (PK, la misma firma de `vistas`), `plataforma`, `instalada`, `idioma`, `version`, `creado`, `ultima`, `dias`, `ip`. La IP se borra a las 48 h y la fila a los 180 días sin uso.

