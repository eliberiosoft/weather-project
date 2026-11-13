# Data Model: Calles con agua

Fuente: `ESQUEMA` e `iniciar_db()` en `api/servidor.py`. Fechas en texto ISO 8601 con zona `-05:00`.

## `reportes`

Una sola tabla para los 14 tipos de reporte; aquí se describen los campos tal como los usa un aviso de calle (`tipo = 'calle_inundada'`).

| Campo | Tipo | Aviso de calle |
|---|---|---|
| `id` | TEXT PK | 12 hex (`uuid4().hex[:12]`). |
| `creado` | TEXT NOT NULL | Hora de llegada al servidor (no la del teléfono). |
| `dispositivo` | TEXT NOT NULL | Id aleatorio del teléfono (`d` + 32 hex en la app). |
| `ip` | TEXT | IP real (de `X-Real-IP` si viene de un proxy de confianza); se pone NULL a las 48 h. |
| `tipo` | TEXT NOT NULL | `calle_inundada`. |
| `gravedad` | INTEGER NOT NULL | Igual a `altura_agua`. |
| `descripcion` | TEXT | Máx. 500; vacío desde la hoja del mapa. |
| `lat`, `lon` | REAL NOT NULL | Punto proyectado sobre la vía (`tramo.punto`), o el punto elegido si no hubo vía. |
| `recinto_id`, `recinto` | INTEGER, TEXT | Recinto más cercano si está a ≤ 3 km; si no, NULL. |
| `en_canton` | INTEGER | 1 si el punto cae dentro del polígono cantonal. |
| `foto` | TEXT | Nombre del JPEG en `datos/fotos/` (solo desde el asistente). |
| `estado` | TEXT NOT NULL DEFAULT `pendiente` | `pendiente`, `validado`, `resuelto`, `descartado`. |
| `nota_ugr` | TEXT | Nota del analista; los cierres automáticos le agregan « [cerrado por vecinos]» o « [quien avisó dijo que el agua ya pasó]». |
| `revisado_en` | TEXT | Hora de la última revisión del analista. |
| `expira` | TEXT NOT NULL | `creado` + 8 h. |
| `sigue` | INTEGER NOT NULL DEFAULT 0 | Teléfonos que dicen que sigue el agua. |
| `ya_no` | INTEGER NOT NULL DEFAULT 0 | Teléfonos que dicen que ya pasó. |
| `altura_agua` | INTEGER | 1, 2 o 3 (columna agregada por `iniciar_db` en bases viejas). |
| `via` | TEXT | Nombre de la vía, máx. 120 (agregada por `iniciar_db`). |
| `tramo` | TEXT | JSON `[[lat, lon], …]`, 2–80 puntos, 6 decimales (agregada por `iniciar_db`). |

## `confirmaciones`

| Campo | Tipo | Notas |
|---|---|---|
| `reporte_id` | TEXT | PK compuesta con `dispositivo`. |
| `dispositivo` | TEXT | Un voto por teléfono y aviso; `INSERT OR REPLACE` permite cambiarlo. |
| `sigue` | INTEGER | 1 = sigue el agua, 0 = ya pasó. |
| `creado` | TEXT | Hora del último voto (se renueva al cambiarlo). |
| `ip` | TEXT | Agregada por `iniciar_db`; se pone NULL a las 48 h. Se usa para el límite de 30 votos por IP y hora y para contar conexiones distintas. |

`reportes.sigue` = `SUM(sigue)` y `reportes.ya_no` = `SUM(1 - sigue)` de las confirmaciones del aviso; se recalculan en cada voto.

## Escala de altura del agua

| Valor | Servidor (`ALTURA`) | App, corto (`altura.n`) | App, botón (`app.altura.n.boton` / `.nota`) | Color y grosor en el mapa |
|---|---|---|---|---|
| 1 | Hasta el borde de la vereda (menos de 15 cm) | hasta la vereda | Hasta la vereda · menos de 15 cm | `#6baed6`, 5 px |
| 2 | Sobre la vereda (tapa media llanta de moto) | sobre la vereda | Sobre la vereda · tapa media llanta | `#2171b5`, 7 px |
| 3 | No cruces (más de 40 cm o con corriente) | no cruces | No cruces · hondo o con corriente | `#08306b`, 9 px |

## Estados y transiciones de un aviso de calle

| Desde | Evento | Hacia | Dónde |
|---|---|---|---|
| (nada) | `POST /api/reportes` con `tipo: calle_inundada` | `pendiente` («aviso de vecinos», visible al momento) | `crear_reporte` |
| `pendiente` | ≥ 3 conexiones distintas votan «ya no» y `ya_no > 2 × sigue` | `resuelto` (+ « [cerrado por vecinos]») | `confirmar_reporte` |
| `pendiente` | el autor toca «El agua ya pasó» | `resuelto` (+ « [quien avisó dijo que el agua ya pasó]») | `confirmar_reporte` |
| `validado` | el autor toca «El agua ya pasó» | `resuelto` — no debería (Brecha 1) | `confirmar_reporte` |
| cualquiera | el analista elige `validado`, `pendiente`, `resuelto` o `descartado` | ese estado (`descartado` borra la foto) | `panel_revisar` |
| `pendiente` / `validado` | pasan 8 h | mismo estado, pero fuera de la lista pública | `listar_reportes` (filtro `expira`) |

- La vigencia no es un estado: un aviso `pendiente` o `validado` con `expira` pasada deja de salir en la lista pública, pero su estado no cambia.
- `panel_revisar` (panel, con PIN) puede poner cualquiera de los cuatro estados en cualquier momento.
- Solo los avisos `pendiente` se cierran por votos; los `validado` solo los cambia el analista (salvo la Brecha 1).

## Visibilidad (`listar_reportes`, `visible_para`)

| Estado | Vigente (`expira > ahora`) | Lo ve |
|---|---|---|
| `pendiente` | sí | Todos (es `PUBLICO_YA`). |
| `validado` | sí | Todos. |
| cualquiera | cualquiera | El propio teléfono (por `X-Dispositivo`). |

## En el teléfono (`localStorage`)

| Clave | Contenido |
|---|---|
| `ay_dispositivo` | Id aleatorio (`crypto.randomUUID` o `crypto.getRandomValues`). |
| `ay_consent_ok` | `true` tras el primer envío aceptado; oculta la casilla de consentimiento. |
| `ay_cola_reportes` | Avisos pendientes de envío (ver `specs/011-pwa-sin-conexion/`). |
