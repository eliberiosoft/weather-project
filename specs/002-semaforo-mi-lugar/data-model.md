# Data Model: Semáforo de «Mi lugar»

Fuente: `ESQUEMA` e `iniciar_db()` en `api/servidor.py`. Las fechas se guardan como texto ISO 8601 con zona `-05:00` (`iso(ahora())`, Ecuador continental). SQLite no tiene restricciones `CHECK`: los valores permitidos los impone el código.

## Tablas que alimentan el nivel

### `niveles_oficiales` — nivel verificado por el analista

| Campo | Tipo | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | El mayor `id` por ámbito es el vigente. |
| `creado` | TEXT NOT NULL | Hora en que se fijó; se muestra como `oficial_hora`. |
| `ambito_tipo` | TEXT NOT NULL | `canton`, `rio`, `parroquia` o `recinto` (validado en `panel_nivel`). |
| `ambito_id` | TEXT NOT NULL | `yaguachi` (cantón), nombre del río, nombre de la parroquia o id del recinto como texto. |
| `nivel_cod` | INTEGER | 1–4; `NULL` = nivel retirado. |
| `motivo` | TEXT | Obligatorio si `nivel_cod` no es NULL (máx. 300); al retirar se guarda «nivel oficial retirado». |

Es un **historial**: nunca se actualiza ni se borra; cada cambio inserta una fila. `oficiales()` toma la última fila por `(ambito_tipo, ambito_id)` y descarta las que tienen `nivel_cod` NULL.

Precedencia al evaluar un punto (`evaluar_punto`): `("recinto", id)` → `("parroquia", nombre)` → `("rio", nombre)` solo si el punto está a ≤ 1500 m del río → `("canton", "yaguachi")`. El primero que exista manda; su tipo se devuelve como `oficial_fuente`.

### `lecturas` — lecturas de las reglas limnimétricas (vigías)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `creado` | TEXT NOT NULL | Hora de la lectura (la que da el vigía o la del guardado). |
| `punto_id` | TEXT NOT NULL | P01–P09 (debe existir en `puntos_control.geojson`). |
| `lectura_m` | REAL NOT NULL | Metros en la regla. |
| `tendencia` | TEXT | `sube`, `baja`, `igual` o NULL. |
| `lluvia` | INTEGER | 0/1. |
| `vigia` | TEXT | Máx. 60 caracteres. |

`nivel_regla` usa la última lectura si tiene ≤ 12 h, la última de hace ≥ 24 h y la primera de los 70 min anteriores.

### `reglas` — borde de desborde de cada punto

| Campo | Tipo | Notas |
|---|---|---|
| `punto_id` | TEXT PK | P01–P09. |
| `borde_m` | REAL | Lectura en la que el río desborda; NULL = sin borde definido. |
| `nota` | TEXT | Máx. 200. |

### `ajustes` — clave/valor JSON

| Clave | Valor | Uso |
|---|---|---|
| `advertencia` | `{vigente: bool, texto: str(≤200), hasta: ISO \| null}` | `advertencia_vigente()`: vigente si `vigente` y (`hasta` vacío o futuro). Sube ríos y puntos a ≥ VIGILANCIA y pinta el banner. |
| `aguaje` | `{hasta: "AAAA-MM-DD" \| null, nota: str(≤200)}` | `aguaje_vigente()`: vigente hasta esa fecha inclusive. Da `sugerido_pleamar` a Yaguachi y Babahoyo y pinta el banner. |

### `cache` — respuestas de Open-Meteo

| Campo | Tipo | Notas |
|---|---|---|
| `clave` | TEXT PK | `lluvia_celdas` o `glofas_P0x`. |
| `actualizado` | REAL NOT NULL | Época Unix del guardado. |
| `datos` | TEXT NOT NULL | JSON crudo. |

Vigencia: `cache_lluvia_min` (60) y `cache_glofas_min` (360) de `config.json`. Si la red falla se devuelve lo guardado con `desactualizado = true`.

