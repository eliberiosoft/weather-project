# Feature Specification: Mapa interactivo del cantón

**Feature Branch**: `003-mapa-interactivo`

**Created**: 2026-11-09

**Status**: Implementado

**Input**: Pedido del dueño: un mapa Leaflet del cantón que se use con el dedo en un teléfono de gama baja, con ríos y recintos coloreados por nivel, calles con agua, reportes y las capas de riesgo base claramente marcadas como escenarios, y que se pueda compartir.

> Documentación *as-built* de la sección «MAPA» de `cliente/app.js` (`iniciarMapa`, `montarMapa`, `refrescarCapasDinamicas`, `abrirInfo`, `armarHojaCapas`, `guardarVista`, `leerHash`…) y de `#v-mapa` en `cliente/index.html`. El reporte de calles con agua desde el mapa está en `specs/005-calles-inundadas/`; el modo sin conexión en `specs/011-pwa-sin-conexion/`.


> **Nota (2026-11-09, spec 014):** el frontend se migró a React + TypeScript + Vite, y el panel entra con usuarios y roles en lugar del PIN. El comportamiento descrito aquí se conserva; las rutas de archivos y las referencias al PIN, a unpkg o a `sw.js` v1.x corresponden a la versión anterior. Ver [014](../014-usuarios-incidentes-push-react/spec.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver de un vistazo dónde está el peligro ahora (Priority: P1)

Una persona abre la pestaña «Mapa» y ve el cantón con los ríos pintados del color de su nivel, los recintos como puntos del color de su nivel con su nombre, las calles con agua reportadas y los demás reportes verificados. Lo verificado por el analista se distingue de lo estimado y lo reportado sin verificar.

**Why this priority**: es la vista de conjunto del semáforo; sin ella el mapa es solo una vitrina.

**Independent Test**: abrir `/#mapa` con la API levantada: deben verse límite cantonal, ríos coloreados, recintos con nombre desde zoom 13 y puntos de control P01–P09.

**Acceptance Scenarios**:

1. **Given** el mapa sin preferencias guardadas, **When** se abre, **Then** están encendidas «Calles inundadas», «Ríos por nivel», «Recintos por nivel», «Otros reportes de vecinos» y «Puntos de control P01–P09»; están apagadas las cuatro capas de «Riesgo base», «Salud, UPC y escuelas» y «Parroquias».
2. **Given** `/api/estado` cargado, **When** se pintan los ríos, **Then** cada río tiene una línea de 5 px del color de su nivel efectivo (verificado si existe; gris `#d9dde5` si no hay nivel) sobre un halo blanco de 9 px, o negro de 11 px si el nivel está verificado.
3. **Given** `/api/estado` cargado, **When** se pintan los recintos, **Then** cada uno es un círculo (radio 8, 10 en cabeceras) relleno del color de su nivel efectivo, con borde gris fino si es estimado y borde negro de 4 px si es verificado, y su nombre en una etiqueta permanente que se oculta por debajo del zoom 13.
4. **Given** reportes en `/api/reportes`, **When** se pintan, **Then** las calles con agua pendientes o verificadas van en la capa «Calles inundadas» y los demás reportes verificados (y los tuyos pendientes, con contorno discontinuo) en «Otros reportes de vecinos».
5. **Given** el mapa abierto, **When** pasan 5 minutos, se confirma un aviso o se envía un reporte, **Then** se actualizan los estilos de ríos y recintos y se rehacen las capas de reportes y calles con agua (`refrescarCapasDinamicas`), sin recrear las capas fijas.

---

### User Story 2 - Tocar algo y entender qué es (Priority: P1)

Al tocar un recinto, un río, una calle con agua, un reporte, un punto de control, un equipamiento o una capa de riesgo base, se abre una hoja inferior (no un popup) con su detalle, el elemento queda resaltado y el mapa se corre para que no lo tape la hoja.

**Why this priority**: en el teléfono es la única forma de leer el detalle; los popups tapan lo tocado y cuesta cerrarlos con el pulgar.

**Independent Test**: tocar un recinto: se abre `#hoja-info` con la ficha compacta del nivel, «Ver qué hacer aquí» y «Avisar de una calle inundada aquí»; se cierra con ✕, con Escape o tocando el mapa vacío.

**Acceptance Scenarios**:

1. **Given** un recinto, **When** lo toco, **Then** la hoja muestra su nombre, la ficha compacta del nivel (nombre del nivel, motivo, sello estimado/verificado y escala), el tipo de lugar y dos botones; la URL pasa a `#mapa/recinto/{id}`.
2. **Given** un río (zona de toque de 24 px), **When** lo toco, **Then** la hoja muestra la ficha compacta del nivel del río, el medidor GloFAS y la regla de su primer punto, el nivel en pleamar si hay aguaje, la nota «hereda el nivel del río» y un botón para avisar de una calle inundada cerca.
3. **Given** un punto de control, **When** lo toco, **Then** la hoja muestra el sitio, el medidor de caudal (modelo GloFAS) y la última lectura de la regla (medido) o «Sin lectura reciente de la regla en este punto.».
4. **Given** una zona crítica, una huella de desborde, un tramo crítico o la capa de riesgo muy alto, **When** la toco, **Then** la hoja muestra sus datos y siempre el rótulo «Escenario de planificación de octubre de 2026. No es un pronóstico de mancha.».
5. **Given** una hoja abierta en un teléfono (ancho < 816 px), **When** se resalta el elemento, **Then** el mapa se desplaza para dejar el punto a un 26 % de la altura desde arriba (`encimaDeLaHoja`).
6. **Given** «Ver qué hacer aquí», **When** lo toco, **Then** se carga ese recinto en «Mi lugar» y se cambia a esa pestaña.

---

### User Story 3 - Elegir qué capas ver y el fondo (Priority: P2)

El botón de capas abre una hoja con el fondo (Calles u OSM / Satélite Esri) y tres grupos de interruptores: «Ahora», «Riesgo base» (con la nota «Escenarios de planificación de octubre de 2026. No son pronóstico.») y «Referencia». Cada interruptor lleva su leyenda en palabras llanas. La elección se recuerda.

**Why this priority**: el control de capas de Leaflet es ilegible en un teléfono, y los escenarios no deben confundirse con lo de ahora.

**Independent Test**: encender «Huellas de desborde» y cambiar a «Satélite»; recargar: deben seguir así.

**Acceptance Scenarios**:

1. **Given** la hoja de capas, **When** cambio un interruptor, **Then** la capa se agrega o se quita al instante y se guarda en `ay_capas_on`.
2. **Given** el selector de fondo, **When** elijo Satélite, **Then** se cambia la capa de teselas y se guarda en `ay_fondo`.
3. **Given** que fallan las teselas, **When** ocurre el primer `tileerror`, **Then** sale una sola vez el aviso «Sin señal para el fondo del mapa: se ven solo las capas del cantón.».

---

### User Story 4 - Ir a un lugar, ubicarme y compartir la vista (Priority: P2)

La persona busca un recinto o una calle en el buscador del mapa, toca «mi ubicación» para ver dónde está con su margen de error, o vuelve a ver todo el cantón. La vista y la selección quedan en la URL para compartirlas por WhatsApp.

**Why this priority**: orientarse rápido y mandar a otro «mira aquí» sin explicar.

**Independent Test**: abrir `/#mapa/16/-2.0921/-79.6013` en una pestaña nueva: el mapa abre en esa vista; abrir `/#mapa/recinto/19`: abre centrado en el recinto 19 con su hoja.

**Acceptance Scenarios**:

1. **Given** el buscador del mapa, **When** elijo un recinto, **Then** el mapa va a zoom 15 y abre su hoja; si elijo una calle, va a zoom 17.
2. **Given** «Mostrar mi ubicación», **When** el navegador da la posición, **Then** se dibujan un punto y un círculo del radio de precisión, el mapa va a zoom 16 y sale «Tu ubicación, con un margen de unos {m} m.».
3. **Given** que muevo el mapa, **When** termina el movimiento, **Then** la URL pasa a `#mapa/{z}/{lat}/{lon}` (4 decimales) con `history.replaceState`, o a `#mapa/recinto/{id}` si hay un recinto seleccionado.
4. **Given** «Ver todo el cantón», **When** lo toco, **Then** el mapa encuadra el límite cantonal.
5. **Given** `prefers-reduced-motion: reduce` o un salto de menos de 1,5 km, **When** el mapa va a un punto, **Then** usa `setView` sin animación; si no, `flyTo` de 0,7 s.
6. **Given** «Ver en el mapa» en «Mi lugar», **When** lo toco, **Then** el mapa va al lugar (zoom 15 recinto, 17 punto) y abre la hoja si es recinto.

---

### Edge Cases

- **Leaflet no cargó** (sin conexión la primera vez y sin service worker): `#mapa` muestra «No se pudo cargar el mapa (sin conexión la primera vez).».
- **Sin `/api/estado`**: los ríos y recintos quedan en gris `#d9dde5` (`refrescarCapasDinamicas` sale si no hay `ESTADO`).
- **Sin `/api/reportes`**: se vacían las capas de reportes y calles y quedan las capas fijas (el error se ignora).
- **Fuera del cantón**: `maxBounds` es el límite cantonal ampliado un 30 % con viscosidad 0,8; zoom entre 10 y 19.
- **Hash inválido** (`#mapa/abc`): `leerHash` devuelve `{}` y se usa la vista por defecto (lugar guardado o cantón).
- **Mientras se reporta** (modo calle o modo reporte): tocar objetos no abre hojas (`abrirInfo` sale), y Escape cancela el modo.
- **Cambio de idioma con una hoja abierta**: se rearma la hoja de capas y se vuelve a abrir la última hoja de información en el idioma nuevo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El mapa DEBE usar Leaflet 1.9.4 desde unpkg con integridad SRI, sin control de zoom de Leaflet (botones propios), `minZoom` 10, `maxZoom` 19 y `maxBounds` = límite cantonal con `pad(0.3)`.
- **FR-002**: Las capas vectoriales DEBEN dibujarse en canvas, con un renderizador por *pane* (`lienzo(pane)`, `padding: 0.5`, `tolerance: 6`), en este orden de abajo arriba: `escenarios` 350, `limites` 360, `rios` 380, `tramos` 390, `agua` 400, `recintos` 410, `seleccion` 450. Los marcadores DOM (puntos de control, equipamientos, reportes, tu ubicación) van en el *pane* de marcadores de Leaflet (600).
- **FR-003**: Las capas fijas (límite, parroquias, escenarios, tramos, ríos, recintos, puntos, equipamientos) DEBEN crearse una sola vez en `montarMapa`; el refresco solo cambia estilos (`setStyle`) de ríos y recintos y rehace las colecciones de reportes.
- **FR-004**: Las líneas finas (ríos, tramos críticos, calles con agua) DEBEN tener una línea de toque transparente encima (24 px en ríos y tramos, 26 px en calles) y la línea visible con `interactive: false`.
- **FR-005**: El color del semáforo DEBE usarse solo en ríos, recintos y fichas de nivel; lo verificado se marca con halo o borde negro (`#102a3c`), lo estimado sin él.
- **FR-006**: Las capas de riesgo base DEBEN ir apagadas por defecto, en el grupo «Riesgo base» con la nota de escenario, en magenta `#7a0177` (riesgo muy alto: relleno 0,2 sin borde; zonas críticas: borde discontinuo y relleno 0,05), huellas de desborde en azules con borde punteado (relleno 0,4 si `nivel = ESPERABLE`, 0,2 si no) y tramos críticos en negro discontinuo sobre halo blanco; su hoja DEBE decir que es un escenario y no un pronóstico.
- **FR-007**: El control de capas DEBE ser propio (`#hoja-capas`, `capasDef`, `armarHojaCapas`): fondo en control segmentado, tres grupos de interruptores con su leyenda, y la elección guardada en `ay_capas_on` y `ay_fondo`.
- **FR-008**: El detalle de lo tocado DEBE abrirse en una hoja inferior (`#hoja-info`), con el elemento resaltado en el *pane* `seleccion` y cerrarse con ✕, Escape o un toque en el mapa vacío.
- **FR-009**: La vista DEBE guardarse en el hash (`#mapa/{z}/{lat}/{lon}` o `#mapa/recinto/{id}`) con `history.replaceState` y restaurarse al montar el mapa con la prioridad: recinto del hash > vista del hash > lugar guardado > todo el cantón.
- **FR-010**: El buscador del mapa DEBE usar la misma lista de lugares que «Mi lugar» (`LUGARES`, `#lista-lugares`).
- **FR-011**: «Mostrar mi ubicación» DEBE dibujar el punto y el círculo de precisión (`accuracy`) y explicar el fallo si no hay permiso o HTTPS.
- **FR-012**: Los fondos DEBEN ser OpenStreetMap (`tile.openstreetmap.org`) y Esri World Imagery (`server.arcgisonline.com`), ambos permitidos en la CSP.
- **FR-013**: La capa de calles (`calles.geojson`, 345 KB) DEBE cargarse solo cuando hace falta (`cargarCalles`: modo calle, GPS, reporte de calle), no al abrir el mapa.
- **FR-014**: Las etiquetas de recintos DEBEN ocultarse por debajo del zoom 13 (clase `sin-etiquetas`).
- **FR-015**: Los marcadores DOM DEBEN tener `keyboard: true`, `title` y `alt`; los controles propios DEBEN ser `<button>` con nombre accesible por i18n.
- **FR-016**: Todo texto del mapa (leyendas, títulos de hoja, avisos, `aria-label`) DEBE salir de `I18N.t()`; los nombres de ríos, recintos, calles y los datos de las capas se muestran tal cual pasando por `esc()`.

### Key Entities

- **Capa**: definición en `capasDef()` (clave, encendida por defecto, leyenda) y objeto Leaflet en `capas[k]`.
- **Selección**: lo tocado (`seleccion = {tipo, id?, latlng|geo|linea, capa}`) con su resaltado en el *pane* `seleccion`.
- **Vista**: centro y zoom (o recinto) reflejados en el hash.
- **Preferencias del mapa**: `ay_capas_on` y `ay_fondo` en `localStorage`.

Ver `data-model.md` para las capas GeoJSON y sus propiedades.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Todos los objetos tocables tienen una zona de toque de al menos 24 px de ancho (líneas) o 26–36 px (marcadores).
- **SC-002**: Al abrir el mapa se descargan 9 capas GeoJSON (~390 KB en total) y no la de calles (345 KB); los recintos salen de `/api/territorio`, no de `recintos.geojson`.
- **SC-003**: Un enlace `#mapa/{z}/{lat}/{lon}` o `#mapa/recinto/{id}` abierto en una pestaña nueva reproduce la vista o la selección.
- **SC-004**: Ninguna capa de riesgo base aparece encendida por defecto, y el 100 % de sus hojas dice «escenario de planificación».
- **SC-005**: La hoja de cualquier objeto se cierra con un toque (✕ o mapa vacío) o con Escape.

## Assumptions

- Las capas de riesgo base salen del análisis de riesgo propio del proyecto de octubre de 2026 (HAND sobre Copernicus DEM 30 m, Sentinel-1, GloFAS) y son escenarios de planificación.
- El uso de las teselas de OpenStreetMap y Esri está dentro de sus términos para un prototipo de bajo tráfico.
- En escritorio (≥ 816 px, clase `md:`) las hojas pasan a panel flotante de 24rem abajo a la izquierda y el mapa no se desplaza.

## Brechas conocidas

1. **Capas pesadas al abrir.** `montarMapa` descarga a la vez las 9 capas, incluidas `huellas_desborde` (118 KB), `riesgo_muy_alto` (70 KB) y `tramos_criticos` (44 KB), aunque están apagadas por defecto. El principio I y la skill `mapas-leaflet` piden cargarlas bajo demanda.
2. **Leyenda no sincronizada.** Cada interruptor muestra su leyenda esté o no encendida la capa; la skill pide mostrar solo lo visible.
3. **Sin manejo de error de capas.** `capa(n)` no captura fallos: si un GeoJSON no llega (sin red y sin caché), `montarMapa` se corta a medias sin aviso.
4. **El enlace profundo solo se lee al montar.** Si el mapa ya existe y llega un hash `#mapa/…` nuevo, `iniciarMapa` llama `guardarVista()` y lo pisa con la vista actual.
5. **Huellas en la familia del agua.** Las huellas de desborde usan `AGUA[1]` y `AGUA[2]`, que `DESIGN.md` reserva para calles con agua («El Agua No Es Nivel»); la skill de cartografía pide trama o borde punteado para escenarios.
6. **La selección no queda arriba de todo.** El *pane* `seleccion` (450) está por debajo de los marcadores (600): el anillo de un punto de control o reporte seleccionado queda debajo de su marcador. El tramo provisional de calle (`capaTramoTmp`) y el círculo de tu ubicación no usan el renderizador canvas (van en SVG).
7. **Sin calles de base sin señal.** Si fallan las teselas no se dibujan las calles como base vectorial (la skill lo pide); solo quedan límite, ríos y recintos.
8. **Sin etiquetas de calles.** La skill pide nombres de calles desde zoom 16; no existen.
9. **«Avisar de una calle cerca» en un río** usa el centro del mapa, no el punto tocado.
10. **Atribuciones fijas.** «© OpenStreetMap» y «Esri World Imagery» van escritas en el JS (son atribuciones, no se traducen). [NEEDS CLARIFICATION: ¿se aceptan como excepción a la regla de i18n?]
