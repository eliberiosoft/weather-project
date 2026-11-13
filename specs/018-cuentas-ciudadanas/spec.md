# Feature Specification: Cuentas ciudadanas (registro propio), modo invitado y protección de pantalla

**Feature Branch**: `feat/cuentas-ciudadanas`

**Created**: 2026-11-10

**Status**: Implementado

**Input**: Pedidos del dueño (2026-11-10):
- «La aplicación cliente permitirá registrarse e iniciar sesión con Facebook; también tendrá la opción de ingresar como invitado, pero como invitado no podrá reportar ni compartir un incidente; adicional, bloquea que puedan capturar la pantalla por seguridad.»
- «Descarta Firebase; hagámoslo solo con Facebook y con registro normal. El registro me interesa: nombres, apellidos, cédula, email y foto, que puede ser opcional y podrá cambiarla luego.»
- «Si inicia con Facebook y ese usuario no existe, lo debe crear en mi base.»
- «Entonces quita Facebook, mucho problema; quedémonos con el registro nomás.» (Meta exige verificar el negocio para publicar la app.)
- «Al iniciar el cliente puede ver todo; no presentes la pantalla de iniciar sesión o de entrar como invitado; cuando vayas a reportar da la opción de reportar de manera anónima; el inicio de sesión o el registro es opcional.»
- «Nombres y apellidos en un solo renglón [una sola caja de texto]; la cédula, numérica de 10 y ecuatoriana válida; la clave, 6 como mínimo: eso ya es responsabilidad de cada quien.»

Contrato: [contracts/api.md](contracts/api.md). Enmienda el principio V de la constitución (2.2.0).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear la cuenta con el registro propio (Priority: P1)

**Independent Test**: abre la app sin datos guardados → «Crear cuenta» → llena «Nombres y apellidos» (una sola caja), cédula, correo y contraseña de 6 o más (la foto es opcional) → acepta la política → «Crear cuenta». La cabecera muestra tu foto o tu inicial y ya puedes reportar.

**Acceptance Scenarios**:

1. **Given** la primera apertura, **Then** sale la pantalla de ingreso y no se cierra sin elegir. El botón del 911 sigue a la vista.
2. **Given** un dato inválido (cédula que no son 10 números o con dígito verificador malo, correo sin dominio, contraseña de menos de 6), **Then** se marca el campo con su error antes de enviar; la API valida lo mismo.
3. **Given** una cédula o un correo ya registrados, **Then** 409 y el mensaje «inicia sesión».
4. **Given** una cuenta, **When** inicia sesión con su correo o su cédula y su contraseña, **Then** entra. Tras 5 fallos seguidos, espera creciente.

### User Story 3 - Perfil y foto (Priority: P2)

1. **Given** «Mi cuenta», **Then** se ve la foto (o la inicial), el nombre, la cédula a medias y el correo; se puede cambiar o quitar la foto, corregir nombres y apellidos y correo (la cédula no cambia), cerrar sesión y eliminar la cuenta (dos toques; los reportes quedan sin autor).

### User Story 4 - Sin cuenta: ver todo y reportar de forma anónima (Priority: P1)

1. **Given** la app abierta por primera vez, **Then** no se pide ingresar: se ven niveles, mapa, avisos y Vecinos, y se puede compartir.
2. **Given** alguien sin cuenta en el último paso de «Reportar», **Then** ve «Se envía de forma anónima» y, si quiere, «Iniciar sesión».
3. **Given** alguien con cuenta, **Then** elige «Como {nombre}» o «Anónimo»; anónimo no liga el reporte a la cuenta.
4. **Given** reportes en la cola sin conexión, **Then** se envían solos, con o sin cuenta.

### User Story 5 - Protección de pantalla (Priority: P2)

1. **Given** la app abierta, **When** pierde el foco o pasa a segundo plano, **Then** una portada tapa el contenido hasta volver.
2. **Given** un atajo de captura (Impr Pant, Cmd+Shift+3/4/5/6, Win+Shift+S) o de impresión, **Then** la portada tapa la app hasta tocar «Volver a la app»; con Impr Pant además se vacía el portapapeles; imprimir sale en blanco.
3. **Given** una foto, **Then** no hay menú de «guardar imagen» ni se puede arrastrar; el texto no se selecciona fuera de los campos.

**Límite conocido**: una página web no puede impedir la captura del sistema operativo (botones físicos del teléfono, grabación de pantalla). Es una barrera disuasiva; el bloqueo real (FLAG_SECURE en Android) exige empaquetar la app como nativa.

## Requirements *(mandatory)*

- **FR-001**: Registro propio con nombres y apellidos en un solo campo (al menos dos palabras), cédula ecuatoriana (10 dígitos, módulo 10, única), correo (único), contraseña de 6 a 128 (scrypt) y foto opcional; consentimiento explícito con fecha.
- **FR-002**: Ingreso con correo o cédula; bloqueo por fallos.
- **FR-003**: La cuenta es opcional: se reporta y comparte sin ella (anónimo). Con cuenta, el reporte se liga a ella salvo que elija «anónimo»; tope de reportes por cuenta y hora.
- **FR-004**: Nombre, cédula y foto nunca se publican con los reportes.
- **FR-005**: La foto de perfil se cambia o se quita cuando la persona quiera; se sirve solo a su dueño.
- **FR-006**: Eliminar la cuenta borra datos, sesiones y foto; los reportes quedan sin autor.
- **FR-007**: La política de privacidad describe los datos y la baja.
- **FR-008**: No hay recuperación de contraseña por correo (la API no envía correos): queda como mejora.
- **Descartado**: Google y Facebook (ver la historia en contracts/api.md).
