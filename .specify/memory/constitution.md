<!--
Informe de sincronización
- Versión: 0.0.0 (plantilla) → 1.0.0 → 1.0.1 (PATCH: formato real de los motivos; VERSION del SW del panel)
  → 2.0.0 (MAJOR, 2026-11-09, pedido del dueño: frontends en React + TypeScript + Vite; la API admite
  dependencias de pip fijadas y justificadas (firebase-admin); el PIN del panel se reemplaza por usuarios, roles y captcha;
  V admite cuentas solo para el equipo del panel y la autoría de incidentes)
  → 2.1.0 (MINOR, 2026-11-09, pedido del dueño: la base de datos es PostgreSQL —servicio `db`— en lugar de SQLite;
  carga y placeholders obligatorios en toda vista que espera datos)
  → 2.2.0 (MINOR, 2026-11-10, pedido del dueño: cuentas ciudadanas opcionales con registro propio (cédula);
  se puede reportar de forma anónima; V ya no dice que los ciudadanos no tienen cuentas)
  → 2.3.0 (MINOR, 2026-11-11, pedido del dueño, spec 020: la caché compartida de datos de terceros es Redis
  —servicio `redis`— y la API admite el paquete `redis`)
  → 2.4.0 (MINOR, 2026-11-11, pedido del dueño: en I, «Qué hacer ahora» va plegado en la primera pantalla; «¿qué hago?»
  queda a un toque en lugar de a la vista)
  → 2.4.1 (PATCH, 2026-11-12: Service workers aclara el id de build automático de la app ciudadana)
  → 2.5.0 (MINOR, 2026-11-12, pedido del dueño, spec 021: V suma el conteo de alcance de avisos e incidentes,
  anónimo y sin terceros)
  → 2.6.0 (MINOR, 2026-11-12, pedido del dueño: en V, el superadmin ve los teléfonos del alcance por código, sin nombres)
  → 2.7.0 (MINOR, 2026-11-12, pedido del dueño: en V, la app avisa su uso para la pestaña «Dispositivos»)
  → 2.7.1 (PATCH, 2026-11-12: el uso suma marca, versión del sistema y formato; nunca el modelo)
  → 2.8.0 (MINOR, 2026-11-12, pedido del dueño, spec 022: II suma «confirmado por vecinos», distinto de «verificado»)
- Principios nuevos: I a VII (primera ratificación)
- Secciones nuevas: Restricciones técnicas, Flujo de trabajo y calidad, Gobierno
- Plantillas revisadas: plan-template.md (la «Constitution Check» se cumple con la lista de compuertas de abajo) ✅,
  spec-template.md ✅, tasks-template.md ✅ (sin cambios necesarios)
- Pendiente: ninguno
-->

# Constitución de Yaguachi Weather

Yaguachi Weather es una PWA de alertas de inundación para el cantón San Jacinto de Yaguachi (Guayas, Ecuador): una app ciudadana, un panel para el analista de riesgo y una API. Su contexto de producto está en `PRODUCT.md` y su sistema visual en `DESIGN.md`. Esta constitución fija lo que no se negocia al cambiar el proyecto.

## Principios

### I. Se usa con un teléfono de gama baja, bajo estrés y con mala señal

Quien abre la app puede estar con el agua en la puerta, con un teléfono de gama baja, datos limitados y señal intermitente.

- Toda pantalla DEBE funcionar a 360 px de ancho, con objetivos táctiles de al menos 44 px y texto legible al sol.
- La app DEBE seguir siendo útil sin conexión: el service worker sirve la última versión, las capas y las teselas vistas, y los reportes enviados sin señal quedan en cola y se reenvían.
- La primera pantalla DEBE responder «¿estoy en peligro?» sin desplazarse, y «¿qué hago?» a un toque: «Qué hacer ahora» está en esa pantalla, plegado (pedido del dueño, 2026-11-11, para que no ocupe espacio).
- Ninguna vista queda en blanco mientras carga:
  - Muestra un placeholder con la forma del contenido.
  - Muestra una barra de carga si algo tarda más de 400 ms.
  - Avisa si la conexión está lenta.
  - Si hay datos guardados, los muestra en lugar del placeholder.
