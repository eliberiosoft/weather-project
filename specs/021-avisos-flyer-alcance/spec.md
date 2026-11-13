# Feature Specification: avisos con flyer, compartir y alcance de avisos e incidentes

**Feature Branch**: `feat/avisos-flyer-alcance`

**Created**: 2026-11-12

**Status**: Implementado

**Input**: Pedido del dueño: «El administrador o el analista quieren lanzar un aviso: dale la oportunidad de que puedan colocar una imagen tipo flyer para que, cuando los usuarios abran el push, puedan ver esa imagen también. Diseña mejor el card de avisos y dale la oportunidad de que lo puedan compartir. También, para avisos e incidentes, si un usuario lo abrió, para el administrador y el analista quiero ver el alcance de esas publicaciones: no que salgan los nombres, pero sí el número de dispositivos que las leyeron.»

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publicar un aviso con flyer (Priority: P1)

1. **Given** el formulario «Publicar aviso» del panel (superadmin y analista, permiso `avisos.publicar`), **Then** hay un campo opcional «Imagen tipo flyer»:
   - se elige una imagen, se ve la vista previa con su peso y se puede quitar;
   - el panel la redibuja en un canvas a JPEG de 1600 px como máximo (calidad 0,82), o de 1280 px si pesa más de 1,5 MB. Así se pierden los metadatos de la cámara, ubicación incluida.
2. **Given** un flyer que no es JPEG, o que es más grande que `max_foto_kb`, **Then** la API responde 400 (`foto.formato` o `foto.invalida`) y no se publica nada.
3. **Given** un aviso con flyer, **Then**:
   - la API lo guarda en `datos/fotos/avisos/<uuid>.jpg`, aparte de las fotos de reportes y de su limpieza;
   - lo sirve en `GET /api/avisos/<id>/flyer`, con `?v=` del nombre y caché de 30 días `immutable`. Si el aviso está anulado o eliminado, responde 404.

### User Story 2 - Ver el flyer al abrir la notificación (Priority: P1)

1. **Given** un aviso con flyer, **Then** el push lleva `imagen` y la notificación lo muestra grande en Android y en computadoras (iPhone lo ignora). La notificación local, la que se arma con la app abierta, también.
2. **Given** que se toca la notificación, **Then** la app abre `#avisos/<id>/push`:
   - lleva a la tarjeta y la resalta unos segundos;
   - abre el flyer a pantalla completa en el visor de la app;
   - cuenta que se abrió desde la notificación.

   Si el aviso ya no está vigente, lo dice.

### User Story 3 - Tarjeta de aviso más clara y para compartir (Priority: P1)

1. **Given** un aviso vigente en «Avisos», **Then** la tarjeta muestra, de arriba abajo:
   - la franja del nivel (nombre escrito sobre su color) y el ámbito;
   - el flyer, si hay; se toca para verlo entero;
   - «Publicado hace X · Vigente hasta …»;
   - el título grande y el texto;
   - una fila para compartir: WhatsApp, Facebook, «Copiar enlace» y, si el teléfono lo permite, «Compartir» (menú del sistema).
2. **Given** el enlace compartido `/a/<id>`, **Then** la página trae Open Graph, con el flyer como imagen (o el ícono si no hay), y abre `#avisos/<id>` en la app. Un aviso anulado o eliminado lleva a «Avisos» sin datos.

### User Story 4 - Alcance sin nombres (Priority: P1)

1. **Given** que un teléfono abre un aviso o un incidente del equipo, **Then** la app lo cuenta, una vez por teléfono, ítem y vía:
   - «app»: la tarjeta estuvo a la vista (60 %) 1 s, o se abrió su hoja en el mapa;
   - «push»: llegó tocando la notificación.

   Se agrupan y se mandan en `POST /api/vistas`, en segundo plano.
2. **Given** el panel, **Then**:
   - cada aviso dice «Lo abrieron N teléfonos · N desde la notificación · notificación enviada a N» (este último, cuando el push ya salió);
   - cada incidente dice «Lo abrieron N teléfonos».

   Nunca nombres ni ids.
3. **Given** la base, **Then** `vistas.quien` es un HMAC-SHA256 del id del teléfono, con la llave del servidor y un prefijo propio. No se puede volver al id ni cruzar con los reportes. La IP solo sirve para el tope (600 por hora por conexión) y se borra a las 48 h.
4. **Given** una petición con tipo, vía o ids inválidos, más de 30 ids, o un teléfono sin id válido, **Then** responde 400 (`vistas.invalidas`). Solo cuentan los avisos no eliminados y los reportes con `origen='equipo'`.

### User Story 5 - El superadmin ve qué teléfonos son, sin nombres (Priority: P2, 2026-11-12)

Pedido del dueño: «Que solo lo vea el administrador: los dispositivos que están activos o que abrieron. En las estadísticas sale que se dispara a 9 y que 5 abrieron, pero quisiera ver qué dispositivos son.»

1. **Given** el superadmin (permiso `alcance.detalle`, que solo tiene ese rol; la API lo verifica y cada consulta queda en la auditoría), **Then**:
   - bajo cada aviso o incidente que alguien abrió hay un botón «Ver teléfonos», que lista los teléfonos que lo abrieron con su código, tipo aproximado, recinto (si tiene notificaciones), por dónde («en la app» o «notificación») y cuándo;
   - en «Avisos» hay una tarjeta «Teléfonos con notificaciones», con una tabla de código, tipo, recinto, idioma, cuándo activó las notificaciones y su última actividad.
