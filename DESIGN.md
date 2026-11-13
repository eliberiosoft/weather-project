---
name: Yaguachi Weather
description: Alerta de inundaciones del cantón Yaguachi como app móvil en mosaico bento de fichas de vidrio sobre un cielo despejado; el nivel de tu lugar es la ficha más grande.
colors:
  cielo-1: "#bfe3f6"
  cielo-2: "#dcf0fa"
  cielo-3: "#f0f8fc"
  suelo: "#eaf5fb"
  papel: "#ffffff"
  vidrio: "rgb(255 255 255 / .74)"
  texto: "#163a52"
  gris: "#4b6478"
  regla: "#d5e5ee"
  tinta: "#1d5f84"
  tinta-2: "#174d6c"
  tinta-suave: "#dcf0fa"
  negro: "#102a3c"
  cielo: "#3bb3e8"
  nube: "#d6ecf8"
  sol: "#f6b13b"
  sol-claro: "#ffd66b"
  n0: "#d9dde5"
  n1: "#1a9641"
  n2: "#ffd92f"
  n3: "#fd8d3c"
  n4: "#d7191c"
  n0-claro: "#f1f4f8"
  n1-claro: "#a6dbb5"
  n1-medio: "#5cb877"
  n2-claro: "#fff3b0"
  n3-claro: "#ffd2ad"
  a1: "#6baed6"
  a2: "#2171b5"
  a3: "#08306b"
  escenario: "#7a0177"
typography:
  display:
    fontFamily: "system-ui, -apple-system, \"SF Pro Text\", Roboto, \"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "system-ui, -apple-system, \"SF Pro Text\", Roboto, \"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline-largo:
    fontFamily: "system-ui, -apple-system, \"SF Pro Text\", Roboto, \"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "1.4rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  cifra:
    fontFamily: "system-ui, -apple-system, \"SF Pro Text\", Roboto, \"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  title:
    fontFamily: "system-ui, -apple-system, \"SF Pro Text\", Roboto, \"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "system-ui, -apple-system, \"SF Pro Text\", Roboto, \"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  nota:
    fontFamily: "system-ui, -apple-system, \"SF Pro Text\", Roboto, \"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.375
  label:
    fontFamily: "system-ui, -apple-system, \"SF Pro Text\", Roboto, \"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
  placa:
    fontFamily: "system-ui, -apple-system, \"SF Pro Text\", Roboto, \"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.025em"
rounded:
  lg: "0.5rem"
  xl: "0.75rem"
  2xl: "1rem"
  ficha: "1.6rem"
  hoja: "1.75rem"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
components:
  button-primary:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    typography: "{typography.label}"
    rounded: "{rounded.2xl}"
    padding: "0 16px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.tinta-2}"
    textColor: "{colors.papel}"
  button-secondary:
    backgroundColor: "{colors.tinta-suave}"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.2xl}"
    padding: "0 16px"
    height: "48px"
  button-pill:
    backgroundColor: "{colors.tinta-suave}"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 14px"
    height: "36px"
  button-emergencia:
    backgroundColor: "{colors.negro}"
    textColor: "{colors.papel}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 14px"
    height: "36px"
  ficha:
    backgroundColor: "{colors.vidrio}"
    textColor: "{colors.texto}"
    rounded: "{rounded.ficha}"
    padding: "20px"
  ficha-panel:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.texto}"
    rounded: "{rounded.ficha}"
    padding: "20px"
  ficha-cifra:
    backgroundColor: "{colors.vidrio}"
    textColor: "{colors.texto}"
    typography: "{typography.cifra}"
    rounded: "{rounded.ficha}"
    padding: "16px"
  ficha-nivel-n0:
    backgroundColor: "{colors.n0}"
    textColor: "{colors.texto}"
    typography: "{typography.display}"
    rounded: "2rem"
    padding: "20px"
  ficha-nivel-n1:
    backgroundColor: "{colors.n1}"
    textColor: "{colors.texto}"
    typography: "{typography.display}"
    rounded: "2rem"
    padding: "20px"
  ficha-nivel-n2:
    backgroundColor: "{colors.n2}"
    textColor: "{colors.texto}"
    typography: "{typography.display}"
    rounded: "2rem"
    padding: "20px"
  ficha-nivel-n3:
    backgroundColor: "{colors.n3}"
    textColor: "{colors.texto}"
    typography: "{typography.display}"
    rounded: "2rem"
    padding: "20px"
  ficha-nivel-n4:
    backgroundColor: "{colors.n4}"
    textColor: "{colors.papel}"
    typography: "{typography.display}"
    rounded: "2rem"
    padding: "20px"
  placa-nivel:
    typography: "{typography.placa}"
    rounded: "{rounded.full}"
    padding: "0 12px"
    height: "28px"
  chip-estado-validado:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  chip-estado-pendiente:
    backgroundColor: "{colors.tinta-suave}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  chip-estado-cerrado:
    backgroundColor: "{colors.suelo}"
    textColor: "{colors.gris}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  segmentado:
    backgroundColor: "{colors.suelo}"
    rounded: "{rounded.2xl}"
    padding: "4px"
  segmentado-activo:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.texto}"
    rounded: "{rounded.xl}"
    height: "40px"
  campo:
    backgroundColor: "{colors.suelo}"
    textColor: "{colors.texto}"
    rounded: "{rounded.2xl}"
    padding: "14px"
  campo-foco:
    backgroundColor: "{colors.papel}"
  barra-pestanas:
    textColor: "{colors.gris}"
    height: "72px"
  pestana-activa:
    backgroundColor: "{colors.tinta-suave}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.full}"
    height: "32px"
    width: "60px"
  hoja:
    backgroundColor: "{colors.papel}"
    rounded: "{rounded.hoja}"
    padding: "0 16px 16px"
  interruptor:
    backgroundColor: "{colors.regla}"
    rounded: "{rounded.full}"
    height: "28px"
    width: "48px"
  interruptor-on:
    backgroundColor: "{colors.tinta}"
  paso-asistente:
    backgroundColor: "{colors.vidrio}"
    textColor: "{colors.texto}"
    rounded: "{rounded.ficha}"
    padding: "20px"
  progreso-paso-hecho:
    backgroundColor: "{colors.tinta}"
    rounded: "{rounded.full}"
    height: "6px"
  eleccion:
    textColor: "{colors.texto}"
    typography: "{typography.label}"
    rounded: "{rounded.2xl}"
    height: "104px"
  eleccion-activa:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
  button-siguiente:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    rounded: "{rounded.2xl}"
    padding: "0 16px"
    height: "56px"
