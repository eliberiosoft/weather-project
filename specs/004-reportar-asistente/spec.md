# Feature Specification: Reportar — asistente paso a paso

**Feature Branch**: `004-reportar-asistente`

**Created**: 2026-11-09

**Status**: Implementado

**Input**: Pedido del dueño: que un vecino pueda avisar lo que pasa (14 tipos de problema) en pocos toques, con gravedad, ubicación confirmada en un mapa, foto opcional y consentimiento, y que el reporte no se publique hasta que el analista lo revise, salvo las calles inundadas.

> Documentación «as-built»: describe lo que hace el código hoy (`cliente/app.js`, `cliente/index.html`, `cliente/textos-app.js`, `api/servidor.py`). Las diferencias con lo esperado están en «Brechas conocidas».
>
> Fuera de esta spec: el flujo de calle inundada desde la hoja del mapa (`#hoja-calle`) y los votos «sigue / ya pasó» (ver `specs/005-calles-inundadas`); el muro donde se ven los reportes (ver `specs/006-vecinos`); la revisión en el panel (ver `specs/008-panel-analista`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enviar un reporte con mi ubicación (Priority: P1)

Un vecino ve un problema (p. ej. una alcantarilla tapada) y quiere avisarlo desde donde está. Abre la pestaña «Reportar» y sigue cinco pasos, uno por pantalla: 1) qué pasa, 2) qué tan grave es, 3) dónde, 4) foto y detalles, 5) revisar y enviar. Al final ve una pantalla de gracias.

**Why this priority**: es la razón de ser de la pestaña: los vecinos son sensores (principio 4 de `PRODUCT.md`).

**Independent Test**: en la app levantada, pestaña «Reportar» → tocar «Alcantarilla o canal tapado» → «Moderada» → «Mi ubicación» → «Siguiente» → «Saltar este paso» → marcar la casilla → «Enviar reporte». La API responde 201 y el reporte aparece en el panel con estado `pendiente`.

**Acceptance Scenarios**:

1. **Given** el paso 1, **When** el vecino toca un tipo, **Then** queda marcado (`aria-checked=true`) y, tras 260 ms (0 ms con `prefers-reduced-motion`), el asistente pasa solo al paso 2 (`avanzar()`).
2. **Given** un tipo distinto de `calle_inundada`, **When** llega al paso 2, **Then** ve «¿Qué tan grave es?» con Leve / Moderada / Grave y «Moderada» ya marcada (`gravSel = 2`).
3. **Given** el paso 3, **When** toca «Mi ubicación» y el GPS responde, **Then** se fija la ubicación con origen `gps` y su precisión, aparece el texto «Ubicación de tu teléfono: lat, lon» (5 decimales) y un mini mapa centrado en el punto (zoom 17) con un círculo del margen del GPS.
4. **Given** el paso 4 sin foto ni texto, **When** mira el botón, **Then** dice «Saltar este paso»; con foto o texto dice «Siguiente».
5. **Given** el paso 5, **When** la casilla de consentimiento no está marcada, **Then** el botón está deshabilitado y dice «Marca la casilla para enviar»; al marcarla dice «Enviar reporte».
6. **Given** el envío aceptado por la API, **When** termina, **Then** se borra el formulario (`reiniciarReporte()`), se muestra «¡Gracias por avisar!» con el texto «Vamos a revisar tu reporte; mientras tanto solo lo ves tú» y tres botones: ver mi reporte en Vecinos, ver en el mapa y hacer otro reporte.

---

### User Story 2 - Confirmar o corregir el lugar en el mini mapa (Priority: P1)

El GPS de un teléfono barato puede errar decenas de metros, o el vecino no está en el sitio. En el paso 3 puede marcar el punto en el mapa grande o corregirlo en el mini mapa arrastrando el pin o tocando el lugar correcto.

**Why this priority**: un reporte en el lugar equivocado engaña al analista y al mapa.

