# Feature Specification: Usuarios y roles del panel, incidentes del equipo, web push y migración a React

**Feature Branch**: `014-usuarios-incidentes-push-react`

**Created**: 2026-11-09

**Status**: Implementado (push pendiente de probar con credenciales reales de Firebase)

**Input**: Pedido del dueño:

> para el admin coloca el módulo de usuarios y roles para que puedan acceder al panel; ahora tendrás inicio de sesión, estarás protegido por captcha, pero solo el admin; el cliente normal, ese es público. Desde el admin también puedes hacer reportes de incidentes y esos reportes los podrán ver los clientes, pero ahí sí saldrá el nombre de quien lo publicó, a no ser que el superadministrador, con una opción de configuración, lo desactive y la gente vea el reporte como anónimo. Cuando se publique una notificación desde el admin llegará un evento web push a las PWA cliente; para ello vamos a configurar Firebase. Migrar a React con clean code.

El contrato técnico está en [contracts/api.md](contracts/api.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El equipo entra al panel con su cuenta (Priority: P1)

Cada integrante del equipo de riesgo entra con su usuario, su clave y un captcha. Ve solo lo que su rol le permite.

**Why this priority**: el PIN compartido no dice quién hizo qué, y no se puede revocar para una sola persona.

**Independent Test**:
1. Levantar la app y entrar con `admin` y la clave inicial: el panel obliga a cambiarla.
2. Crear un operador y entrar con él: no ve «Usuarios», «Configuración» ni «Fijar nivel».

**Acceptance Scenarios**:

1. **Given** una base sin usuarios, **When** arranca la API, **Then** crea el superadmin `admin`, con una clave temporal mostrada una sola vez y el cambio de clave obligatorio.
2. **Given** el ingreso, **When** el captcha falla, **Then** no se valida la clave y se muestra «Confirma que no eres un robot».
3. **Given** 5 claves equivocadas, **When** llega otro intento, **Then** 429 con espera creciente.
4. **Given** un operador, **When** llama a `/api/panel/nivel`, **Then** recibe 403, aunque el botón no se muestre.
5. **Given** el último superadmin activo, **When** alguien intenta desactivarlo o quitarle el rol, **Then** 409.

---

### User Story 2 - El equipo publica incidentes con su nombre (Priority: P1)

Un analista u operador publica un incidente desde el panel: tipo, gravedad, descripción, ubicación en el mapa y foto opcional. Los vecinos lo ven en el mapa y en «Vecinos», firmado con su nombre.

**Independent Test**: publicar un incidente desde el panel y verlo en la app ciudadana con «Publicado por <nombre>».

**Acceptance Scenarios**:

1. **Given** un incidente publicado por María López, **When** un vecino lo abre, **Then** ve «Publicado por María López · Equipo de riesgo», distinto de los avisos de vecinos.
2. **Given** que el superadmin activa «incidentes anónimos», **When** un vecino abre ese mismo incidente, **Then** ve «Equipo de riesgo», sin nombre. La API ya no envía el nombre.
3. **Given** un incidente retirado, **When** se abre la app, **Then** ya no aparece.

---

**Añadido 2026-11-10 (pedido del dueño): solo el superadmin**

- **Elimina un incidente:** botón «Eliminar» con confirmación. A diferencia de los avisos, el borrado es definitivo: el texto puede ser ofensivo o tener datos personales. En la auditoría queda quién lo borró y qué era, sin la descripción.
- **Vuelve a presentar un incidente retirado:** botón «Volver a presentar». Conserva la fecha de publicación y, si ya había vencido, vuelve a vencer según su tipo, contado desde ahora.
- El analista y el operador reciben 403 en las dos acciones.

---

### User Story 3 - Los avisos llegan como notificación push (Priority: P1)

El vecino activa las notificaciones en «Avisos». Cuando el analista publica un aviso para su zona, le llega una notificación aunque la app esté cerrada.

**Independent Test**: con Firebase configurado (`docs/firebase-y-captcha.md`), activar las notificaciones en Chrome, publicar un aviso y recibirlo con la app cerrada.

**Acceptance Scenarios**:

1. **Given** Firebase sin configurar, **When** se abre «Avisos», **Then** la app sigue con las notificaciones locales, sin errores.
2. **Given** un aviso de nivel 1–2 publicado en horas de silencio, **When** llega la hora, **Then** se envía al terminar la franja. Los de nivel 3–4 se envían de inmediato.
3. **Given** un token que FCM marca como inválido, **When** falla el envío, **Then** la API lo borra.

---

### User Story 4 - App y panel en React, sin perder nada (Priority: P2)

La app ciudadana y el panel se reescriben en React + TypeScript con el mismo diseño y las mismas funciones (specs 002–013).

**Independent Test**: recorrer las pruebas «Cómo probar» de las specs 002–013 sobre la versión React: el mismo resultado, la consola limpia y 0 hallazgos de Impeccable.

### Edge Cases

- Sesión vencida a mitad de una tarea: el panel vuelve al ingreso sin perder el formulario abierto, si es posible.
- Un usuario desactivado con una sesión abierta: la siguiente petición responde 401.
- Push en iPhone: solo con la app instalada e iOS 16.4 o superior.
- Sin captcha configurado en producción: se usan las claves de prueba, que siempre pasan. `docs/firebase-y-captcha.md` advierte que hay que configurarlas.

## Requirements *(mandatory)*

Detallados en [contracts/api.md](contracts/api.md). Resumen:

- **FR-001**: ingreso con usuario, clave (`scrypt`) y Turnstile; cookie `HttpOnly` + `SameSite=Strict`; cabecera anti-CSRF; espera creciente.
- **FR-002**: roles superadmin, analista y operador, con los permisos verificados en la API, en cada ruta. Auditoría de las acciones.
- **FR-003**: gestión de usuarios (crear, editar, activar o desactivar, restablecer la clave), sin quedarse nunca sin un superadmin.
- **FR-004**: configuración `incidentes_anonimos`, aplicada al leer.
- **FR-005**: incidentes del equipo, publicados al instante con `origen = 'equipo'` y autor.
- **FR-006**: web push con FCM:
  - suscripción con recinto e idioma;
  - envío por ámbito al publicar un aviso;
  - horas de silencio;
  - borrado de tokens inválidos.
- **FR-007**: frontends en React + TypeScript + Vite + Tailwind v4, con el motor i18n compartido y PWA en los dos.

## Success Criteria *(mandatory)*

- **SC-001**: 0 rutas de `/api/panel/*` accesibles sin sesión, o con un rol sin permiso (pruebas automatizadas).
- **SC-002**: un aviso publicado llega como push en menos de 60 s (fuera de las horas de silencio).
- **SC-003**: el nombre del autor no aparece en ninguna respuesta pública con el anonimato activo.
- **SC-004**: la versión React mantiene el 100 % de las funciones de las specs 002–013. Bundle inicial del cliente: menos de 200 KB gzip, sin contar Leaflet y Firebase, que se cargan aparte.

## Assumptions

- **Captcha:** Cloudflare Turnstile, que encaja con el plan de publicar detrás de Cloudflare y tiene claves de prueba para el desarrollo local.
- **Roles:** los tres de la tabla del contrato. Si hacen falta más, se agregan en el mapa de permisos de la API.
- **Firebase:** lo configura el dueño (`docs/firebase-y-captcha.md`). La credencial va en `secretos/`.
