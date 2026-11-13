# Feature Specification: Avisos del analista y notificaciones

**Feature Branch**: `007-avisos-notificaciones`

**Created**: 2026-11-09

**Status**: Implementado

**Input**: Pedido del dueño: que el analista pueda emitir avisos para todo el cantón, una parroquia, el corredor de un río o un recinto, con reglas que eviten saturar a la gente (máximo 3 en 24 h por ámbito, sin repetir texto en 6 h ni nivel en 3 h, salvo RESPUESTA), y que la app los muestre y avise con una notificación, respetando horas de silencio.

> Documentación «as-built» de `api/servidor.py` (`panel_aviso`, `panel_anular_aviso`, `avisos_para`), `admin/panel.js` + `admin/index.html` (sección de avisos), `cliente/app.js` (sección «AVISOS»: `cargarAvisos`, `pintarAvisos`, `enSilencio`) y `cliente/sw.js` (`notificationclick`).
>
> Un aviso **no** cambia el nivel del semáforo: el nivel verificado se fija aparte (`POST /api/panel/nivel`, spec 002/008). Los avisos son del equipo de Yaguachi Weather, no del COE ni de la SGR, y la app lo dice.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El analista publica un aviso para un ámbito (Priority: P1)

El analista, en el panel (`/panel`, pestaña de avisos), elige el ámbito (todo el cantón, una parroquia, el corredor de un río o un recinto), el nivel, un título (máx. 90), un texto (máx. 600) y las horas de vigencia (1–168, por defecto 96 desde el 2026-11-10; antes 24), y lo publica.

**Why this priority**: es el canal para decir «qué pasa y qué hacer» a una zona concreta.

**Independent Test**: en el panel, publicar un aviso de VIGILANCIA para la parroquia de un recinto; en la app, con «Mi lugar» en ese recinto, el aviso aparece en «Avisos»; con un recinto de otra parroquia, no aparece.

**Acceptance Scenarios**:

1. **Given** el formulario con ámbito «Todo el cantón», **When** se publica, **Then** se envía `ambito_tipo: "canton"`, `ambito_id: "yaguachi"` y el aviso se guarda con `ambito_nombre: "Todo el cantón"`.
2. **Given** ámbito «Parroquia», «Corredor de un río (1,5 km)» o «Recinto», **When** se elige, **Then** aparece el selector «Cuál» con las parroquias (`AJ.parroquias`), los ríos (`EST.rios`) o los recintos (`AJ.recintos`, «nombre (parroquia)»).
3. **Given** datos válidos y sin choque con las reglas anti-saturación, **When** se publica, **Then** la API responde `{"ok": true, "id": n}` y guarda `vigente_hasta = ahora + horas` (horas recortadas a 1–168).
4. **Given** título o texto vacíos, **When** se publica, **Then** la API responde 400 «el aviso necesita título y texto».
5. **Given** un aviso publicado, **When** se recarga la lista del panel, **Then** aparece arriba (últimos 50 por id), con su nivel en píldora de color con el nombre escrito, ámbito, desde → hasta y texto.

---

### User Story 2 - Reglas anti-saturación (Priority: P1)

Para que la gente no deje de hacer caso, la API frena avisos repetidos en el mismo ámbito, salvo los de RESPUESTA.

**Why this priority**: una alerta que satura le quita fuerza a la siguiente (principio II).

**Independent Test**: publicar 3 avisos de distintos niveles y textos para el mismo recinto; el cuarto (nivel < 4) recibe 409; uno de RESPUESTA sí pasa.

**Acceptance Scenarios** (todas cuentan solo avisos **no anulados** del **mismo** `ambito_tipo` + `ambito_id` creados en las últimas 24 h, y se aplican solo si el nivel es < 4):