**Independent Test**: fijar la ubicación con GPS, arrastrar el pin del mini mapa unos metros y comprobar que el texto cambia a «Punto ajustado en el mapa: …» y que el reporte se guarda con esas coordenadas.

**Acceptance Scenarios**:

1. **Given** el paso 3, **When** toca «En el mapa», **Then** la app abre la pestaña «Mapa» en modo reporte (`modoReporte = true`, aviso «toca el lugar»); al tocar un punto se fija con origen `mapa` y vuelve a «Reportar» (`fijarUbicacionReporte(…, "mapa")` → `irA("reportar")`).
2. **Given** un punto fijado, **When** arrastra el pin del mini mapa o toca otro lugar del mini mapa, **Then** el punto pasa a origen `ajustada`, redondeado a 6 decimales, y el mini mapa se desplaza sin cambiar el zoom.
3. **Given** un teléfono táctil, **When** desliza un dedo sobre el mini mapa, **Then** la página se desplaza (el arrastre del mapa está apagado en móviles: `dragging: !L.Browser.mobile`); el pin sí se arrastra.
4. **Given** el tipo `calle_inundada`, **When** se fija el punto, **Then** la app busca la calle de OSM más cercana (≤ 70 m, `tramoCercano`) y añade su nombre al texto, o «no hay una calle a menos de 70 m».

---

### User Story 3 - Reportar una calle inundada desde el asistente (Priority: P2)

Si elige «Calle o camino inundado», el paso 2 pregunta «¿Cuánta agua hay?» con la escala propia de tres alturas en vez de la gravedad, y el reporte se publica al momento como «aviso de vecinos».

**Why this priority**: es el reporte más frecuente en temporada de lluvias; el flujo desde la hoja del mapa (spec 005) es el principal, este es el alternativo.

**Independent Test**: elegir «Calle o camino inundado» → «Sobre la vereda» → GPS → … → enviar; la respuesta trae `estado: pendiente` y el reporte se ve en el mapa de otro teléfono con trazo discontinuo.

**Acceptance Scenarios**:

1. **Given** el tipo `calle_inundada`, **When** llega al paso 2, **Then** ve las tres alturas (hasta la vereda, sobre la vereda, no cruces) y ninguna marcada; elegir una avanza solo.
2. **Given** el envío, **When** hay una calle a ≤ 70 m, **Then** el cuerpo lleva `altura_agua`, `gravedad = altura_agua`, `via` (nombre o «calle sin nombre cerca de …»), `tramo` (±120 m sobre la vía) y la ubicación se ajusta al punto de la calle (`tr.punto`).
3. **Given** el envío aceptado, **When** se muestra la pantalla final, **Then** el texto dice que el aviso ya está en el mapa como «aviso de vecinos».
4. **Given** que cambia de tipo después de elegir altura, **When** vuelve a elegir un tipo distinto, **Then** la altura elegida se borra (`alturaSel = null`).

---

### User Story 4 - Adjuntar una foto liviana (Priority: P2)

El vecino toma o elige una foto. La app la reduce en el teléfono antes de enviarla para gastar pocos datos y quitar los metadatos.

**Why this priority**: la foto acelera la verificación, pero no es obligatoria.

**Independent Test**: elegir una foto de 4000×3000 px; la vista previa aparece y el cuerpo enviado lleva `data:image/jpeg;base64,…` de 1280×960 px.

**Acceptance Scenarios**:

1. **Given** el paso 4, **When** elige una imagen, **Then** se dibuja en un `<canvas>` con el lado mayor a 1280 px como máximo (nunca se agranda), se codifica como JPEG calidad 0,7 (`toDataURL("image/jpeg", 0.7)`) y se muestra la vista previa; los metadatos EXIF (incluida la ubicación de la cámara) no pasan al canvas.
2. **Given** un archivo que el navegador no puede leer, **When** falla `createImageBitmap`, **Then** aparece «No se pudo leer la foto» y el reporte queda sin foto.
3. **Given** una foto decodificada de más de 1500 KB (`max_foto_kb`) o que no empieza con la firma JPEG `FF D8 FF`, **When** llega a la API, **Then** responde 400 «la foto es demasiado grande o no es válida».
4. **Given** 20 reportes con foto desde la misma IP en 24 h, **When** envía otro con foto, **Then** la API responde 429 «ya enviaste muchas fotos hoy; manda el reporte sin foto».

