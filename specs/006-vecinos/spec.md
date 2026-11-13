# Feature Specification: Vecinos — publicaciones, me gusta y compartir

**Feature Branch**: `006-vecinos`

**Created**: 2026-11-09

**Status**: Implementado

**Input**: Pedido del dueño: convertir la lista de reportes en un «muro» de vecinos (pestaña «Vecinos»), donde se vean como publicaciones mis reportes y los de la gente cerca, con buscador, filtros, «me gusta», fotos y botones para compartir en Facebook y WhatsApp con vista previa.

> Documentación «as-built» de `cliente/app.js` (sección «MURO»), `cliente/index.html` (`#v-muro`, `#visor`) y `api/servidor.py` (`listar_reportes`, `me_gusta_reporte`, `visible_para`, `pagina_compartida`). En el código la pestaña se sigue llamando `muro` (`#v-muro`, `#muro/<id>`, `filtroMuro`); en la interfaz se llama «Vecinos» (`app.sec.muro`).
>
> Relacionado: cómo se crea un reporte (spec 004), los votos «sigue / ya pasó» de las calles (spec 005), el mapa (spec 003).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver lo que avisan los vecinos cerca de mí (Priority: P1)

Una vecina abre «Vecinos» y ve, como publicaciones, los reportes de su zona: qué pasa, dónde, hace cuánto, a qué distancia de su lugar, si está verificado por el analista o es un «aviso de vecinos», la nota del analista y la foto si la hay.

**Why this priority**: es lo que da sentido a reportar: ver que otros vecinos también avisan y qué está confirmado.

**Independent Test**: con «Mi lugar» fijado en un recinto y al menos un reporte verificado a menos de 5 km y otro a más de 5 km, abrir «Vecinos» con el filtro «Cerca de ti»: solo aparece el cercano, con «a X m» o «a X km».

**Acceptance Scenarios**:

1. **Given** el filtro «Cerca de ti» y un lugar elegido, **When** se pinta el muro (`pintarMuro`), **Then** solo se muestran los reportes a ≤ 5 km (`CERCA_M = 5000`) del centro del lugar (`centroLugar()`: el recinto de «Mi lugar» o el punto GPS/calle).
2. **Given** el filtro «Cerca de ti» y ningún lugar elegido, **When** se pinta el muro, **Then** se muestran todos y la cuenta dice «Elige tu lugar en «Mi lugar» para ver lo que pasa cerca. Mientras, ves todos.».
3. **Given** cualquier publicación, **When** se pinta, **Then** muestra: quién («Tú» o «Un vecino», sin nombres), recinto, hace cuánto (`hace()`), distancia, estado («verificado», «en revisión», «aviso de vecinos», «resuelto», «descartado»), título (tipo; en calles, «vía · altura»), descripción, nota del analista, votos de calle y número de «me gusta».
4. **Given** reportes verificados y avisos de vecinos, **When** llega la lista, **Then** los verificados van primero y, dentro de cada grupo, los más recientes primero (orden de la API).
5. **Given** un reporte propio `pendiente` que no es calle, **When** se pinta, **Then** muestra «Solo tú lo ves hasta que el analista lo revise.».

---

### User Story 2 - Filtrar y buscar (Priority: P1)

El muro tiene tres filtros (Cerca de ti, Míos, Todos) y un buscador por calle, recinto o tipo.

**Why this priority**: en plena lluvia puede haber cientos de reportes; hay que encontrar la calle propia rápido.

**Independent Test**: escribir «escuela» (o parte del nombre de una calle sin tilde) en el buscador y comprobar que solo quedan las publicaciones cuyo título, tipo, vía, recinto, descripción o nota del analista lo contienen.

**Acceptance Scenarios**:

1. **Given** el filtro «Míos», **When** se pinta, **Then** solo aparecen los reportes con `mio: true`, en cualquier estado (incluido «descartado»).
2. **Given** el filtro «Todos», **When** se pinta, **Then** aparecen todos los que devolvió la API, menos los descartados de otros (que la API tampoco envía).
3. **Given** un texto en el buscador, **When** se escribe, **Then** se filtra 150 ms después de la última tecla, sin distinguir mayúsculas ni tildes (`normalizar()` con NFD), sobre título, tipo, vía, recinto, descripción y nota del analista.
4. **Given** que no hay resultados, **When** se pinta, **Then** aparece el mensaje del caso: «Nada coincide con «…»», «No hay reportes a menos de 5 km de tu lugar», «Todavía no has enviado reportes» o «Todavía no hay reportes publicados».
5. **Given** un filtro elegido, **When** se vuelve a abrir la app, **Then** se conserva (`ay_muro_filtro`; por defecto «cerca»).