- Las capas pesadas se cargan bajo demanda; los vectores del mapa se dibujan en canvas.

**Por qué:** si la app falla en ese momento, falla en el único momento que importa.

### II. Honestidad del nivel

- El semáforo es fijo y sale del plan cantonal y del COE: verde NORMAL `#1a9641`, amarillo VIGILANCIA `#ffd92f`, naranja PREPARACIÓN `#fd8d3c` y rojo RESPUESTA `#d7191c`. Esos colores solo se usan para decir un nivel.
- El nombre del nivel siempre va escrito: el color nunca va solo.
- Todo nivel DEBE decir de dónde sale: estimado por modelo, reportado por vecinos, verificado por el analista o escenario de planificación.
- Un reporte que publican varias personas distintas del mismo sector sale «confirmado por N vecinos» (spec 022), nunca «verificado». No publica fotos ni cuenta para el nivel hasta que el analista lo verifique. Los escenarios nunca se presentan como pronóstico.
- La app NO es oficial: no imita el sello, el escudo ni el tono del COE, la SGR o el INAMHI, y lo dice.
- Los textos son propios. No se copian textos, escalas ni pantallas de otras apps.

**Por qué:** una alerta que exagera o aparenta ser oficial le quita confianza a la próxima, y copiar textos de otras apps expone a problemas legales.

### III. Pila mínima y código limpio

- **API:** Python 3.10 o superior sobre la biblioteca estándar (`http.server`).
  - La base de datos es **PostgreSQL 17**, en el servicio `db` de Docker, con `psycopg` 3. Las migraciones son versionadas e idempotentes, y todo el SQL usa parámetros.
  - La caché compartida de datos de terceros (satélite, rayos, lluvia: spec 020) es **Redis**, en el servicio `redis` de Docker, sin disco y con tope de memoria. Si no responde, la API sigue con la memoria del proceso.
  - Los paquetes de pip se permiten solo cuando la biblioteca estándar no alcanza; hoy, `firebase-admin` para web push y `redis` para esa caché.
  - Cada paquete va con versión fija en `api/requirements.txt`. `firebase-admin` es opcional en tiempo de ejecución: si falta, el push se apaga sin romper la API. `psycopg` es obligatorio.
- **Frontends:** React y TypeScript (`strict`), construidos con Vite.
  - Se organizan por funcionalidad (`src/features/*`, `src/shared/*`), con componentes pequeños, la lógica en hooks y sin estado global innecesario.
  - No se usan librerías de router ni de componentes de interfaz.
- **Mapa:** Leaflet desde npm, empaquetado.
- **Estilos:** Tailwind v4 con `@tailwindcss/vite`.
- **Dependencias:** cada una nueva (npm o pip) DEBE justificarse en el plan de su funcionalidad (sección «Complexity Tracking»). Las versiones quedan fijadas en `package-lock.json` y `requirements.txt`.
- **Peso:** lo pesado y opcional, como Firebase, se carga de forma perezosa. El bundle inicial del cliente se mide y se informa en cada plan.

**Por qué:** lo mantiene un equipo pequeño. React y TypeScript los pidió el dueño (2026-11-09) para tener código limpio y mantenible; el resto de la pila sigue siendo mínima, porque cada dependencia es algo más que se rompe.

### IV. Tailwind, i18n e Impeccable en toda la interfaz

- **Estilos:** solo utilidades de Tailwind y los tokens de `@theme` de la hoja de entrada de cada frontend. No hay otras hojas CSS escritas a mano.
- **Textos:** NINGÚN texto visible va escrito directo en JSX, en el HTML ni en el TS.
  - Todo pasa por el motor `compartido/i18n/motor.js`, mediante `I18N.t()` o el hook `useI18n()` de cada app, con español e inglés completos y el selector de idioma visible.
  - Los errores de la API traen una clave `k` que el front traduce.
  - Los motivos que envía el servidor llegan estructurados (`{k, v}`, más `src`/`pid` cuando aplica; el texto en español viaja aparte en `motivo`) y se traducen en el cliente.
