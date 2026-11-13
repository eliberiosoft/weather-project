# Implementation Plan: Idiomas (i18n es/en)

**Branch**: `009-i18n` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-i18n/spec.md` (documentación «as-built»).

## Summary

Motor de idiomas propio de ~240 líneas (`compartido/i18n.js`, IIFE que expone `window.I18N`), sin librerías, compartido por la app ciudadana y el panel. Los textos viven en tres diccionarios que se suman con `I18N.agregar()`: comunes (en el propio `i18n.js`), de la app (`cliente/textos-app.js`) y del panel (`admin/textos-panel.js`). El HTML marca los nodos con `data-i18n*` y el JS usa `I18N.t()`. El servidor no traduce: envía los motivos del nivel como claves + valores (`motivos`) y el cliente los arma en el idioma activo.

## Technical Context

**Language/Version**: JavaScript del navegador (ES2020+: `?.`, `??`, `Object.fromEntries`, `CustomEvent`); Python ≥ 3.10 para la parte del servidor (`M`, `unir`, `sin_es`).

**Primary Dependencies**: ninguna. Usa las API del navegador `Intl` (`toLocaleString`, `Intl.RelativeTimeFormat` en la app) y `localStorage`.

**Storage**: `localStorage["ay_idioma"]` por origen. Los diccionarios son archivos JS estáticos (el service worker los guarda: `i18n.js` y `textos-app.js` están en `BASE` de `cliente/sw.js`).

**Testing**: sin pruebas automáticas. Comprobación manual de claves (la hecha para esta spec): cargar los diccionarios en Node con `vm` y comparar `Object.keys(es)` con `Object.keys(en)`, y buscar las claves literales usadas en `cliente/` y `admin/`.

**Target Platform**: Chrome/Android de gama baja (app) y navegador de escritorio (panel).

**Project Type**: aplicación web, sin build.

**Performance Goals**: cambiar de idioma sin peticiones de red; `aplicar()` recorre el DOM una vez por tipo de atributo.

**Constraints**: CSP sin scripts en línea (el motor se carga como archivo); `data-i18n-html` solo con textos de confianza.

**Scale/Scope**: 2 idiomas; 83 claves comunes, 339 de la app y 146 del panel (568 por idioma); 21 claves de motivo del servidor.

## Constitution Check

*GATE: compuertas de «Flujo de trabajo y calidad» de `.specify/memory/constitution.md`.*

| # | Compuerta | Estado | Evidencia |
|---|---|---|---|
| 1 | Detector de Impeccable en 0 hallazgos | N/A al motor · ⚠️ sin evidencia en las páginas | El motor no pinta interfaz propia; el selector de idioma está en `cliente/index.html` y `admin/index.html`, sin registro de una pasada de `impeccable detect` en su ubicación actual. |
| 2 | Textos nuevos en `es` y `en` | ✅ Cumple | 0 claves solo en un idioma en los tres diccionarios; 0 claves literales usadas sin definir (comprobado el 2026-11-09). Brecha G-03: textos del servidor que siguen solo en español. |
| 3 | `VERSION` del service worker subida | ✅ Cumple | `cliente/sw.js` tiene `VERSION = "v1.6"` e incluye `i18n.js` y `textos-app.js` en `BASE`; cualquier cambio de textos de la app exige subirla. |
| 4 | Sin dependencias nuevas sin justificar | ✅ Cumple | Motor propio, sin librerías (ni i18next ni ICU). |
| 5 | Límites y validación en toda escritura nueva de la API | N/A | La funcionalidad no agrega escrituras a la API. |
| 6 | Probado en la app levantada | ⚠️ Sin evidencia | No hay registro de prueba del cambio de idioma en 360 px / escritorio con la consola limpia (un `[i18n] falta la clave` aparecería ahí). |

Principio IV (textos): ✅ con las excepciones documentadas en FR-013 y las brechas G-01 a G-03.

## Project Structure

### Documentation (this feature)

```text
specs/009-i18n/
├── spec.md
├── plan.md              # este archivo
├── data-model.md        # diccionarios, preferencia y estructura del motivo
├── contracts/
│   └── api.md           # campos motivo/motivos en las respuestas de la API y claves de motivo
└── tasks.md
```

### Source Code (repository root)

```text
compartido/
└── i18n.js              # motor: t, lista, existe, agregar, aplicar, cambiar, fecha, locale, motivo, motivoVecino;
                         # textos comunes (niveles, tipos, gravedad, altura, estados, acciones, motivo.*, vecino.*)
cliente/
├── index.html           # data-i18n*, <html data-i18n-titulo data-i18n-desc>, <select id="idioma" data-idioma="corto">
├── textos-app.js        # claves app.* (es/en)
├── app.js               # const t = I18N.t; NIV/ALT por Proxy; repintado en window "idioma"; I18N.aplicar() al final
└── sw.js                # guarda i18n.js y textos-app.js para uso sin conexión
admin/
├── index.html           # data-i18n*, <html data-i18n-titulo>, <select id="idioma" data-idioma="corto">
├── textos-panel.js      # claves panel.* (es/en)
└── panel.js             # t = I18N.t; I18N.aplicar() al inicio; repintado sin red en "idioma"
api/
└── servidor.py          # M(k, es, **v), unir(), sin_es(); motivos en nivel_glofas, nivel_regla, nivel_lluvia,
                         # evaluar_punto, calcular_estado
cliente/Dockerfile, admin/Dockerfile   # copian compartido/i18n.js a la raíz servida (/i18n.js)
```

**Structure Decision**: un único motor en `compartido/` para que app y panel se comporten igual; cada pieza agrega su propio diccionario con prefijo (`app.*`, `panel.*`). En desarrollo sin Docker, la API sirve `i18n.js` desde `compartido/` como segunda raíz de `--estaticos` y `--admin`.

## Cómo agregar un texto

1. Elegir el diccionario: común a las dos piezas → `compartido/i18n.js`; solo app → `cliente/textos-app.js` (`app.*`); solo panel → `admin/textos-panel.js` (`panel.*`).
2. Escribir la clave en `es` **y** en `en` en el mismo cambio.
3. Usarla: en el HTML `data-i18n="clave"` (texto), `data-i18n-html="clave"` (si lleva `<b>`, `<code>`, `<ul>`), `data-i18n-attr="placeholder:clave;aria-label:clave2"`; en el JS `I18N.t("clave", { var })`. Si el JS arma HTML, repintarlo en el evento `idioma`.
4. Si es un motivo nuevo del servidor: crear `M("grupo.nombre", "texto es", var=…)` en `api/servidor.py` y agregar `motivo.grupo.nombre` (y si conviene `vecino.grupo.nombre`) en `es` y `en` de `compartido/i18n.js`.
5. Subir `VERSION` en `cliente/sw.js` si cambió algo de la app.
