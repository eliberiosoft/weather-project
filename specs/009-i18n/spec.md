# Feature Specification: Idiomas (i18n es/en)

**Feature Branch**: `009-i18n`

**Created**: 2026-11-09

**Status**: Implementado

**Input**: Regla permanente del dueño del producto: «i18n siempre (es/en)»; ningún texto visible escrito directo en el HTML ni en el JS, con español e inglés completos, selector de idioma visible en la app y en el panel, y los motivos del nivel que calcula el servidor traducidos en el cliente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El vecino usa la app en su idioma (Priority: P1)

Quien abre la app la ve en español (o en inglés si su teléfono está en inglés). Con el selector «ES / EN» de la barra superior cambia el idioma al instante, sin recargar ni perder lo que estaba viendo, y la app lo recuerda en las próximas visitas.

**Why this priority**: el texto es la mitad de la alerta; una persona que no entiende el idioma no entiende qué hacer.

**Independent Test**: con el teléfono en inglés y sin datos guardados, abrir la app → textos en inglés y `<html lang="en-US">`; elegir «ES» → todo pasa a español y `localStorage["ay_idioma"] = "es"`; recargar → sigue en español.

**Acceptance Scenarios**:

1. **Given** una primera visita sin `ay_idioma`, **When** carga `compartido/i18n.js`, **Then** el idioma es el de `navigator.language` si empieza por `es` o `en`, y si no, `es`.
2. **Given** el selector `select[data-idioma]`, **When** `I18N.aplicar()` lo encuentra vacío, **Then** lo llena con una opción por idioma (con `data-idioma="corto"` muestra «ES» / «EN»), cada una con su atributo `lang`, y marca el activo.
3. **Given** la app abierta en una vista cualquiera, **When** se elige otro idioma, **Then** `I18N.cambiar(l)` guarda `ay_idioma`, vuelve a aplicar todos los `data-i18n*`, cambia `document.title`, la meta `description` y `<html lang>` (`es-EC` / `en-US`), y dispara el evento `idioma` en `window`; la app repinta lo que arma el JS (banners, lugar, avisos, muro, asistente, capas del mapa, hoja de información abierta).
4. **Given** un nivel, **When** se muestra, **Then** su nombre sale de `nivel.N` (`NORMAL`, `VIGILANCIA`/`WATCH`, `PREPARACIÓN`/`GET READY`, `RESPUESTA`/`RESPONSE`), siempre escrito junto al color.
5. **Given** fechas y números, **When** se muestran, **Then** usan el locale del idioma (`I18N.fecha`, `I18N.locale()`, `Intl.RelativeTimeFormat`): «lun, 9 nov» / «Mon, Nov 9»; «1.234,5» / «1,234.5».

---

### User Story 2 - El analista usa el panel en su idioma (Priority: P2)

El panel tiene el mismo selector y el mismo motor. Al cambiar de idioma se repinta desde lo que ya está en memoria, sin volver a pedir datos ni perder niveles o motivos escritos y sin fijar.

**Why this priority**: el panel lo usa una persona (o pocas) en escritorio; importa, pero menos que la app ciudadana.

**Independent Test**: en la Situación, elegir un nivel en una fila sin fijarlo, cambiar a «EN» → la tabla se traduce y el nivel elegido sigue elegido; no hay nuevas peticiones a `/api/panel/estado`.

**Acceptance Scenarios**:

1. **Given** el panel con datos cargados, **When** se cambia de idioma, **Then** el manejador de `idioma` de `admin/panel.js` llama a `cargarSituacion(false, [], true)` (sin red), `pintarReglas()`, `pintarAvisos()`, `pintarHistorial()` y, si está visible, `pintarReportes()`.
2. **Given** el panel en el ingreso (sin datos), **When** se cambia de idioma, **Then** solo se aplican los `data-i18n*` del HTML.

---

### User Story 3 - Los motivos del nivel se leen en el idioma activo (Priority: P1)

El «por qué» de cada nivel estimado lo calcula el servidor, pero no llega como frase cerrada: llega como una lista de motivos estructurados (clave + valores) que la app y el panel arman en el idioma activo. La app usa frases de vecino; el panel, la redacción técnica.

**Why this priority**: es la explicación del nivel (principio II, honestidad); si solo existiera en español, la versión en inglés mentiría por omisión.