- **Revisión:** cada cambio de interfaz pasa por el detector de Impeccable (`impeccable detect`) hasta 0 hallazgos. No se permiten bordes laterales de color, gradientes en texto, tarjetas idénticas repetidas ni otros rasgos de «hecho por IA».

**Por qué:** lo pidió el dueño del producto como regla permanente; mantiene coherente y traducible el sistema visual.

### V. Privacidad por defecto (LOPDP)

- **Ciudadanos:** cada teléfono se identifica con un id aleatorio generado con `crypto`. La cuenta (registro propio, spec 018) es opcional: sin ella se ve todo, se comparte y se reporta de forma anónima; con ella, el vecino puede ligar sus reportes a su cuenta o enviarlos como anónimos.
  - La cuenta guarda nombres, apellidos, cédula, correo, contraseña (scrypt) y una foto opcional, con consentimiento explícito al crearla. No se pide teléfono.
  - El nombre, la cédula y la foto del vecino nunca se publican con sus reportes. La persona elimina su cuenta desde la app, en el momento.
- **Equipo del panel:** solo sus integrantes tienen cuenta (usuario, nombre y rol).
  - El nombre del autor de un incidente se publica, salvo que el superadmin active el anonimato.
  - Nunca se exponen el id, el usuario ni el correo del autor.
- **Push:** los tokens de web push se guardan solo con el recinto y el idioma, y se borran cuando FCM los invalida o cuando la persona se da de baja.
- Enviar un reporte requiere consentimiento explícito.
- Plazos de borrado:
  - La foto de otra persona solo se publica si el analista verifica el reporte.
  - Las fotos se borran a los 90 días, y al descartarse el reporte.
  - La IP se borra a las 48 h.
- **Alcance de avisos e incidentes** (spec 021): la app cuenta qué avisos e incidentes del equipo abrió cada teléfono, para que el panel muestre a cuántos teléfonos llegaron. Se guarda solo una firma de una sola vía del id del teléfono (HMAC con la llave del servidor), nunca el id, el nombre ni la ubicación. El panel ve números. Solo el superadmin (permiso `alcance.detalle`, cada consulta en la auditoría) ve la lista de teléfonos por un código derivado de esa firma, con el tipo de teléfono aproximado (sistema y navegador) y, si tienen notificaciones, recinto e idioma; nunca nombres, números ni ubicación. La IP se borra a las 48 h.
- **Uso de la app** (pestaña «Dispositivos», solo superadmin): la app avisa, como mucho cada 6 h mientras se usa, la misma firma, el tipo aproximado, la marca (nunca el modelo, que no sale del teléfono), la versión mayor del sistema, el formato (teléfono, tablet o computadora), si está instalada, el idioma y la versión. Se borra a los 180 días sin uso y el panel la muestra por código, sin nombres.
- No hay analítica de terceros ni cookies de seguimiento. `localStorage` solo guarda preferencias, y la persona puede borrarlo desde «Privacidad».
- Los datos personales nunca van en la URL de una petición nueva. El id del teléfono viaja en la cabecera `X-Dispositivo`.

### VI. Seguridad y separación api / cliente / admin

- Son tres servicios.
  - La `api` no publica puertos.
  - El `cliente` es público y responde 404 a `/api/panel/*`.
  - El `admin` solo escucha en 127.0.0.1 o detrás de Cloudflare Access.
- **Acceso al panel:**
  - Se entra con usuario y clave (`scrypt`, 12 caracteres como mínimo), con captcha (Cloudflare Turnstile) y con espera creciente tras intentos fallidos.
  - La sesión va en una cookie `HttpOnly` + `SameSite=Strict`, y las escrituras exigen la cabecera anti-CSRF.
  - Los roles (superadmin, analista, operador) se verifican en la API, en cada ruta.
  - Nunca puede quedar el sistema sin un superadmin activo, y toda acción del panel queda en la auditoría.
