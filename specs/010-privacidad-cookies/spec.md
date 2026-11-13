# Feature Specification: Privacidad y cookies

**Feature Branch**: `010-privacidad-cookies`

**Created**: 2026-11-09

**Status**: Implementado

**Input**: Pedido del dueño: una sección de privacidad y cookies en la app ciudadana que diga qué se guarda en el teléfono y en el servidor, que no hay cookies de seguimiento, qué terceros intervienen y cuánto se conservan los datos, con un aviso de una sola vez y un botón para borrar los datos del teléfono, de acuerdo con la LOPDP (Ecuador).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Aviso de una sola vez (Priority: P1)

La primera vez que alguien abre la app aparece, sobre la barra inferior, un aviso breve: la app no usa cookies de seguimiento ni de publicidad y solo guarda en el teléfono lo necesario (lugar, idioma, lo último descargado). Tiene dos botones: «Entendido» y «Ver la política». No es un banner de consentimiento: no hay nada que aceptar ni rechazar.

**Why this priority**: es la única vez que se informa sin que la persona lo busque; debe ser corto para no tapar el nivel y la acción.

**Independent Test**: en un navegador limpio abrir `/` → aparece `#aviso-cookies`; pulsar «Entendido» → desaparece y `localStorage["ay_aviso_cookies"] = "true"`; recargar → ya no aparece.

**Acceptance Scenarios**:

1. **Given** `ay_aviso_cookies` sin guardar, **When** `iniciar()` termina de cargar el territorio, **Then** se muestra `#aviso-cookies` (salvo que la URL abra directamente `#privacidad`).
2. **Given** el aviso visible, **When** se pulsa «Entendido» (`#cookies-ok`), **Then** se guarda `aviso_cookies = true` y se oculta.
3. **Given** el aviso visible, **When** se pulsa «Ver la política» (`#cookies-ver`, enlace a `#privacidad`), **Then** se abre la vista de privacidad, se guarda `aviso_cookies = true` y se oculta el aviso.
4. **Given** el aviso ya visto, **When** se abre la app, **Then** no vuelve a aparecer hasta que se borren los datos del teléfono.

---

### User Story 2 - Leer la política de privacidad y cookies (Priority: P1)

Desde el pie del aviso «No es un canal oficial» de Inicio (`app.priv.enlace`), desde el paso de confirmación del asistente de reporte o desde el aviso de una sola vez, la persona abre la vista `#privacidad` (`#v-privacidad`) y lee, en lenguaje llano, quién es responsable, qué guarda el teléfono, qué guarda el servidor, qué terceros intervienen, cuánto dura cada dato y qué derechos tiene.

**Why this priority**: la LOPDP exige informar antes de tratar datos; los reportes llevan ubicación, foto e IP.

**Independent Test**: abrir `/#privacidad` → se ve la vista con fecha «Última actualización: 9 de noviembre de 2026» y las secciones Quién es responsable, Cookies, Lo que se guarda en tu teléfono, Uso sin conexión, Servicios de terceros, Tus reportes, Tus derechos y Borrar los datos de este teléfono, en el idioma activo.

**Acceptance Scenarios**:

1. **Given** cualquier vista, **When** cambia el hash a `#privacidad` (enlace, botón Atrás o URL directa), **Then** `irA("privacidad")` muestra `#v-privacidad`, marca el aviso como visto y sube el scroll.
2. **Given** la vista abierta, **When** se lee «Cookies», **Then** dice que la app no crea cookies propias de seguimiento ni de publicidad ni usa analítica de terceros, y que por eso no pide aceptar cookies.
3. **Given** la vista abierta, **When** se lee «Lo que se guarda en tu teléfono», **Then** enumera: id aleatorio del teléfono, lugar e idioma, preferencias del mapa y filtro de Vecinos, reportes por enviar, lo último descargado (niveles, avisos, territorio) y que ya se vio el aviso.
4. **Given** la vista abierta, **When** se lee «Servicios de terceros», **Then** nombra OpenStreetMap y Esri (teselas, reciben la IP), unpkg.com (Leaflet) y Facebook / WhatsApp (solo al tocar Compartir, con sus propias políticas y cookies).
5. **Given** la vista abierta, **When** se lee «Tus reportes», **Then** dice qué se guarda (texto, ubicación, foto, id del teléfono, IP), que la IP se borra a las 48 h, que la foto se borra al descartarse el reporte y a los 90 días, que las fotos de otros solo se publican si el analista verifica el reporte, que no se piden nombre, cédula ni teléfono, y que se hace con consentimiento según la LOPDP.

---

### User Story 3 - Borrar los datos de este teléfono (Priority: P2)

