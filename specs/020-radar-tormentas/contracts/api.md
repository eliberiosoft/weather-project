# Contrato: API de tormentas (spec 020)

Las tres rutas son públicas, de solo lectura y se sirven desde la caché (Redis). Se miden desde el centro del cantón, que es el centro del bbox de los recintos. El teléfono no manda su ubicación.

## `GET /api/tormentas`

Lo que necesita la vista «Tormentas cerca». Va con `Cache-Control: no-store`; el service worker guarda la última respuesta para usarla sin señal.

```jsonc
{
  "cerca": {                          // null si no hay satélite
    "dist_km": 25.3,                  // null: no hay nubes de tormenta en el mosaico
    "rumbo": "e",                     // n|ne|e|se|s|so|o|no, o null si está encima (< 1 km)
    "intensidad": 2,                  // la más fuerte a ≤ 40 km: 0 ninguna, 1 nube de tormenta, 2 fuerte, 3 muy fuerte
    "estado": "cerca",                // encima ≤ 10 km · cerca ≤ 40 · lejos ≤ 150 · sin
    "tendencia": "acercandose",       // acercandose|alejandose|quieta|nueva, o null (contra la imagen de 30 min antes)
    "t": "2026-11-12T02:50:00Z"       // hora de la imagen
  },
  "rayos": {                          // null si GLM falló y no hay copia
    "calculando": true                // solo mientras se leen por primera vez (la app vuelve a pedir a los 15 s)
    // o, ya leídos:
    // "desde_min": 30, "n": 221, "cerca_n": 0, "cerca_km": 78.4, "completo": true, "t": "…Z", "viejo": false,
    // "puntos": [[lat, lon, minutos_atrás], …]          // hasta 3000, dentro del área del mosaico
  },
  "lluvia": {                         // null si Open-Meteo falló y no hay copia
    "proxima_hora_mm": 0.4, "max_15_mm": 0.2, "viejo": false,
    "serie": [{ "t": "2026-11-12T02:45:00Z", "mm": 0.1 }]   // 8 tramos de 15 min (2 h)
  },
  "centro": [-2.119, -79.666],
  "radios": { "encima": 10, "cerca": 40, "lejos": 150, "rayos": 30 },
  "mosaico": {
    "limites": [[-11.1784, -90.0], [5.616, -73.125]],      // [[sur, oeste], [norte, este]] para L.imageOverlay
    "clases": [{ "c": 1, "color": "#a5b4fc", "alfa": 150, "desde": -41 }, …],
    "marcos": [{ "id": "20261112T0050", "t": "2026-11-12T00:50:00Z" }, …],  // solo las ya armadas, de vieja a nueva
    "preparando": 0                   // cuántas de las 12 se arman todavía en segundo plano
  }
}
```

- `cerca_n` cuenta los destellos a ≤ 30 km de los últimos 15 min. `cerca_km` es el más cercano de los últimos 15 min.
- `viejo: true` quiere decir que la fuente falló y se da la última copia buena (de hasta 6 h).

Además, las dos rutas traen el radar, y solo `/api/tormentas` trae el movimiento:

```jsonc
"radar": {                            // null si no hay satélite
  "radio_km": 150, "t": "…Z",
  "nubes": [[x_km, y_km, clase], …],  // celdas de 10 km; x al este y y al norte del centro del cantón
  "rayos": [[x_km, y_km, minutos], …] // celdas de 5 km (el más reciente); null mientras se leen los rayos
},
"movimiento": {                       // null si no hay satélite
  "t": "…Z", "desde_min": 30,
  "flechas": [{ "desde": [lat, lon], "hacia": [lat, lon],   // dónde estaría en 1 h si sigue igual
                "km_h": 16, "rumbo": "e", "clase": 2 }]     // hasta 30, de las tormentas más grandes
}
```

## `GET /api/tormentas/resumen`

Igual a la anterior, pero sin `mosaico`, `movimiento` ni `rayos.puntos`. La usa la ficha de «Mi lugar».

## `GET /api/tormentas/marco/<AAAAMMDDTHHMM>.png`

Es el mosaico de esa hora (UTC): un PNG de paleta de 768×768. El índice 0 es transparente y los índices 1 a 3 son las clases.

- **200:** `image/png`, con `Cache-Control: public, max-age=10800, immutable`.
- **404 `{"k": "tormentas.marco"}`:** la hora es de hace más de 3 h, del futuro, no es múltiplo de 10 min o está mal escrita.
- **503 `{"k": "tormentas.sin_datos"}`:** no hay satélite y la imagen no está en la caché.

## Claves de Redis (prefijo `yw:`)

| Clave | Plazo | Contenido |
|---|---|---|
| `torm:ultimo` | 2 min | hora de la última imagen según GIBS (un HEAD) |
| `torm:clases:<id>` | 3 h | clases por píxel del mosaico (zlib) |
| `torm:png:<id>` | 3 h | el PNG servido |
| `torm:cerca:<id>:<lat>,<lon>` | 3 h | el aviso de esa imagen |
| `torm:radar:<id>:<lat>,<lon>` | 3 h | las celdas de nubes del radar |
| `torm:mov:<id>` | 3 h | las flechas de movimiento |
| `torm:glm:<archivo>` | 45 min | destellos de un archivo GLM dentro del mosaico |
| `torm:rayos:<lat>,<lon>` | 2 min | resumen y puntos de rayos |
| `torm:lluvia:<lat>,<lon>` | 15 min | lluvia de las próximas 2 h |
| `torm:listo` | 3 h | la última hora que se pudo armar |
| `torm:ultima:<parte>` | 6 h | última respuesta buena de `cerca`, `radar`, `movimiento` y `marcos` (se da con `viejo: true` si falla) |
| `torm:demanda` | 30 min | alguien miró «Tormentas»: el hilo mantiene la caché |
| `<clave>:viejo` | 6 h | última copia buena |
| `<clave>:fallo` | 60 s | falló hace poco: no se reintenta |
| `candado:<clave>` | espera + 5 s | una sola descarga a la vez (`SET NX`, se suelta con Lua) |