1. **Given** 3 avisos previos (`avisos_max_24h_por_ambito`), **When** se publica otro, **Then** 409 «ya hay 3 avisos en 24 h para este ámbito; edita uno o espera (solo RESPUESTA puede pasar este límite)».
2. **Given** un aviso previo con exactamente el mismo texto hace menos de 6 h, **When** se publica, **Then** 409 «ese mismo aviso ya se publicó hace menos de 6 h».
3. **Given** que el aviso previo más reciente tiene el mismo nivel y es de hace menos de 3 h, **When** se publica, **Then** 409 «ya hay un aviso del mismo nivel hace menos de 3 h; no repitas, actualízalo».
4. **Given** nivel 4 (RESPUESTA), **When** se publica, **Then** no se aplica ninguna de las tres reglas.
5. **Given** un 409, **When** el panel recibe la respuesta, **Then** muestra el mensaje 6 s y no borra el formulario.

---

### User Story 3 - El vecino ve los avisos de su zona (Priority: P1)

En la pestaña «Avisos» el vecino ve los avisos vigentes que aplican a su lugar y una lista corta de los anteriores.

**Why this priority**: la respuesta a «¿qué hago?» cuando el analista ve algo que el modelo no.

**Independent Test**: con «Mi lugar» en un recinto, abrir «Avisos»: se ven los avisos del cantón, de su parroquia, de su recinto y del río cercano si el recinto está a ≤ 1,5 km de él.

**Acceptance Scenarios**:

1. **Given** «Mi lugar» es un recinto, **When** se abre «Avisos» (`cargarAvisos(true)`), **Then** se pide `GET /api/avisos?recinto=<id>` y se muestran los vigentes que aplican: `canton` siempre; `recinto` si es el mismo id; `parroquia` si coincide con la del recinto; `rio` si es el río más cercano al recinto y está a ≤ 1,5 km (`DIST_RIO_M`).
2. **Given** un aviso vigente, **When** se pinta, **Then** la tarjeta lleva una cabecera con el color del nivel **y su nombre escrito** (`NIV[n]`), el ámbito y la hora; el título, el texto (con saltos de línea) y «Vigente hasta …».
3. **Given** avisos ya vencidos (`vigente_hasta` ≤ ahora), **When** se pinta, **Then** salen en «Avisos anteriores» como «hora · **título** (NIVEL)».
4. **Given** que no hay vigentes, **When** se pinta, **Then** aparece «No hay avisos vigentes para tu zona.».
5. **Given** que no hay red, **When** falla la petición, **Then** se pinta la última respuesta guardada (`ay_avisos_cache`).
6. **Given** avisos vigentes que el vecino no ha visto, **When** no está en la pestaña, **Then** la pestaña «Avisos» muestra una insignia con el número; al abrir la pestaña se marcan como vistos (`ay_avisos_vistos`) y la insignia desaparece.

---

### User Story 4 - Notificación en el teléfono con horas de silencio (Priority: P2)

El vecino activa las notificaciones; cuando la app (abierta o recién pasada a segundo plano) encuentra un aviso nuevo, muestra una notificación del sistema. De noche solo notifica PREPARACIÓN y RESPUESTA.

**Why this priority**: el aviso tiene que llegar aunque no esté mirando la pestaña; pero despertar a la gente por una VIGILANCIA satura.

**Independent Test**: tocar «Activar notificaciones» y aceptar; con la app abierta, publicar un aviso de PREPARACIÓN; en menos de 5 min llega la notificación «PREPARACIÓN · {título}»; tocarla enfoca la app.

**Acceptance Scenarios**:

