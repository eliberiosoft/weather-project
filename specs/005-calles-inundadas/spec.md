# Feature Specification: Calles con agua (aviso de vecinos)

**Feature Branch**: `005-calles-inundadas`

**Created**: 2026-11-09

**Status**: Implementado

**Input**: Pedido del dueño: que un vecino pueda avisar en pocos toques, desde el mapa, que una calle tiene agua y cuánta, que el aviso salga al instante como «aviso de vecinos» y que los demás vecinos lo confirmen o digan que ya pasó, con una escala de altura propia.

> Documentación *as-built*. Cliente: `modoCalle`, `tramoCercano`, `elegirTramo`, `cancelarCalle`, `#hoja-enviar`, `botonesVoto`, `confirmar` y el paso 2 del asistente «Reportar» en `cliente/app.js`; `#hoja-calle` en `cliente/index.html`. Servidor: `crear_reporte`, `validar_tramo`, `listar_reportes`, `confirmar_reporte`, `PUBLICO_YA`, `ALTURA` y `TIPOS["calle_inundada"]` en `api/servidor.py`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Avisar que mi calle tiene agua desde el mapa (Priority: P1)

Un vecino toca «Calle con agua» en el mapa (o «Avisar de una calle inundada» en «Mi lugar» o en la hoja de un recinto), toca su calle, la app le marca el tramo de unos 240 m alrededor del toque, elige cuánta agua hay con tres botones de referencias que se ven desde la vereda y envía. El aviso aparece enseguida en el mapa como «aviso de vecinos».

**Why this priority**: «los vecinos son sensores» (principio de producto 4); es el dato más fresco y local que tiene la app.

**Independent Test**: en `/#mapa`, zoom ≥ 15, tocar «Calle con agua», tocar sobre una vía, elegir «Sobre la vereda», marcar el consentimiento y enviar: el tramo debe verse en azul discontinuo sobre halo blanco y la hoja debe decir «aviso de vecinos».

**Acceptance Scenarios**:

1. **Given** el mapa, **When** activo el modo calle, **Then** aparece la barra «Toca la calle inundada» con «Cancelar», se ocultan los botones inferiores, el cursor pasa a cruz en escritorio, se empieza a descargar `calles.geojson` y, si el zoom es < 15, sale «Acerca el mapa a tu calle y tócala.».
2. **Given** el modo calle, **When** toco a ≤ 70 m de una vía OSM, **Then** `tramoCercano` encuentra el segmento más cercano y arma un tramo de hasta 120 m a cada lado siguiendo la vía; se dibuja en tinta y se abre `#hoja-calle` con el nombre de la vía (o «Calle sin nombre (cerca de {recinto})») y «¿Cuánta agua hay en este tramo de unos 240 m?».
3. **Given** el modo calle, **When** toco a más de 70 m de cualquier vía, **Then** sale «Toca justo sobre una calle o camino. Acerca el mapa si hace falta.» y sigo en el modo.
4. **Given** la hoja de la calle, **When** elijo una altura (1 «Hasta la vereda · menos de 15 cm», 2 «Sobre la vereda · tapa media llanta», 3 «No cruces · hondo o con corriente»), marco el consentimiento (solo la primera vez) y envío, **Then** se hace `POST /api/reportes` con `tipo: "calle_inundada"`, `altura_agua`, `gravedad = altura`, `via`, `tramo` y el punto ajustado a la vía; sale «Gracias. Tu aviso ya está en el mapa como «aviso de vecinos»…», se cierra el modo y se refresca el mapa.
5. **Given** la hoja sin altura o sin consentimiento, **When** toco Enviar, **Then** salen «Elige hasta dónde llega el agua.» o «Marca la casilla de uso de datos para enviar.» y no se envía.
6. **Given** el modo calle o la hoja abierta, **When** toco «Cancelar», ✕ o Escape, o cambio de pestaña, **Then** se quita el tramo provisional y se sale del modo.

---

### User Story 2 - Ver las calles con agua y cuánta agua hay (Priority: P1)

