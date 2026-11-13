# Feature Specification: Semáforo de «Mi lugar»

**Feature Branch**: `002-semaforo-mi-lugar`

**Created**: 2026-11-09

**Status**: Implementado

**Input**: Pedido del dueño: que la primera pantalla diga, para el recinto, la calle o el punto GPS de la persona, en qué nivel del semáforo cantonal está, por qué, de dónde sale ese nivel y qué hacer ahora.

> Documentación *as-built*: describe lo que hace hoy el código de `api/servidor.py` (cálculo del nivel y rutas `/api/estado`, `/api/recinto`, `/api/lugar`, `/api/territorio`) y de `cliente/app.js` (sección «MI LUGAR»: `pintarLugar`, `cargarLugar`, `nivelEfectivo`, `banda`). Lo que el código no cumple está en «Brechas conocidas».

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el nivel de mi recinto y qué hacer (Priority: P1)

Una vecina escribe su recinto (o una cabecera) en el buscador de «Mi lugar» y ve, sin desplazarse, la ficha del nivel (NORMAL, VIGILANCIA, PREPARACIÓN o RESPUESTA, con el nombre escrito y el color del semáforo), el motivo en palabras llanas, si el nivel es una estimación automática o lo verificó el analista, y la lista «Qué hacer ahora» de ese nivel.

**Why this priority**: es la razón de ser de la app (principio «nivel y acción primero»). Sin esto, nada más tiene sentido.

**Independent Test**: con la API levantada, abrir `/`, escribir «Virgen de Fátima» en el buscador y elegir la opción; la ficha del nivel, el motivo, el sello y las acciones deben aparecer en la primera pantalla a 360 px.

**Acceptance Scenarios**:

1. **Given** que no hay lugar guardado, **When** abro la app, **Then** veo el bloque «¿Dónde vives?» (`#sin-lugar`) con la guía de los cuatro niveles y el buscador.
2. **Given** el buscador de «Mi lugar», **When** escribo un texto que coincide (exacto o como parte) con un recinto, cabecera o calle de la lista y confirmo, **Then** la app pide `/api/recinto?id=` (recinto) o `/api/lugar?lat=&lon=&nombre=` (calle) y pinta la ficha del nivel, el nombre del lugar y su subtítulo («Recinto · {parroquia}», la etiqueta de la cabecera o «parroquia · cerca de {recinto}»).
3. **Given** un recinto sin nivel verificado, **When** se pinta la ficha, **Then** el sello dice «Estimación automática · no es alerta oficial» y el motivo es la versión «de vecino» de los motivos estructurados (`I18N.motivo(r, {vecino: true})`).
4. **Given** que el analista fijó un nivel verificado que aplica al lugar, **When** se pinta la ficha, **Then** se muestra ese nivel con el sello «Verificado por el equipo de riesgo», la hora en que se fijó, el motivo escrito por el analista, «Nivel fijado para {ámbito}» y, si la estimación automática es distinta, «La estimación automática dice {nivel}; manda el nivel verificado».
5. **Given** cualquier nivel n, **When** se pinta la ficha, **Then** «Qué hacer ahora» lista las acciones `acciones.{n}` del idioma activo (4 en VIGILANCIA, PREPARACIÓN y RESPUESTA; 3 en NORMAL) y el botón «Llamar al ECU 911» está en el mismo mosaico. Desde 2026-11-11, por pedido del dueño, la ficha empieza **plegada** en todos los niveles: muestra el título y «Ver N pasos», y la lista se abre al tocarla. Al cambiar de nivel vuelve a plegarse.
6. **Given** un texto que no coincide con nada, **When** confirmo la búsqueda, **Then** aparece el aviso «No encontramos ese lugar…».

---

### User Story 2 - Ver el nivel donde estoy con el GPS (Priority: P1)

Un vecino toca el botón de ubicación del buscador; la app toma su posición, busca la calle OSM más cercana (≤ 60 m) para nombrar el lugar y le muestra el nivel de ese punto con el mismo detalle que un recinto.