1. **Given** la pestaña «Avisos», **When** se toca «Activar notificaciones», **Then** se llama a `Notification.requestPermission()` y un toast dice si quedó activada; si el navegador no tiene `Notification`, avisa que no las permite.
2. **Given** permiso concedido y un aviso vigente nuevo (no en `ay_avisos_notificados`), **When** `cargarAvisos` lo recibe (al arrancar, cada 5 min o al abrir la pestaña), **Then** el service worker muestra una notificación con título «{NIVEL} · {título}», cuerpo con los primeros 180 caracteres, ícono `icono-192.png`, `tag: "aviso-<id>"` y `requireInteraction` si es RESPUESTA.
3. **Given** la hora del teléfono dentro de `horas_silencio` (por defecto `[22, 6]`, de 22:00 a 05:59), **When** el aviso es de nivel 1 o 2, **Then** no se muestra notificación; los de nivel 3 y 4 sí.
4. **Given** una notificación, **When** se toca, **Then** el service worker la cierra y enfoca una ventana abierta de la app, o abre `./#avisos` si no hay ninguna.
5. **Given** un aviso ya notificado, **When** vuelve a llegar, **Then** no se notifica otra vez.

---

### User Story 5 - El analista anula un aviso (Priority: P2)

Si un aviso fue un error o ya no aplica, el analista lo anula desde la lista del panel y deja de verse en la app.

**Why this priority**: un aviso equivocado que sigue a la vista hace más daño que no tener aviso.

**Independent Test**: anular un aviso vigente en el panel (confirmando el diálogo); en la app, al abrir «Avisos», ya no aparece ni en vigentes ni en anteriores; en el panel queda con la etiqueta «anulado».

**Acceptance Scenarios**:

1. **Given** un aviso no anulado en la lista del panel, **When** se toca «Anular» y se confirma «¿Anular este aviso? Deja de mostrarse en la app.», **Then** se envía `POST /api/panel/avisos/{id}/anular` y la lista se recarga.
2. **Given** un aviso anulado, **When** la app pide `/api/avisos`, **Then** no viene ni en `vigentes` ni en `anteriores` (`anulado=0` en las dos consultas).
3. **Given** un aviso anulado, **When** se aplican las reglas anti-saturación, **Then** ya no cuenta para el tope de 3, ni para el texto repetido, ni para el nivel repetido.

### Edge Cases

- **Lugar que no es recinto** (GPS o calle): la app pide `GET /api/avisos?recinto=` vacío y la API, sin recinto, considera que **todos** los avisos aplican (ver brecha 2).
- **Recinto inexistente** en `?recinto=`: igual que vacío (todos aplican).
- **Muchos avisos**: la API toma los 50 vigentes y los 20 anteriores más recientes **antes** de filtrar por ámbito; un recinto puede ver menos de 20 anteriores.
- **Horas fuera de rango**: `horas` < 1 se sube a 1; > 168 se baja a 168; no numérico → 400 «nivel u horas inválidos». Si el analista deja vacío el campo «Vigente por (horas)», el panel envía `+"" = 0` y el aviso queda vigente solo 1 h, sin avisar.
- **Sin service worker** (HTTP en un celular de la red local, o navegador que lo bloquea): no hay notificaciones aunque haya permiso (`navigator.serviceWorker?.ready`).
- **Nivel fuera de 1–4** → 400 «nivel inválido»; **ámbito desconocido** → 400 «ámbito inválido».
- **Campo `forzar`** en el cuerpo: si es verdadero, la API se salta las reglas anti-saturación para cualquier nivel. El panel no lo envía.
- **Primera apertura de la app** con permiso ya concedido: todos los avisos vigentes son «nuevos» y se notifican (también tras «Borrar mis datos»).
- **Teléfono en otra zona horaria**: las horas de silencio se evalúan con la hora local del teléfono, no con la de Ecuador.
- **Notificación ya mostrada y aviso anulado después**: la notificación del sistema no se retira.

## Requirements *(mandatory)*

### Functional Requirements

**Publicación (API + panel)**

