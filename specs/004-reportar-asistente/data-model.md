# Data Model: Reportar — asistente paso a paso

Fuente: `ESQUEMA` e `iniciar_db()` en `api/servidor.py`. Base SQLite en `datos/yaguachi.db` (en Docker, `/app/datos/yaguachi.db` dentro del volumen `yaguachi-weather_datos`). Las fechas se guardan como texto ISO 8601 con segundos y zona de Ecuador (`2026-11-09T14:05:33-05:00`, función `iso()`), así que se comparan como texto.

## Tabla `reportes`

| Columna | Tipo | Nulo | Origen / regla |
|---|---|---|---|
| `id` | TEXT PK | no | `uuid4().hex[:12]` (12 hex). Las rutas lo exigen con `[0-9a-f]{12}`. |
| `creado` | TEXT | no | hora del servidor al recibirlo. |
| `dispositivo` | TEXT | no | id del teléfono (`[A-Za-z0-9_-]{8,64}`); el cliente lo genera como `d` + 32 hex. |
| `ip` | TEXT | sí | IP real (de `X-Real-IP` si viene de un proxy de confianza). Se pone en NULL a las 48 h. |
| `tipo` | TEXT | no | clave de `TIPOS`. |
| `gravedad` | INTEGER | no | 1 Leve, 2 Moderada, 3 Grave. En `calle_inundada` es igual a `altura_agua`. |
| `descripcion` | TEXT | sí | texto libre, recortado a 500 caracteres (cadena vacía si no hay). |
| `lat`, `lon` | REAL | no | WGS84, dentro de `T.bbox`. |
| `recinto_id` | INTEGER | sí | id del recinto más cercano si está a ≤ 3 km. |
| `recinto` | TEXT | sí | nombre de ese recinto. |
| `en_canton` | INTEGER | sí | 1 si el punto cae dentro del polígono del cantón. |
| `foto` | TEXT | sí | nombre de archivo `<uuid4>.jpg` en `datos/fotos/`. NULL tras 90 días o al descartar. |
| `estado` | TEXT | no | `pendiente` (por defecto), `validado`, `descartado`, `resuelto`. |
| `nota_ugr` | TEXT | sí | nota del analista (≤ 300); el cierre por vecinos le agrega `[cerrado por vecinos]` o `[quien avisó dijo que el agua ya pasó]`. |
| `revisado_en` | TEXT | sí | hora de la última revisión en el panel. |
| `expira` | TEXT | no | `creado` + horas del tipo. Solo filtra la visibilidad pública; no cambia el estado. |
| `sigue`, `ya_no` | INTEGER | no (0) | totales de votos de vecinos (ver spec 005). |
| `altura_agua` | INTEGER | sí | solo `calle_inundada`: 1, 2 o 3. Columna agregada por `ALTER TABLE` si la base es antigua. |
| `via` | TEXT | sí | solo `calle_inundada`: nombre de la calle (≤ 120). Columna agregada por migración. |
| `tramo` | TEXT | sí | solo `calle_inundada`: JSON `[[lat, lon], …]`, 2–80 puntos, 6 decimales. Columna agregada por migración. |

No hay índices aparte de la clave primaria.

## Tipos de reporte (`TIPOS`, en código)

| Clave | Vigencia (`expira`) | Sube a RESPUESTA si se verifica |
|---|---|---|
| `calle_inundada` | 8 h | no (se publica al momento: `PUBLICO_YA`) |
| `vivienda_inundada` | 24 h | **sí** |
| `rio_crecido` | 12 h | no |
| `desborde` | 24 h | **sí** |
| `via_cerrada` | 24 h | no |
| `alcantarilla` | 72 h | no |
| `dique_filtracion` | 72 h | no |
| `socavon` | 72 h | no |
| `arbol_poste` | 24 h | no |
| `sin_luz` | 12 h | no |
| `lluvia_fuerte` | 3 h | no |
| `aislados` | 24 h | **sí** |
| `cultivos_ganado` | 72 h | no |
| `otro` | 24 h | no |

## Tabla `confirmaciones` (relacionada)

`(reporte_id TEXT, dispositivo TEXT, sigue INTEGER, creado TEXT, ip TEXT, PRIMARY KEY (reporte_id, dispositivo))`. Un voto por teléfono y reporte; la columna `ip` se agrega por migración. La documenta `specs/005-calles-inundadas`.

## Estados y transiciones

```text
crear_reporte ──▶ pendiente
pendiente  ──(analista)──▶ validado | descartado | resuelto
validado   ──(analista)──▶ pendiente | descartado | resuelto
descartado ──(analista)──▶ pendiente | validado | resuelto      (la foto ya no vuelve)
resuelto   ──(analista)──▶ pendiente | validado | descartado
pendiente (solo calle_inundada) ──(autor «ya pasó» o 3 conexiones «ya no»)──▶ resuelto
```

| Desde \ Hacia | `pendiente` | `validado` | `descartado` | `resuelto` |
|---|---|---|---|---|
| `pendiente` | — | analista | analista (borra foto) | analista; vecinos/autor si es calle |
| `validado` | analista | — | analista (borra foto) | analista |
| `descartado` | analista | analista | — | analista |
| `resuelto` | analista | analista | analista (borra foto) | — |

- **Analista** (`panel_revisar`): puede pasar de cualquier estado a cualquiera de `validado`, `descartado`, `resuelto`, `pendiente`. Siempre reescribe `nota_ugr` (NULL si la nota va vacía) y `revisado_en`. Pasar a `descartado` borra el archivo de la foto.
- **Vecinos y autor** (solo `calle_inundada` `pendiente`, spec 005): el autor puede pasarla a `resuelto` («ya pasó»); tres conexiones distintas que dicen «ya no» (y más del doble de «ya no» que de «sigue») la pasan a `resuelto`. Lo `validado` solo lo cambia el analista.
- **Vencimiento**: al pasar `expira`, el reporte deja de verse para otros, pero su `estado` no cambia.

## Quién ve qué

| Estado | Autor (mismo `X-Dispositivo`) | Otros vecinos | Analista (`X-PIN`) |
|---|---|---|---|
| `pendiente`, tipo `calle_inundada`, vigente | sí, con su foto | sí, como «aviso de vecinos», sin foto | sí, con foto |
| `pendiente`, otros tipos | sí, «en revisión», con su foto | **no** | sí, con foto |
| `validado`, vigente | sí | sí, con foto | sí |
| `validado`, vencido | sí | no (la foto sigue accesible por id hasta los 90 días) | sí |
| `resuelto` | sí | no | sí |
| `descartado` | sí (sin foto: se borró) | no | sí |

## Datos en el teléfono (`localStorage`, prefijo `ay_`)

| Clave | Contenido |
|---|---|
| `ay_dispositivo` | id aleatorio del teléfono. |
| `ay_cola_reportes` | lista de cuerpos `POST /api/reportes` pendientes (incluye la foto en base64). |
| `ay_consent_ok` | `true` después del primer envío correcto. |
| `ay_muro_filtro` | filtro de Vecinos; el asistente lo pone en `mios` al ir a «Ver mis reportes». |

## Archivos

- Fotos: `datos/fotos/<uuid4 hex>.jpg`, tal como llegaron del cliente (ya reducidas). Se borran a los 90 días (`limpiar_fotos_viejas`, al arrancar y cada 6 h) o al descartar el reporte.
