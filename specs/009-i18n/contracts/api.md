# Contrato: motivos estructurados en la API

La API no tiene rutas propias de idiomas ni recibe el idioma del cliente: siempre responde igual, y el cliente traduce. Este contrato fija la forma de los campos `motivo` / `motivos` que la app y el panel traducen con `I18N.motivo()`.

## Dónde aparecen

| Ruta | Objeto | `src` | `pid` |
|---|---|---|---|
| `GET /api/estado`, `GET /api/panel/estado` | `rios[]` | sí (por motivo de GloFAS o regla) | sí (por motivo de GloFAS o regla) |
| ″ | `recintos{id}` | no | no |
| ″ | `puntos{pid}.glofas` | `glofas` (si hay nivel) | no |
| ″ | `puntos{pid}.regla` (o `null`) | `regla` | no |
| `GET /api/recinto?id=` | `estado`, `rio` | como arriba | como arriba |
| `GET /api/lugar?lat=&lon=` | `estado`, `rio` | como arriba | como arriba |

Cada uno de esos objetos lleva:

```json
{
  "motivo": "texto en español (compatibilidad y respaldo)",
  "motivos": [ { "k": "clave", "v": { … }, "src": "glofas", "pid": "P01" } ]
}
```

- `rios[].motivo` = `"<pid>: <motivo del punto>"` unidos con `" / "` (más «Advertencia INAMHI vigente (…)» o «sin punto GloFAS ni regla» si aplica).
- Los motivos de un punto empiezan por `"GloFAS: "` o `"Regla: "`.
- `recintos{}.motivo` = motivos unidos con `"; "`, o `"sin disparadores activos"`; en ese caso `motivos = [{"k": "ninguno", "v": {}}]`.
- Un objeto `glofas` sin datos trae `nivel_cod: null` y un único motivo sin `src` (`glofas.sin_datos`, `glofas.vencido` o `glofas.sin_caudal`).

## Claves de motivo

| `k` | `v` | Origen (`api/servidor.py`) | Nivel que aporta |
|---|---|---|---|
| `glofas.q_q5` | `q`, `u` (caudal y Q5, enteros) | `nivel_glofas` | RESPUESTA |
| `glofas.p_q5_72` | `p` (%) | `nivel_glofas` | RESPUESTA |
| `glofas.q_q2` | `q`, `u` | `nivel_glofas` | PREPARACIÓN |
| `glofas.p_q2_30` | `p` | `nivel_glofas` | PREPARACIÓN (≥ 50 %) o VIGILANCIA (≥ 20 %) |
| `glofas.p_q5_30` | `p` | `nivel_glofas` | PREPARACIÓN |
| `glofas.q_p90` | `q`, `u` | `nivel_glofas` | VIGILANCIA |
| `glofas.normal` | `q`, `u`, `p` | `nivel_glofas` | NORMAL |
| `glofas.sin_datos` | — | `nivel_glofas` | sin nivel |
| `glofas.vencido` | — | `nivel_glofas` | sin nivel |
| `glofas.sin_caudal` | — | `nivel_glofas` | sin nivel |
| `regla.borde` | `m` (metros al borde) | `nivel_regla` | según distancia |
| `regla.24h` | `m` (subida en 24 h) | `nivel_regla` | ≥ VIGILANCIA |
| `regla.hora` | `m` (m/h) | `nivel_regla` | ≥ PREPARACIÓN |
| `lluvia.prep` | `dia`, `tres` (mm) | `nivel_lluvia` | PREPARACIÓN |
| `lluvia.vig` | `dia` (mm) | `nivel_lluvia` | VIGILANCIA |
| `adv` | — | `evaluar_punto` | ≥ VIGILANCIA |
| `adv_texto` | `texto` (texto del analista) | `calcular_estado` (ríos) | ≥ VIGILANCIA |
| `rio_cerca` | `rio` (nombre), `m` (metros) | `evaluar_punto` | el del río |
| `graves` | `n` | `evaluar_punto` | RESPUESTA |
| `sin_punto` | — | `calcular_estado` (ríos) | — |
| `ninguno` | — | `evaluar_punto` | NORMAL |

Las 21 claves tienen `motivo.<k>` en `es` y `en` (`compartido/i18n.js`); todas salvo `glofas.sin_datos`, `glofas.vencido` y `glofas.sin_caudal` tienen además `vecino.<k>`.

## Reglas para el cliente

- Formatear los números de `v` con el locale activo (`toLocaleString`, máx. 2 decimales; `p` sin decimales en modo vecino).
- No traducir `v.rio` ni `v.texto` (son datos).
- Si `motivos` falta o está vacío, mostrar `motivo`.
- Si una clave no tiene traducción, mostrar la clave (`k`) y no fallar.

## Textos de la API que NO están estructurados (solo español)

`error` de todas las respuestas de error, `mensaje` de `POST /api/reportes` (la app no lo usa: muestra su propio texto), `etiqueta` de tipos y de recintos cabecera, `altura_txt`, `ambito_nombre` de avisos, `recinto.nombre` por defecto «Cerca de …» en `/api/lugar`, y el HTML de `/r/<id>`. Ver brecha G-03.