Cualquier persona ve en el mapa y en «Mi lugar» las calles con agua de las últimas 8 horas, con la altura codificada en la familia de azules del agua y en grosor creciente, distinguiendo lo verificado por el analista de lo que solo avisaron vecinos.

**Why this priority**: el aviso solo sirve si otros lo ven a tiempo y entienden cuánta agua hay sin confundirlo con un nivel de alerta.

**Independent Test**: con un aviso de calle creado, abrir «Mi lugar» de un recinto a ≤ 3 km: debe listarse en «Calles inundadas cerca» con la vía, la altura y la etiqueta «aviso de vecinos».

**Acceptance Scenarios**:

1. **Given** un aviso de calle pendiente y vigente, **When** se pinta el mapa, **Then** el tramo se dibuja con halo blanco y línea discontinua (`10 7`) del color de su altura (`#6baed6` 5 px, `#2171b5` 7 px, `#08306b` 9 px); si no tiene tramo, un círculo de radio 9 con borde discontinuo.
2. **Given** un aviso verificado por el analista, **When** se pinta, **Then** el halo es negro y la línea continua.
3. **Given** que toco un tramo (zona de toque de 26 px), **When** se abre la hoja, **Then** muestra «Agua: {altura}», el estado («aviso de vecinos» o «verificado») con la antigüedad, cerca de qué recinto, la nota del analista, «{s} dicen que sigue inundada · {n} que ya pasó» y los botones de voto.
4. **Given** «Mi lugar», **When** hay avisos de calle pendientes o verificados a ≤ 3 km, **Then** se listan hasta 10 en «Calles inundadas cerca», o «No hay avisos de calles inundadas a menos de 3 km.».
5. **Given** un aviso con más de 8 h, **When** otro vecino pide `/api/reportes`, **Then** ya no aparece (`expira > ahora`).

---

### User Story 3 - Confirmar si la calle sigue con agua o ya pasó (Priority: P2)

Los vecinos tocan «Aún inundada (n)» o «Ya pasó (n)» en el aviso. Quien avisó puede decir «El agua ya pasó» y cerrar su propio aviso. Si suficientes conexiones distintas dicen que ya pasó, el aviso se cierra solo; lo verificado por el analista no lo cierran los vecinos.

**Why this priority**: mantiene el mapa al día sin que el analista tenga que revisar cada calle, y sin que unos pocos teléfonos puedan borrar avisos ajenos.

**Independent Test**: con tres teléfonos en tres conexiones distintas votar «Ya pasó» sobre un aviso pendiente sin votos «Aún inundada»: el aviso pasa a `resuelto` y desaparece del mapa.

**Acceptance Scenarios**:

1. **Given** un aviso de calle ajeno abierto (pendiente o verificado), **When** voto, **Then** se guarda un voto por teléfono (`confirmaciones`, se puede cambiar), se actualizan `sigue`/`ya_no` y sale «Gracias por confirmar.».
2. **Given** un aviso pendiente, **When** al menos 3 conexiones distintas (IP, o el teléfono si no hay IP) dicen «ya pasó» y los «ya pasó» son más del doble de los «sigue», **Then** el aviso pasa a `resuelto` con la nota « [cerrado por vecinos]».
3. **Given** un aviso verificado, **When** los vecinos votan «ya pasó», **Then** se cuentan los votos pero no se cierra (lo cierra el analista).
4. **Given** mi propio aviso de calle, **When** toco «El agua ya pasó», **Then** el aviso pasa a `resuelto` con la nota « [quien avisó dijo que el agua ya pasó]» y sale «Listo, marcamos que el agua ya pasó.».
5. **Given** mi propio aviso, **When** intento votar «sigue», **Then** la API responde 409 «no puedes confirmar tu propio reporte» (la app no muestra ese botón).
6. **Given** más de 30 votos desde la misma IP en una hora, **When** voto otra vez, **Then** la API responde 429.

---

### User Story 4 - Avisar de una calle desde el asistente «Reportar» (Priority: P3)