---

### User Story 5 - Reportar sin señal (Priority: P2)

Sin conexión, el reporte no se pierde: queda en una cola del teléfono y se reenvía cuando vuelve la señal.

**Why this priority**: principio I de la constitución (mala señal).

**Independent Test**: en Chrome, DevTools → Network → Offline; enviar un reporte; aparece «Sin conexión: el reporte se enviará cuando vuelva la señal»; volver a Online; aparece «Se enviaron 1 reportes pendientes» y el reporte está en el panel.

**Acceptance Scenarios**:

1. **Given** `navigator.onLine === false`, **When** el envío falla, **Then** el cuerpo completo (con foto) se guarda en `localStorage` (`ay_cola_reportes`, `encolar()`) y se muestra la pantalla de gracias con el mensaje de la cola.
2. **Given** reportes en cola, **When** la app arranca (`iniciar()`) o el navegador dispara `online`, **Then** `enviarCola()` los envía uno a uno; los que fallan por falta de red quedan; los demás salen de la cola.
3. **Given** `navigator.onLine === true` pero la API rechaza el envío (400, 409, 429, 507), **When** falla, **Then** se muestra el mensaje de error de la API y el asistente se queda en el paso 5 con los datos.

---

### User Story 6 - Saber qué pasa con mi reporte (Priority: P3)

Quien reporta ve su reporte en «Vecinos → Míos» en cualquier estado, con la nota del analista; los demás solo lo ven cuando el analista lo verifica.

**Why this priority**: da confianza sin exponer reportes falsos a todo el cantón.

**Independent Test**: enviar un reporte de tipo `socavon` desde el teléfono A; en el teléfono B no aparece; en A aparece con «en revisión» y «Solo tú lo ves hasta que el analista lo revise»; el analista lo verifica en el panel; ahora aparece en B con «verificado».

**Acceptance Scenarios**:

1. **Given** un reporte `pendiente` que no es calle, **When** otro teléfono pide `GET /api/reportes`, **Then** no lo recibe.
2. **Given** el mismo reporte, **When** el autor pide `GET /api/reportes` con su `X-Dispositivo`, **Then** lo recibe con `mio: true` y `foto: true` si adjuntó foto.
3. **Given** que el analista lo pasa a `validado`, **When** cualquiera pide la lista antes de `expira`, **Then** lo recibe con `verificado: true` y su foto es pública en `/api/foto/{id}`.
4. **Given** que el analista lo pasa a `descartado`, **When** se guarda, **Then** su foto se borra del disco y la columna `foto` queda en NULL; el autor lo sigue viendo como «descartado».

### Edge Cases

