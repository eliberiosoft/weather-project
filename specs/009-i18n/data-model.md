# Data Model: Idiomas (i18n es/en)

La funcionalidad no tiene tablas en SQLite. Sus datos son los diccionarios (archivos JS), la preferencia del usuario (`localStorage`) y la estructura de los motivos que envía la API.

## Diccionario

```js
// interno de compartido/i18n.js
textos = {
  es: { "clave": "texto" | ["texto", "texto", …], … },
  en: { … }
}
```

| Fuente | Prefijo de clave | Claves por idioma | Cómo se suma |
|---|---|---|---|
| `compartido/i18n.js` | sin prefijo de pieza: `idioma.*`, `nivel.*`, `tipo.*`, `gravedad.*`, `altura.*`, `estado.*`, `acciones.*`, `motivo.*`, `vecino.*`, `fuente.*` | 83 | dos llamadas internas a `agregar()` |
| `cliente/textos-app.js` | `app.*` | 339 | `I18N.agregar({ es, en })` |
| `admin/textos-panel.js` | `panel.*` | 146 | `I18N.agregar({ es, en })` |

- `agregar(dic)` fusiona por idioma con `Object.assign` (una clave repetida la pisa el último archivo cargado).
- Valores lista: hoy solo `acciones.1`–`acciones.4` (3 o 4 frases cada una).
- Valores con HTML: claves que se usan con `data-i18n-html` (p. ej. `app.no_oficial`, `app.priv.*.c`, `panel.sit.explica`, `panel.login.texto`, `panel.reg.formato`).
- Variables: `{nombre}` dentro del texto, sustituidas por `t(clave, { nombre })`.

### Claves con sufijo dinámico (se arman en el código)

| Patrón | Valores |
|---|---|
| `nivel.N` | 0 (sin dato), 1–4 |
| `tipo.<tipo>` | las 14 claves de `TIPOS` del servidor |
| `gravedad.N`, `altura.N`, `altura.N.larga` | 1–3 |
| `estado.<estado>` | `validado`, `pendiente`, `descartado`, `resuelto`, `calle_pendiente` |
| `acciones.N` | 1–4 |
| `motivo.<k>`, `vecino.<k>` | claves de motivo (ver `contracts/api.md`) |
| `motivo.src.<src>`, `vecino.src.<src>` | `glofas`, `regla` |
| `fuente.<fuente>` | `modelo`, `medido` |
| `app.ambito.<tipo>` | `canton`, `rio`, `parroquia`, `recinto` |
| `panel.reg.t.<tendencia>` | `vacia`, `sube`, `igual`, `baja` |

## Preferencia de idioma

| Dónde | Clave | Valor | Vida |
|---|---|---|---|
| `localStorage` del origen | `ay_idioma` | `"es"` o `"en"` | hasta que se borre (o «Borrar los datos de este teléfono», 010) |

Estado en memoria: `idioma` (variable del IIFE), que se lee con `I18N.idioma`.

```text
arranque ── ay_idioma válido? ── sí ──► ese idioma
                 │ no
                 └── navigator.language[0..2] ∈ {es, en}? ── sí ──► ese
                                  │ no
                                  └──► "es"
cambiar(l) ──► idioma = l ──► localStorage.ay_idioma = l ──► aplicar() ──► evento "idioma"
```

## Motivo

En el servidor (`api/servidor.py`):

```python
M(k, es, **v)        # -> {"k": k, "v": v, "es": es}
unir(ms, sep="; ")   # -> "es1; es2"            (texto en español: campo "motivo")
sin_es(ms, **extra)  # -> [{"k", "v", **extra}] (sin "es": campo "motivos")
```

Lo que recibe el cliente en cada elemento de `motivos`:

| Campo | Tipo | Siempre | Significado |
|---|---|---|---|
| `k` | string | sí | clave estable; se traduce como `motivo.<k>` o `vecino.<k>` |
| `v` | objeto | sí | valores crudos (números sin formatear, nombres de río, texto del analista) |
| `src` | `"glofas"` \| `"regla"` | no | fuente del motivo, en ríos y puntos |
| `pid` | `"P01"`…`"P09"` | no | punto de control, solo en `rios[].motivos` |

`es` no viaja en `motivos` (lo quita `sin_es`); el mismo contenido en español va en el campo `motivo` del objeto (ver brecha G-01).