---

### User Story 3 - Dar «me gusta» (Priority: P2)

Cualquier vecino puede marcar «me gusta» en una publicación (y quitarlo), sin cuenta: un voto por teléfono.

**Why this priority**: es una señal social liviana de que otros vieron lo mismo; no cambia el nivel ni la verificación.

**Independent Test**: tocar «Me gusta» en una publicación: el corazón se rellena y la cuenta sube al momento; recargar la app: sigue marcado; tocar otra vez: se quita.

**Acceptance Scenarios**:

1. **Given** una publicación, **When** se toca «Me gusta», **Then** el cliente actualiza al instante (`aria-pressed`, cuenta ± 1) y envía `POST /api/reportes/{id}/megusta`; al responder usa los valores de la API (`likes`, `me_gusta`).
2. **Given** que la API falla, **When** responde con error, **Then** se deshace el cambio local y se muestra el mensaje de error.
3. **Given** un teléfono que ya dio «me gusta», **When** lo vuelve a tocar, **Then** se borra su voto (alternar).
4. **Given** 60 «me gusta» nuevos desde la misma IP en una hora, **When** llega otro, **Then** la API responde 429 «demasiados «me gusta» desde esta conexión; espera un rato».
5. **Given** un reporte que ese teléfono no puede ver (p. ej. pendiente de otro), **When** intenta darle «me gusta», **Then** la API responde 404.

---

### User Story 4 - Ver la foto en grande (Priority: P2)

Las publicaciones con foto la muestran recortada 4:3; al tocarla se abre un visor a pantalla casi completa.

**Why this priority**: la foto es la prueba visual; en un teléfono pequeño hay que poder verla entera.

**Independent Test**: tocar la foto de un reporte verificado: se abre `<dialog id="visor">` con la imagen completa (`object-contain`) y el título; se cierra con la X, tocando fuera o con Escape.

**Acceptance Scenarios**:

1. **Given** un reporte con `foto: true`, **When** se pinta, **Then** la imagen se carga diferida (`loading="lazy"`) desde `/api/foto/{id}?dispositivo=<id del teléfono>`.
2. **Given** la foto, **When** se toca, **Then** `verFoto()` abre el visor con `showModal()`, título del reporte y `alt` traducido.
3. **Given** el visor abierto, **When** se toca el fondo oscuro o el botón cerrar, **Then** se cierra.
4. **Given** un reporte de otra persona sin verificar, **When** se pinta, **Then** no hay foto (la API manda `foto: false` y `/api/foto` respondería 404).

---

### User Story 5 - Compartir una publicación (Priority: P2)

Desde cada publicación se puede compartir en Facebook, WhatsApp, copiar el enlace o usar el menú del sistema. El enlace `/r/<id>` muestra una vista previa (Open Graph) y abre la publicación dentro de la app.

**Why this priority**: en Yaguachi la información de inundaciones circula por WhatsApp y Facebook; el enlace lleva a la gente a la app.

**Independent Test**: tocar «Compartir» → «Copiar enlace» en un reporte verificado; pegar el enlace en el depurador de Facebook (o abrirlo): la página `/r/<id>` trae `og:title`, `og:description`, `og:image` (la foto) y redirige a `/#muro/<id>`, donde la publicación aparece resaltada.

**Acceptance Scenarios**:

1. **Given** una publicación, **When** se toca «Compartir», **Then** se despliega una fila con Facebook (`facebook.com/sharer/sharer.php?u=`), WhatsApp (`wa.me/?text=` con el texto «{título} en {lugar} · Yaguachi Weather (aviso de vecinos, no oficial)» y el enlace), «Copiar enlace» y, si el navegador tiene `navigator.share`, «Más».
2. **Given** «Copiar enlace», **When** el portapapeles no está permitido, **Then** el enlace se muestra en un toast durante 9 s para copiarlo a mano.
3. **Given** un reporte público (verificado o calle pendiente), **When** alguien abre `/r/<id>`, **Then** la API devuelve una página HTML con título «{tipo}[: vía] · {recinto}», descripción (altura, texto, «Verificado por el analista.» o «Aviso de vecinos, sin verificar.» y la nota de que no es oficial), imagen (la foto solo si está verificado; si no, `icono-512.png`) y `meta refresh` a `/#muro/<id>`.
4. **Given** un reporte que no es público (pendiente de otro tipo, descartado, resuelto o inexistente), **When** alguien abre `/r/<id>`, **Then** la página es genérica («Yaguachi Weather», «Reportes de vecinos… No es un canal oficial.») y redirige a `/#muro`.
5. **Given** `URL_PUBLICA` definida en el servicio `api`, **When** se arma la página, **Then** `og:url` y `og:image` usan esa base; si no, `http://<Host>`.
6. **Given** la app abierta desde `/#muro/<id>` (enlace compartido), **When** arranca (`iniciar()`), **Then** abre «Vecinos» con el filtro «Todos» (sin guardarlo) y resalta y centra esa publicación (`postDestacado`, clase `destacado`).

---

### User Story 6 - Ir del muro al mapa (Priority: P3)

Cada publicación tiene «Mapa», que abre la pestaña «Mapa» en el punto (zoom 17) con su hoja de información.

**Why this priority**: ubicar el problema en el mapa de la zona.

**Independent Test**: tocar «Mapa» en una calle inundada: el mapa se centra en ella y abre la hoja «calle».

**Acceptance Scenarios**:

1. **Given** una publicación, **When** se toca «Mapa», **Then** `irA("mapa")`, `irAlPunto([lat, lon], 17)` y, al terminar el movimiento, `abrirInfo({tipo: "calle" | "reporte", r})`.

### Edge Cases

- **Sin conexión**: `cargarMuro()` ignora el error y pinta lo último que tenga en memoria; el service worker devuelve la última respuesta guardada de `/api/reportes`. «Me gusta» falla y se deshace.
- **Reporte compartido que este teléfono no ve** (p. ej. ya vencido): el muro abre en «Todos» y no hay nada que resaltar; no hay mensaje.
- **Enlace `#muro/<id>` con la app ya abierta** (cambio de `hash`): solo cambia a la pestaña «Vecinos» si no estaba activa; no resalta la publicación.
- **Más de 400 reportes**: la API corta en 400 (verificados primero), así que reportes propios antiguos pueden no llegar.
- **Cambio de idioma**: el muro se repinta con los textos del nuevo idioma; los textos del vecino y del analista no se traducen.
- **Descripción con saltos de línea**: se respetan (`whitespace-pre-line`); todo texto del vecino pasa por `esc()`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La pestaña «Vecinos» (`#v-muro`) MUST cargar la lista con `GET /api/reportes` (cabecera `X-Dispositivo`) cada vez que se abre (`irA("muro")` → `cargarMuro()`), y también después de enviar un reporte o confirmar una calle.
- **FR-002**: La API MUST devolver a cada teléfono solo: reportes `validado` vigentes, `calle_inundada` `pendiente` vigentes y los propios en cualquier estado; ordenados con lo verificado primero y luego por fecha descendente; máximo 400 (`listar_reportes`).
- **FR-003**: El muro MUST ofrecer tres filtros excluyentes (`role=radiogroup`): «Cerca de ti» (≤ 5 km del lugar elegido; todos si no hay lugar), «Míos» y «Todos»; el filtro se guarda en `ay_muro_filtro`.
- **FR-004**: El buscador MUST filtrar en el cliente, sin tildes ni mayúsculas, sobre título, tipo, vía, recinto, descripción y nota del analista, con una espera de 150 ms.
- **FR-005**: Cada publicación MUST mostrar autor anónimo («Tú» / «Un vecino»), recinto, tiempo relativo, distancia al lugar elegido, etiqueta de estado, título, descripción, nota del analista, aviso de «en revisión» para lo propio sin verificar, botones de voto de calle (spec 005) y tres acciones: Me gusta, Mapa, Compartir.
- **FR-006**: «Me gusta» MUST ser un voto por teléfono y reporte (`me_gusta` con clave `(reporte_id, dispositivo)`), alternable, con actualización optimista y reversión si falla.
- **FR-007**: La API MUST rechazar con 429 más de 60 «me gusta» nuevos por IP y hora, y con 404 los «me gusta» a reportes que ese teléfono no puede ver (`visible_para`).
- **FR-008**: La foto MUST mostrarse solo si la API marca `foto: true` (verificado o propio) y abrirse en el visor `<dialog id="visor">` con cierre por botón, fondo y Escape.
- **FR-009**: «Compartir» MUST ofrecer Facebook, WhatsApp, copiar enlace y, si existe, `navigator.share`; el enlace compartido es `{origen}/r/{id}`.
- **FR-010**: `GET /r/{id}` MUST devolver HTML con Open Graph (`og:type`, `og:site_name`, `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card`) y redirigir a `/#muro/{id}`; solo con datos del reporte si es público, y la foto solo si está verificado. Todo valor va escapado con `html.escape`.
- **FR-011**: La base de los enlaces de la página compartida MUST salir de `URL_PUBLICA` si está definida (no de la cabecera `Host`).
- **FR-012**: Al abrir la app con `#muro/<id>` (12 hex), MUST abrirse «Vecinos» en «Todos» con esa publicación resaltada y centrada.
- **FR-013**: Todos los textos del muro MUST salir de `I18N` (`app.muro.*`, `estado.*`, `tipo.*`) en `es` y `en`.