**Independent Test**: con un río en VIGILANCIA por GloFAS, `GET /api/estado` trae en el río `motivos: [{"k": "glofas.q_p90", "v": {"q": 1700, "u": 1659}, "src": "glofas", "pid": "P01"}]`; en el panel en inglés se lee «P01 · GloFAS: flow 1,700 > P90 1,659»; en la app en español, «El río está más alto de lo habitual (modelo GloFAS)».

**Acceptance Scenarios**:

1. **Given** un objeto con `motivos` (lista no vacía), **When** se llama `I18N.motivo(obj)`, **Then** agrupa por `pid` + `src`, traduce cada `motivo.<k>` con sus valores formateados al locale (máx. 2 decimales) y devuelve `"<pid> · <fuente>: parte; parte / …"`.
2. **Given** el mismo objeto, **When** se llama `I18N.motivo(obj, { vecino: true })`, **Then** usa `vecino.<k>` si existe (si no, `motivo.<k>`), quita repetidos, añade las fuentes entre paréntesis («modelo GloFAS», «medido en la regla»), formatea las probabilidades (`p`) sin decimales y pone en mayúscula la primera letra.
3. **Given** un objeto sin `motivos` (respuesta vieja guardada en caché), **When** se llama `I18N.motivo(obj)`, **Then** devuelve `obj.motivo`, el texto en español que sigue enviando el servidor.
4. **Given** una clave de motivo sin traducción, **When** se arma, **Then** se muestra la clave cruda (`m.k`) en lugar de romper la pantalla.
5. **Given** un nivel verificado, **When** se muestra su motivo, **Then** se muestra tal como lo escribió el analista (`oficial_motivo`): es un dato, no se traduce.

---

### User Story 4 - Quien mantiene el proyecto agrega o cambia un texto (Priority: P2)

Quien toca la interfaz no escribe textos en el HTML ni en el JS: crea una clave en el diccionario que corresponde, en `es` y en `en`, y la usa con `data-i18n`, `data-i18n-html`, `data-i18n-attr` o `I18N.t()`.

**Why this priority**: es la regla que mantiene la app traducible; sin ella el inglés se degrada con cada cambio.

**Independent Test**: comparar las claves de `es` y `en` de cada diccionario (hoy: 83 comunes, 339 de la app, 146 del panel; 0 diferencias) y comprobar que toda clave literal usada en `cliente/` y `admin/` existe.

**Acceptance Scenarios**:

1. **Given** una clave que falta en `en`, **When** se pide en inglés, **Then** se usa la de `es`.
2. **Given** una clave que falta en los dos idiomas, **When** se pide, **Then** `t()` devuelve la clave misma y escribe `[i18n] falta la clave <clave>` en la consola.
3. **Given** un valor que es una lista (`acciones.N`), **When** se pide con `t()`, **Then** se une con espacios; con `I18N.lista()` se obtiene la lista.
4. **Given** variables `{nombre}` en el texto, **When** se llama `t(clave, {nombre: …})`, **Then** se sustituyen; una variable que falta queda vacía.

---

### Edge Cases

- **Idioma guardado inválido** (p. ej. `ay_idioma = "fr"`): se ignora y se usa el del navegador o `es`.
- **Navegador sin `localStorage`** (modo privado estricto): el idioma funciona en la sesión pero no se recuerda; no hay error (try/catch).
- **«Borrar los datos de este teléfono»** (010) también borra `ay_idioma`: la app vuelve al idioma del navegador.
- **App y panel en orígenes distintos** (`:8090` y `:8091`): cada uno recuerda su idioma por separado; en desarrollo (mismo origen `:8080`) lo comparten.
- **Cambio de idioma con el botón de borrar datos en «Toca otra vez para confirmar»**: `aplicar()` repone el texto original del botón, pero el estado de confirmación sigue 5 s (ver 010).
- **Fechas**: `I18N.fecha` usa la zona horaria del dispositivo, no la de Ecuador.
- **Variables con datos**: `t()` no escapa los valores; quien pone el resultado en `innerHTML` debe pasar los datos por `esc()` (como `panel.sit.advertencia`).
- **Textos del servidor que siguen solo en español**: ver «Brechas conocidas».

## Requirements *(mandatory)*

### Functional Requirements

**Motor (`compartido/i18n.js`)**