**Why this priority**: muchas personas no saben el nombre oficial de su recinto o están fuera de casa.

**Independent Test**: en Chrome con HTTPS o `localhost`, simular una ubicación dentro del cantón y tocar el botón de ubicación; debe aparecer la ficha con «Tu ubicación» en el subtítulo.

**Acceptance Scenarios**:

1. **Given** que el navegador da la ubicación, **When** toco el botón GPS (`#btn-gps`), **Then** se llama `tramoCercano(lat, lon, 60)` y se carga `/api/lugar` con el nombre de la calle encontrada o «Tu ubicación».
2. **Given** un punto a ≤ 1,5 km de su recinto más cercano y ese recinto tiene nivel verificado, **When** se calcula el lugar, **Then** el nivel verificado del recinto se aplica al punto (`estado_lugar`: `rid_of`).
3. **Given** un punto fuera del rectángulo del cantón ampliado (`T.bbox`), **When** se pide `/api/lugar`, **Then** la API responde 400 «la ubicación está fuera del cantón Yaguachi» y la app lo muestra en un aviso.
4. **Given** que el permiso de ubicación se niega o no hay HTTPS, **When** toco el botón, **Then** aparece «No se pudo obtener tu ubicación. Revisa el permiso de ubicación (en el celular necesita HTTPS).».

---

### User Story 3 - Entender de dónde sale el nivel (Priority: P2)

Debajo de la ficha, la persona ve los datos que lo explican: lluvia de las próximas 24 h y de 3 días, distancia al río, curva de lluvia de 6 días con los umbrales del plan, el río más cercano con su nivel, el medidor de caudal frente a P90/Q2/Q5 (modelo GloFAS) y la última lectura de la regla (medido), lugares cercanos y reportes cercanos.

**Why this priority**: la honestidad del nivel (principio II) exige decir si es modelo, medida o verificación; además da confianza a quien decide salir o no.

**Independent Test**: elegir un recinto a menos de 1,5 km del Río Yaguachi; la ficha del río debe mostrar placa de nivel, «estimado» o «verificado», el medidor con la nota «Modelo GloFAS, no medición» y, si hay lectura de regla de las últimas 12 h, «Regla P0x: … Medido.».

**Acceptance Scenarios**:

1. **Given** datos de lluvia, **When** se pinta el lugar, **Then** la ficha muestra «Lluvia próx. 24 h», «Lluvia 3 días» y «Al río», y la curva de 6 días con escala fija de 0 a 120 mm y líneas en 50 y 100 mm, con la nota «modelo, no medición».
2. **Given** un lugar a más de 1,5 km del cauce, **When** se pinta el río, **Then** aparece «Este lugar está a más de 1,5 km del cauce: el nivel del río no se aplica directo aquí.».
3. **Given** un río sin punto GloFAS (p. ej. Río Culebras), **When** se pinta, **Then** aparece «Este cauce no tiene punto GloFAS…».
4. **Given** aguaje vigente y un río Yaguachi o Babahoyo, **When** se pinta, **Then** aparece «En pleamar con aguaje: {nivel}» con el nivel subido en uno (tope RESPUESTA).
5. **Given** advertencia del INAMHI o aguaje vigentes, **When** se pinta «Mi lugar», **Then** salen los banners correspondientes encima del buscador.
6. **Given** reportes cercanos, **When** se pinta el lugar, **Then** «Calles inundadas cerca» lista hasta 10 avisos de calle (pendientes o verificados) a ≤ 3 km y «Otros reportes cerca» hasta 8 reportes verificados a ≤ 3 km.
7. **Given** equipamientos en `equipamientos.geojson`, **When** se pinta, **Then** «Cerca de ti» lista los 3 más cercanos con categoría y distancia, más la nota de albergues y, si el recinto más cercano está a ≤ 1 km, su prioridad y riesgo base del plan.

---

### User Story 4 - Seguir viendo mi nivel sin señal y en mi idioma (Priority: P2)