Quien prefiere el asistente elige «Calle o camino inundado», la altura del agua, su ubicación (GPS, mapa o minimapa ajustable), opcionalmente foto y detalle, y envía. La app busca la calle más cercana al enviar.

**Why this priority**: camino alternativo con foto y descripción; el principal es el del mapa.

**Independent Test**: «Reportar» → «Calle o camino inundado» → «No cruces» → «Mi ubicación» → saltar foto → marcar consentimiento → enviar: debe aparecer en el mapa como aviso de vecinos.

**Acceptance Scenarios**:

1. **Given** el tipo calle, **When** paso al paso 2, **Then** se pide la altura (no la gravedad) con la nota «El aviso sale en el mapa enseguida… y se borra solo a las 8 horas.».
2. **Given** una ubicación elegida, **When** el tipo es calle, **Then** el paso 3 dice el nombre de la vía encontrada o « · no hay una calle a menos de 70 m».
3. **Given** el envío, **When** hay una vía a ≤ 70 m, **Then** se envían `tramo` y el punto ajustado; si no, se envía el punto sin `tramo` y la vía como «Calle sin nombre (cerca de {recinto})».

---

### Edge Cases

- **El mismo aviso dos veces**: el mismo teléfono, mismo tipo, a < 150 m en 30 min → 409 «ya reportaste lo mismo aquí hace poco».
- **Muchos avisos**: más de 6 reportes por teléfono en una hora o 40 por IP → 429.
- **Sin señal al enviar desde la hoja del mapa**: si `navigator.onLine` es falso el aviso se guarda en la cola local (`ay_cola_reportes`) y se cierra la hoja, sin mensaje (ver Brechas). El reenvío está en `specs/011-pwa-sin-conexion/`.
- **Tramo fuera del cantón ampliado o con menos de 2 o más de 80 puntos** → 400.
- **Altura ausente o fuera de 1–3 en un aviso de calle** → 400 «indica cuánta agua hay (hasta la vereda, sobre la vereda o no cruces)».
- **Calle sin nombre en OSM**: `via` = «Calle sin nombre (cerca de {recinto más cercano})».
- **Aviso de calle y semáforo**: un aviso de calle (aun verificado) **no** sube el nivel de ningún recinto; solo lo hacen los reportes graves verificados (`vivienda_inundada`, `desborde`, `aislados`). La altura del agua no es un nivel.

### «Calles inundadas cerca» en «Mi lugar» (2026-11-11, pedido del dueño)

1. **Given** avisos de calles con agua a 3 km o menos del lugar, **Then** la ficha empieza **plegada**. La barra dice cuántos avisos hay y a qué distancia está el más cercano. Si alguno dice «no cruces», lo destaca en una etiqueta oscura con su ícono.
2. **Given** la ficha abierta, **Then** cada aviso es una ficha propia, de la más cercana a la más lejana (hasta 10):
   - la altura del agua con el color de la familia del agua y la palabra («hasta la vereda», «sobre la vereda», «no cruces»), nunca con el semáforo;
   - la calle y la distancia («a 282 m»);
   - el estado («aviso de vecinos» o «verificado»), el autor si es del equipo, el recinto y la hora;
   - la descripción, en hasta 3 líneas;
   - en una misma fila, los votos, «Ver foto» y «En el mapa». Los dos últimos son íconos con su nombre accesible.