- **FR-001**: El motor DEBE exponer `window.I18N = { t, lista, existe, agregar, aplicar, cambiar, fecha, locale, motivo, IDIOMAS, idioma }` (`idioma` es de solo lectura).
- **FR-002**: Los idiomas DEBEN ser `es` («Español», locale `es-EC`, por defecto) y `en` («English», locale `en-US`). Agregar uno exige sumarlo a `IDIOMAS` / `LOCALE` y dar sus textos en `i18n.js`, `cliente/textos-app.js` y `admin/textos-panel.js`; Kichwa u otras lenguas requieren traducción humana.
- **FR-003**: `t(clave, vars)` DEBE buscar en el idioma activo, luego en `es`, y si no existe devolver la clave con un aviso en consola; sustituir `{var}` (vacío si falta) y unir listas con espacio.
- **FR-004**: `lista(clave)` DEBE devolver siempre una lista; `existe(clave)` DEBE decir si hay texto en el idioma activo o en `es` (sin aviso en consola).
- **FR-005**: `fecha(iso, opciones)` DEBE formatear con `toLocaleString(locale(), opciones)` y devolver `""` si no hay fecha.
- **FR-006**: `aplicar(raiz = document)` DEBE poner `textContent` en `[data-i18n]`, `innerHTML` en `[data-i18n-html]` (solo con textos de los diccionarios, nunca datos), atributos en `[data-i18n-attr="atr:clave;atr2:clave2"]`, `document.title` desde `<html data-i18n-titulo>`, la meta `description` desde `<html data-i18n-desc>`, `<html lang>` y el selector `select[data-idioma]`.
- **FR-007**: `cambiar(l)` DEBE ignorar idiomas desconocidos o el ya activo; si no, guardar `localStorage["ay_idioma"]`, llamar a `aplicar()` y disparar `new CustomEvent("idioma", { detail: l })` en `window`.
- **FR-008**: El idioma inicial DEBE salir de `ay_idioma`, si es válido; si no, de las dos primeras letras de `navigator.language`, si es un idioma conocido; si no, `es`.
- **FR-009**: `motivo(obj, { vecino })` DEBE cumplir los escenarios de la US3.
- **FR-010**: `i18n.js` DEBE incluir los textos comunes a las dos piezas: `idioma.etq`, `nivel.0`–`nivel.4`, `tipo.<14 tipos>`, `gravedad.1–3`, `altura.1–3` y `altura.N.larga`, `estado.*`, `acciones.1–4` (listas), `motivo.*`, `motivo.src.*`, `vecino.*`, `vecino.src.*`, `fuente.modelo` y `fuente.medido`.

**Diccionarios y uso**

- **FR-011**: La app DEBE cargar `i18n.js` → `textos-app.js` → `app.js`, y el panel `i18n.js` → `textos-panel.js` → `panel.js`; cada página llama a `I18N.aplicar()` al arrancar (el motor no se aplica solo).
- **FR-012**: Cada diccionario DEBE tener exactamente las mismas claves en `es` y `en`.
- **FR-013**: Ningún texto visible DEBE ir escrito en el HTML o el JS. Excepciones aceptadas: nombres propios de idioma en `IDIOMAS` («Español», «English»), códigos «ES»/«EN», marcas («Facebook», «WhatsApp») y símbolos o unidades («—», «m», «mm»).
- **FR-014**: Son **datos** y NO se traducen: nombres de lugares (recintos, parroquias, ríos, calles), textos que escribe el analista (motivo del verificado, títulos y textos de avisos, nota del analista, texto de la advertencia) y descripciones de los vecinos.
- **FR-015**: La app DEBE mostrar el selector de idioma en su barra superior (`#idioma`, `data-idioma="corto"`) y el panel en la suya (`#idioma`), ambos con una etiqueta accesible (`idioma.etq`).

**Motivos estructurados (servidor)**