- **FR-001**: `POST /api/panel/aviso` (con `X-PIN`) MUST aceptar `ambito_tipo` en `canton | parroquia | rio | recinto`, `ambito_id` (texto), `nivel_cod` 1–4, `titulo` (≤ 90 tras recortar espacios), `texto` (≤ 600) y `horas` (1–168, por defecto 24).
- **FR-002**: Para niveles 1–3, la API MUST rechazar con 409: un 4.º aviso del mismo ámbito en 24 h (`avisos_max_24h_por_ambito = 3`), el mismo texto en el mismo ámbito en 6 h y el mismo nivel que el último aviso del ámbito en 3 h. Solo cuentan los avisos no anulados. RESPUESTA (4) MUST saltarse las tres reglas.
- **FR-003**: La API MUST guardar `ambito_nombre` legible: «Todo el cantón», el nombre de la parroquia o del río, o el nombre del recinto (por su id).
- **FR-004**: El panel MUST mostrar las reglas anti-saturación junto al formulario (`panel.av.reglas`), pedir confirmación antes de publicar un aviso de RESPUESTA (`panel.av.confirmar_respuesta`) y listar los últimos 50 avisos con su estado.
- **FR-005**: `POST /api/panel/avisos/{id}/anular` MUST marcar `anulado = 1`; un aviso anulado no se muestra en la app ni cuenta para las reglas.

**Consulta (app)**

- **FR-006**: `GET /api/avisos?recinto=<id>` MUST devolver `vigentes` (no anulados, `vigente_hasta` > ahora, hasta 50, más recientes primero), `anteriores` (no anulados, vencidos, hasta 20) filtrados por ámbito, y `horas_silencio` de la configuración.
- **FR-007**: La regla de ámbito MUST ser: cantón siempre; recinto por id; parroquia por nombre; río por nombre y solo si el recinto está a ≤ 1,5 km del cauce.
- **FR-008**: La app MUST cargar los avisos al arrancar, al abrir la pestaña y cada 5 minutos mientras está abierta, y guardar la última respuesta para usarla sin red.
- **FR-009**: Cada tarjeta MUST mostrar el nombre del nivel escrito sobre su color del semáforo (principio II) y la vigencia.
- **FR-010**: La app MUST mostrar una insignia con el número de avisos vigentes no vistos.

**Notificaciones (cliente + service worker)**

- **FR-011**: Las notificaciones MUST ser locales (`ServiceWorkerRegistration.showNotification`), solo con permiso explícito, una vez por aviso.
- **FR-012**: Dentro de `horas_silencio`, MUST notificarse solo los avisos de nivel ≥ 3; RESPUESTA MUST quedar en pantalla hasta que se toque (`requireInteraction`).
- **FR-013**: Tocar la notificación MUST enfocar la app o abrirla en `#avisos`.
- **FR-014**: Todos los textos de la pestaña y del panel MUST salir de `I18N` (`app.av.*`, `panel.av.*`) en `es` y `en`; el título y el texto del aviso son datos del analista y no se traducen.

### Key Entities

- **Aviso**: mensaje del analista para un ámbito, con nivel, título, texto, vigencia y marca de anulado. Ver `data-model.md`.
- **Ámbito**: `canton` (`yaguachi`), `parroquia` (nombre), `rio` (nombre del río; aplica a recintos a ≤ 1,5 km) o `recinto` (id).
- **Horas de silencio**: `horas_silencio` en `config.json` (`[inicio, fin]`, horas enteras).
- **Registro local de avisos**: `ay_avisos_cache`, `ay_avisos_vistos`, `ay_avisos_notificados` en `localStorage`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una prueba con 5 intentos seguidos de avisos de nivel < 4 para el mismo ámbito y textos distintos, se publican como máximo 3.
- **SC-002**: Un aviso de RESPUESTA se publica siempre, aunque ya haya 3 avisos en el ámbito.
- **SC-003**: Con la app abierta y permiso concedido, un aviso nuevo genera la notificación en menos de 5 minutos (intervalo de consulta).
- **SC-004**: Entre las 22:00 y las 06:00 (hora del teléfono) no se muestra ninguna notificación de NORMAL o VIGILANCIA.
- **SC-005**: Un aviso anulado desaparece de la app en la siguiente consulta (≤ 5 min o al abrir la pestaña).
- **SC-006**: Un vecino de un recinto nunca ve en «vigentes» un aviso de otra parroquia o de otro recinto.