La app recuerda el lugar elegido, refresca el nivel cada 5 minutos y, sin conexión, muestra lo último guardado con la hora. Al cambiar el idioma, motivos, acciones y rótulos se vuelven a pintar en inglés o español.

**Why this priority**: principio I (mala señal) y IV (i18n).

**Independent Test**: elegir un lugar, recargar (debe volver solo), pasar a modo avión y recargar: debe verse el último nivel guardado; cambiar a English: motivos y acciones en inglés.

**Acceptance Scenarios**:

1. **Given** un lugar elegido, **When** vuelvo a abrir la app, **Then** se carga solo desde `localStorage` (`ay_lugar`).
2. **Given** la app abierta, **When** pasan 5 minutos, **Then** se vuelven a pedir `/api/estado`, el lugar, los avisos y las capas del mapa.
3. **Given** que falla la petición del lugar, **When** hay un detalle guardado (`ay_ultimo_lugar_det`), **Then** se pinta ese detalle y un aviso «Sin conexión: datos guardados de {hora}».
4. **Given** el idioma cambia, **When** llega el evento `idioma`, **Then** se repinta el lugar con `I18N.motivo`, `acciones.{n}` y `nivel.{n}` del idioma nuevo; los nombres de lugares, ríos y el motivo escrito por el analista no se traducen.

---

### Edge Cases

- **Sin datos de modelo**: si GloFAS y la lluvia no llegan (sin internet y sin caché), `evaluar_punto` devuelve `sugerido = 1` con el motivo `ninguno` («no hay señales de peligro por ahora»). La ficha dice NORMAL, no «Sin dato». Ver Brechas.
- **Nivel verificado retirado**: el analista puede guardar `nivel_cod = NULL`; `oficiales()` ignora ese registro y vuelve a mandar el siguiente ámbito o la estimación.
- **Lugar guardado de una versión anterior** (`ay_recinto` con solo el id): `iniciar()` lo convierte a `{tipo: "recinto", id}`.
- **Nombre guardado como «Tu ubicación · Calle X»** (formato viejo): `pintarLugar` lo muestra como «Calle X» con «Tu ubicación» en el subtítulo.
- **Recinto inexistente**: `/api/recinto?id=999` responde 404 «recinto no encontrado».
- **Coordenadas sin `lat`/`lon` o no numéricas**: `/api/lugar` responde 400 «faltan lat y lon».
- **Caché del estado**: `/api/estado` se recalcula como máximo cada 120 s; un cambio del analista llama `invalidar_estado()` y se ve en la siguiente petición.
- **Sin conexión al primer arranque** (sin `ay_territorio`): la app muestra «No hay conexión con el servidor.» y no arma el buscador.

## Requirements *(mandatory)*

### Functional Requirements

**Cálculo del nivel (servidor, `api/servidor.py`)**