- **FR-016**: El servidor DEBE construir cada motivo con `M(k, es, **v)` → `{"k": k, "v": v, "es": es}`; `unir(ms)` arma con los `es` el texto en español del campo `motivo`, y `sin_es(ms, **extra)` quita `es` y agrega datos (`src`) a la lista que se envía en `motivos`.
- **FR-017**: Los objetos de nivel (`rios[]`, `recintos{}`, `puntos{}.glofas`, `puntos{}.regla`, `estado` de `/api/recinto` y `/api/lugar`) DEBEN llevar `motivo` (texto en español, compatibilidad) y `motivos` (lista `{k, v, src?, pid?}`). El contrato está en `contracts/api.md`.
- **FR-018**: Toda clave de motivo que envía el servidor DEBE tener `motivo.<k>` en `es` y `en`; las frases para vecinos (`vecino.<k>`) son opcionales (sin ella se usa `motivo.<k>`).

### Key Entities

- **Diccionario**: mapa idioma → (clave → texto o lista de textos). Hay tres fuentes que se suman con `I18N.agregar`: comunes (`compartido/i18n.js`), app (`cliente/textos-app.js`, claves `app.*`) y panel (`admin/textos-panel.js`, claves `panel.*`).
- **Motivo**: razón de un nivel estimado, como clave estable (`glofas.q_p90`, `regla.borde`…) más valores crudos (`q`, `u`, `p`, `m`, `dia`, `tres`, `n`, `rio`, `texto`), con su fuente (`src`) y punto de control (`pid`) opcionales.
- **Preferencia de idioma**: `localStorage["ay_idioma"]` por origen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las claves de cada diccionario existen en `es` y en `en` (hoy 83 + 339 + 146 claves, 0 diferencias).
- **SC-002**: El 100 % de las claves literales usadas en `cliente/` y `admin/` (`t("…")`, `data-i18n*`) están definidas (hoy 0 faltantes).
- **SC-003**: Cambiar de idioma no hace ninguna petición de red en el panel y no cambia la vista activa en la app.
- **SC-004**: El 100 % de los motivos de `/api/estado` se muestran en inglés cuando el idioma es `en` (ninguna clave cruda en pantalla).
- **SC-005**: La elección de idioma persiste tras recargar en el 100 % de los navegadores con `localStorage` disponible.

## Assumptions

- Español de Ecuador con voz «tú» por defecto; el inglés es una ayuda, no la versión de referencia.
- No se usa una librería de i18n ni pluralización: los plurales se resuelven en el texto («reporte(s)»).
- Los textos de los diccionarios son de confianza (los escribe el equipo), por eso pueden ir a `innerHTML` con `data-i18n-html`.
- El servidor sigue enviando el texto en español (`motivo`) para clientes viejos y cachés del service worker.

## Brechas conocidas

- **G-01 (contrato de motivos)**: la constitución (principio IV) y el comentario de `M()` describen los motivos como `{k, v, es}`, pero lo que llega al cliente es `{k, v, src?, pid?}`: `sin_es()` quita `es`, y el español viaja aparte en el campo `motivo` del objeto. Hay que corregir la constitución o el código.
- **G-02 (documentación vieja)**: `README.md` («los motivos que calcula el servidor … son datos y no se traducen») y `PRODUCT.md` («Server-computed reasons … stay as entered») contradicen el comportamiento actual, en el que los motivos sí se traducen. El comentario de `M()` en `api/servidor.py` cita `web/i18n.js`, una ruta que ya no existe (hoy `compartido/i18n.js`).
- **G-03 (textos del servidor solo en español)** que llegan a la pantalla:
  - los mensajes `{"error": …}` de la API, que la app y el panel muestran en toasts;
  - `etiqueta` de las cabeceras (`CABECERAS`: «cabecera cantonal · zona urbana», «cabecera parroquial»), que la app muestra en el buscador y en la ficha del lugar;
  - `ambito_nombre` «Todo el cantón» de los avisos, en la app y en el panel;
  - el nombre por defecto «Cerca de <recinto>» de `/api/lugar` si la app no manda `nombre`;
  - la página `/r/<id>` (título, descripción y vista previa de Open Graph), solo en español;
  - en el panel, `oficial_fuente` y `ambito_tipo` crudos (`recinto`, `rio`…) y `Error <código>` (ver 008 B-06).
- **G-04 (sin comprobación automática)**: nada impide subir una clave solo en `es` o un texto escrito en el HTML; la comparación de claves se hizo a mano para esta spec.
- **G-05**: `I18N.fecha` muestra las horas en la zona del dispositivo; un teléfono con otra zona horaria vería horas distintas a las de Ecuador. [NEEDS CLARIFICATION: ¿se fija `timeZone: "America/Guayaquil"`?]