- Las claves, los tokens y las credenciales de Firebase nunca aparecen en registros, chats ni tickets, ni en el repositorio.
- Toda escritura pública tiene un límite por dispositivo y por IP, y se comprueba de forma atómica.
- **Datos:**
  - Todo SQL usa parámetros.
  - Todo texto de usuario pasa por `esc()` antes de ir al HTML.
- **Cabeceras:**
  - CSP sin scripts en línea, ni siquiera `onclick`.
  - `X-Frame-Options: DENY`, `nosniff` y `Permissions-Policy`.
- Lo verificado por el analista solo lo cambia el analista.
- Los detalles y la guía de Cloudflare están en `docs/seguridad.md`.

### VII. Se prueba de verdad y sin tocar los datos reales

- Un cambio se da por bueno cuando:
  - se probó en la app levantada (`PUERTO=8090 docker compose up -d --build`);
  - se revisó en el navegador a 360 px y en escritorio;
  - la consola está sin errores;
  - para la API, se probó con peticiones reales.
- Las pruebas usan un servidor aislado con un directorio de datos temporal. NUNCA se crean datos de prueba en los volúmenes `yaguachi-weather_datos` ni `yaguachi-weather_pg`, ni en la base de producción, y no se ejecuta `docker compose down -v` sin pedirlo el dueño. Las pruebas de la API usan un PostgreSQL de pruebas aparte.

## Restricciones técnicas

- **Estructura:**
  - `api/` contiene `servidor.py` y sus módulos, `requirements.txt` y `tests/`.
  - `cliente/` es la PWA ciudadana y `admin/` es el panel PWA; los dos son proyectos de Vite.
  - `compartido/` reúne el motor i18n (`compartido/i18n/motor.js`), las capas GeoJSON y el logo.
- La configuración y los secretos se pasan por variables de entorno (`.env`, a partir de `.env.example`) y por archivos de secretos montados en Docker. Nunca van en el repositorio.
- Capas GeoJSON en WGS84, con 6 decimales como máximo. Se generan con `preparar_capas.py`.
- **Service workers:** cada despliegue con cambios en el cliente o en el panel DEBE subir la `VERSION` de su service worker (v2.0, v2.1…), o los equipos seguirán con lo viejo. En la app ciudadana el build le suma además un id único (`__BUILD__`, spec 011): cada despliegue tiene su caché aunque se olvide subir el número, y la app detecta la versión nueva por `/version.json` y se actualiza sola.
- **Puertos:** en la máquina de desarrollo el 8080 está ocupado, así que la app va en el 8090 y el panel en el 8091.

## Flujo de trabajo y calidad

- Cada funcionalidad nueva o cambio de comportamiento tiene su carpeta en `specs/NNN-nombre/`, con `spec.md`, `plan.md` y `tasks.md`, y cuando aplica también `data-model.md` y `contracts/`. Se usan los comandos `/speckit-specify`, `/speckit-plan`, `/speckit-tasks` e `/speckit-implement`.
- Las specs de lo ya construido están marcadas como **Implementado** y describen el comportamiento real. Si el código y la spec difieren, se corrige uno de los dos en el mismo cambio.
- Compuertas para cerrar un cambio (la «Constitution Check» de cada plan):
  1. Detector de Impeccable en 0 hallazgos; además, `tsc`, ESLint y las pruebas (Vitest en los frontends, `unittest` en la API) en verde.
  2. Textos nuevos en `es` y en `en`.
  3. `VERSION` del service worker subida.
  4. Sin dependencias nuevas sin justificar.
  5. Límites y validación en toda escritura nueva de la API.
  6. Probado en la app levantada.
- Commits solo cuando el dueño los pide, en una rama distinta de `main`.

## Gobierno

Esta constitución manda sobre cualquier otra práctica del proyecto. Un cambio a un principio requiere:

- explicar por qué;
- subir la versión: MAJOR si quita o redefine un principio, MINOR si agrega uno, PATCH si solo aclara;
- revisar las plantillas de `.specify/templates/`.

Cada plan verifica la «Constitution Check» contra las compuertas de arriba, y toda violación se justifica en «Complexity Tracking».

**Versión**: 2.8.0 | **Ratificada**: 2026-11-09 | **Última enmienda**: 2026-11-12