- **Tipos graves**: al elegir `aislados`, `desborde` o `vivienda_inundada` se muestra arriba del asistente la ficha negra «Si hay personas en peligro, llama primero al ECU 911» con enlace `tel:911`.
- **Sin GPS o permiso negado**: toast «Este teléfono no da ubicación» (`app.err.sin_gps`) o «No se pudo obtener tu ubicación…» (`app.err.gps`) (timeout 15 s, alta precisión); el vecino puede usar «En el mapa».
- **Fuera del cantón**: la API rechaza con 400 «la ubicación está fuera del cantón Yaguachi» si el punto cae fuera del rectángulo de los recintos ampliado 0,08° (`T.bbox`). Un punto dentro del rectángulo pero fuera del polígono cantonal se acepta con `en_canton = 0` (el panel lo marca «fuera»).
- **Duplicado**: el mismo teléfono, mismo tipo, a menos de 150 m y en los últimos 30 min → 409 «ya reportaste lo mismo aquí hace poco».
- **Demasiados envíos**: 6 por hora por teléfono (`max_reportes_hora_dispositivo`) y 40 por hora por IP → 429.
- **Disco casi lleno**: con menos de 1 GB libre, un reporte con foto → 507; sin foto se acepta.
- **Cuerpo enorme**: `Content-Length` > 3 MB → 413 (nginx también corta en 3 MB).
- **Descripción larga**: el `<textarea>` corta en 500 caracteres y la API también (`[:500]`).
- **Recinto lejano**: si el recinto más cercano está a más de 3 km, el reporte se guarda sin `recinto`.
- **Volver atrás**: el botón circular «atrás» vuelve un paso con la animación inversa; en el resumen, cada fila tiene «Cambiar», que lleva a su paso (`data-ir-paso`).
- **Cambio de idioma a mitad del asistente**: se repintan el «Paso n de 5», el botón, los tipos y el resumen sin perder lo elegido.
- **Leaflet no cargado** (primera visita sin red): el mini mapa no se muestra (`!window.L`), pero se puede enviar.

## Requirements *(mandatory)*

### Functional Requirements

**Asistente (cliente)**

- **FR-001**: El asistente MUST tener 5 pasos numerados («Paso n de 5», barra de 5 segmentos) más una pantalla final `ok`; solo un paso visible a la vez (`irPaso(n)`), con el foco en la pregunta (`h2`) y desplazamiento al inicio.
- **FR-002**: El paso 1 MUST listar los 14 tipos de `TIPOS` (recibidos en `GET /api/territorio`) como opciones `role=radio` en rejilla de 3 columnas, con ícono `t-<tipo>` y nombre traducido (`tipo.<clave>`).
- **FR-003**: `pasoListo(n)` MUST exigir: paso 1 un tipo; paso 2 una altura si el tipo es `calle_inundada` o una gravedad en otro caso; paso 3 una ubicación; paso 5 el consentimiento marcado. El paso 4 es opcional.
- **FR-004**: En los pasos 1 y 2, elegir una opción MUST avanzar solo; el botón «Siguiente» solo se muestra en esos pasos si ya hay respuesta (al volver atrás).
- **FR-005**: El paso 3 MUST ofrecer «Mi ubicación» (GPS) y «En el mapa», y mostrar un mini mapa (OSM, zoom 17, pin arrastrable, toque para mover, círculo de precisión GPS) para confirmar el punto (`pintarMiniMapa`, `fijarUbicacionReporte`).
- **FR-006**: La foto MUST reducirse en el cliente a 1280 px de lado mayor y JPEG 0,7 antes de enviarse; no se envía el archivo original.
- **FR-007**: El paso 5 MUST mostrar un resumen (`pintarResumen`) con qué pasa, gravedad o altura, dónde, foto (miniatura) y detalles, cada fila con «Cambiar».
- **FR-008**: El envío MUST requerir la casilla de consentimiento marcada en cada reporte; el cuerpo lleva `consentimiento: true`.
- **FR-009**: Para `calle_inundada`, el cliente MUST calcular el tramo de ±120 m sobre la calle más cercana (≤ 70 m) y enviar `altura_agua`, `via`, `tramo` y el punto ajustado a la calle.
- **FR-010**: Sin conexión (`navigator.onLine === false`), el reporte MUST guardarse en la cola local y reenviarse al arrancar la app o al volver la conexión (`enviarCola`).
- **FR-011**: Tras un envío (o encolado) MUST mostrarse la pantalla final con el mensaje según el tipo y los accesos a Vecinos (filtro «Míos», con el reporte nuevo resaltado), al mapa (zoom 17 en el punto) y a «Hacer otro reporte».
- **FR-012**: Para `aislados`, `desborde` y `vivienda_inundada` MUST mostrarse el aviso de llamar primero al ECU 911.
- **FR-013**: Todos los textos del asistente MUST salir de `I18N` (`app.wiz.*`, `app.rep.*`, `tipo.*`, `altura.*`, `app.grav.*`) en `es` y `en`; el cliente no muestra el `mensaje` en español que devuelve la API en un envío correcto, sino `app.toast.rep_ok` / `app.toast.calle_ok`.