- **FR-001**: El sistema DEBE usar cuatro niveles fijos: 1 NORMAL `#1a9641`, 2 VIGILANCIA `#ffd92f`, 3 PREPARACIÓN `#fd8d3c`, 4 RESPUESTA `#d7191c` (`NIVELES`, `COLORES`).
- **FR-002**: Para cada punto de control P01–P09 el sistema DEBE calcular el nivel GloFAS (`nivel_glofas`) con el caudal de hoy (miembro de control o, si falta, la mediana de los 51 escenarios) y las probabilidades de superar Q2 y Q5 en 3 y 30 días: RESPUESTA si caudal > Q5 o P(>Q5, 3 d) ≥ 50 %; PREPARACIÓN si caudal > Q2, P(>Q2, 30 d) ≥ 50 % o P(>Q5, 30 d) ≥ 20 %; VIGILANCIA si caudal > P90 o P(>Q2, 30 d) ≥ 20 %; si no, NORMAL. Sin datos, pronóstico vencido o sin caudal de hoy, el nivel es `None` con el motivo `glofas.sin_datos`, `glofas.vencido` o `glofas.sin_caudal`.
- **FR-003**: Para cada punto con lectura de regla de las últimas 12 h el sistema DEBE calcular el nivel medido (`nivel_regla`): por distancia al borde de desborde (≤ 0,5 m RESPUESTA, ≤ 1 m PREPARACIÓN, ≤ 2 m VIGILANCIA, más NORMAL), al menos VIGILANCIA si subió ≥ 1 m en 24 h y al menos PREPARACIÓN si sube ≥ 0,3 m/h (comparando con la primera lectura de los 70 min anteriores). Sin borde ni subidas no hay nivel medido.
- **FR-004**: El nivel de cada río DEBE ser el máximo de sus puntos, tomando el medido si existe (con la excepción: si GloFAS da RESPUESTA, el medido sube al menos a PREPARACIÓN) y si no el de GloFAS; `fuente_sugerido` es `medido` si algún punto usó la regla. Con advertencia INAMHI vigente el río sube al menos a VIGILANCIA. Con aguaje vigente, los ríos Yaguachi y Babahoyo tienen además `sugerido_pleamar` = nivel + 1 (tope 4).
- **FR-005**: El nivel estimado de un recinto o punto (`evaluar_punto`) DEBE ser el máximo de: VIGILANCIA si hay advertencia INAMHI; el nivel del río más cercano (o su `sugerido_pleamar`) si está a ≤ 1500 m (`DIST_RIO_M`); el nivel por lluvia de su celda de 0,05° (VIGILANCIA si un día de hoy a +2 días ≥ 50 mm; PREPARACIÓN si un día ≥ 100 mm o la suma de esos 3 días ≥ 150 mm, umbrales en `config.json`); y RESPUESTA si hay a ≤ 1,5 km un reporte verificado y vigente de tipo grave (`vivienda_inundada`, `desborde`, `aislados`).
- **FR-006**: El nivel verificado (tabla `niveles_oficiales`, último registro por ámbito) DEBE mandar sobre el estimado en este orden: recinto, parroquia, río (solo si el punto está en su corredor de 1,5 km) y cantón. Para un punto (`/api/lugar`) el ámbito recinto es el del recinto más cercano si está a ≤ 1,5 km.
- **FR-007**: Cada nivel calculado DEBE llevar sus motivos estructurados `motivos: [{k, v, src?, pid?}]` (sin texto en español) además de `motivo` (texto en español, por compatibilidad). Claves usadas: `adv`, `adv_texto`, `rio_cerca`, `lluvia.vig`, `lluvia.prep`, `graves`, `ninguno`, `sin_punto`, `glofas.*`, `regla.*`.
- **FR-008**: `/api/estado` DEBE devolver el estado completo (cantón, advertencia, aguaje, ríos, puntos con GloFAS y regla, recintos y frescura de la lluvia) y cachearlo 120 s en memoria; los datos externos se cachean en la tabla `cache` (lluvia 60 min, GloFAS 360 min) y, si falla la red o está `--offline`, se usa lo último guardado con `desactualizado = true`.
- **FR-009**: `/api/recinto?id=` y `/api/lugar?lat=&lon=&nombre=` DEBEN devolver el mismo formato: `recinto`, `estado` (sugerido, motivos, oficial, oficial_fuente, oficial_motivo, oficial_hora, lluvia), `rio`, `acciones`, `equipamientos` (3 más cercanos), `advertencia`, `aguaje`, `generado`.
- **FR-010**: `/api/territorio` DEBE devolver los recintos (con río cercano, distancia, celda y etiqueta de cabecera), las calles con nombre agrupadas por nombre y recinto cercano para el buscador, los tipos de reporte, gravedades, alturas, acciones, niveles y colores.

**Pantalla «Mi lugar» (cliente, `cliente/app.js`)**