## Assumptions

- No hay Web Push (VAPID): las notificaciones solo llegan mientras el navegador mantiene viva la página (abierta o poco después de pasar a segundo plano). README lo anota como pendiente.
- El analista escribe los avisos en un solo idioma (español); no hay traducción.
- Un aviso no cambia el nivel; para eso el analista fija el nivel verificado aparte.
- El panel lo usa una sola persona a la vez (las reglas no se comprueban bajo candado).

## Brechas conocidas

1. **El panel no puede publicar avisos de RESPUESTA (error de código).** En el listener de `#a-publicar` (`admin/panel.js`), `const t = $("#a-tipo").value;` tapa la función de traducción `t`. Con nivel 4, `confirm(t("panel.av.confirmar_respuesta"))` lanza `TypeError: t is not a function` antes de enviar nada. Con niveles 1–3 el aviso **sí se publica**, pero `toast(t("panel.av.publicado"))` lanza el mismo error dentro del `try`: el panel muestra «t is not a function», no limpia el formulario ni recarga la lista (el analista puede creer que falló y reintentar, y entonces recibe un 409). Comprobado con Node sobre la misma estructura de código. La regla «RESPUESTA se salta el límite» funciona en la API, pero hoy no se puede usar desde el panel.
2. **Avisos de otras zonas para lugares GPS o de calle.** `cargarAvisos` solo manda `recinto` si «Mi lugar» es un recinto; para un punto GPS o una calle manda vacío y la API devuelve todos los avisos de todas las parroquias, recintos y ríos, mientras el subtítulo dice «Para {lugar} y todo el cantón». [NEEDS CLARIFICATION: ¿usar el recinto más cercano (`recinto_cercano`) o filtrar por parroquia/río del punto?]
3. **Los avisos silenciados nunca se notifican.** Un aviso de nivel 1–2 que llega en horas de silencio se marca como notificado aunque no se mostró; al terminar el silencio no se avisa. El texto de la app («De 22:00 a 06:00 solo suenan…») sugiere que solo se silencia.
4. **Textos de ayuda que no coinciden con el código.** `app.av.notif.nota` dice «Solo te avisamos cuando cambia el nivel», pero la app no notifica cambios de nivel, solo avisos del analista. Las horas «22:00 a 06:00» están escritas en los textos (app y panel) aunque `horas_silencio` es configurable.
5. **Horas de silencio con la hora del teléfono**, no con la de Ecuador (`new Date().getHours()`).
6. **Anulación sin rastro.** `panel_anular_aviso` no guarda quién, cuándo ni por qué; responde `{"ok": true}` aunque el id no exista; no se puede deshacer desde el panel. Anular y volver a publicar permite rodear las reglas anti-saturación.
7. **Reglas no atómicas.** `panel_aviso` lee los avisos previos fuera de `_db_lock` y luego inserta: dos publicaciones simultáneas para el mismo ámbito pueden pasar las dos. Riesgo bajo (un solo analista).
8. **`ambito_id` sin validar.** La API acepta cualquier texto como parroquia, río o recinto; un id que no existe crea un aviso que nadie ve (salvo quienes no tienen recinto, brecha 2). Para `canton`, ids distintos de `yaguachi` crean «cantones» separados para las reglas.
9. **`forzar` sin documentar ni registrar.** Cualquier cliente con PIN puede saltarse las reglas con `"forzar": true`.
10. **Mensajes de la API solo en español** (409 y 400), mostrados tal cual en el panel en inglés.
11. **Al tocar una notificación con la app ya abierta**, el service worker solo enfoca la ventana; no la lleva a `#avisos`.