**API (`crear_reporte`)**

- **FR-014**: `POST /api/reportes` MUST validar: `dispositivo` con `[A-Za-z0-9_-]{8,64}`; `consentimiento === true`; `tipo` en `TIPOS`; `gravedad` en 1–3 (por defecto 2); `lat`/`lon` numéricos dentro de `T.bbox`; para `calle_inundada`, `altura_agua` en 1–3 (y entonces `gravedad = altura_agua`), `via` ≤ 120 caracteres y `tramo` de 2 a 80 puntos `[lat, lon]` dentro de `T.bbox`; foto opcional `data:image/jpeg;base64,…`, ≤ 1500 KB decodificada y con firma JPEG.
- **FR-015**: La API MUST comprobar y guardar bajo el mismo candado (`_db_lock`): ≤ 6 reportes/hora por dispositivo, ≤ 40/hora por IP, ≤ 20 reportes con foto/24 h por IP, sin duplicado (mismo dispositivo y tipo a < 150 m en 30 min) y ≥ 1 GB libre para guardar una foto.
- **FR-016**: La API MUST guardar el reporte con `estado = 'pendiente'`, `id` de 12 hex (`uuid4().hex[:12]`), `creado` en hora de Ecuador (UTC−5), `expira = creado + horas del tipo` (de 3 h a 72 h, ver `data-model.md`), la IP, el recinto más cercano si está a ≤ 3 km y `en_canton`.
- **FR-017**: La foto MUST guardarse como archivo `<uuid4>.jpg` en `datos/fotos/`, nunca en la base.

**Visibilidad y ciclo de vida**

- **FR-018**: `GET /api/reportes` MUST devolver a cualquiera: los `validado` no vencidos y las `calle_inundada` `pendiente` no vencidas; y además, al dueño (por `X-Dispositivo`), todos sus reportes en cualquier estado. Orden: verificados primero, luego más recientes; máximo 400.
- **FR-019**: La foto de un reporte MUST servirse (`GET /api/foto/{id}`) solo si el reporte está `validado`, si quien la pide es el dueño (`?dispositivo=`) o con el PIN del panel (`X-PIN`); en otro caso 404. El service worker no la guarda en caché.
- **FR-020**: Solo el analista MUST poder pasar un reporte a `validado`, `descartado`, `resuelto` o de vuelta a `pendiente` (`POST /api/panel/reportes/{id}`). Al descartar, la foto se borra al momento.
- **FR-021**: Las fotos MUST borrarse a los 90 días (`dias_conservar_fotos`) y la IP a las 48 h, por el hilo `mantenimiento()` cada 6 h y al arrancar.
- **FR-022**: Un reporte `validado` y vigente de tipo `vivienda_inundada`, `desborde` o `aislados` MUST subir a RESPUESTA estimada todo punto a ≤ 1,5 km (`reportes_graves_validados`, ver spec 002).

### Key Entities