Al final de la política, el botón «Borrar los datos de este teléfono» borra todo lo que la app guardó en el navegador. Pide confirmación con un segundo toque, sin diálogo.

**Why this priority**: es el derecho que la persona puede ejercer sola, sin escribir a nadie.

**Independent Test**: con datos guardados, tocar el botón → cambia a «Toca otra vez para confirmar» (fondo negro); tocar de nuevo antes de 5 s → la app recarga sin hash, sin claves `ay_*` en `localStorage`, sin cachés y sin service worker registrado (que se vuelve a registrar al cargar).

**Acceptance Scenarios**:

1. **Given** el botón en reposo, **When** se toca, **Then** se le agrega la clase `confirmar`, el texto pasa a `app.priv.borrar.confirmar` y a los 5 s vuelve solo a su estado inicial.
2. **Given** el botón en `confirmar`, **When** se toca otra vez, **Then** se borran todas las claves de `localStorage` que empiezan por `ay_`, todas las cachés de `caches` del origen (archivos, API y teselas), se desregistran los service workers y se recarga `location.pathname`.
3. **Given** el borrado hecho, **When** la app arranca, **Then** genera un id de teléfono nuevo, vuelve al idioma del navegador y muestra de nuevo el aviso de una sola vez; los reportes enviados siguen en el servidor pero ya no aparecen como «míos».

---

### User Story 4 - Consentimiento explícito al reportar (Priority: P1)

Para enviar un reporte, la persona marca una casilla que dice que acepta que el equipo de Yaguachi Weather use el reporte, su ubicación y la foto solo para el análisis de riesgo del cantón (LOPDP), y que no se piden nombre, cédula ni teléfono. Sin la casilla no se envía, y el servidor rechaza cualquier reporte sin `consentimiento: true`.

**Why this priority**: el reporte es el único dato personal que la app manda al servidor por iniciativa de la persona.

**Independent Test**: `POST /api/reportes` sin `consentimiento` (o con `false`) → `400 {"error": "falta aceptar el uso de los datos del reporte"}`.

**Acceptance Scenarios**:

1. **Given** el asistente en el paso 5 (confirmar), **When** la casilla `#consent` no está marcada, **Then** el botón dice «Marca la casilla para enviar» (`app.wiz.marca`) y está desactivado (`pasoListo(5)` es falso); si de todos modos se llega a `enviarReporte()`, aparece «Marca la casilla de uso de datos para enviar.» (`app.val.consent`); junto a la casilla hay un enlace «Ver la política» a `#privacidad`.
2. **Given** la hoja de «calle inundada» del mapa, **When** la persona nunca ha enviado un reporte, **Then** se muestra la casilla `#hoja-ok` (`app.consent.calle`) y es obligatoria.
3. **Given** un reporte enviado con éxito (por el asistente o por la hoja), **When** se guarda `consent_ok = true`, **Then** la hoja de calle inundada ya no muestra la casilla y envía `consentimiento: true` directamente; el asistente sigue pidiendo la casilla en cada reporte y la desmarca al reiniciarse.
4. **Given** un reporte sin señal, **When** se encola, **Then** se guarda en `ay_cola_reportes` con `consentimiento: true` y se reenvía al volver la conexión.

---

### User Story 5 - Plazos de conservación en el servidor (Priority: P1)

El servidor conserva lo mínimo y lo borra solo: la IP del envío se usa solo para frenar abusos y se borra a las 48 h; las fotos se borran al descartarse el reporte y a los 90 días; la foto de otra persona solo se ve si el analista verificó el reporte.

**Why this priority**: es lo que la política promete; si el código no lo cumple, la política miente.

**Independent Test**: en un servidor aislado con un reporte de hace 49 h, esperar a la vuelta del hilo `mantenimiento` (o reiniciar la API y esperar su primera vuelta) → `reportes.ip` es `NULL`; con una foto de hace 91 días, al arrancar → archivo borrado y `foto = NULL`.

**Acceptance Scenarios**:

1. **Given** la API en marcha, **When** pasa cada vuelta del hilo `mantenimiento` (al arrancar y luego cada 6 h), **Then** `limpiar_fotos_viejas()` borra los archivos de fotos de reportes con `creado` de hace más de `dias_conservar_fotos` (90) y pone `foto = NULL`, y pone `ip = NULL` en `reportes`, `confirmaciones` y `me_gusta` con `creado` de hace más de 48 h.
2. **Given** un reporte con foto, **When** el analista lo descarta, **Then** la foto se borra del disco en ese momento (ver 008).
3. **Given** un reporte no verificado de otra persona, **When** alguien pide `GET /api/foto/<id>` sin ser el autor ni tener el PIN, **Then** responde `404 {"error": "foto no disponible"}`; la lista pública marca `foto: false`, y `/r/<id>` usa el ícono de la app como imagen de vista previa.
4. **Given** el service worker, **When** se pide una foto, **Then** no se guarda en la caché (`/api/foto` queda fuera).

