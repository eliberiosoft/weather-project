# Data Model: Avisos del analista y notificaciones

Fuente: `ESQUEMA`, `panel_aviso()`, `panel_anular_aviso()`, `avisos_para()` y `CONFIG_DEF` en `api/servidor.py`; `cargarAvisos()` / `pintarAvisos()` en `cliente/app.js`.

## Tabla `avisos`

| Columna | Tipo | Nulo | Regla |
|---|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | no | lo devuelve `POST /api/panel/aviso`. |
| `creado` | TEXT | no | ISO 8601, hora de Ecuador (UTC−5). |
| `nivel_cod` | INTEGER | no | 1 NORMAL, 2 VIGILANCIA, 3 PREPARACIÓN, 4 RESPUESTA. |
| `titulo` | TEXT | no | ≤ 90 caracteres, sin espacios al borde, no vacío. |
| `texto` | TEXT | no | ≤ 600 caracteres, no vacío. |
| `ambito_tipo` | TEXT | no | `canton`, `parroquia`, `rio` o `recinto`. |
| `ambito_id` | TEXT | sí (en la práctica nunca NULL: `str(... or "")`) | `yaguachi` (cantón, lo pone el panel), nombre de la parroquia, nombre del río (`properties.rio` de `rios.geojson`) o id del recinto como texto. No se valida contra las capas. |
| `ambito_nombre` | TEXT | sí | «Todo el cantón», el mismo `ambito_id` para parroquia y río, o el nombre del recinto. |
| `vigente_hasta` | TEXT | no | `creado + horas` (1–168). |
| `anulado` | INTEGER | no (0) | 1 tras `POST /api/panel/avisos/{id}/anular`. |

No hay índices aparte de la PK. Los avisos no se borran nunca.

## Estados de un aviso (derivados)

| Estado | Condición | Dónde se ve |
|---|---|---|
| Vigente | `anulado = 0` y `vigente_hasta` > ahora | app: «Avisos» (tarjeta), insignia, notificación; panel: lista |
| Anterior | `anulado = 0` y `vigente_hasta` ≤ ahora | app: «Avisos anteriores»; panel: lista |
| Anulado | `anulado = 1` | solo panel, con la etiqueta «anulado» |

```text
publicar ──▶ vigente ──(pasa vigente_hasta)──▶ anterior
                │                                 │
                └────────(analista: anular)───────┴──▶ anulado   (sin vuelta atrás)
```

## Reglas anti-saturación (sobre los avisos de un ámbito)

Ventana: avisos con `anulado = 0`, mismo `ambito_tipo` y `ambito_id`, `creado` en las últimas 24 h, ordenados del más reciente al más antiguo. Solo si `nivel_cod < 4` y sin `forzar`:

| Regla | Condición de rechazo (409) | Configurable |
|---|---|---|
| Tope | hay ≥ `avisos_max_24h_por_ambito` (3) en la ventana | sí, `config.json` |
| Texto repetido | alguno de la ventana tiene `texto` idéntico y es de hace < 6 h | no (en código) |
| Nivel repetido | el más reciente de la ventana tiene el mismo `nivel_cod` y es de hace < 3 h | no (en código) |

## Aplicabilidad a un recinto (`avisos_para`)

Para `?recinto=<id>` existente (`p = T.recintos[id]`):

| `ambito_tipo` | Aplica si |
|---|---|
| `canton` | siempre |
| `recinto` | `ambito_id == str(p.id)` |
| `parroquia` | `ambito_id == p.parroquia` |
| `rio` | `ambito_id == p.rio_cercano` **y** `p.dist_rio_m ≤ 1500` |

Sin recinto o con un id que no existe: aplican todos.

## Configuración (`config.json`, `CONFIG_DEF`)

| Clave | Por defecto | Uso |
|---|---|---|
| `avisos_max_24h_por_ambito` | `3` | tope de la regla anti-saturación |
| `horas_silencio` | `[22, 6]` | se envía al cliente en `/api/avisos`; si inicio > fin, la franja cruza la medianoche |

## Datos en el teléfono (`localStorage`, prefijo `ay_`)

| Clave | Contenido | Crece sin límite |
|---|---|---|
| `ay_avisos_cache` | última respuesta de `/api/avisos` | no |
| `ay_avisos_vistos` | ids de avisos vigentes ya vistos en la pestaña (quita la insignia) | sí |
| `ay_avisos_notificados` | ids de avisos ya notificados (o descartados por silencio) | sí |

El permiso de notificaciones lo guarda el navegador, no la app.
