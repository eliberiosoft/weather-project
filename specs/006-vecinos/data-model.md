# Data Model: Vecinos

Fuente: `ESQUEMA`, `iniciar_db()`, `listar_reportes()`, `reporte_publico()` y `me_gusta_reporte()` en `api/servidor.py`. La tabla `reportes`, sus estados y la regla de quién ve qué están en [`specs/004-reportar-asistente/data-model.md`](../004-reportar-asistente/data-model.md); aquí solo lo propio del muro.

## Tabla `me_gusta`

| Columna | Tipo | Regla |
|---|---|---|
| `reporte_id` | TEXT | id del reporte (12 hex). Parte de la PK. Sin clave foránea. |
| `dispositivo` | TEXT | id del teléfono (`[A-Za-z0-9_-]{8,64}`). Parte de la PK: un voto por teléfono y reporte. |
| `creado` | TEXT | ISO 8601, hora de Ecuador. |
| `ip` | TEXT | IP del voto; la agrega `iniciar_db()` con `ALTER TABLE` en bases antiguas; se pone en NULL a las 48 h (`mantenimiento()`). |

`PRIMARY KEY (reporte_id, dispositivo)`. No hay índice por `ip`; el tope por IP hace un `COUNT(*)` con `ip=? AND creado>?`.

**Ciclo de vida**: `INSERT` al dar «me gusta», `DELETE` al quitarlo. No se borran cuando el reporte vence, se resuelve o se descarta.

## Publicación (vista derivada, no es tabla)

Lo que `GET /api/reportes` devuelve por cada reporte (`reporte_publico`):

| Campo | Origen |
|---|---|
| `id`, `tipo`, `gravedad`, `descripcion`, `lat`, `lon`, `recinto`, `creado`, `expira`, `estado`, `nota_ugr`, `sigue`, `ya_no`, `altura_agua`, `via` | columnas de `reportes` |
| `emoji`, `etiqueta` | `TIPOS[tipo]` (el cliente usa la etiqueta traducida `tipo.<clave>`) |
| `altura_txt` | `ALTURA[altura_agua]` (en español) |
| `tramo` | JSON de `tramo` ya decodificado |
| `foto` | `true` si hay archivo **y** (`estado = 'validado'` **o** el reporte es del teléfono que pide) |
| `mio` | `dispositivo` del reporte = `X-Dispositivo` |
| `verificado` | `estado = 'validado'` |
| `likes` | `COUNT(*)` de `me_gusta` por `reporte_id` |
| `me_gusta` | el teléfono que pide tiene fila en `me_gusta` para ese reporte |

## Estado en el teléfono

| Dónde | Clave / variable | Contenido |
|---|---|---|
| `localStorage` | `ay_muro_filtro` | `cerca` (por defecto), `mios` o `todos` |
| memoria | `REPORTES` | última lista recibida; se reutiliza sin red |
| memoria | `postDestacado` | id a resaltar (enlace `#muro/<id>` o «Ver mi reporte en Vecinos») |
| caché del SW (`VERSION`) | respuesta de `GET /api/reportes` | última lista para usar sin red |

## Página compartida `/r/<id>`

No se guarda: la genera `pagina_compartida()` en cada petición a partir del reporte. Es pública solo si `estado = 'validado'` o (`estado = 'pendiente'` y `tipo = 'calle_inundada'`); no mira `expira`.