---

### Edge Cases

- **Primera visita sin servidor ni caché**: `iniciar()` termina antes de mostrar el aviso (`if (!TERR) return`), así que el aviso no aparece en esa visita.
- **Entrar por `#privacidad`**: el aviso no se muestra y queda marcado como visto.
- **Cambiar de idioma durante «Toca otra vez para confirmar»**: `I18N.aplicar()` repone el texto «Borrar los datos de este teléfono» en el botón, pero sigue en estado `confirmar` hasta 5 s: un toque en ese lapso borra sin el aviso escrito.
- **Reportes en cola al borrar**: se pierden (la política lo dice: «reportes pendientes»).
- **Modo privado o `localStorage` bloqueado**: `almacen` y el borrado van en try/catch; el aviso puede reaparecer en cada visita.
- **Permisos del navegador** (ubicación, notificaciones): el botón de borrado no los quita; se quitan desde los ajustes del navegador.
- **Cola sin espacio**: si el reporte encolado no cabe en `localStorage`, `encolar()` lo guarda sin la foto y avisa (`app.toast.cola_sin_foto`); si tampoco cabe, avisa que no se pudo guardar (`app.toast.cola_llena`). Al reenviar, los reportes que la API rechaza (no por falta de red) se descartan con aviso (`app.toast.cola_rechazados`).
- **Plazos efectivos**: como el hilo corre cada 6 h, la IP puede durar hasta ~54 h y una foto hasta 90 días + 6 h.

## Requirements *(mandatory)*

### Functional Requirements

**Aviso y política**

- **FR-001**: La app DEBE mostrar `#aviso-cookies` (`role="region"`) una sola vez por teléfono, hasta que se pulse «Entendido» o se abra `#privacidad`, y recordarlo en `localStorage["ay_aviso_cookies"]`.
- **FR-002**: La app DEBE tener la vista `#v-privacidad`, alcanzable por el hash `#privacidad`, con las secciones y textos `app.priv.*` en español e inglés, y su fecha de actualización.
- **FR-003**: La app NO DEBE crear cookies propias ni cargar analítica o publicidad de terceros. Los únicos orígenes externos permitidos por la CSP son `unpkg.com`, `tile.openstreetmap.org` y `server.arcgisonline.com` (`cliente/seguridad.conf`); Facebook y WhatsApp solo se abren como enlaces (`target="_blank"`) al tocar Compartir.
- **FR-004**: `localStorage` DEBE usarse solo con claves `ay_*` para el funcionamiento de la app (ver `data-model.md`); nunca para datos de otras personas que no se hayan descargado como públicos.
- **FR-005**: La política DEBE enlazarse desde Inicio, desde el paso de confirmación del asistente de reporte y desde el aviso.

**Borrado local**

- **FR-006**: El botón `#borrar-datos` DEBE pedir un segundo toque en ≤ 5 s y entonces borrar las claves `ay_*` de `localStorage`, todas las cachés del origen y los registros de service worker, y recargar la app sin hash.

**Consentimiento**

- **FR-007**: El servidor DEBE rechazar `POST /api/reportes` si `consentimiento` no es exactamente `true` (`400`).
- **FR-008**: El asistente DEBE exigir marcar `#consent` en cada reporte; la hoja de calle inundada DEBE exigir `#hoja-ok` hasta el primer envío con éxito y después recordar el consentimiento (`ay_consent_ok`). [NEEDS CLARIFICATION: ¿la LOPDP admite un consentimiento recordado para los reportes siguientes de calle inundada, o hay que pedirlo cada vez? Revisión legal pendiente.]
- **FR-009**: La app NO DEBE pedir nombre, cédula ni teléfono; cada teléfono se identifica con un id aleatorio (`"d"` + `crypto.randomUUID()` sin guiones, o 16 bytes de `crypto.getRandomValues`) que viaja en la cabecera `X-Dispositivo` y en el cuerpo de los envíos.

**Conservación en el servidor**