2. **Given** un teléfono, **Then** su código son los primeros 6 caracteres de la firma (`quien`), por ejemplo «7F3A2C»:
   - es el mismo en todas las listas: el que abrió un aviso se reconoce en la lista de notificaciones;
   - nunca se muestran el id del teléfono, el nombre ni el número.
3. **Given** el tipo de teléfono, **Then** es solo sistema y navegador («Android · Chrome»), sacado del User-Agent al suscribirse o al abrir un aviso (migración 6). No se guardan versión ni modelo.
4. **Given** el analista o el operador, **Then** no ven los botones y la API responde 403.
5. **Given** Privacidad, **Then** dice todo esto en `es` y en `en`. La constitución pasa a 2.6.0.

### User Story 6 - Pestaña «Dispositivos»: qué teléfonos usan la app (Priority: P2, 2026-11-12)

Pedido del dueño: «Lo que yo quería es una opción nueva en el menú que diga "Dispositivos", y desde ahí poder ver qué dispositivos tengo que estén usando mi aplicativo.»

1. **Given** el superadmin, **Then** el menú del panel tiene la pestaña **«Dispositivos»**, con el permiso `alcance.detalle`. Analista y operador no la ven; la API responde 403 y audita cada consulta. La pestaña muestra:
   - un resumen: activos hoy, en los últimos 7 días, en los últimos 30 días, con notificaciones, instalada como app y en total;
   - la lista de teléfonos, de la última actividad a la más vieja, con: código, tipo de teléfono, cómo la usa («App instalada» o «Navegador»), notificaciones (con el recinto), idioma, versión de la app, desde cuándo, última actividad y días de uso;
   - filtros por periodo (hoy, 7 días, 30 días, todos), «Solo con notificaciones» y búsqueda por código. En escritorio la lista es una tabla y en el celular, fichas;
   - **paginación** de 25 por página, con «Página X de Y · N en total», Anterior y Siguiente. La API filtra y pagina, así el panel no baja la lista entera. Al cambiar un filtro se vuelve a la página 1.
2. **Given** la app ciudadana, **Then** avisa su uso con `POST /api/actividad`, en segundo plano, al abrirse o al volver a primer plano, como mucho cada 6 h. Manda si está instalada, el idioma y la versión (el build); el servidor suma la firma y el tipo de teléfono. Un teléfono es una fila: `dias` sube una vez por día con uso.
3. **Given** la retención, **Then** la IP se borra a las 48 h y la fila a los 180 días sin uso. La tope es de 30 teléfonos distintos por conexión y por hora.
4. **Given** «Teléfonos con notificaciones», que estaba en Avisos, **Then** pasa a esta pestaña. «Ver teléfonos» sigue bajo cada aviso e incidente.
5. **Given** Privacidad, **Then** suma «Uso de la app» en `es` y en `en`. La constitución pasa a 2.7.0.
6. **Given** el tipo de equipo (pedido del dueño: «¿se puede obtener el tipo de dispositivo o es antiprivacidad?»), **Then** se guardan solo tres datos, nunca el modelo exacto:
   - la **marca**: la app la deduce del modelo que da el navegador (Client Hints, solo Chrome/Edge en Android); el modelo no sale del teléfono y la API solo acepta una lista fija de marcas;
   - la **versión mayor del sistema** (Android 14, iOS 18);
   - el **formato**: teléfono, tablet o computadora.

   En un cantón chico, el modelo exacto junto con el recinto podría señalar a una persona; la marca no. La pestaña muestra «Samsung · Android 14» con «Chrome · Teléfono» abajo, y bajo el resumen, el conteo por marca y por formato (migración 8).

## Requirements *(mandatory)*

- **FR-001:** migración 5 (`avisos.flyer` y tabla `vistas` con PK `(tipo, item_id, quien, via)`).
- **FR-002:** contrato en [contracts/api.md](contracts/api.md).
- **FR-003:** textos en `es` y en `en` (app y panel). Privacidad: cómo se cuenta el alcance sin guardar quién.
- **FR-004:** SW de la app v2.21 (con el id de build) y del panel v2.10.
- **FR-005:** nginx del cliente y Vite pasan `/a/` a la API, como `/r/`.

## Success Criteria *(mandatory)*

- **SC-001:** pruebas de la API: `test_alcance.py`, con 6 pruebas nuevas (flyer en la app, en el push y al compartir; anulado; inválido; teléfonos distintos y vía push; incidentes; validación), y la suite completa en verde.
- **SC-002:** entorno aislado (PostgreSQL y API de demostración), probado el 2026-11-12:
  - la tarjeta con flyer y los botones para compartir, a 360 px;
  - `#avisos/1/push` abrió el visor y quedaron 2 vistas (app y push) con `quien` de 32 caracteres;
  - el panel mostró «Lo abrió 1 teléfono · 1 desde la notificación».
- **SC-003:** Impeccable en 0 hallazgos en `#avisos` (360 y 1280 px) y en el panel.
