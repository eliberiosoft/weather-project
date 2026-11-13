---
name: cartografia-riesgo
description: Experto en cartografía de riesgo y comunicación de alertas en mapas para Yaguachi Weather. Úsala SIEMPRE que decidas cómo se ve algo en el mapa: colores de niveles, simbología de ríos, recintos, calles con agua y reportes, orden de capas, leyendas, etiquetas, cómo distinguir estimado de verificado o modelo de medición, y cómo mostrar escenarios (huellas de desborde, riesgo muy alto) sin que parezcan pronósticos. También al diseñar un mapa nuevo, una capa nueva o un panel con mapa.
---

# Cartografía de riesgo para Yaguachi Weather

Diseñas mapas que una persona mayor, mojada y con prisa entiende en un vistazo, y que nunca prometen más certeza de la que hay. Complementa a la skill `mapas-leaflet` (cómo se programa); esta decide **qué se dibuja y cómo se ve**.

## Fijo por el producto (no se negocia)

- **Semáforo:** verde NORMAL `#1a9641`, amarillo VIGILANCIA `#ffd92f`, naranja PREPARACIÓN `#fd8d3c`, rojo RESPUESTA `#d7191c` (plan cantonal / COE). Puedes ajustar bordes, halos y el color del texto encima para el contraste; el tono de cada nivel no cambia.
- **El color del semáforo solo se usa para decir un nivel.** Nada decorativo en verde, amarillo, naranja o rojo: ni botones, ni íconos, ni capas de referencia. Si otra capa necesita color, sale de una familia que no compita (azules del agua, índigo, grises).
- **El nombre del nivel siempre está escrito** donde se afirma un nivel (hoja, leyenda, etiqueta). El color nunca va solo.
- **No es oficial.** Ningún símbolo, sello o escudo imita al COE, la SGR o el INAMHI.

## Certeza visible

Cada objeto dice de dónde sale su nivel, siempre con la misma gramática:

| Estado | Línea | Punto |
|---|---|---|
| Estimado por modelo (GloFAS, Open-Meteo) | trazo continuo del color del nivel, sin borde | relleno del nivel, borde fino gris oscuro |
| Aviso de vecinos, sin verificar | trazo **discontinuo** | relleno del nivel con borde discontinuo |
| Confirmado por varios vecinos (spec 022), sin revisión del equipo | trazo **discontinuo** (igual que arriba) | borde discontinuo; la etiqueta dice «confirmado por N vecinos» |
| Verificado por el analista | trazo continuo con **halo negro** | borde negro grueso + ✔ en la hoja |
| Escenario de planificación (huellas, riesgo muy alto, zonas críticas) | relleno translúcido con **trama** o borde punteado, nunca color de semáforo pleno | — |

Los escenarios llevan siempre su rótulo: «escenario de planificación del 27–28 oct, no es pronóstico». Medido (regla limnimétrica) se distingue de modelado (GloFAS) con texto, no solo con forma.

## Orden de capas (de abajo arriba)

1. Base (OSM o satélite), atenuada si hay muchas capas encima.
2. Riesgo base y escenarios (polígonos translúcidos).
3. Límite cantonal y parroquias (línea, sin relleno).
4. Ríos por nivel.
5. Tramos críticos.
6. Calles con agua (por encima de los ríos: es lo que la gente reporta ahora).
7. Recintos por nivel.
8. Reportes, puntos de control, equipamientos.
9. Ubicación del usuario y selección actual (siempre arriba).

## Jerarquía y lectura

- **Lo de ahora manda**: calles con agua, ríos y recintos por nivel están visibles por defecto. Riesgo base y escenarios, apagados por defecto y agrupados como «Riesgo base».
- **Halos** blancos (o del color del fondo) bajo líneas de color para que se lean sobre satélite.
- **Etiquetas por zoom**: nombres de recintos desde zoom 13, de calles desde 16. Pocas y grandes antes que muchas y chicas.
- **Cuánta agua hay** en calles (escala propia, no copiar la de otras apps): hasta la vereda, sobre la vereda, no cruces. Codifícala con la familia del agua, nunca con el semáforo (hasta la vereda `#6baed6`, sobre la vereda `#2171b5`, no cruces `#08306b`), **y** con grosor creciente (5, 7, 9 px), y escribe la palabra en la hoja. La altura del agua no es un nivel de alerta.
- **Leyenda en lenguaje llano**: «Calle inundada sobre la vereda», no «calle_inundada altura 2». Muestra solo lo visible.
- **Tamaño mínimo**: puntos de recinto ≥ 14 px de diámetro en pantalla; íconos de reporte ≥ 24 px.

## Textos del mapa

Todo rótulo, leyenda, título de hoja o mensaje del mapa sale de i18n (`I18N.t("app.…")`, diccionarios en `cliente/textos-app.js`); nunca texto directo. Los nombres de ríos, recintos y calles son datos y no se traducen.

## Contraste y sol

Se usa afuera, bajo sol o lluvia. Texto sobre mapa con fondo sólido (no translúcido) y contraste ≥ 7:1. Sobre amarillo y naranja, texto negro; sobre verde y rojo, comprueba el contraste antes de poner blanco (el verde `#1a9641` con blanco no llega a 4,5:1 en texto chico: usa negro o texto grande en negrita).

## Antes de dar por buena una capa o un estilo

- ¿Se entiende en escala de grises? (el nivel debe seguir escrito o con patrón)
- ¿Distingue estimado, reportado, verificado y escenario?
- ¿Se lee sobre OSM **y** sobre satélite?
- ¿La leyenda la explica en palabras de vecino?
- ¿Algo parece oficial o un pronóstico cuando no lo es?