---

# Design System: Yaguachi Weather

## Overview

**Creative North Star: "La app del teléfono, en mosaico, bajo un cielo despejado"**

Yaguachi Weather se ve y se toca como una app nativa del teléfono de quien la usa: un mosaico bento de fichas muy redondeadas, la letra del sistema (San Francisco en iPhone, Roboto en Android) y una sola tinta de azul petróleo para todo lo que se puede tocar. Desde este cambio aprobado, el mosaico flota sobre un degradado de cielo despejado (celeste arriba, casi blanco abajo) y las fichas son de vidrio claro: blanco translúcido con un filo blanco, de modo que el cielo se adivina detrás. De la referencia del clima solo se tomó la gama de color, no su diseño. La pieza más grande del mosaico sigue siendo el nivel de tu lugar, pintada en su color del semáforo, ahora como degradado del mismo tono y con una escena viva: agua que sube con el nivel, una nube que llueve según el pronóstico o sol cuando no llueve.

La densidad es de app, no de página: márgenes de 16 px, separación de 12 px entre fichas, objetivos táctiles de 48 px o más, barra de pestañas inferior y hojas que suben desde abajo con un asa. «Reportar» es un asistente de cinco pasos, uno por pantalla. El panel del analista comparte el mismo mundo (cielo, tinta, píldoras) con fichas de papel sólido y controles un poco más compactos para escritorio.

El mundo rechaza dos cosas confirmadas por el usuario: la app de alertas genérica de tarjetas apiladas y el aspecto de «saco de piladora» impreso y rudo de una ronda anterior. Tampoco copia escalas ni textos de otras apps: la escala de altura del agua (hasta la vereda, sobre la vereda, no cruces) es propia.

**Key Characteristics:**
- Fondo fijo en degradado de cielo (cielo-1 → cielo-2 → cielo-3); nada de grises fríos.
- Mosaico bento de fichas de vidrio (1.6rem de radio, blanco al 74 % con filo blanco al 70 %) en la app; papel sólido en el panel y en las hojas.
- La ficha del nivel es la más grande y la única en color de semáforo: degradado del mismo tono, escena animada y escala de 4 barras.
- Letra del sistema del teléfono, en minúsculas normales; nada se descarga.
- Una tinta de azul petróleo para acciones; su tinte celeste para acciones secundarias, chips y fondos de íconos.
- Movimiento suave y con sentido (entrada en cascada, olas, nube, gotas, curva que se dibuja, pasos que se deslizan), todo apagado con `prefers-reduced-motion`.

## Colors

Una paleta cerrada (`--color-*: initial`): la gama de un cielo despejado para el fondo y las superficies, un azul petróleo para texto y acciones, acentos de clima (cielo, nube, sol) y dos familias semánticas (semáforo y agua) que nunca se mezclan con la interfaz.

### Primary
- **Tinta petróleo** (tinta): el único color de acción y marca. Botones primarios, enlaces, íconos de acción, anillo de foco (3 px), selección de texto, pestaña activa, opción elegida en el asistente, segmentos completados de la barra de progreso, punto y píldora de «hoy» en la curva de lluvia, insignia de avisos.
- **Tinta presionada** (tinta-2): hover y presión del botón primario. Nunca como color de reposo.
- **Tinte celeste** (tinta-suave): fondo de botones secundarios, botones píldora, chips «pendiente», círculos numerados de «Qué hacer ahora», cajas de ícono en listas y en la revisión del asistente, píldora tras el ícono activo de la barra inferior, aviso de que la app no es oficial, fondo de `code`.

### Secondary
- **Negro petróleo de emergencia** (negro): llamada al ECU 911 (píldora en la barra superior y ficha sólida en el mosaico), sello «Verificado», aviso del 911 en «Reportar», avisos de modo sobre el mapa, toasts, indicador sin conexión y bordes de lo verificado en el mapa.