### `reportes` (solo lectura aquí)

`reportes_graves_validados()` lee `lat`, `lon`, `tipo` de los reportes con `estado = 'validado'` y `expira > ahora` cuyo tipo tiene la marca «grave» en `TIPOS` (`vivienda_inundada`, `desborde`, `aislados`). El modelo completo de `reportes` está en `specs/005-calles-inundadas/data-model.md`.

## Configuración (`config.json`, `CONFIG_DEF`)

| Clave | Por defecto | Uso en el nivel |
|---|---|---|
| `lluvia_vigilancia_24h_mm` | 50 | Un día ≥ → VIGILANCIA. |
| `lluvia_preparacion_24h_mm` | 100 | Un día ≥ → PREPARACIÓN. |
| `lluvia_preparacion_72h_mm` | 150 | Suma de hoy y 2 días ≥ → PREPARACIÓN. |
| `cache_lluvia_min` | 60 | Vigencia de la lluvia. |
| `cache_glofas_min` | 360 | Vigencia de GloFAS. |

## Entidades en memoria (no persistidas)

### Recinto (`Territorio.recintos[id]`)

Propiedades de `recintos.geojson` (`id`, `nombre`, `parroquia`, `prioridad`, `prioridad_cod`, `riesgo_base`, `riesgo_300m`, `hand_m`, `escenario_min_m`, `pob_300m`) más: `lon`, `lat`, `parroquia_nombre`, `rio_cercano`, `dist_rio_m` (m, entero), `celda` ([lat, lon] redondeados a 0,05°), `etiqueta` (texto de `CABECERAS` o null).

### Estado de río (`calcular_estado` → `rios[]`)

`rio`, `sugerido` (1–4 o null), `motivo`, `motivos[]`, `fuente_sugerido` (`modelo` | `medido`), `sugerido_pleamar` (o null), `oficial`, `oficial_motivo`, `oficial_hora`, `puntos` (ids).

### Estado de recinto o punto (`evaluar_punto`)

`sugerido` (1–4), `motivo`, `motivos[]` (`[{k:"ninguno",v:{}}]` si no hay disparadores), `oficial`, `oficial_fuente`, `oficial_motivo`, `oficial_hora`, `lluvia` (resumen o null).

### Motivo estructurado

`{k: clave, v: {valores crudos}, src?: "glofas" | "regla", pid?: "P0x"}`. El servidor también arma `es` (texto en español) pero lo quita de la lista (`sin_es`) y lo deja solo en `motivo`.

### Resumen de lluvia (`lluvia_resumen`)

`dias[{fecha, mm, prob}]` (6 días: 2 pasados, hoy, 3 de pronóstico), `hoy_indice`, `max_dia_3d`, `suma_3d`, `prox_24h`, `ult_24h`.

## Estado del lugar en el teléfono (`localStorage`, prefijo `ay_`)

| Clave | Contenido |
|---|---|
| `ay_lugar` | `{tipo: "recinto", id, texto}` o `{tipo: "punto", lat, lon, nombre, texto, gps?, calle?}` |
| `ay_ultimo_lugar_det` | Última respuesta de `/api/recinto` o `/api/lugar` |
| `ay_estado_cache` | Última respuesta de `/api/estado` |
| `ay_territorio` | Última respuesta de `/api/territorio` |
| `ay_recinto` | Formato viejo (solo id); se migra a `ay_lugar` al arrancar |

## Transiciones del nivel mostrado

```text
            analista fija nivel (panel_nivel)              analista retira (nivel_cod NULL)
ESTIMADO  ────────────────────────────────────►  VERIFICADO  ─────────────────────────────►  ESTIMADO
(sugerido, sello «Estimación automática»)        (oficial, sello «Verificado por el equipo de riesgo»)
```

El nivel estimado cambia solo cuando cambian sus entradas (GloFAS, regla, lluvia, advertencia, aguaje, reportes graves verificados); se recalcula a lo sumo cada 120 s o al instante tras `invalidar_estado()`.