- **FR-011**: El buscador DEBE ofrecer en un `<datalist>` las cabeceras primero, luego los recintos y luego las calles («{calle} · {recinto cercano}»), y aceptar coincidencia exacta o la primera que contenga el texto (`buscarLugar`).
- **FR-012**: La ficha del nivel (`banda`) DEBE mostrar el nombre del nivel escrito, el color del semáforo, el sello de certeza (estimado o verificado con hora), el motivo y una escala de cuatro barras con el nivel activo rotulado; el sello verificado lleva el enlace «No es alerta oficial · ver quién las emite» al aviso `#aviso-oficial`.
- **FR-013**: El nivel efectivo (`nivelEfectivo`) DEBE ser `oficial` si existe y si no `sugerido`.
- **FR-014**: «Qué hacer ahora» DEBE salir de los diccionarios i18n (`acciones.1`…`acciones.4` en `compartido/i18n.js`), no del campo `acciones` de la API.
- **FR-015**: El motivo estimado DEBE traducirse en el cliente con `I18N.motivo(obj, {vecino: true})`: frases llanas (`vecino.*`), sin repetir, con la fuente entre paréntesis («modelo GloFAS», «medido en la regla») cuando el motivo la trae.
- **FR-016**: El aviso «No es un canal oficial» DEBE estar siempre al pie de «Mi lugar».
- **FR-017**: El lugar elegido y su último detalle DEBEN guardarse en `localStorage` (`ay_lugar`, `ay_ultimo_lugar_det`), y el estado y el territorio también (`ay_estado_cache`, `ay_territorio`) para el uso sin señal.
- **FR-018**: La app DEBE refrescar estado, lugar, avisos y capas cada 5 minutos mientras está abierta.
- **FR-019**: La fecha de «Mi lugar» DEBE decir cuándo se generó el estado («actualizado hace…», con `ESTADO.generado`).

### Key Entities

- **Nivel estimado (`sugerido`)**: 1–4, calculado por el servidor; con `motivos` estructurados. Para ríos además `fuente_sugerido` (`modelo` o `medido`) y `sugerido_pleamar`.
- **Nivel verificado (`oficial`)**: fijado por el analista en el panel por ámbito (`canton`/`rio`/`parroquia`/`recinto`), con motivo y hora; se guarda en `niveles_oficiales`. En el código se llama `oficial` por compatibilidad.
- **Recinto**: punto de `recintos.geojson` (71) con parroquia, prioridad, riesgo base, río más cercano, distancia y celda de lluvia.
- **Lugar**: recinto o punto libre (calle del buscador o GPS) que la persona eligió; vive en `localStorage`.
- **Punto de control**: P01–P09 de `puntos_control.geojson` con umbrales P90, Q2 (`t2`), Q5 (`t5`) y la celda GloFAS.
- **Resumen de lluvia**: 6 días (2 pasados, hoy y 3 de pronóstico), índice de hoy, máximo diario y suma de 3 días, próximas y últimas 24 h.

Ver `data-model.md` y `contracts/api.md`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con un lugar guardado, la ficha del nivel, el sello y la primera acción se ven sin desplazarse en una pantalla de 360 × 640 px.
- **SC-002**: Elegir un recinto desde el buscador lleva como máximo 2 toques (escribir/elegir y confirmar).
- **SC-003**: El 100 % de los niveles mostrados en «Mi lugar» lleva su nombre escrito y un sello «estimación automática» o «verificado».
- **SC-004**: Un cambio de nivel verificado en el panel se ve en «Mi lugar» en ≤ 5 minutos con la app abierta (refresco de 5 min; la caché de 120 s se invalida al guardar).
- **SC-005**: Sin conexión, con un lugar visto antes, la app muestra el último nivel guardado y su hora en lugar de una pantalla vacía.
- **SC-006**: Al cambiar a English, el 100 % de los motivos estructurados conocidos y las acciones se muestran en inglés.

## Assumptions