### Tertiary (acentos de clima y familias semánticas)
- **Cielo** (cielo): el agua que cae y la lluvia pronosticada: curva y área de la gráfica de lluvia, puntos de los días, gotas de la escena del nivel. Es un acento gráfico, nunca texto ni acción (2,4:1 sobre blanco: las cifras van siempre en texto).
- **Nube** (nube): sombra inferior del degradado de la nube en la escena del nivel.
- **Sol y sol claro** (sol, sol-claro): el sol de la escena del nivel, solo cuando el pronóstico no trae lluvia.
- **Semáforo** (n1 verde NORMAL, n2 amarillo VIGILANCIA, n3 naranja PREPARACIÓN, n4 rojo RESPUESTA; n0 gris «sin dato»): ficha del nivel, placas de nivel en píldora, guía de niveles de «sin lugar», cabecera de cada aviso, medidor del río, ríos y recintos en el mapa. El texto va en texto sobre n0, n2 y n3, en negro (black, 5,5:1) sobre n1 sólido y en blanco sobre n4 y en blanco sobre n4.
- **Tintes del semáforo** (n0-claro a n3-claro): el mismo tono aclarado, solo como inicio del degradado de la ficha del nivel. NORMAL termina en n1-medio (#5cb877, el mismo verde aclarado) para que el texto pequeño no baje de 4,5:1; los demás terminan en su color pleno. RESPUESTA (n4) no lleva degradado: rojo sólido con texto blanco.
- **Agua en la calle** (a1 hasta el borde de la vereda, a2 sobre la vereda, a3 no cruces): solo líneas y puntos de calles con agua en el mapa y sus muestras de leyenda, con grosor creciente (5, 7, 9 px). Son alturas, no niveles.
- **Escenario** (escenario, magenta oscuro): zonas de planificación (muy alto riesgo, zonas críticas) y el ícono de la nota «esto es un escenario». Nunca en color de semáforo pleno.

### Neutral
- **Cielo alto, medio y bajo** (cielo-1, cielo-2, cielo-3): el degradado fijo del fondo de la app y del panel (cielo-1 arriba, cielo-2 al 42 %, cielo-3 abajo). cielo-2 es también el fondo del mapa mientras cargan las teselas; «Siguiente» del asistente.
- **Vidrio** (vidrio): fichas del mosaico, pasos del asistente, avisos y banners de la app, siempre con filo blanco al 70 % de 1 px.
- **Papel** (papel): fichas del panel, hojas inferiores, campo de búsqueda y botones flotantes del mapa (al 95 %), segmento activo.
- **Suelo** (suelo): fondo de campos, controles segmentados, botones de cerrar, selector de idioma del panel y chips cerrados.
- **Texto** (texto): texto principal y texto sobre n0–n3 (11,9:1 sobre blanco).
- **Gris de apoyo** (gris): texto secundario, notas, metadatos, pestañas inactivas, umbrales de la curva de lluvia (6,2:1 sobre blanco; 5,7:1 sobre vidrio en lo más celeste del cielo).
- **Regla** (regla): separadores de 1 px entre filas, borde de campos y de las opciones del asistente, base de la curva de lluvia, asa de las hojas, interruptor apagado.

### Named Rules
**The Color Afirma Nivel Rule.** n1–n4 (y sus tintes claros) aparecen solo donde se afirma un nivel: ficha del nivel, placas de nivel, guía de niveles, cabecera de aviso, medidor del río y símbolos del mapa (ríos, recintos). Nunca como acento, estado de botón, gráfico de lluvia o decoración. La correspondencia de tono es fija (plan cantonal / COE); solo puede ajustarse el contraste del texto.

**The El Agua No Es Nivel Rule.** a1–a3 describen la altura del agua en una calle, no un nivel de alerta. Viven solo en el mapa y su leyenda; la elección de altura en el asistente usa vidrio, regla y tinta, nunca a1–a3 ni el semáforo.

**The Una Tinta Rule.** Toda acción es tinta o tinta-suave. No hay segundo color de acción: cielo, nube y sol son clima, no botones.

**The Cielo Es Clima Rule.** cielo, nube, sol y sol-claro solo dibujan tiempo atmosférico (lluvia, nube, sol) en la escena del nivel y en la curva de lluvia. No pintan superficies, texto ni controles.

## Typography

**Display Font:** la letra del sistema (system-ui, -apple-system, «SF Pro Text», Roboto, «Segoe UI», «Helvetica Neue», Arial, sans-serif)
**Body Font:** la misma
**Label/Mono Font:** la misma, con cifras tabulares donde hay números

**Character:** una sola familia, la del teléfono; la jerarquía sale del peso (400 a 800) y del tamaño, nunca de una segunda fuente. Minúsculas normales; las mayúsculas solo aparecen en los nombres oficiales de los niveles.

### Hierarchy
- **Display** (800, 2.5rem, 3rem en lg, interlineado 1): solo el nombre del nivel en la ficha del nivel (1.9rem en la versión compacta de las hojas del mapa).
- **Headline** (700, 1.75rem, 1.25): nombre del lugar, títulos de pantalla y la pregunta de cada paso del asistente; baja a 1.4rem cuando el nombre pasa de 22 caracteres.
- **Cifra** (700, 1.9rem, 1, tabular): el número de las fichas de dato; la unidad va en 1rem, 600, gris.
- **Title** (700, 1.125rem): títulos de ficha y del asistente; 1.25rem en el título de las hojas.
- **Body** (400, 1rem, 1.45): texto corrido; las acciones de «Qué hacer ahora» en 500.
- **Nota** (400, 0.82–0.92rem, 1.375, gris): notas bajo datos, ayudas bajo cada pregunta del asistente, metadatos de listas.
- **Label** (600, 0.875rem): botones, rótulos de campos, píldoras, opciones del asistente; 0.72rem en las etiquetas de la barra inferior.
- **Placa** (700, 0.75rem, +0.025em): nombres de nivel dentro de píldoras.

### Named Rules
**The Peso No Familia Rule.** La jerarquía se construye con peso y tamaño dentro de la letra del sistema. No se descargan ni se añaden fuentes.

**The Cifras Tabulares Rule.** Todo número que se compara (milímetros, metros, lecturas, contadores) lleva cifras tabulares.

## Layout

Columna de app: ancho máximo 32rem (`max-w-lg`) con 16 px de margen en móvil; en lg la pantalla «Mi lugar» se abre a 64rem con 24 px de margen. El panel del analista usa hasta 80rem.

El mosaico bento es una rejilla de 2 columnas en móvil con 12 px de separación y de 4 columnas en lg con 16 px. La ficha del nivel ocupa 2×2 en lg (2 columnas en móvil); «Qué hacer ahora» ocupa 2 columnas y 2 filas en lg; las fichas de dato (lluvia 24 h, lluvia 3 días, distancia al río) y la ficha negra del 911 ocupan una celda cada una; las fichas de lista (calles, lluvia, río, cerca, reportes) ocupan 2 columnas. El juego de fichas y su orden es el mismo para todos los lugares.

«Reportar» es una sola columna: cabecera con botón atrás circular, título y «Paso n de 5»; barra de progreso de 5 segmentos; una ficha de vidrio por paso; y el botón «Siguiente» justo después de la ficha del paso (no queda fijo, así no tapa el consentimiento ni ningún texto); mientras falta algo dice qué falta («Marca la casilla para enviar»). En los pasos 1 y 2 elegir una opción avanza solo (tras una pausa de 260 ms para ver la selección) y el botón solo aparece al volver a un paso ya respondido.

Ritmo: pasos de 4 px; 12 px entre fichas, 20 px de relleno en fichas grandes y 16 px en fichas de dato, 12 px de alto por fila de lista (más el separador de 1 px). Las barras fijas respetan el área segura: barra superior de 56 px, barra inferior de 72 px más `env(safe-area-inset-bottom)`, y el contenido deja ese hueco al final.

El mapa ocupa toda la pantalla entre las dos barras; sus controles flotan a 12 px del borde (búsqueda y capas arriba, zoom/ubicarme/cantón a la derecha, dos botones de reporte abajo). En md las hojas pasan de cajón inferior a panel flotante de 24rem abajo a la izquierda.

## Elevation & Depth

Sistema híbrido sobre el cielo: las fichas de vidrio descansan con una sombra suave y difusa teñida de azul petróleo (nunca gris neutro) más un filo blanco de 1 px que hace de reflejo; lo que flota sobre el mapa lleva una sombra más fuerte; las hojas proyectan su sombra hacia arriba. Las barras superior e inferior son vidrio con desenfoque (blanco al 55 % y al 75 %, `backdrop-blur-md`, filo blanco) en lugar de sombra.

### Shadow Vocabulary
- **Ficha** (`box-shadow: 0 1px 2px rgb(22 58 82 / .06), 0 14px 30px -16px rgb(22 58 82 / .32)`): toda ficha del mosaico y del asistente, ficha del nivel, banners, botón atrás, píldora «En el mapa».
- **Flota** (`box-shadow: 0 2px 6px rgb(22 58 82 / .10), 0 16px 34px -12px rgb(22 58 82 / .34)`): controles sobre el mapa, marcadores, hojas en escritorio, toasts, perilla del interruptor, botón «Siguiente», círculo del visto final.
- **Hoja** (`box-shadow: 0 -12px 34px -8px rgb(22 58 82 / .28)`): hojas inferiores en móvil.
- **Etiqueta** (`box-shadow: 0 1px 3px rgb(22 58 82 / .25)`): etiquetas de recinto sobre el mapa.

### Named Rules
**The Sombra Suave Rule.** Las sombras son siempre difusas, teñidas de azul petróleo (texto) y con desplazamiento negativo de expansión; nunca sombras duras desplazadas ni bordes de color a un lado.

**The Filo De Vidrio Rule.** Toda ficha de vidrio lleva su filo blanco al 70 % de 1 px; el vidrio sin filo se pierde en el cielo.

## Shapes

Esquinas generosas y concéntricas: fichas a 1.6rem, la ficha del nivel a 2rem (la más redonda, como la más grande), hojas a 1.75rem solo arriba (todo el contorno a 1.6rem en escritorio), controles, campos y opciones del asistente a 1rem, opciones dentro de un segmentado y cajas de ícono a 0.75rem, marcadores de punto de control a 0.5rem. Todo lo que es estado, chip, botón pequeño, placa de nivel, selector de idioma, insignia, asa, segmento de progreso y barra de la escala del nivel va en píldora completa. Los bordes se reservan a filos blancos del vidrio, separadores de 1 px en regla y contornos de campos y opciones; no hay bordes decorativos.

Íconos: SVG de trazo 2 sobre cuadrícula de 24 con extremos redondeados, color `currentColor`, 24 px por defecto (16–22 px en píldoras y listas, 28–32 px en las opciones del asistente). Las alturas del agua tienen íconos propios (a-1 vereda con agua baja, a-2 persona con agua sobre la vereda, a-3 agua tachada).

## Components

### Buttons
Rotundos y táctiles: grandes, redondeados y con un leve encogimiento al presionar.
- **Shape:** rectángulo redondeado (1rem) para botones de bloque; píldora para botones pequeños; círculo de 40 px para el botón atrás del asistente.
- **Primary:** tinta con texto blanco, 600, alto mínimo 48 px (52–56 px en «Siguiente»/«Enviar» y en los botones del mapa), ancho completo dentro de su ficha, ícono de 20 px.
- **Hover / Focus:** hover a tinta-2; presión `scale(.98)`; foco con contorno de 3 px en tinta a 2 px de distancia; deshabilitado al 45 % de opacidad (el «Siguiente» deshabilitado pasa a blanco al 85 % con texto gris y sin sombra).
- **Secondary:** tinta-suave con texto tinta, misma forma; dentro del asistente, blanco al 80 % con filo regla y texto tinta.
- **Píldora:** 36 px de alto, tinta-suave y tinta (votos, «Salir»), papel con sombra de ficha («En el mapa») o negro con blanco (911); presión `scale(.95)`.
- **Panel:** en el panel del analista los mismos botones bajan a 0.75rem de radio y 44 px de alto; el secundario oscurece con `brightness(.95)` al hover.

### Chips
- **Estado de reporte:** píldora de 0.7rem, 600: validado en tinta/blanco, pendiente en tinta-suave/tinta, descartado y resuelto en suelo/gris.
- **Placa de nivel:** píldora de 28 px, 0.75rem, 700, en el color del nivel (texto blanco sobre n4).
- **Sello de certeza:** arriba en la ficha del nivel, «Verificado» en negro al 85 % con ícono de visto; «Estimado» en blanco al 60 % (al 20 % sobre n4).

### Cards / Containers
- **Corner Style:** 1.6rem.
- **Background:** vidrio con filo blanco en la app; papel en el panel; la ficha del 911 en negro sólido; la ficha del nivel en su degradado; el aviso de que la app no es oficial en tinta-suave sin sombra.
- **Shadow Strategy:** sombra Ficha (ver Elevation & Depth).
- **Border:** solo el filo blanco del vidrio.
- **Internal Padding:** 20 px; 16 px en fichas de dato y en la del 911.
- **Listas dentro de fichas:** filas separadas por 1 px de regla (sin separador en la última), caja de ícono de 40 px en tinta-suave/tinta a 0.75rem, título en 600 y metadatos en nota gris. Las filas de dato clave/valor ponen la clave en gris a la izquierda y el valor a la derecha.

### Inputs / Fields
- **Style:** fondo suelo (blanco al 80 % dentro del asistente), borde de 1 px en regla, radio 1rem (0.75rem en el panel), relleno de 14 px; la búsqueda es una ficha papel de 48 px con lupa y botón GPS en tinta-suave.
- **Focus:** el campo pasa a papel, el borde a tinta y aparece un anillo de 4 px en tinta al 15 %.
- **Casillas:** 20 px con `accent-color` tinta.

### Navigation
- **Barra inferior (app):** 4 pestañas de igual ancho, vidrio blanco al 75 % con desenfoque y filo superior blanco al 60 %; ícono de 22 px sobre etiqueta de 0.72rem, 600, gris. La activa se pinta en tinta con una píldora tinta-suave de 60×32 px tras el ícono. Insignia de avisos en píldora tinta con anillo papel.
- **Barra superior (app):** 56 px, vidrio blanco al 55 % con desenfoque y filo inferior blanco al 50 %; marca en cuadro tinta de 0.75rem, nombre en 700, selector de idioma en píldora blanca al 70 % y píldora negra del 911.
- **Pestañas del panel:** una píldora papel con sombra que contiene pestañas píldora; la seleccionada en tinta con texto blanco.

### Control segmentado
Pista suelo de 1rem con 4 px de relleno; cada opción es 0.75rem, 600, gris; la elegida sube a papel con sombra Ficha y texto texto o tinta. Se usa para el mapa base (calle / satélite).

### Interruptores (hoja de capas)
Pista de 48×28 px en píldora, regla apagada y tinta encendida; perilla blanca de 24 px con sombra Flota que se desliza 20 px. Cada interruptor vive en una fila de una lista agrupada (fondo suelo, radio 1rem, separadores en regla) con el nombre de la capa en 600 y su leyenda en muestras de 0.78rem debajo. Los grupos llevan un rótulo pequeño en gris de 0.75rem, 600 (el estilo de encabezado de lista agrupada de iOS).

### Hojas inferiores
Cajón papel que sube desde abajo (`hoja`, 0.34s, cubic-bezier(.16, 1, .3, 1)), radio 1.75rem arriba, alto máximo 75 %, sombra Hoja; cabecera fija con asa de 40×6 px en regla, título de 1.25rem en 700 y botón de cerrar circular de 36 px en suelo/gris. En md se convierte en panel flotante de 24rem con radio de ficha y sombra Flota, sin asa. La hoja de información imprime la ficha del nivel en versión compacta (color sólido del nivel, radio 1rem, sin escena) para lo que se tocó.

### Ficha del nivel (componente distintivo)
La pieza grande del mosaico, a 2rem de radio y con sombra Ficha. Fondo en degradado de 150° del tinte claro al color del nivel (n0, n2, n3; NORMAL termina en n1-medio); RESPUESTA va en rojo n4 sólido con texto blanco. Arriba, el sello de certeza en píldora; luego el nombre del nivel en display a todo el ancho, el motivo en 600 y, abajo, una escala de 4 barras de 8 px en píldora donde la barra del nivel activo va en texto al 80 % (blanco sobre n4) y las demás al 15 % (30 % sobre n4). Solo el nivel activo lleva su nombre bajo la barra; los otros quedan para lectores de pantalla.

La escena viva (decorativa, `aria-hidden`):
- **Agua:** dos olas de blanco al 25 % y al 30 % al pie de la ficha cuya altura sube con el nivel (14 %, 18 %, 30 %, 42 %, 54 % para n0–n4); se desplazan en sentidos opuestos (`ola` 9 s y `ola-lenta` 15 s).
- **Nube y lluvia:** arriba a la derecha, una nube de blanco a nube que flota 5 px (`flota`, 6 s) y suelta gotas en cielo según la lluvia pronosticada para 24 h: ninguna bajo 1 mm, 3 bajo 10 mm, 5 bajo 30 mm, 7 desde 30 mm, escalonadas 0.17 s (`gota`, 1.2 s).
- **Sol:** sol y sol-claro detrás de la nube solo cuando no hay gotas.

### Curva de lluvia
Gráfica SVG de 6 días con escala fija de 0 a 120 mm (no se reescala con los datos) y líneas discontinuas en gris al 30 % en 50 y 100 mm, rotuladas a la derecha. Área en cielo que funde del 35 % a 0, línea suavizada de 5 px en cielo que se dibuja sola (`dibujar`, 1.4 s). Días pasados con punto blanco y borde cielo; días por venir con punto cielo y borde blanco; hoy con punto tinta de mayor tamaño y su rótulo en píldora tinta con texto blanco. Cada valor en texto 700 sobre su punto y una etiqueta accesible con la lista completa.

### Asistente «Reportar»
Cinco pasos: qué pasa → cuánta agua o qué tan grave → dónde → foto y detalles → revisar; luego, la pantalla de gracias.
- **Progreso:** 5 segmentos de 6 px en píldora, blanco al 70 % y tinta al completarse (transición de color de 0.3 s); «Paso n de 5» en gris, 600, a la derecha del título.
- **Paso:** ficha de vidrio con la pregunta en headline, una ayuda en nota y sus opciones. Entra desde el lado hacia el que se avanza (`paso` desde +28 px, `paso-atras` desde −28 px, 0.34 s) y el foco va a la pregunta.
- **Opciones:** rejilla de 3 columnas de 104 px de alto mínimo, blanco al 80 % con filo regla a 1rem, ícono de 28–32 px arriba, texto 0.875rem, 600, nota opcional en 0.75rem; la elegida pasa a tinta con texto blanco. Presión `scale(.97)`.
- **Revisión:** lista en blanco al 80 % con filo regla; cada fila lleva caja de ícono tinta-suave, la pregunta en gris pequeño, la respuesta en 600 y un botón «Cambiar» en tinta que lleva a ese paso.
- **Gracias:** círculo tinta de 80 px con sombra Flota y un visto blanco que se dibuja solo, título en headline y dos botones (ver en el mapa, reportar otra cosa).

### Mapa: marcadores y líneas
- **Marcadores:** reporte validado en círculo tinta con anillo blanco de 2 px; reporte pendiente en tinta al 80 % con contorno discontinuo tinta; equipamiento en círculo blanco con ícono tinta; punto de control en rectángulo blanco de 0.5rem con su código en 0.7rem, 700; tu ubicación en punto tinta con borde blanco de 3 px. Todos con sombra Flota.
- **Etiquetas de recinto:** píldora blanca al 94 % con sombra Etiqueta, 0.78rem, 600, que se ocultan por debajo del zoom 13.
- **Líneas:** ríos en el color de su nivel (5 px) sobre halo blanco, o halo negro si el nivel está verificado; calles con agua en a1–a3 con grosor 5/7/9 px sobre halo, discontinuas si no están verificadas; límite cantonal en tinta de 3 px y parroquias discontinuas de 1.5 px; zonas de escenario en magenta con relleno al 5–20 %.

### Toast
Píldora rectangular de 1rem en negro con texto blanco, sombra Flota, que sube 10 px al aparecer (0.25s) encima de la barra inferior.

### Movimiento
Una sola curva de salida, cubic-bezier(.16, 1, .3, 1), para todo lo que entra: pantallas (`entra`, 0.32 s, sube 10 px desde escala .985), fichas de «Mi lugar» en cascada la primera vez (55 ms entre una y otra), hojas (`hoja`), toasts (`sube`) y pasos del asistente (`paso`, `paso-atras`). Lo continuo es lento y suave (`ola`, `ola-lenta`, `flota`, `gota`) y vive solo en la escena del nivel; `dibujar` traza la curva de lluvia y el visto final. Con `prefers-reduced-motion` todo se apaga y el asistente avanza sin pausa.

## Do's and Don'ts

### Do:
- **Do** poner el nivel del lugar como la ficha más grande del mosaico, en su color del semáforo y con su nombre escrito (el color nunca va solo).
- **Do** mantener el mismo juego de fichas en el mismo orden para todos los lugares: nivel, Qué hacer ahora, fichas de dato, 911, listas.
- **Do** usar fichas de vidrio con filo blanco sobre el cielo en la app, y papel sólido en hojas, panel y controles del mapa.
- **Do** teñir toda sombra de azul petróleo (rgb(22 58 82 / …)), nunca de gris o negro neutro.
- **Do** usar tinta para la acción principal y tinta-suave para todas las secundarias; un solo color de acción por pantalla.
- **Do** separar las filas de una lista con 1 px de regla dentro de la ficha, no con fichas anidadas.
- **Do** dar a la escena del nivel solo datos reales: la altura del agua sigue al nivel y las gotas a la lluvia pronosticada.
- **Do** escribir todo texto de interfaz a través de i18n (es por defecto, en disponible): `data-i18n`, `data-i18n-attr`, `data-i18n-html` o `t()`; ningún texto literal en HTML ni JS.
- **Do** estilar solo con clases de Tailwind v4 y los tokens de `cliente/estilos/fuente.css` y `admin/estilos/fuente.css` (mismos tokens en las dos piezas), compilando con el CLI standalone (`sh estilos.sh`, o `--watch`); escribir las clases completas en el JS para que el CLI las encuentre.
- **Do** cerrar cada cambio de interfaz con `impeccable detect` en 0 hallazgos.
- **Do** respetar `prefers-reduced-motion`: sin animaciones ni transiciones.

### Don't:
- **Don't** usar n1–n4 ni sus tintes claros donde no se afirma un nivel (acentos, botones, gráficos de lluvia, decoración).
- **Don't** usar a1–a3 como niveles ni el semáforo para la altura del agua.
- **Don't** usar cielo, nube o sol fuera de la escena del nivel y la curva de lluvia, ni cielo para texto.
- **Don't** pintar escenarios de planificación en color de semáforo pleno; van en magenta escenario y rotulados como escenario.
- **Don't** añadir colores fuera de la paleta (`--color-*: initial`) ni grises o azules por defecto de Tailwind.
- **Don't** copiar escalas, textos ni diseño de otras apps; de la referencia del clima solo se tomó la gama.
- **Don't** descargar fuentes ni añadir una segunda familia.
- **Don't** poner bordes de color a un lado de fichas o avisos, ni sombras duras desplazadas.
- **Don't** escribir CSS a mano fuera de `fuente.css` ni usar Node/npm para compilar estilos.
- **Don't** dar aspecto oficial: el aviso de que la app no es oficial queda visible en «Mi lugar».

## Ajustes de la revisión final (9 nov 2026)

- **Cabecera del lugar:** pin + nombre (headline, o headline-largo de 1,4rem desde 22 caracteres) con la píldora «En el mapa» con su texto a la derecha; debajo, «Tu ubicación · Parroquia» en mayúsculas y minúsculas normales y la fecha corta («Lun, 9 nov · actualizado hace 3 min»). El buscador se vacía al elegir para no repetir el nombre.
- **Sello verificado:** «Verificado por el equipo de riesgo» en una línea y la hora en la siguiente, sin separador; debajo, el enlace «No es alerta oficial · ver quién las emite» hacia el aviso completo.
- **Medidor del río (app):** tramos con nombre llano bajo la barra (normal, alto, crecida, crecida fuerte), resaltado el tramo de hoy, y una nota en palabras de vecino. Los umbrales P90/Q2/Q5 solo aparecen en el panel del analista.
- **Motivos:** la app usa frases de vecino (`I18N.motivo(obj, { vecino: true })`); el panel, la redacción técnica.
- **Escritorio:** la barra inferior es un dock flotante centrado de 28rem.

## Vecinos (reportes como publicaciones)

- **Pestaña Vecinos** (entre Mapa y Reportar): título, buscador de vidrio (calle, recinto, tipo, texto; sin tildes ni mayúsculas) y un control segmentado «Cerca de ti (5 km de tu lugar) · Míos · Todos», con la cuenta de resultados debajo.
- **Publicación:** ficha de vidrio. Cabecera con avatar redondo del tipo (tinta sólida si es tuyo, tinta-suave si es de un vecino), «Tú» o «Un vecino» (nunca nombres) · recinto, «hace X · a N m» y la píldora de estado. Debajo, título en title (o calle + cuánta agua), descripción, nota del analista en una placa blanca, votos de los vecinos y la foto a todo el ancho en 4:3 (se abre grande en un `<dialog>`). Cuentas («2 me gusta», confirmaciones) y una barra de 3 acciones separada por un filete: Me gusta (corazón relleno en tinta cuando está marcado), Mapa, Compartir. Compartir despliega Facebook, WhatsApp, Copiar enlace y, si el teléfono lo permite, Más (menú nativo).
- **Fotos:** las de otros vecinos solo aparecen cuando el analista verificó el reporte; las tuyas siempre las ves.
- **Enlace compartido:** `/r/<id>` sirve las etiquetas Open Graph (título, descripción con «no es un canal oficial», foto si está verificada) y abre la pestaña Vecinos (`#muro/<id>`), que resalta la publicación con un anillo tinta.
- **Me gusta:** uno por teléfono (sin cuentas), se ve al instante y lo confirma el servidor.

## Carga, placeholders y splash (spec 015, 9 nov 2026)

**Regla general:** ninguna vista queda en blanco mientras carga. Los placeholders y el splash usan solo `cielo` y `regla`, porque dibujan agua y lluvia. Nunca usan los colores del semáforo.

### Barra global de carga

- **Dónde:** el borde inferior de la cabecera.
  - App: 3 px.
  - Panel: 2 px, en posición absoluta para no empujar el contenido.
- **Aspecto:** un segmento de `tinta` que avanza sobre `tinta/15` (`tinta-suave` en el panel), con `--animate-carga` de 1,4 s.
- **Cuándo:** aparece solo si una lectura de la API tarda más de 400 ms. Hay una sola barra aunque haya varias peticiones a la vez.
- **Accesibilidad:** `role="progressbar"` con la etiqueta i18n «Cargando…».
- **Con reduce motion:** línea quieta a todo el ancho.

### Aviso de conexión lenta

- Aparece a los 8 s: una píldora o tarjeta de `papel` con `shadow-flota`, bajo la cabecera.
- Texto: «La conexión está lenta; seguimos intentando».
- Acciones: «Reintentar», que vuelve a pedir solo las lecturas y nunca repite un envío, y cerrar, solo en la app.

### Placeholders (esqueletos)

- **Bloques:**
  - App: `regla/80`, con un brillo `::after` blanco al 70 % (`--animate-brillo`, 1,6 s; solo `transform`).
  - Panel: base `nube` con una franja `cielo-3`.
- **Con reduce motion:** el bloque queda quieto, sin brillo.
- **Forma:** copian las medidas del contenido real (líneas de 14 px, campos de 46 px, píldoras de nivel de 28×96 px, botones de 44 px). Las tablas del panel usan sus encabezados reales. Objetivo: CLS menor de 0,1.
- **App:**
  - Mi lugar: ficha del nivel sin color, «qué hacer», 3 fichas de datos y la ficha del 911, que es real porque llamar nunca espera a la red.
  - Vecinos: 3 publicaciones con miniatura en 4:3.
  - Avisos: 2 tarjetas.
  - Mapa: la píldora `ChipCarga` («Cargando el mapa…» / «Cargando capas…») con un aro `tinta` que gira.
- **Panel:** uno por pestaña, con la forma real de cada una.
- **Accesibilidad:** `aria-busy` en el contenedor, `aria-hidden` en los bloques y un «Cargando…» `sr-only` que se anuncia una sola vez.
- **Error:** `ErrorCarga` es una ficha de vidrio con «Reintentar». No se deja un esqueleto infinito.

### Splash (solo con la app instalada)

- **Cuándo se ve:** solo con la app instalada (`@custom-variant instalada` / `standalone` → `display-mode: standalone`, más `navigator.standalone` en iOS). Está en `index.html` para verse antes de React. En una pestaña normal no existe.
- **App:**
  - Fondo sólido `cielo-2` (`#dcf0fa`), igual que `background_color`, `theme_color` y el meta `theme-color`, para que empalme con el splash de Android.
  - Ícono de 112 px centrado, «Yaguachi Weather» y el lema i18n, con 3 gotas `cielo` y dos ondas que suben en 0,8 s (`--animate-marea`).
  - Dura entre 900 ms y unos 3,9 s.
  - iOS: tres `apple-touch-startup-image` (750×1334, 828×1792 y 1170×2532), generados con `node cliente/scripts/inicio-ios.mjs`.
- **Panel:**
  - Fondo `papel` (`#fff`), ícono de 88 px, «Yaguachi Weather» y una barra de 144×4 px.
  - Dura entre 600 ms y 4 s.
- **Salida:** fundido de 320 ms (150 ms con reduce motion). Al cerrarse se quita del DOM, así que no queda ningún velo invisible. En la app, si el JS no corre, una animación CSS (`--animate-splash-fuera`, a los 4,6 s) lo oculta igual.
