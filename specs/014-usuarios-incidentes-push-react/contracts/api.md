# Contrato de la API v2: usuarios, roles, incidentes del equipo y web push

Fuente única de verdad para los tres equipos (API, cliente y admin). Si algo no está aquí, se agrega aquí primero.

Convenciones:
- Todo en JSON UTF-8. Los errores responden `{"error": "<texto en español>", "k": "<clave i18n opcional>"}`.
- Las rutas `/api/panel/*` y `/api/auth/*` (salvo `GET /api/auth/config`) exigen la cabecera `X-Requested-With: yaguachi` (anti-CSRF; sin ella → 403).
- La sesión va en una cookie, nunca en `localStorage`.

## 1. Sesión del panel (reemplaza al PIN)

El PIN compartido (`X-PIN`) deja de existir.

### Cookie de sesión

- Con HTTPS (`COOKIE_SEGURA=1`, `URL_PUBLICA` https o `X-Forwarded-Proto: https`): `__Host-yw_sesion` con `HttpOnly; SameSite=Strict; Path=/; Secure` y sin `Domain`. Solo se acepta ese nombre, así otro subdominio no puede plantar una sesión.
- En desarrollo (http): `yw_sesion` con `HttpOnly; SameSite=Strict; Path=/api`.
- Valor: token aleatorio de 32 bytes. En la base se guarda solo su SHA-256.
- Caduca a las 12 h de inactividad y a las 7 días como máximo.
- Se invalida al cerrar sesión, al cambiar o restablecer la clave, al cambiar el rol y al desactivar el usuario.