- Los niveles siguen la sección 3.2 del plan de gestión de riesgos de inundación de Yaguachi (octubre de 2026), que no está en el repositorio.
- Lluvia y caudal son modelos (Open-Meteo, GloFAS vía Open-Meteo Flood API), no mediciones; GloFAS trabaja con celdas de unos 5 km, no modela la marea y sobreestima ríos pequeños.
- El corredor de 1,5 km («corredor F de las zonas v3») y el radio de 1,5 km para reportes graves son decisiones del análisis de riesgo del proyecto.
- No hay cuentas: el lugar elegido solo vive en el teléfono.
- Albergues y rutas de evacuación aún no tienen capa; «Cerca de ti» lo dice con una nota.

## Brechas conocidas

1. **«Sin dato» se muestra como NORMAL.** Si no hay GloFAS ni lluvia (sin internet y sin caché), `evaluar_punto` devuelve `sugerido = 1` con el motivo `ninguno` («no hay señales de peligro por ahora») y el cliente usa `ef.n || 1`. El nivel `nivel.0` («Sin dato») existe pero nunca se usa en «Mi lugar». Contradice el principio II (honestidad del nivel).
2. **La frescura de los datos no se muestra.** El servidor calcula `desactualizado` (GloFAS) y `fuentes.lluvia_desactualizada`, pero `cliente/app.js` no los usa; solo se ve «actualizado hace…» del cálculo, no la edad de los datos del modelo.
3. **El origen del nivel de un recinto queda incompleto.** El motivo `rio_cerca` de un recinto no lleva `src`, así que no dice si el nivel heredado del río es modelo o medido; solo lo dice la ficha del río. Además el sello solo distingue «estimado» y «verificado»: los niveles subidos por reportes graves verificados no tienen un sello propio de «reportado por vecinos» (solo el motivo `graves`). [NEEDS CLARIFICATION: ¿debe el sello distinguir modelo, medido y reportes como pide el principio II?]
4. **El medidor del río usa solo el primer punto.** `pintarLugar` muestra el GloFAS y la regla de `rio.puntos[0]`; en ríos con dos puntos (Yaguachi P01/P02, Babahoyo P03/P04, Chimbo P05/P06) el nivel puede venir del segundo y el medidor no lo refleja.
5. **Avisos de un punto GPS o una calle.** `cargarAvisos` solo manda `recinto=` si el lugar es un recinto; para un punto manda vacío y `avisos_para` devuelve los avisos de **todos** los ámbitos, aunque el texto diga «Para {lugar} y todo el cantón». [NEEDS CLARIFICATION: ¿se filtran por el recinto más cercano?]
6. **La ubicación GPS viaja en la URL.** `/api/lugar?lat=&lon=` lleva las coordenadas en la consulta (los registros de la API las omiten, pero el service worker guarda la respuesta con esa URL en la caché). El principio V prohíbe datos personales en la URL. [NEEDS CLARIFICATION: ¿la ubicación cuenta como dato personal a efectos de esa regla?]
7. **`/api/estado` no es «liviano».** El comentario en `_api_get` dice «versión liviana para el ciudadano: sin series largas», pero devuelve todo, incluidas las series de 15 días y las probabilidades de cada punto.
8. **Acciones duplicadas.** `ACCIONES` (solo en español) se envía en `/api/territorio`, `/api/recinto` y `/api/lugar`, pero ni la app ni el panel lo usan; las acciones visibles salen de `compartido/i18n.js`. Si alguien cambia una copia, las dos divergen.
9. **Primer cálculo lento.** `calcular_estado` pide GloFAS de los 9 puntos uno tras otro dentro de `_estado_lock` (hasta 120 s de espera cada uno); con la caché fría y mala red, `/api/estado` y `/api/recinto` pueden tardar minutos.
10. **Lugar sin señal.** `ay_ultimo_lugar_det` guarda un solo detalle: si se cambia de lugar sin conexión se muestra el detalle del lugar anterior (con su propio nombre) y el aviso, mientras `ay_lugar` ya apunta al nuevo.
11. **Errores del servidor sin traducir.** Los mensajes de error de la API (p. ej. «la ubicación está fuera del cantón Yaguachi») se muestran tal cual en español aunque el idioma sea inglés.