- **Reporte**: lo que un vecino avisa. Tipo, gravedad (o altura del agua), descripción, ubicación, recinto cercano, foto opcional, estado, nota del analista, vigencia (`expira`), id del teléfono e IP (temporal). Ver `data-model.md`.
- **Tipo de reporte** (`TIPOS`): clave, emoji, etiqueta, horas de vigencia y si sube a RESPUESTA al verificarse. Está en el código, no en la base.
- **Cola local**: lista de cuerpos de reporte pendientes de envío en `localStorage` (`ay_cola_reportes`).
- **Consentimiento**: casilla por reporte; `ay_consent_ok` recuerda que ya aceptó alguna vez (lo usa la hoja de calle, no el asistente).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un reporte sin foto con ubicación GPS se envía en 7 toques como máximo (tipo, gravedad, «Mi ubicación», «Siguiente», «Saltar este paso», casilla, «Enviar»).
- **SC-002**: El 100 % de los reportes `pendiente` que no son `calle_inundada` quedan fuera de `GET /api/reportes` para cualquier otro dispositivo.
- **SC-003**: Ninguna foto enviada supera 1280 px de lado mayor, y ninguna foto de un reporte descartado queda en `datos/fotos/` después de descartarlo.
- **SC-004**: El séptimo reporte de un mismo teléfono en una hora recibe 429, y dos envíos simultáneos no pasan el tope (comprobación bajo candado).
- **SC-005**: Un reporte enviado sin conexión llega a la API en el primer arranque o evento `online` con red, sin que el vecino lo reescriba.
- **SC-006**: Toda la interfaz del asistente funciona a 360 px de ancho con objetivos de al menos 44 px (opciones de 104 px de alto, botón «Siguiente» de 56 px).

## Assumptions

- No hay cuentas: el dueño de un reporte es el teléfono (`ay_dispositivo`, id aleatorio con `crypto`). Si se borran los datos del navegador, el vecino deja de ver sus reportes pendientes.
- La ubicación del reporte es la que el vecino confirma; no se verifica que esté físicamente ahí.
- La IP solo sirve para frenar abusos y se borra a las 48 h; detrás de Cloudflare hay que configurar la IP real (ver `docs/seguridad.md`).
- Las vigencias por tipo (`TIPOS[...][2]`) son decisión de producto, no del plan cantonal.
- El analista revisa los reportes con regularidad; no hay plazo ni aviso automático al autor cuando cambia el estado.

## Brechas conocidas

1. **Cola sin conexión incompleta.** Solo se encola si `navigator.onLine` es `false`. Con señal débil (el navegador cree que hay red pero `fetch` falla) se muestra el error del navegador («Failed to fetch») y el reporte no se encola; el vecino debe reintentar. Contradice en parte el principio I.
2. **La cola puede perder reportes en silencio.** `almacen.set` ignora el error de cuota de `localStorage`: una cola con varias fotos (cada una 150–400 KB en base64) puede no guardarse y el vecino ve «se enviará cuando vuelva la señal». Además, `enviarCola()` descarta sin avisar los reportes que la API rechaza (409, 429, 400).
3. **Mensajes de error solo en español.** Los errores de la API (`{"error": "…"}`) se muestran tal cual en el toast, también con la interfaz en inglés. [NEEDS CLARIFICATION: ¿la API debe devolver códigos (`{k, v}`) para traducir los errores, como ya hace con los motivos del nivel?]
4. **Errores 500 evitables.** Un `base64` con relleno incorrecto (`binascii.Error`) o una `descripcion` que no es texto producen 500 «error interno» en vez de 400.
5. **Reportes vencidos del propio teléfono.** La API devuelve al dueño todos sus reportes sin mirar `expira`, y el mapa (`refrescarCapasDinamicas`) y «cerca de ti» los pintan igual: el autor sigue viendo su calle inundada después de las 8 h aunque para los demás ya no exista.
6. **Tramo largo rechazado.** El cliente no limita los puntos del tramo; si una calle de OSM tiene más de 80 vértices en ±120 m, la API responde 400 «tramo de calle inválido» y el vecino no sabe por qué.
7. **Consentimiento repetido.** El asistente pide marcar la casilla en cada reporte aunque `ay_consent_ok` ya esté guardado; la hoja de calle no la vuelve a pedir. [NEEDS CLARIFICATION: ¿se quiere la casilla siempre (más claro para la LOPDP) o solo la primera vez?]
8. **Sin aviso al autor** cuando el analista verifica o descarta su reporte; tiene que entrar a «Vecinos → Míos».
9. **`DESIGN.md` desactualizado**: describe la pantalla de gracias con dos botones; el código tiene tres (Vecinos, mapa, otro reporte).