3. **Given** que no hay avisos, **Then** se ve «No hay avisos de calles inundadas a menos de 3 km», sin plegar.
4. **Given** cualquier caso, **Then** «Avisar de una calle inundada» queda siempre a la vista, fuera de lo plegado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El tipo `calle_inundada` DEBE publicarse al momento (`PUBLICO_YA`) con estado `pendiente`, etiquetado «aviso de vecinos» (`estado.calle_pendiente`), y vencer a las 8 h de creado (`TIPOS["calle_inundada"][2]`).
- **FR-002**: La altura del agua DEBE usar la escala propia de tres valores con referencias de la vereda (`ALTURA` en el servidor, `altura.*` y `app.altura.*` en i18n): 1 hasta el borde de la vereda (< 15 cm), 2 sobre la vereda (tapa media llanta de moto), 3 no cruces (> 40 cm o con corriente). No DEBE copiar escalas de otras apps.
- **FR-003**: En un aviso de calle la altura DEBE ser obligatoria y la gravedad DEBE derivarse de ella (1→1, 2→2, 3→3).
- **FR-004**: `tramoCercano(lat, lon, maxDist = 70, medio = 120)` DEBE proyectar el toque sobre el segmento de vía más cercano de `calles.geojson` y devolver `{nombre, clase, coords: [[lat, lon]…] (6 decimales), punto: [lat, lon], dist}` con hasta 120 m a cada lado siguiendo la geometría, o `null` si la vía más cercana está a más de `maxDist`.
- **FR-005**: El servidor DEBE validar el tramo (`validar_tramo`): lista de 2 a 80 pares `[lat, lon]` dentro de `T.bbox`, redondeados a 6 decimales; `via` se recorta a 120 caracteres.
- **FR-006**: Todo aviso DEBE exigir `consentimiento: true`, un `dispositivo` válido (`[A-Za-z0-9_-]{8,64}`) y una ubicación dentro de `T.bbox`; el consentimiento se recuerda en el teléfono (`ay_consent_ok`) y la casilla se oculta después.
- **FR-007**: Los límites (6 por hora y teléfono, 40 por hora e IP, 20 fotos por día e IP, deduplicación de 150 m / 30 min) DEBEN comprobarse y el aviso guardarse bajo el mismo candado (`_db_lock`).
- **FR-008**: `GET /api/reportes` DEBE devolver los avisos de calle pendientes y vigentes, los reportes verificados y vigentes, y todos los del propio teléfono (cabecera `X-Dispositivo`), con los verificados primero, hasta 400.
- **FR-009**: En el mapa, los avisos de calle DEBEN dibujarse en el *pane* `agua` (canvas), por encima de ríos y tramos, con la familia de azules y grosor por altura, discontinuos si no están verificados y con halo negro si lo están (ver `specs/003-mapa-interactivo/`).
- **FR-010**: Los vecinos DEBEN poder votar «sigue» o «ya no» una vez por teléfono y aviso (`confirmaciones`, PK `(reporte_id, dispositivo)`, el voto se puede cambiar), con un máximo de 30 votos por IP y hora.
- **FR-011**: Un aviso **pendiente** DEBE cerrarse solo (`resuelto`) cuando al menos 3 conexiones distintas votaron «ya no» y los «ya no» superan el doble de los «sigue». Un aviso **verificado** no se cierra por votos.
- **FR-012**: Quien creó un aviso de calle DEBE poder cerrarlo con «ya no»; no DEBE poder votar «sigue» en el suyo; en reportes de otros tipos su voto se rechaza (lo cierra el analista).
- **FR-013**: Los avisos y sus votos DEBEN poder abrirse desde el mapa, «Mi lugar» (≤ 3 km) y el muro, con los mismos botones (`botonesVoto`).
- **FR-014**: La IP de avisos y votos DEBE borrarse a las 48 h (hilo `mantenimiento`).
- **FR-015**: Todos los textos de esta funcionalidad DEBEN salir de i18n (`app.modo.calle`, `app.calle.*`, `app.altura.*`, `app.alturas.etq`, `app.consent.calle`, `app.voto.*`, `app.val.*`, `app.toast.calle_ok`, `app.toast.bajo`, `app.toast.gracias`…), en es y en.

### Key Entities

- **Aviso de calle**: fila de `reportes` con `tipo = 'calle_inundada'`, `altura_agua` 1–3, `via`, `tramo` (JSON), `expira` = creado + 8 h, contadores `sigue` / `ya_no`.
- **Confirmación**: voto de un teléfono sobre un aviso (`sigue` 1/0), con la IP para limitar abusos.
- **Tramo**: polilínea de hasta ~240 m sobre la vía OSM más cercana al toque.

