# Data Model: Mapa interactivo del cantón

El mapa no escribe en la base de datos. Lee capas GeoJSON estáticas, el estado del semáforo (`/api/estado`, ver `specs/002-semaforo-mi-lugar/contracts/api.md`), los recintos de `/api/territorio` y los reportes (`/api/reportes`, ver `specs/005-calles-inundadas/contracts/api.md`).

## Capas GeoJSON (`compartido/capas/`, servidas como `capas/*.geojson`)

Todas en WGS84 (RFC 7946) con 6 decimales, exportadas por `preparar_capas.py` desde GeoPackages en EPSG:32717 (simplificación en metros indicada).

| Archivo | Elementos | Tamaño | Geometría | Propiedades | Simplif. | Uso en el mapa |
|---|---|---|---|---|---|---|
| `limite_canton` | 1 | 19 KB | polígono | `canton`, `area_ha` | 15 m | Línea tinta 3 px; `maxBounds`; «ver todo el cantón». No interactiva. |
| `parroquias` | 4 | 25 KB | polígono | `codigo`, `parroquia`, `tipo`, `area_ha` | 15 m | Línea discontinua 1,5 px (apagada). La API la usa para `parroquia_de`. |
| `rios` | 10 | 87 KB | línea | `rio`, `km_dentro` | 10 m | Halo + línea del nivel + línea de toque. |
| `puntos_control` | 9 | 3 KB | punto | `id` (P01–P09), `rio`, `sitio`, `lat_celda`, `lon_celda`, `p90`, `t2` (Q2), `t5` (Q5), `en_canton` | — | Marcador rectangular con el código. |
| `tramos_criticos` | 63 | 44 KB | línea | `id_tramo`, `rio`, `km`, `alt_orilla_min`, `margen_baja`, `escenario_desborde_m`, `confiabilidad`, `recinto_cercano`, `dist_recinto_m` | — | Solo orillas ≤ 1,5 m sobre el cauce. Escenario. |
| `zonas_criticas` | 6 | 21 KB | polígono | `cod`, `prioridad`, `zona`, `motivo`, `recintos`, `area_ha`, `poblacion` | 15 m | Situación del 25-oct. Escenario. |
| `huellas_desborde` | 4 | 118 KB | polígono | `cod` (M1, M2, B1, B2), `rio`, `nivel` (`ESPERABLE`, `DESFAVORABLE`, `FRANJA DE PRIMER DESBORDE`), `aplicabilidad`, `area_ha`, `poblacion`, `recintos`, `recintos_300m` | 15 m | Escenario 27–28 oct. |
| `riesgo_muy_alto` | 1 | 70 KB | polígono | `nivel_cod` (4), `nivel`, `area_ha` | 45 m | Riesgo muy alto del escenario A. Escenario. |
| `equipamientos` | 15 | 3 KB | punto | `id`, `nombre` («s/n» si no tiene), `categoria` (`Salud`, `Seguridad`, `Educación`), `parroquia`, `riesgo_base` | — | Marcador con ícono `e-{categoria}` (apagada). |
| `calles` | 1207 | 345 KB | línea | `id` (OSM), `nombre` (316 con nombre), `clase` (`primary`, `residential`, `track`…) | 3 m | No se dibuja: se carga bajo demanda para `tramoCercano`. |
| `recintos` | 71 | 22 KB | punto | `id`, `nombre`, `parroquia`, `prioridad`, `prioridad_cod`, `riesgo_base`, `riesgo_300m`, `hand_m`, `escenario_min_m`, `pob_300m` | — | El mapa usa `TERR.recintos` de `/api/territorio`, no el archivo. |

## Capas Leaflet (`capas[k]` en `cliente/app.js`)

| Clave | Grupo | Encendida por defecto | *Pane* | Origen |
|---|---|---|---|---|
| `callesAgua` | Ahora | sí | `agua` (canvas) | `/api/reportes`, tipo `calle_inundada`, estado `pendiente` o `validado` |
| `rios` | Ahora | sí | `rios` (canvas) | `rios.geojson` + nivel de `/api/estado` |
| `recintos` | Ahora | sí | `recintos` (canvas) | `/api/territorio` + nivel de `/api/estado` |
| `reportes` | Ahora | sí | marcadores (DOM) | `/api/reportes`: verificados de otros tipos y los tuyos pendientes |
| `tramos` | Riesgo base | no | `tramos` (canvas) | `tramos_criticos.geojson` |
| `muyAlto` | Riesgo base | no | `escenarios` (canvas) | `riesgo_muy_alto.geojson` |
| `zonas` | Riesgo base | no | `escenarios` (canvas) | `zonas_criticas.geojson` |
| `huellas` | Riesgo base | no | `escenarios` (canvas) | `huellas_desborde.geojson` |
| `puntos` | Referencia | sí | marcadores (DOM) | `puntos_control.geojson` + GloFAS/regla de `/api/estado` |
| `equip` | Referencia | no | marcadores (DOM) | `equipamientos.geojson` |
| `parroquias` | Referencia | no | `limites` (canvas) | `parroquias.geojson` |

El límite cantonal (`limite`) siempre está visible y no figura en la hoja de capas.

## Simbología (constantes de `cliente/app.js`)

| Constante | Valor | Uso |
|---|---|---|
| `COL` | 1 `#1a9641`, 2 `#ffd92f`, 3 `#fd8d3c`, 4 `#d7191c` | Nivel de ríos y recintos. |
| `AGUA` / `AGUA_W` | 1 `#6baed6`/5 px, 2 `#2171b5`/7 px, 3 `#08306b`/9 px | Altura del agua en calles (y, hoy, las huellas). |
| `NEGRO` | `#102a3c` | Halo/borde de lo verificado; tramos críticos. |
| `TINTA` | `#1d5f84` | Límite, parroquias, resaltado de selección, tu ubicación. |
| `ESCENARIO` | `#7a0177` | Riesgo muy alto y zonas críticas. |

## Estado del mapa en el teléfono

| Dónde | Clave / forma | Contenido |
|---|---|---|
| `localStorage` | `ay_capas_on` | `{clave: bool}` solo de las capas que la persona cambió; se mezcla con los valores por defecto (`capasEncendidas`). |
| `localStorage` | `ay_fondo` | `"osm"` o `"sat"`. |
| URL | `#mapa/{z}/{lat}/{lon}` | Zoom entero y centro con 4 decimales. |
| URL | `#mapa/recinto/{id}` | Recinto seleccionado (hoja abierta). |
| Memoria | `seleccion`, `ultimaInfo` | Lo tocado y la última hoja (para repintarla al cambiar de idioma). |

## Transiciones de la selección

```text
(nada) ──toque en objeto──► seleccionado (hoja-info abierta, resaltado, hash recinto si aplica)
seleccionado ──✕ / Escape / toque en mapa vacío──► (nada) (hash vuelve a z/lat/lon)
cualquier estado ──«Avisar de una calle» / «Otro reporte»──► modo de reporte (abrirInfo deshabilitado; ver 005)
```
