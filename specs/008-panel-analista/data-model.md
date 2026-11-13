# Data Model: Panel del analista

Tablas de SQLite (`datos/yaguachi.db`) que lee o escribe el panel, tal como las crea `ESQUEMA` / `iniciar_db()` en `api/servidor.py`. Las horas se guardan como texto ISO 8601 con zona `-05:00` (`iso(ahora())`, segundos).

## `reportes` (el panel cambia estado, nota, revisión y foto)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | TEXT PK | 12 hex (`uuid4().hex[:12]`) |
| `creado` | TEXT NOT NULL | ISO |
| `dispositivo` | TEXT NOT NULL | id aleatorio del teléfono; el panel solo ve los 6 primeros caracteres + «…» |
| `ip` | TEXT | IP del envío; se pone `NULL` a las 48 h (hilo `mantenimiento`). Nunca se envía al panel |
| `tipo` | TEXT NOT NULL | una de las 14 claves de `TIPOS` |
| `gravedad` | INTEGER NOT NULL | 1 leve, 2 moderada, 3 grave |
| `descripcion` | TEXT | ≤ 500 |
| `lat`, `lon` | REAL NOT NULL | |
| `recinto_id`, `recinto` | INTEGER, TEXT | recinto a ≤ 3 km, si hay |
| `en_canton` | INTEGER | 1 si cae dentro del límite CONALI |
| `foto` | TEXT | nombre del archivo en `datos/fotos/`; `NULL` tras descartar o a los 90 días |
| `estado` | TEXT NOT NULL DEFAULT `'pendiente'` | ver transiciones |
| `nota_ugr` | TEXT | nota del analista (≤ 300), visible para el ciudadano |
| `revisado_en` | TEXT | hora de la última revisión en el panel |
| `expira` | TEXT NOT NULL | `creado` + horas de vigencia del tipo |
| `sigue`, `ya_no` | INTEGER NOT NULL DEFAULT 0 | votos de vecinos |
| `altura_agua`, `via`, `tramo` | INTEGER, TEXT, TEXT | solo `calle_inundada` (columnas agregadas por migración en `iniciar_db`) |

### Estados y transiciones de un reporte

```text
                 ┌──────────── panel: validado ───────────┐
                 │                                        ▼
  (creado) ──► pendiente ──── panel: resuelto ──────► resuelto
                 │   ▲  └──── panel: descartado ───► descartado  (+ borra la foto)
                 │   └──────── panel: pendiente ◄──── (cualquiera; sin botón en el panel)
                 └── vecinos (solo calle_inundada pendiente): ≥ 3 conexiones distintas «ya no»
                     y ya_no > 2 · sigue → resuelto «[cerrado por vecinos]»
  calle_inundada (pendiente o validado) ── quien lo creó dice «ya pasó» ──► resuelto
```

- El panel puede pasar un reporte de cualquier estado a cualquiera de `validado`, `resuelto`, `descartado`, `pendiente` (`panel_revisar`).
- `validado` («verificado» en la interfaz) es el único estado que publica la foto a otros vecinos y el único que cuenta como reporte grave (`vivienda_inundada`, `desborde`, `aislados`) para subir a RESPUESTA a ≤ 1,5 km mientras no expire.
- Los votos de los vecinos nunca cierran un reporte `validado`; solo quien creó una calle inundada puede darla por pasada, aunque esté verificada (`confirmar_reporte`, ver 005).

## `niveles_oficiales` (nivel verificado; solo agregar)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | orden de los cambios |
| `creado` | TEXT NOT NULL | ISO |
| `ambito_tipo` | TEXT NOT NULL | `canton`, `rio`, `parroquia`, `recinto` |
| `ambito_id` | TEXT NOT NULL | `yaguachi` (cantón), nombre del río, nombre de la parroquia o id del recinto como texto |
| `nivel_cod` | INTEGER | 1–4; `NULL` = verificado retirado |
| `motivo` | TEXT | ≤ 300; obligatorio con nivel; por defecto «nivel oficial retirado» al retirar |

- **Vigente por ámbito**: la fila de `id` máximo para cada (`ambito_tipo`, `ambito_id`) (`oficiales()`); si su `nivel_cod` es `NULL`, el ámbito no tiene verificado.
- **Precedencia** para un recinto o punto (`evaluar_punto`): recinto (si el punto está a ≤ 1,5 km del recinto) → parroquia → río (si está a ≤ 1,5 km del cauce) → cantón.
- Nunca se actualizan ni se borran filas: la tabla es el historial (el panel muestra las 50 últimas).

## `lecturas` (reglas limnimétricas)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `creado` | TEXT NOT NULL | hora de la lectura (la del vigía o la de guardado), en UTC−5 |
| `punto_id` | TEXT NOT NULL | `P01`–`P09` (validado contra `puntos_control.geojson`) |
| `lectura_m` | REAL NOT NULL | metros en la regla |
| `tendencia` | TEXT | `sube`, `baja`, `igual` o `NULL` (informativa) |
| `lluvia` | INTEGER | 1/0 (informativa) |
| `vigia` | TEXT | ≤ 60 |

## `reglas`

| Campo | Tipo | Notas |
|---|---|---|
| `punto_id` | TEXT PK | `P01`–`P09` |
| `borde_m` | REAL | lectura a la que el agua sale del cauce; `NULL` = sin borde |
| `nota` | TEXT | ≤ 200 (la API la acepta; el panel no la envía) |

## `avisos`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `creado` | TEXT NOT NULL | |
| `nivel_cod` | INTEGER NOT NULL | 1–4 |
| `titulo`, `texto` | TEXT NOT NULL | ≤ 90 y ≤ 600 |
| `ambito_tipo`, `ambito_id`, `ambito_nombre` | TEXT | `ambito_nombre` se calcula al publicar («Todo el cantón», nombre del río o parroquia, o nombre del recinto) |
| `vigente_hasta` | TEXT NOT NULL | `creado` + 1–168 h |
| `anulado` | INTEGER NOT NULL DEFAULT 0 | 1 = anulado (no se borra) |

Estados: vigente (`anulado = 0` y `vigente_hasta` > ahora) → vencido (pasa la hora) o anulado (panel).

## `ajustes`

| `clave` | `valor` (JSON) | Efecto |
|---|---|---|
| `advertencia` | `{"vigente": bool, "texto": str ≤ 200, "hasta": ISO o null}` | si `vigente` y (`hasta` vacío o futuro): todo el cantón ≥ VIGILANCIA |
| `aguaje` | `{"hasta": "AAAA-MM-DD" o null, "nota": str ≤ 200}` | si `hasta` ≥ hoy: ríos Yaguachi y Babahoyo con `sugerido_pleamar = min(4, nivel + 1)` |

## Datos en memoria (no persistentes)

- `_fallos_pin`: `{ip: (fallos, bloqueado_hasta_epoch)}`, protegido por `_fallos_lock`; se pierde al reiniciar y se vacía si pasa de 10 000 IP.
- `_estado_cache`: último `calcular_estado()` (120 s).

## Datos en el navegador del analista

- `sessionStorage["ay_pin"]`: el PIN, mientras la pestaña esté abierta o hasta «Salir».
- `localStorage["ay_idioma"]`: idioma elegido (ver 009).
- `FOTOS`: `objectURL` de las fotos ya vistas, en memoria.