Ver `data-model.md` y `contracts/api.md`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde el mapa a zoom ≥ 15, un aviso de calle se envía en 4 toques con el consentimiento ya dado (botón, calle, altura, enviar) o 5 la primera vez.
- **SC-002**: El aviso es visible para otros vecinos en su siguiente carga de `/api/reportes` (al abrir el mapa, en un voto o en el refresco de 5 minutos).
- **SC-003**: Ningún aviso pendiente se cierra con votos de menos de 3 conexiones distintas.
- **SC-004**: Ningún aviso verificado se cierra por votos de vecinos.
- **SC-005**: El 100 % de los avisos de calle desaparece de la vista pública a las 8 h de creado.

## Assumptions

- Las vías de OSM (`calles.geojson`, 1207 tramos, 316 con nombre) cubren las calles de la cabecera y los caminos de los recintos.
- Una IP compartida (por ejemplo, la de una operadora móvil o de Cloudflare si no se configura `CF-Connecting-IP`) cuenta como una sola conexión para cerrar avisos; ver `docs/seguridad.md`.
- 8 h es la vigencia adecuada para el agua en una calle tras una lluvia o un desborde.
- La foto y el detalle solo se piden en el asistente; la hoja del mapa busca rapidez.

## Brechas conocidas

1. **El autor puede cerrar su aviso verificado.** En `confirmar_reporte`, si el teléfono es el autor y el tipo es calle, el aviso pasa a `resuelto` sin comprobar que esté `pendiente`. Contradice el principio VI («Lo verificado por el analista solo lo cambia el analista») y `docs/seguridad.md` («Quien lo creó solo cierra sus avisos de calle», que no aclara este caso).
2. **La regla de cierre no es la que dice el comentario.** El código dice «tres vecinos dicen "ya no" y nadie "sigue" en la última hora», pero no hay ventana de tiempo y la condición real es `ya_no > 2 × sigue` con ≥ 3 conexiones distintas.
3. **«Un voto por conexión» solo vale para el umbral.** Los contadores `sigue`/`ya_no` que se muestran y la proporción 2:1 cuentan teléfonos, no conexiones: varios teléfonos en una misma red inflan los números visibles y la proporción.
4. **Se puede votar un aviso vencido.** `confirmar_reporte` no mira `expira`.
5. **El autor sigue viendo sus avisos vencidos como activos.** `listar_reportes` devuelve todos los del propio teléfono y el cliente (mapa y «Mi lugar») solo filtra por `estado`, no por `expira`; el texto `app.rep.altura.nota` dice que «se borra solo a las 8 horas».
6. **Sin aviso al encolar desde la hoja del mapa.** En `#hoja-enviar`, si no hay señal se encola y se cierra la hoja sin ningún mensaje (el asistente sí muestra «Sin conexión: el reporte se enviará cuando vuelva la señal.»).
7. **El servidor no exige que el aviso esté sobre una calle.** Desde el asistente puede llegar sin `tramo` (solo un punto) y el servidor lo acepta; tampoco comprueba que el tramo esté sobre una vía.
8. **Errores del servidor sin traducir.** Los 400/409/429 se muestran tal cual en español en el aviso.
9. **Entrada malformada da 500.** Un `tramo` con valores no numéricos (`float()` sin capturar) o una foto con base64 mal formado responden `500 error interno` en vez de 400.
10. **Los votos «sigue» no alargan la vigencia.** El aviso vence a las 8 h aunque los vecinos confirmen que sigue el agua. [NEEDS CLARIFICATION: ¿debe un voto «sigue» extender `expira`?]
11. **Documentación con otra escala.** `DESIGN.md` («a1 al tobillo, a2 a la rodilla, a3 no se puede pasar») y la skill `cartografia-riesgo` («tobillo, rodilla, no se puede pasar») describen una escala anterior, mientras la interfaz y la API usan la escala propia de la vereda. Hay que alinear esos documentos.
12. **SQL armado con f-string.** `listar_reportes` arma `tipo IN (…)` con una f-string desde la constante `PUBLICO_YA`; no entra dato del usuario, pero se aparta de «Todo SQL usa parámetros».