- **FR-010**: La API DEBE borrar las fotos de más de `dias_conservar_fotos` (90) días al arrancar y en cada vuelta del hilo `mantenimiento` (cada 6 h).
- **FR-011**: La API DEBE poner `ip = NULL` en `reportes`, `confirmaciones` y `me_gusta` para registros de más de 48 h en cada vuelta de `mantenimiento`.
- **FR-012**: Al descartar un reporte, la API DEBE borrar su foto enseguida.
- **FR-013**: Una foto DEBE servirse solo si el reporte está `validado`, si trae el PIN del panel, si quien la pide es su autor (cabecera `X-Dispositivo`, o `?dispositivo=` por compatibilidad) o si trae la llave firmada `?k=` (`llave_foto(id)`: HMAC-SHA256 del id con `secreto_fotos` de `config.json`, 32 hex) que la API entrega solo al autor de una foto aún no pública (`foto_k`). La app usa `?k=`, de modo que el id del teléfono ya no va en la URL. El service worker no guarda las fotos.
- **FR-014**: La IP solo se usa para límites anti-abuso (reportes por hora, fotos por día, confirmaciones y «me gusta» por hora) y nunca se envía al panel ni a la app.
- **FR-015**: Los registros de la API DEBEN omitir la query de las rutas `/api/` (no quedan `?dispositivo=` ni coordenadas en el log de la API).

### Key Entities

- **Datos locales del teléfono**: claves `ay_*` de `localStorage` y las cachés del service worker (`v1.6` y `ay-teselas`).
- **Reporte** (servidor): texto, ubicación, foto, id del teléfono, IP (48 h), con consentimiento.
- **Foto**: archivo JPEG en `datos/fotos/`, ligado a un reporte; vive hasta el descarte o 90 días.
- **Voto** (`confirmaciones`, `me_gusta`): id del teléfono, hora e IP (48 h).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de los reportes guardados tienen consentimiento explícito (la API no acepta otros).
- **SC-002**: Ninguna IP de más de 54 h queda en `reportes`, `confirmaciones` ni `me_gusta` con la API en marcha.
- **SC-003**: Ninguna foto de más de 90 días + 6 h queda en `datos/fotos/` con la API en marcha; 0 fotos de reportes descartados.
- **SC-004**: Tras «Borrar los datos de este teléfono», 0 claves `ay_*` en `localStorage` y 0 cachés del origen.
- **SC-005**: La app no fija cookies propias (`document.cookie` vacío en el origen de la app).
- **SC-006**: El aviso de una sola vez aparece como máximo una vez por teléfono mientras no se borren los datos.

## Assumptions

- El equipo de Yaguachi Weather es el responsable del tratamiento; la app no es un canal oficial.
- El público no tiene cuentas: el único vínculo entre una persona y sus reportes es el id del teléfono.
- Los derechos de acceso, corrección y eliminación de un reporte se atienden a mano por el equipo de Yaguachi Weather (no hay ruta de API para eso).
- Las teselas de OSM / Esri y Leaflet desde unpkg son necesarias para el mapa; su tratamiento de la IP se rige por sus políticas.

## Pendiente (marcado por el dueño)

- **P-01**: falta el **correo de contacto del proyecto** en «Tus derechos» (`app.priv.derechos.c` solo dice «contacta al equipo de Yaguachi Weather»). [NEEDS CLARIFICATION: dirección de contacto para ejercer los derechos LOPDP.]
- **P-02**: falta la **revisión legal** de la política de privacidad y cookies y del texto de consentimiento (`docs/seguridad.md`, «Pendiente»).

## Brechas conocidas

- **PR-01 (registros de nginx)**: la política dice que la IP se borra a las 48 h, pero el nginx del `cliente` registra en su access log (salida estándar → `docker logs`) la IP y la URL completa de cada petición, incluidas las coordenadas GPS de `GET /api/lugar?lat=&lon=`. Esos registros no se borran a las 48 h.
- **PR-02 (datos en la URL)**: el principio V prohíbe datos personales en la URL de una petición nueva, pero `GET /api/lugar?lat=&lon=` lleva la ubicación GPS del teléfono. (Las fotos propias ya no llevan `?dispositivo=`: desde el 2026-11-09 usan la llave `?k=`; `docs/seguridad.md` todavía dice lo contrario en «Pendiente».)
- **PR-03 (conservación del reporte)**: la política no dice cuánto se conservan el texto, la ubicación y el id del teléfono de un reporte, ni los votos (`confirmaciones`, `me_gusta`): hoy se guardan sin plazo. [NEEDS CLARIFICATION: plazo de conservación de los reportes.]
- **PR-04 (lista incompleta)**: «Lo que se guarda en tu teléfono» no menciona que se recuerda el consentimiento (`ay_consent_ok`) ni los avisos ya vistos y notificados (`ay_avisos_vistos`, `ay_avisos_notificados`).
- **PR-05 (hoja de calle)**: la casilla de consentimiento de la hoja de calle inundada no enlaza a la política (la del asistente sí).
- **PR-06 (derecho de supresión)**: no hay forma de que la persona borre del servidor un reporte suyo; y tras «Borrar los datos», pierde el id que lo vincula con sus reportes.
- **PR-07 (copias del volumen)**: los plazos no consideran copias de seguridad del volumen `yaguachi-weather_datos`, si se hacen.