### Key Entities

- **Publicación**: la vista de un reporte en el muro (`reporte_publico` + `likes` + `me_gusta` + `mio`). No es una tabla aparte.
- **Me gusta**: voto de un teléfono a un reporte (tabla `me_gusta`). Ver `data-model.md`.
- **Enlace compartido**: `/r/<id>`, página HTML efímera generada por la API; no se guarda.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ningún reporte `pendiente` que no sea calle, `descartado` o `resuelto` de otro teléfono aparece en el muro ni en `/r/<id>` (0 filtraciones en una prueba con dos teléfonos).
- **SC-002**: Con «Cerca de ti», el 100 % de las publicaciones mostradas está a ≤ 5 km del lugar elegido.
- **SC-003**: Tocar «Me gusta» cambia el botón en menos de 100 ms (antes de la respuesta de la API).
- **SC-004**: Un enlace `/r/<id>` de un reporte verificado con foto muestra la foto en la vista previa de Facebook/WhatsApp cuando `URL_PUBLICA` apunta al dominio público con HTTPS.
- **SC-005**: El muro funciona a 360 px sin desplazamiento horizontal, con acciones de 48 px de alto.

## Assumptions

- No hay cuentas ni nombres: la única identidad visible es «Tú» frente a «Un vecino».
- «Me gusta» no influye en el nivel, en el orden ni en la verificación.
- Facebook y WhatsApp son los canales de difusión del cantón; sus nombres son marcas y no se traducen.
- Los rastreadores de Facebook y WhatsApp leen el HTML de `/r/<id>` sin ejecutar JavaScript.

## Brechas conocidas

1. **`og:image` relativo a la raíz.** La imagen por defecto es `{base}/icono-512.png`: en Docker la sirve el cliente nginx, pero en desarrollo sin `--estaticos` la API respondería 404.
2. **`/r/<id>` y «me gusta» no miran `expira`.** Un reporte verificado ya vencido sigue dando vista previa con foto en `/r/<id>` y sigue aceptando «me gusta» (`visible_para` y `pagina_compartida` solo miran el estado), aunque ya no sale en el muro de otros.
3. **El límite de «me gusta» se puede rodear alternando.** El tope cuenta filas de la última hora; quitar un «me gusta» borra su fila, así que dar y quitar sin parar no llega nunca al tope.
4. **Compartir lo que no es público.** Los botones de compartir están en todas las publicaciones, incluidas las propias en revisión o descartadas; su enlace muestra la página genérica sin avisar al vecino. [NEEDS CLARIFICATION: ¿ocultar «Compartir» en lo que no es público?]
5. **Página `/r/<id>` solo en español.** Título y descripción de Open Graph se arman en el servidor en español; no hay versión en inglés.
6. **El id del teléfono en la URL de la foto** (`/api/foto/{id}?dispositivo=`): queda en registros de proxies. Ya anotado como pendiente en `docs/seguridad.md`.
7. **El enlace se arma con `location.origin`**, no con `URL_PUBLICA`: si alguien comparte desde `http://IP:8090`, el enlace apunta a esa IP.
8. **Enlace profundo con la app abierta**: `hashchange` a `#muro/<id>` no resalta la publicación, y `irA()` reescribe el hash a `#muro` (se pierde el id).
9. **`DESIGN.md` dice «4 pestañas»** en la barra inferior; hay 5 (Inicio, Mapa, Vecinos, Reportar, Avisos).