### Endpoints

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/api/auth/config` | — | `{"captcha": {"proveedor": "turnstile", "site_key": "…"}}` |
| POST | `/api/auth/login` | `{"usuario", "clave", "captcha"}` | 200 `{"usuario": Usuario}` + `Set-Cookie` |
| POST | `/api/auth/logout` | — | 200 `{"ok": true}` (borra la cookie) |
| GET | `/api/auth/me` | — | 200 `{"usuario": Usuario, "publicacion": {"incidentes_anonimos": bool}}` o 401 (cualquier rol sabe cómo se publicará su incidente) |
| POST | `/api/auth/clave` | `{"actual", "nueva"}` | 200 `{"ok": true}`. La nueva tiene 12 caracteres como mínimo y no puede ser igual a la actual |

Notas:
- `captcha` es el token de Cloudflare Turnstile.
- Con `debe_cambiar_clave: true`, todo `/api/panel/*` responde **403** con `{"k": "auth.cambiar_clave"}` hasta que se cambie la clave.

### Objeto `Usuario`

```json
{ "id": 1, "usuario": "mlopez", "nombre": "María López", "rol": "analista",
  "permisos": ["panel.ver", "…"], "debe_cambiar_clave": false, "activo": true,
  "creado": "ISO", "ultimo_ingreso": "ISO|null" }
```

### Errores del login

| Código | Caso | `k` |
|---|---|---|
| 400 | Captcha inválido | `auth.captcha` |
| 401 | Usuario o clave incorrectos (mismo mensaje para los dos) | `auth.credenciales` |
| 403 | Usuario desactivado | `auth.inactivo` |
| 429 | 5 fallos seguidos por IP o por usuario → espera exponencial, como el PIN de antes | `auth.espera` |

### Primer arranque

- Sin usuarios en la base, la API crea el superadmin `admin` con una clave aleatoria de 16 caracteres y `debe_cambiar_clave`. La clave se muestra **una sola vez** en el registro: `CLAVE INICIAL del superadmin 'admin': …`.
- Si el superadmin pierde su clave: `python servidor.py --restablecer-clave <usuario>` imprime una clave temporal nueva.

### Claves

- Se guardan con `hashlib.scrypt` (n=2^15, r=8, p=1, sal de 16 bytes) en el formato `scrypt$n$r$p$sal_b64$hash_b64`.
- Se comparan en tiempo constante.

## 2. Roles y permisos

| Permiso | superadmin | analista | operador |
|---|:-:|:-:|:-:|
| `panel.ver` (situación, reportes y avisos en solo lectura) | ✔ | ✔ | ✔ |
| `niveles.fijar` | ✔ | ✔ | |
| `reportes.revisar` (verificar, resolver, descartar) | ✔ | ✔ | |
| `avisos.publicar` (dispara web push) | ✔ | ✔ | |
| `reglas.editar` (lecturas y bordes) | ✔ | ✔ | |
| `ajustes.editar` (INAMHI, aguaje) | ✔ | ✔ | |
| `incidentes.crear` | ✔ | ✔ | ✔ |
| `incidentes.gestionar` (editar o retirar los de otros) | ✔ | ✔ | |
| `usuarios.gestionar` | ✔ | | |
| `config.editar` | ✔ | | |
| `dashboard.ver` (mapa en vivo y análisis, §5 bis) | ✔ | | |
| `avisos.eliminar` (eliminación lógica de avisos, §5 ter) | ✔ | | |
| `incidentes.eliminar` (borrado definitivo de un incidente, 2026-11-10) | ✔ | | |
| `incidentes.reactivar` (volver a presentar un incidente retirado, 2026-11-10) | ✔ | | |
| `albergues.gestionar` (crear, editar y eliminar albergues, §5 quater, 2026-11-10) | ✔ | ✔ | |

- Cada ruta existente de `/api/panel/*` exige el permiso de su columna. Sin sesión → 401; sin permiso → 403 `{"k": "auth.permiso"}`.
- `GET /api/foto/{id}` también acepta una sesión con `panel.ver`.

## 3. Usuarios (`usuarios.gestionar`)

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/api/panel/usuarios` | — | `{"usuarios": [Usuario]}` |
| POST | `/api/panel/usuarios` | `{"usuario", "nombre", "rol"}` | 201 `{"usuario": Usuario, "clave_temporal": "…"}` (se muestra una vez) |
| POST | `/api/panel/usuarios/{id}` | `{"nombre"?, "rol"?, "activo"?}` | `{"usuario": Usuario}` |
| POST | `/api/panel/usuarios/{id}/clave` | — | `{"clave_temporal": "…"}` (restablece y obliga a cambiarla) |

Reglas de validación:
- `usuario` coincide con `^[a-z0-9._-]{3,32}$` y es único (si no, 409).
- `nombre` tiene de 2 a 80 caracteres.
- `rol` es `superadmin`, `analista` u `operador`.

Reglas de negocio:
- Nunca se puede quedar sin al menos un superadmin activo: quitarle el rol, o desactivar, al último superadmin activo → 409.
- Nadie puede desactivarse a sí mismo.
- No se borran usuarios; se desactivan, para conservar la autoría.
- Toda acción queda en la tabla `auditoria` (quién, qué y cuándo).

## 4. Configuración (`config.editar`)

| Método | Ruta | Cuerpo / respuesta |
|---|---|---|
| GET | `/api/panel/config` | `{"incidentes_anonimos": false}` |
| POST | `/api/panel/config` | `{"incidentes_anonimos": true}` → `{"ok": true}` |

El anonimato se aplica **al leer**: al cambiarlo, afecta también a los incidentes ya publicados.

## 5. Incidentes del equipo

Son reportes que publica el panel. Se guardan en la tabla `reportes` con `origen = 'equipo'`, `autor_id`, `estado = 'validado'` y `en_canton`.

| Método | Ruta | Permiso | Cuerpo / respuesta |
|---|---|---|---|
| GET | `/api/panel/incidentes` | `panel.ver` | `{"incidentes": [Reporte], "mas": bool}`; el operador ve solo los suyos. Por páginas (scroll infinito), del más nuevo al más viejo: `?n=30` (hasta 100) y, para la siguiente tanda, `&antes=<creado>&antes_id=<id>` del último ya mostrado; `mas` dice si quedan |
| POST | `/api/panel/incidentes` | `incidentes.crear` | `{"tipo", "gravedad", "descripcion", "lat", "lon", "horas", "foto"?, "altura_agua"?, "via"?, "tramo"?}` → 201 `{"id"}` |
| POST | `/api/panel/incidentes/{id}` | autor o `incidentes.gestionar` | `{"descripcion"?, "gravedad"?, "estado"?: "resuelto"\|"retirado"}` → `{"ok": true}` |
| POST | `/api/panel/incidentes/{id}/reactivar` | `incidentes.reactivar` | Solo si está `retirado` (si no, 400 `incidentes.no_retirado`). Vuelve a `validado`, conserva `creado` y, si ya venció, `expira` = ahora + horas de su tipo → `{"ok": true, "expira"}`. Auditoría `incidente.reactivar` |
| POST | `/api/panel/incidentes/{id}/eliminar` | `incidentes.eliminar` | Borrado **definitivo**: la fila, sus confirmaciones y «me gusta», y la foto → `{"ok": true}`; 404 `incidentes.no_existe`. Auditoría `incidente.eliminar` con id, tipo, vía, recinto, fecha, estado y autor, sin la descripción |

Validaciones de `POST /api/panel/incidentes`:
- `tipo` debe ser una clave de `TIPOS`.
- `gravedad` va de 1 a 3.
- `horas` va de 1 a 168; por defecto, el valor de `TIPOS`.
- `descripcion` tiene de 1 a 500 caracteres.
- La ubicación debe caer dentro del cantón.
- La foto se valida igual que en `POST /api/reportes`.

Un incidente retirado deja de verse en público.

## 5 ter. Eliminar avisos (`avisos.eliminar`)

| Método | Ruta | Respuesta |
|---|---|---|
| POST | `/api/panel/avisos/{id}/eliminar` | `{"ok": true}`; 404 `avisos.no_existe` si no existe o ya estaba eliminado. Auditoría: `aviso.eliminar`. |

- Es una eliminación lógica: la fila queda con `eliminado_en` y `eliminado_por` (migración 2).
- Un aviso eliminado no sale en `GET /api/avisos` ni en `GET /api/panel/ajustes`, no se puede anular, no cuenta para el límite de avisos por ámbito y su push pendiente se omite (`{"omitido": "eliminado"}`).
- Anular (`avisos.publicar`) sigue igual: el aviso deja de verse en la app pero queda en el panel, marcado como anulado. Se puede eliminar un aviso anulado.

## 5 quater. Albergues y ruta para llegar (2026-11-10)

| Método | Ruta | Permiso | Cuerpo → respuesta |
|---|---|---|---|
| GET | `/api/albergues` | público | `{"albergues": [{"id", "nombre", "descripcion", "lat", "lon", "fotos": n, "actualizado"}]}` (sin los eliminados) |
| GET | `/api/albergues/{id}/foto/{1-3}` | público | JPEG; `Cache-Control: public, max-age=86400` (la app agrega `?v=<actualizado>`) |
| GET | `/api/ruta?modo=pie\|auto&lat&lon&albergue=<id>` | público | `{"modo", "linea": [[lat, lon]…], "metros", "segundos"}`. La API la pide a OSRM (routing.openstreetmap.de) con el origen redondeado a 4 decimales; el destino solo puede ser un albergue. Caché 1 h; 30 por IP cada 10 min (429 `ruta.limite`); 404 `ruta.sin_camino`; 502 `ruta.no_disponible`; 400 `ruta.lejos` |
| GET | `/api/panel/albergues` | `albergues.gestionar` | igual que el público |
| POST | `/api/panel/albergues` | `albergues.gestionar` | `{"nombre", "descripcion"?, "lat", "lon", "fotos"?: [dataURL]}` → 201 `{"id"}` |
| POST | `/api/panel/albergues/{id}` | `albergues.gestionar` | Lo que cambie de `nombre`, `descripcion`, `lat`+`lon` y `fotos`. `fotos` es la lista final (hasta 3) en orden: cada elemento es una foto nueva (data URL JPEG) o el número (1–3) de una que ya tiene. Las quitadas se borran → `{"ok": true}` |
| POST | `/api/panel/albergues/{id}/eliminar` | `albergues.gestionar` | Eliminación lógica (`eliminado_en`, `eliminado_por`); sus fotos se borran → `{"ok": true}` |

- `nombre` de 3 a 80 caracteres con sentido (`albergues.nombre`); `descripcion` hasta 280 (`albergues.descripcion`); ubicación dentro del cantón (`albergues.ubicacion`, `albergues.fuera`); hasta 200 albergues (`albergues.tope`).
- Auditoría: `albergue.crear`, `albergue.editar`, `albergue.eliminar`.

## 5 quinquies. Hasta 3 fotos por reporte (2026-11-10)

- `POST /api/reportes` acepta `fotos: [dataURL]` (hasta 3, 400 `foto.demasiadas`); `foto` suelta sigue valiendo (reportes guardados sin señal con la versión anterior).
- La primera queda en `reportes.foto` y las demás en `reportes.fotos_extra` (lista JSON, migración 3).
- `GET /api/foto/{id}/{2|3}` con los mismos permisos que `GET /api/foto/{id}`. `Reporte.n_fotos` dice cuántas se pueden pedir (0 si no son visibles para quien pregunta).
- Al descartar un reporte, a los 90 días o al eliminar un incidente se borran todas sus fotos.

## Nada se publica vacío

`POST /api/reportes`, `POST /api/panel/incidentes` y `POST /api/panel/aviso` exigen un texto con sentido (`texto_con_sentido`): al menos 5 caracteres sin contar los espacios de los bordes, y 3 letras o números («.» o «...» no cuentan).
- Reportes de vecinos: `descripcion` obligatoria; si falta, 400 `reportes.descripcion`. Antes era opcional.
- Incidentes: `descripcion` de 5 a 500 caracteres (`incidentes.descripcion`).
- Avisos: `titulo` con al menos 3 y `texto` con al menos 5 (`avisos.texto`).

## 5 bis. Tablero del superadmin (`dashboard.ver`)

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/panel/mapa` | `{"generado", "eventos": [Reporte]}`: reportes `pendiente` o `validado` aún vigentes (vecinos y equipo), como mucho 3000, con `foto`, `en_canton` y `revisado_en`. El panel lo pide cada 3 minutos. |
| GET | `/api/panel/analisis?dias=7\|30\|90\|365` | `{"periodo", "total", "vecinos", "equipo", "limitado", "por_estado", "por_tipo", "puntos": [[lat, lon]], "zonas": [{"recinto", "n", "sin_atender", "lat", "lon"}], "horas": [24], "semana": [7][24], "pico", "sin_atender": [...], "atencion": {"revisados", "mediana_horas", "promedio_horas"}}`. Otro valor de `dias` → 30. Como mucho 50 000 filas (`limitado`). |
| GET | `/api/panel/analisis.xlsx?dias=…` | Libro Excel (hojas Resumen, Reportes, Zonas, Horas pico, Sin atender). Como toda ruta del panel exige `X-Requested-With`: el panel lo pide con `fetch` y lo descarga. Queda en la auditoría (`analisis.exportar`). |

- Horas y días se cuentan en hora de Ecuador (UTC−5); `semana[0]` es el lunes.
- «Sin atender»: de vecinos, `estado = 'pendiente'` (nadie lo revisó, aunque ya haya vencido: `vencido`); del equipo, `validado` y vigente (nadie lo marcó resuelto). `horas` = cuánto lleva esperando; la lista va de mayor a menor.
- Ni el JSON ni el Excel llevan el identificador del teléfono ni la IP.

**Cambio en la lectura pública** (`GET /api/reportes` y `GET /api/reportes`-derivados): cada `Reporte` agrega estos campos.

```json
{ "origen": "vecino" | "equipo",
  "autor": { "nombre": "María López", "rol": "analista" } | null }
```

- `autor` es `null` para los vecinos y para los incidentes del equipo cuando `incidentes_anonimos` es `true`. En ese caso la app muestra «Equipo de riesgo».
- El `id`, el usuario y el correo del autor nunca se exponen.

## 6. Web push con Firebase Cloud Messaging

| Método | Ruta | Cuerpo / respuesta |
|---|---|---|
| GET | `/api/push/config` | `{"habilitado": bool, "firebase": {"apiKey", "authDomain", "projectId", "messagingSenderId", "appId"}, "vapid_key"}` (valores públicos; `habilitado: false` si faltan variables) |
| POST | `/api/push/suscribir` | cabecera `X-Dispositivo`; `{"token", "recinto_id"?, "idioma": "es"\|"en"}` → `{"ok": true}` (upsert por token; 30 por IP y hora) |
| POST | `/api/push/baja` | `{"token"}` → `{"ok": true}` |

Envío:
- Al publicarse un aviso (`POST /api/panel/aviso`), la API encola un envío y responde de inmediato. Un hilo `push` procesa la cola cada 30 s.
- Destinatarios:
  - ámbito `canton`: todos los tokens;
  - `parroquia`, `rio` y `recinto`: los tokens con `recinto_id` dentro del ámbito;
  - los tokens sin recinto reciben los avisos de cantón y los de nivel 3 o más.
- **Horas de silencio** (`horas_silencio`, en hora de Ecuador): los avisos de nivel 1–2 esperan a que termine la franja.
- **Mensaje solo de datos**, en lotes de 500 con `firebase_admin.messaging.send_each_for_multicast`:
  `{"tipo": "aviso", "aviso_id", "nivel", "titulo", "cuerpo", "url": "/#avisos"}`.
  El service worker del cliente arma la notificación en el idioma guardado.
- Los tokens que FCM marca `UNREGISTERED` o `INVALID_ARGUMENT` se borran.

Variables de entorno (servicio `api`):

| Variable | Contenido |
|---|---|
| `FIREBASE_CREDENCIALES` | ruta al JSON de la cuenta de servicio, montado como secreto de solo lectura |
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` | configuración web del proyecto (pública) |
| `FIREBASE_VAPID_KEY` | clave pública VAPID del proyecto (Cloud Messaging → certificados web push) |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | si faltan, se usan las claves de prueba de Cloudflare: `1x00000000000000000000AA` y `1x0000000000000000000000000000000AA` (siempre pasan; solo para desarrollo) |
| `COOKIE_SEGURA` | `1` en producción con HTTPS |

Dependencia nueva de la API: `firebase-admin`, con versión fija en `api/requirements.txt`. Si no está instalada o no hay credenciales, el push queda deshabilitado sin romper nada.

## 7. Tablas nuevas o cambiadas (migración automática en `iniciar_db`)

```sql
usuarios(id INTEGER PK, usuario TEXT UNIQUE, nombre TEXT, rol TEXT, clave TEXT, activo INTEGER DEFAULT 1,
         debe_cambiar_clave INTEGER DEFAULT 1, creado TEXT, ultimo_ingreso TEXT)
sesiones(token_sha TEXT PK, usuario_id INTEGER, creado TEXT, ultimo_uso TEXT, ip TEXT)
auditoria(id INTEGER PK, usuario_id INTEGER, accion TEXT, detalle TEXT, creado TEXT)
config(clave TEXT PK, valor TEXT)            -- incidentes_anonimos, …
push_tokens(token TEXT PK, dispositivo TEXT, recinto_id INTEGER, idioma TEXT, creado TEXT, ultimo_uso TEXT, ip TEXT)
push_cola(id INTEGER PK, aviso_id INTEGER, creado TEXT, enviar_desde TEXT, enviado TEXT, resultado TEXT)
reportes + origen TEXT DEFAULT 'vecino', autor_id INTEGER
avisos  + autor_id INTEGER
```

- El hilo `mantenimiento` borra la IP de `sesiones` y de `push_tokens` a las 48 h, igual que en las demás tablas.
- También borra las sesiones vencidas.

## 8. Lo que no cambia

Todas las rutas públicas actuales (`/api/estado`, `/api/territorio`, `/api/lugar`, `/api/recinto`, `/api/cercano`, `/api/reportes*`, `/api/avisos`, `/api/foto/{id}`, `/r/{id}`) mantienen su forma. Solo se agregan campos.

## 9. Cabeceras (CSP) que deben permitir los frontends

- **Admin:**
  - `script-src` y `frame-src` agregan `https://challenges.cloudflare.com` (Turnstile);
  - `connect-src` sigue siendo `'self'`.
- **Cliente:** `connect-src` agrega:
  - `https://fcmregistrations.googleapis.com`
  - `https://firebaseinstallations.googleapis.com`
  - `https://fcm.googleapis.com`

  Si el SDK lo pide, también `https://www.googleapis.com`. El SDK de Firebase va empaquetado con Vite; no se carga desde gstatic.

## 10. Claves de error `k` (implementadas por la API)

| Grupo | Claves |
|---|---|
| auth | `auth.captcha`, `auth.credenciales`, `auth.inactivo`, `auth.espera`, `auth.permiso`, `auth.cambiar_clave`, `auth.csrf`, `auth.sesion`, `auth.clave_corta`, `auth.clave_larga`, `auth.clave_igual`, `auth.clave_actual` |
| usuarios | `usuarios.usuario`, `usuarios.nombre`, `usuarios.rol`, `usuarios.activo`, `usuarios.existe` (409), `usuarios.no_existe` (404), `usuarios.desactivarse` (409), `usuarios.ultimo_superadmin` (409) |
| config | `config.valor` |
| incidentes | `incidentes.tipo`, `incidentes.gravedad`, `incidentes.horas`, `incidentes.descripcion`, `incidentes.ubicacion`, `incidentes.fuera`, `incidentes.altura`, `incidentes.estado`, `incidentes.no_existe`, `incidentes.limite` (429, 60 por usuario y hora), `incidentes.duplicado` (409: misma persona y tipo a menos de 150 m en 30 min, sin contar los retirados) |
| push | `push.token`, `push.recinto`, `push.idioma`, `push.limite` (429, 30 tokens por IP y hora) |
| albergues | `albergues.nombre`, `albergues.descripcion`, `albergues.ubicacion`, `albergues.fuera`, `albergues.tope`, `albergues.no_existe` (404) |
| ruta | `ruta.lejos`, `ruta.limite` (429), `ruta.sin_camino` (404), `ruta.no_disponible` (502/503) |
| general | `foto.formato`, `foto.invalida`, `foto.demasiadas`, `foto.espacio`, `dispositivo.invalido` |

Si llega una `k` desconocida, el front muestra `error`, que está en español.

## 11. Decisiones tomadas al implementar

- **Cambio de clave:** `POST /api/auth/clave` invalida todas las sesiones del usuario y devuelve un `Set-Cookie` con una sesión nueva, para que quien la cambia siga dentro.
- **Incidentes en el panel:** `GET /api/panel/incidentes` agrega `editable` a cada incidente, y dentro del panel `autor` viene siempre.
- **Configuración:** `GET /api/panel/config` exige `config.editar`.
- **Login con PIN:** `POST /api/panel/login` (el login del PIN) responde 404.
- **Turnstile:** sin red, la clave de prueba se acepta; con una clave real, se rechaza.
- **Fallos de FCM:** un lote en el que todos los tokens vuelven con `INVALID_ARGUMENT` no borra ningún token, porque el problema es el mensaje.
- **Reintentos de push:**
  - Si falla la red, se reintenta cada 30 s hasta que el aviso vence.
  - Los avisos anulados o vencidos se marcan sin enviarse.
- **Identificador del teléfono:** los incidentes guardan `dispositivo = 'equipo'`. `X-Dispositivo` solo se acepta si cumple el formato de un id de teléfono.
- **Avisos:** `/api/avisos` no expone `autor_id`.
- **Módulos de la API:** `api/comun.py`, `auth.py`, `usuarios.py` y `push.py`. Pruebas: `python -m unittest discover api/tests`.
- **Casos graves que suben el nivel (2026-11-10):** el motivo `graves` de `/api/estado` y `/api/lugar` lleva
  `v.ids` (ids separados por coma, hasta 10), `v.equipo` y `v.vecinos`. Con eso, la app muestra «Casos graves
  verificados cerca» con «Ver» en el mapa, y el panel enlaza a «Incidentes» o «Reportes» para retirarlos o revisarlos.
  Antes el texto decía «vecinos reportaron…» aunque fuera un incidente del equipo y no había cómo llegar al caso.
- **Tipos de la ciudad (2026-11-10):** `bache` (168 h), `basura` (48 h) y `robo` (24 h), antes de `otro`. Los reportan
  vecinos y equipo, salen en `/api/territorio` y **no** suben el nivel de inundación. «Robo» muestra la llamada al 911.
- **Gravedad la tipifica el equipo (2026-11-10):** el vecino no elige gravedad. `POST /api/reportes` guarda
  `gravedad = 0` («por tipificar») e ignora la que mande una app vieja; la calle inundada sigue la altura del agua.
  `POST /api/panel/reportes/{id}` acepta `gravedad` (1–3) y la exige para verificar uno por tipificar
  (400 `reportes.tipificar`). Los incidentes del equipo la siguen eligiendo al publicarlos.
- **«Reportes» con filtros, «visible hasta» y eliminar en lote (2026-11-11, spec 019):**
  - `GET /api/panel/reportes` acepta `estado`, `origen`, `tipo`, `vigencia`, `q`, `pagina` y `n`, y devuelve `total` y `paginas`.
  - `POST /api/panel/reportes/vigencia` (`reportes.vigencia`: superadmin y analista) cambia `expira` de 1 a 100 casos.
  - `POST /api/panel/reportes/eliminar` (`reportes.eliminar`: solo superadmin) los borra para siempre.
- **Lo del operador, validado o pendiente (2026-11-11, spec 019):**
  - La configuración `operador_valida_directo` (por defecto `true`, solo superadmin) decide si el incidente del operador se guarda `validado` o `pendiente`.
  - El superadmin y el analista publican siempre validado.
  - `POST /api/panel/incidentes` responde `{id, estado}`, y `/api/auth/me` agrega `publicacion.validado_directo`.

