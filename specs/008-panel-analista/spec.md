# Feature Specification: Panel del analista

**Feature Branch**: `008-panel-analista`

**Created**: 2026-11-09

**Status**: Implementado

**Input**: Pedido del dueño: un panel protegido para que el analista del equipo de riesgo / UGR compare el nivel estimado con el verificado, fije el nivel verificado con motivo, revise los reportes de los vecinos, cargue las lecturas de las reglas que mandan los vigías por WhatsApp, publique avisos y ajuste la advertencia del INAMHI y el aguaje; servido aparte de la app ciudadana.


> **Nota (2026-11-09, spec 014):** el frontend se migró a React + TypeScript + Vite, y el panel entra con usuarios y roles en lugar del PIN. El comportamiento descrito aquí se conserva; las rutas de archivos y las referencias al PIN, a unpkg o a `sw.js` v1.x corresponden a la versión anterior. Ver [014](../014-usuarios-incidentes-push-react/spec.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar al panel con el PIN (Priority: P1)

El analista abre el panel (`http://127.0.0.1:8091` con Docker, o `http://localhost:8080/panel/` en desarrollo), escribe el PIN y entra. El PIN viaja en la cabecera `X-PIN` en cada petición a `/api/panel/*`; no hay sesión en el servidor.

**Why this priority**: todo lo demás depende de entrar, y el PIN es la única llave del panel.

**Independent Test**: con la app levantada, `POST /api/panel/login` con `X-PIN` correcto responde `200 {"ok": true}`; con uno incorrecto, `401`; tras 5 incorrectos desde la misma IP, `429`.

**Acceptance Scenarios**:

1. **Given** el panel abierto sin PIN guardado, **When** el analista escribe el PIN y pulsa «Entrar» (o Enter), **Then** `entrar()` llama a `POST /api/panel/login`, guarda el PIN en `sessionStorage` (`ay_pin`), oculta `#login`, muestra `#app` y el botón «Salir», carga todo y refresca la Situación y el contador de pendientes cada 60 s.
2. **Given** un PIN incorrecto, **When** se intenta entrar, **Then** la API responde `401 {"error": "PIN incorrecto"}` y el panel llama a `salir()`, que borra `ay_pin` y recarga la página.
3. **Given** 5 intentos fallidos desde la misma IP, **When** llega otro intento, **Then** la API responde `429 {"error": "demasiados intentos con el PIN; espera unos minutos"}` durante 1 min; cada fallo siguiente duplica la espera (2, 4, 8… min) hasta un máximo de 24 h. Un acierto borra el contador de esa IP.
4. **Given** el PIN ya guardado en la pestaña, **When** se recarga la página, **Then** el panel entra solo (`if (PIN) entrar()`).
5. **Given** el analista pulsa «Salir», **Then** se borra `ay_pin` y la página vuelve al ingreso.

---

### User Story 2 - Situación: estimado frente a verificado y fijar el nivel (Priority: P1)

En «Situación» el analista ve, para el cantón, cada río y cada recinto en VIGILANCIA o más (o con nivel verificado), el nivel **estimado** (calculado por el servidor) junto al **verificado** (el que fija él), con el «por qué» del estimado. Puede fijar o retirar el nivel verificado escribiendo un motivo, que queda en el historial.

**Why this priority**: el nivel verificado es lo que la gente ve primero en la app (manda sobre el estimado: recinto > parroquia > corredor del río > cantón).

**Independent Test**: fijar VIGILANCIA a un recinto con motivo; `GET /api/panel/estado?forzar=1` devuelve ese recinto con `oficial: 2`, `oficial_fuente: "recinto"`, y `GET /api/panel/ajustes` lo lista en `historial_niveles`.

**Acceptance Scenarios**:

1. **Given** la pestaña Situación, **When** se carga, **Then** se ven: estimado del cantón (máximo de los recintos), verificado del cantón con su motivo, avisos de advertencia INAMHI / aguaje vigentes y de lluvia desactualizada; la tabla de ríos (puntos de control, estimado, nivel en pleamar si hay aguaje, fuente «modelo»/«medido», motivo técnico, verificado y control para fijarlo); la tabla de recintos con estimado ≥ 2 o con verificado, ordenada de mayor a menor estimado.
2. **Given** un nivel elegido y el motivo vacío, **When** se pulsa «Fijar», **Then** el panel no envía nada, enfoca el motivo y avisa «Escribe el motivo: queda en el registro.» (la API también lo exige: `400`).
3. **Given** el nivel RESPUESTA elegido, **When** se pulsa «Fijar», **Then** el panel pide confirmación (`confirm`) antes de enviar.
4. **Given** «(sin verificar)» elegido, **When** se pulsa «Fijar», **Then** se envía `nivel_cod: null`: se registra una fila con motivo «nivel oficial retirado» (o el escrito) y el ámbito vuelve al estimado.
5. **Given** niveles o motivos elegidos en otras filas sin fijar, **When** la tabla se repinta (fijar otra fila, refresco de 60 s, cambio de idioma), **Then** esos valores se conservan (`pendientesSituacion` / `reponerPendientes`).
6. **Given** el botón «Recalcular con datos nuevos», **When** se pulsa, **Then** se pide `/api/panel/estado?forzar=1`, que salta la caché de 2 min del estado (no la de Open-Meteo: lluvia 60 min, GloFAS 360 min).

---

### User Story 3 - Revisar reportes de los vecinos (Priority: P1)

En «Reportes» el analista filtra por estado (pendientes por defecto, validados, descartados, resueltos, todos), ve cada reporte con su foto, tipo, gravedad, recinto, si está fuera del límite CONALI, id de dispositivo recortado, coordenadas (enlace a OpenStreetMap), vencimiento y votos de los vecinos, y lo **valida** (verifica), **resuelve** o **descarta** con una nota opcional que ve el ciudadano.

**Why this priority**: salvo las calles inundadas, ningún reporte se publica sin esta revisión, y los graves verificados suben la zona a RESPUESTA estimada.

**Independent Test**: con un reporte pendiente con foto, «Descartar» lo deja en `descartado`, borra el archivo de `datos/fotos/` y pone `foto = NULL`.

**Acceptance Scenarios**:

1. **Given** la pestaña Reportes, **When** se abre o cambia el filtro, **Then** se pide `GET /api/panel/reportes?estado=<filtro>` (máx. 300, más nuevos primero) y la pestaña muestra el número de pendientes en `#n-pend`.
2. **Given** un reporte con foto, **When** se pinta, **Then** la foto se pide con `fetch("/api/foto/<id>", {headers: {"X-PIN": PIN}})` y se muestra como `blob:` (se guarda en memoria para no pedirla de nuevo).
3. **Given** un reporte, **When** se pulsa Validar / Resuelto / Descartar, **Then** se envía `POST /api/panel/reportes/<id>` con `{estado, nota}`; la API guarda `estado`, `nota_ugr` (máx. 300; vacía = `NULL`) y `revisado_en`, invalida la caché del estado y el panel recarga la lista, el contador y la Situación.
4. **Given** `estado = descartado`, **When** se guarda, **Then** la foto se borra del disco y de la fila en la misma operación (bajo el candado de la base).
5. **Given** una calle inundada pendiente, **When** se lista, **Then** se marca «ya visible como «aviso de vecinos»» (se publica sin revisión; ver 005).

---

### User Story 4 - Reglas limnimétricas y lecturas de vigías (Priority: P2)

En «Reglas y lecturas» el analista registra la lectura de la regla de un punto de control (P01–P09), a mano o pegando el mensaje de WhatsApp del vigía con el formato `P05 | 21-oct 06:00 | 3,45 m | sube | lluvia sí`, y define el **borde de desborde** de cada punto.

**Why this priority**: con borde y lecturas recientes (≤ 12 h) el nivel del río pasa de «modelo» a «medido», que manda sobre GloFAS (salvo que GloFAS dé RESPUESTA: entonces al menos PREPARACIÓN).

**Independent Test**: guardar el borde de P05 en 4,00 y una lectura de 3,45 m de hace minutos; `GET /api/panel/estado?forzar=1` muestra el río de P05 con `fuente_sugerido: "medido"` y PREPARACIÓN (falta 0,55 m, entre 1 y 0,5 m).

**Acceptance Scenarios**:

1. **Given** el texto del vigía pegado en `#l-texto`, **When** se pulsa «Leer», **Then** el panel separa por `|`, pone el punto en mayúsculas, convierte `21-oct 06:00` a fecha y hora local del año en curso, extrae el número de la lectura (con coma o punto), normaliza «subiendo/bajando» a «sube/baja», marca lluvia si encuentra «sí/si», y pide «Revisa los campos y guarda.» No guarda solo.
2. **Given** un texto con menos de 3 partes, **When** se pulsa «Leer», **Then** avisa del formato esperado y no cambia nada.
3. **Given** los campos llenos, **When** se pulsa «Guardar lectura», **Then** se envía `POST /api/panel/lectura` con la hora convertida a ISO UTC (`toISOString()`) o `null` (= ahora); la API la guarda en hora de Ecuador e invalida el estado.
4. **Given** un borde escrito para un punto, **When** se pulsa «Guardar», **Then** `POST /api/panel/regla` guarda `borde_m` (vacío = sin borde) y el estado se recalcula.
5. **Given** lecturas guardadas, **When** se abre la pestaña, **Then** «Últimas lecturas» muestra las 40 más recientes (de las 12 últimas por punto).

---

### User Story 5 - Publicar y anular avisos (Priority: P2)

En «Avisos» el analista publica un aviso para todo el cantón, una parroquia, el corredor de un río (1,5 km) o un recinto, con nivel, título (máx. 90), texto (máx. 600) y vigencia (1–168 h), y puede anular los publicados. El comportamiento en la app está en 007.

**Why this priority**: es el canal para decir qué hacer cuando cambia el nivel; las reglas anti-saturación evitan que la gente deje de leerlos.

**Independent Test**: publicar 3 avisos NORMAL distintos en 24 h para el mismo ámbito; el cuarto responde `409`. Uno de nivel RESPUESTA se publica igual.

**Acceptance Scenarios**:

1. **Given** el formulario lleno, **When** se pulsa «Publicar», **Then** se envía `POST /api/panel/aviso`; para `canton` el `ambito_id` es `"yaguachi"`.
2. **Given** un aviso de nivel < 4 y ya 3 avisos en 24 h para ese ámbito, o el mismo texto hace < 6 h, o un aviso del mismo nivel hace < 3 h, **When** se publica, **Then** la API responde `409` con el motivo.
3. **Given** un aviso publicado, **When** se pulsa «Anular» y se confirma, **Then** `POST /api/panel/avisos/<id>/anular` lo marca `anulado = 1` y deja de verse en la app.
4. **Given** un aviso de nivel RESPUESTA, **When** se pulsa «Publicar», **Then** el panel pide confirmación («sonará incluso de noche») y, publicado, muestra «Aviso publicado.», vacía título y texto y refresca la lista.
5. **Given** dos clics seguidos en «Publicar», **When** llegan a la API, **Then** las reglas y el guardado van bajo el mismo candado, así que el segundo choca con la anti-saturación (si el nivel es < 4).

---

### User Story 6 - Ajustes: advertencia INAMHI y aguaje (Priority: P3)

En «Ajustes» el analista marca si hay una advertencia vigente del INAMHI (texto y «vigente hasta»), registra el aguaje (fecha final y nota con horas de pleamar), y consulta el historial de niveles verificados (últimos 50).

**Why this priority**: la advertencia sube todo el cantón al menos a VIGILANCIA; el aguaje sube un nivel a los ríos Yaguachi y Babahoyo.

**Independent Test**: marcar la advertencia vigente y guardar; `GET /api/panel/estado?forzar=1` devuelve `advertencia.vigente: true` y ningún recinto por debajo de VIGILANCIA.

**Acceptance Scenarios**:

1. **Given** la advertencia marcada con «vigente hasta» futuro, **When** se guarda, **Then** `POST /api/panel/ajustes` guarda `{vigente, texto (≤ 200), hasta}` y el estado se recalcula; vencida la fecha, deja de aplicar sola.
2. **Given** «Aguaje hasta» con una fecha, **When** se guarda, **Then** el aguaje rige desde ese momento hasta el final de ese día; los ríos Yaguachi y Babahoyo muestran «pleamar: <nivel+1>».
3. **Given** el historial, **When** se fija un nivel, **Then** la tabla de historial se actualiza con hora, ámbito, nivel y motivo.

---

### Edge Cases

- **Sin PIN en la cabecera**: `_pin_ok()` devuelve falso sin contar fallo → `401`. El panel, al recibir `401`, recarga la página: el aviso «PIN incorrecto» apenas se ve.
- **Fallos de PIN por otra ruta**: un `X-PIN` incorrecto en `GET /api/foto/<id>` también cuenta como fallo para esa IP.
- **Contador de fallos**: vive en memoria del proceso (`_fallos_pin`); se pierde al reiniciar la API y se vacía entero si supera 10 000 IP.
- **IP real**: detrás de nginx se usa `X-Real-IP` solo si la conexión viene de `YAGUACHI_PROXIES`; detrás de Cloudflare sin `set_real_ip_from`, todos los intentos cuentan como una sola IP (ver 012).
- **Ruta de panel desconocida** con PIN correcto → `404 {"error": "ruta desconocida"}`.
- **Descartar y luego reabrir**: la API acepta `estado: "pendiente"` (el panel no tiene botón), pero la foto descartada ya no se recupera.
- **Nota vacía al revisar**: sobrescribe `nota_ugr` con `NULL`, incluidas marcas automáticas como «[cerrado por vecinos]». El panel precarga la nota existente en el campo, así que solo se pierde si el analista la borra.
- **Lectura con fecha futura**: el pegado asume el año en curso (p. ej. «21-dic» leído en enero queda en diciembre del mismo año) y la API no rechaza horas futuras; esa lectura queda como «la última» del punto hasta que pase su hora.
- **Punto mal escrito en el pegado** (`P5` en vez de `P05`): el `<select>` queda sin selección y la API responde `400 "punto de control desconocido"`.
- **Valores no numéricos** en `borde_m` o `nivel_cod` → la API responde `500 "error interno"` en vez de `400` (ver B-05).
- **Sin datos de lluvia**: si Open-Meteo no responde, la Situación avisa «La lluvia de Open-Meteo no se pudo actualizar; se usa la última guardada.»

## Requirements *(mandatory)*

### Functional Requirements

**Ingreso y PIN**

- **FR-001**: Toda ruta `/api/panel/*` (GET y POST) DEBE exigir la cabecera `X-PIN` igual a `pin_panel`, comparada en tiempo constante (`hmac.compare_digest`); si no, `401 {"error": "PIN incorrecto"}`.
- **FR-002**: El PIN DEBE tener al menos 12 caracteres. Si `config.json` no tiene PIN o tiene uno más corto, `cargar_config()` genera uno nuevo con `secrets.token_urlsafe(12)` (16 caracteres) y lo guarda; `PIN_PANEL` (variable de entorno) manda sobre `config.json` y la API no arranca si tiene menos de 12.
- **FR-003**: Tras 5 fallos desde una IP, la API DEBE responder `429` durante `min(60 · 2^(n−5), 86400)` segundos (n = fallos acumulados); un acierto borra el contador.
- **FR-004**: El PIN NO DEBE escribirse en los registros salvo una vez, al generarse («PIN NUEVO del panel…»); en los arranques siguientes solo se indica dónde está. Las líneas de registro de `/api/` omiten la query.
- **FR-005**: El panel DEBE guardar el PIN solo en `sessionStorage` (`ay_pin`, se borra al cerrar la pestaña o con «Salir») y mostrarlo como campo `type="password"`.
- **FR-006**: La documentación DEBE indicar cómo leer el PIN del volumen sin publicarlo (ver `quickstart` en `plan.md`); nunca se pega en chats, tickets ni registros.

**Situación y nivel verificado**

- **FR-007**: `GET /api/panel/estado` DEBE devolver el mismo cálculo que `/api/estado` (`calcular_estado`), y con `?forzar=1` recalcularlo sin la caché de 120 s.
- **FR-008**: `POST /api/panel/nivel` DEBE aceptar `ambito_tipo` ∈ {`canton`, `rio`, `parroquia`, `recinto`}, `ambito_id` y `nivel_cod` ∈ {1, 2, 3, 4} o `null`; con nivel, el `motivo` (≤ 300) es obligatorio. Cada llamada AGREGA una fila a `niveles_oficiales` (nunca se edita ni se borra); el vigente por ámbito es la fila de `id` mayor, y `nivel_cod NULL` lo retira.
- **FR-009**: El panel DEBE ofrecer fijar el nivel del cantón (`ambito_id = "yaguachi"`), de cada río (por nombre) y de cada recinto listado (por id). [NEEDS CLARIFICATION: la API acepta `parroquia`, pero el panel no tiene control para fijarlo.]
- **FR-010**: Fijar RESPUESTA DEBE pedir confirmación en el panel.
- **FR-011**: Solo el analista cambia lo verificado: ninguna ruta pública escribe en `niveles_oficiales`.

**Reportes**

- **FR-012**: `GET /api/panel/reportes?estado=` DEBE listar hasta 300 reportes del estado pedido (`todos` = sin filtro; por defecto `pendiente`), con `dispositivo` recortado a 6 caracteres + «…», `foto` booleano, `en_canton` y `revisado_en`; nunca la IP.
- **FR-013**: `POST /api/panel/reportes/<id>` DEBE aceptar `estado` ∈ {`validado`, `descartado`, `resuelto`, `pendiente`} y `nota` (≤ 300); `404` si el id no existe.
- **FR-014**: Al descartar, la API DEBE borrar el archivo de la foto y poner `foto = NULL` en la misma transacción.
- **FR-015**: `GET /api/foto/<id>` DEBE servir la foto al panel con `X-PIN` válido aunque el reporte no esté verificado.

**Reglas y lecturas**

- **FR-016**: `POST /api/panel/lectura` DEBE aceptar `punto_id` existente en `puntos_control`, `lectura_m` (número; acepta coma decimal), `tendencia` ∈ {`sube`, `baja`, `igual`} (otro valor = `NULL`), `lluvia` (booleano), `vigia` (≤ 60) y `hora` ISO 8601 (vacía = ahora), guardada en hora de Ecuador (UTC−5).
- **FR-017**: `POST /api/panel/regla` DEBE guardar o reemplazar el `borde_m` (vacío = `NULL`) y `nota` (≤ 200) del punto.
- **FR-018**: El nivel medido (`nivel_regla`) DEBE usar la última lectura si tiene ≤ 12 h: con borde, > 2 m NORMAL, ≤ 2 m VIGILANCIA, ≤ 1 m PREPARACIÓN, ≤ 0,5 m RESPUESTA; subida ≥ 1 m respecto de la lectura de hace ≥ 24 h → al menos VIGILANCIA; velocidad ≥ 0,3 m/h respecto de la primera lectura de los 70 min previos → al menos PREPARACIÓN. Tendencia y lluvia del vigía se guardan pero no cambian el nivel.
- **FR-019**: El panel DEBE leer el formato de WhatsApp `P05 | 21-oct 06:00 | 3,45 m | sube | lluvia sí` y llenar los campos sin guardar.

**Avisos**

- **FR-020**: `POST /api/panel/aviso` DEBE validar nivel (1–4), ámbito, título (≤ 90) y texto (≤ 600) obligatorios, horas (1–168, por defecto 24) y aplicar, bajo el mismo candado que el guardado, la anti-saturación por ámbito a niveles < 4: máximo `avisos_max_24h_por_ambito` (3) en 24 h, mismo texto no antes de 6 h, mismo nivel que el último no antes de 3 h. [NEEDS CLARIFICATION: la API también se salta estas reglas con `"forzar": true`, que el panel no usa ni la documentación menciona.]
- **FR-021**: `POST /api/panel/avisos/<id>/anular` DEBE marcar `anulado = 1`; `404` si el id no existe.

**Ajustes**

- **FR-022**: `GET /api/panel/ajustes` DEBE devolver advertencia, aguaje, reglas, las 12 últimas lecturas por punto (de las 200 más recientes), puntos de control, los 50 últimos cambios de nivel verificado, los 50 últimos avisos (incluidos anulados), parroquias y recintos ordenados.
- **FR-023**: `POST /api/panel/ajustes` DEBE guardar `advertencia` `{vigente, texto ≤ 200, hasta}` y/o `aguaje` `{hasta (fecha), nota ≤ 200}` en la tabla `ajustes` e invalidar el estado.
- **FR-024**: La advertencia vigente DEBE subir todo recinto y río al menos a VIGILANCIA; el aguaje vigente DEBE calcular `sugerido_pleamar = min(4, nivel + 1)` para los ríos Yaguachi y Babahoyo.

**Despliegue e interfaz**

- **FR-025**: El panel DEBE servirse solo por el servicio `admin` (nginx, `127.0.0.1:${PUERTO_ADMIN:-8091}`), que pasa `/api/` a la API; el servicio `cliente` responde `404` a `/api/panel` y `/api/panel/*`.
- **FR-026**: El panel DEBE enviar `X-Robots-Tag: noindex, nofollow`, CSP sin nada externo (`default-src 'self'`, `img-src 'self' data: blob:`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` y `Permissions-Policy` sin geolocalización ni cámara.
- **FR-027**: Ningún texto de la interfaz va escrito en el HTML o el JS: todo pasa por `I18N` con las claves `panel.*` de `admin/textos-panel.js` (es/en) y las comunes de `compartido/i18n.js`; los motivos del estimado se arman con `I18N.motivo(obj)` (redacción técnica). Los botones generados usan `data-accion` con un único escuchador delegado (sin `onclick`).

### Key Entities

- **Nivel verificado** (`niveles_oficiales`): registro de solo agregar; ámbito (`canton`/`rio`/`parroquia`/`recinto` + id), nivel o `NULL` (retirado), motivo y hora. En el código se llama «oficial» por compatibilidad.
- **Reporte** (`reportes`): ver `data-model.md`; el panel cambia `estado`, `nota_ugr`, `revisado_en` y, al descartar, `foto`.
- **Lectura** (`lecturas`): medición de la regla de un punto de control por un vigía.
- **Regla** (`reglas`): borde de desborde de un punto de control.
- **Aviso** (`avisos`): mensaje del analista con ámbito, nivel y vigencia; se anula, no se borra.
- **Ajustes** (`ajustes`): pares clave/JSON `advertencia` y `aguaje`.
- **Punto de control**: P01–P09 de `compartido/capas/puntos_control.geojson` (río, sitio, celda GloFAS, umbrales P90/Q2/Q5); solo lectura.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con el PIN correcto, el analista ve la Situación completa en una sola carga (`/api/panel/ajustes` + `/api/panel/estado`), sin pasos extra.
- **SC-002**: Un atacante que prueba PINs desde una IP no puede hacer más de 5 intentos sin espera, y después de 10 fallos la espera es ≥ 32 min.
- **SC-003**: El 100 % de los cambios de nivel verificado quedan en `niveles_oficiales` con hora y motivo (ninguna ruta los borra).
- **SC-004**: Descartar un reporte con foto deja 0 archivos de esa foto en `datos/fotos/`.
- **SC-005**: Pegar un mensaje bien formado del vigía llena los 5 campos y guardar toma 2 pulsaciones («Leer» y «Guardar lectura»).
- **SC-006**: Desde la app ciudadana (puerto público) el 100 % de las peticiones a `/api/panel/*` responden `404`.

## Assumptions

- Hay un solo analista o un equipo pequeño que comparte el PIN; no hay cuentas ni roles (pendiente: autenticación individual, ver `docs/seguridad.md`).
- El panel se usa en un computador de escritorio desde el mismo equipo donde corre Docker, o detrás de Cloudflare Access si se usa desde fuera.
- Los vigías mandan las lecturas por WhatsApp en español con el formato acordado; el analista las revisa antes de guardar.
- Las horas se interpretan en la zona del navegador del analista (Ecuador) y la API guarda en UTC−5.
- La API corre con Python 3.12 en Docker (`api/Dockerfile`).

## Brechas conocidas

- **B-01 (corregida durante esta documentación, 2026-11-09)**: el manejador de `#a-publicar` en `admin/panel.js` declaraba `const t = $("#a-tipo").value`, que tapaba la función de traducción `t`: los avisos RESPUESTA no se podían publicar y los demás mostraban «t is not a function». Hoy la variable se llama `ambito`. Falta probarlo en la app levantada (T049).
- **B-02 (validación)**: `advertencia.hasta` y `aguaje.hasta` no se validan al guardar. Una fecha mal escrita, o un `hasta` sin zona horaria enviado por API, hace fallar `calcular_estado()` y deja en `500` a `/api/estado` para todos hasta corregirlo.
- **B-03 (Python 3.10)**: el panel envía horas con `toISOString()` (sufijo `Z`), que `datetime.fromisoformat` solo acepta desde Python 3.11. Con el 3.10 que permite la constitución, guardar una lectura con hora falla (`500`) y una advertencia con «vigente hasta» rompe el estado (como en B-02). En Docker (3.12) funciona.
- **B-04 (aguaje)**: el texto del panel dice que los ríos suben un nivel «en pleamar (de 2 h antes a 2 h después)», pero el código aplica `sugerido_pleamar` todo el día mientras dure el aguaje, y los recintos cercanos a esos ríos heredan siempre el nivel de pleamar.
- **B-05 (validación)**: `nivel_cod`, `borde_m` y `hora` no numéricos o mal formados dan `500` en vez de `400`; `lectura_m` acepta `nan`/`inf`; `ambito_id` no se comprueba contra los recintos o ríos existentes; las lecturas con hora futura se aceptan.
- **B-06 (i18n)**: el panel muestra sin traducir `oficial_fuente` (`recinto`, `parroquia`, `rio`, `canton`) en la tabla de recintos, `ambito_tipo` en el historial, `ambito_nombre` «Todo el cantón», el texto `Error <código>` y los mensajes de error de la API, que solo existen en español.
- **B-07 (PIN)**: el campo del PIN tiene `inputmode="numeric"`, pero el PIN generado es alfanumérico (`token_urlsafe`): en una tableta el teclado numérico no permite escribirlo.
- **B-08 (texto)**: `panel.login.texto` dice que el PIN «se muestra al arrancar el servidor», pero solo se muestra cuando se genera uno nuevo.
- **B-09 (desarrollo)**: sin Docker (`python api/servidor.py --estaticos cliente --admin admin`), la API escucha en `0.0.0.0` y sirve el panel en `/panel/`, así que el panel queda accesible desde la red local.
- **B-10 («Recalcular»)**: el botón «Recalcular con datos nuevos» salta solo la caché de 2 min del estado; no vuelve a pedir datos a Open-Meteo antes de que venza su caché.
