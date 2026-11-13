# Contrato: cuentas ciudadanas con registro propio (spec 018, v3)

Extiende el contrato v2 (`specs/014-usuarios-incidentes-push-react/contracts/api.md`). Mismas convenciones: JSON UTF-8,
errores `{"error": "<texto en español>", "k": "<clave i18n>"}`, cookies `HttpOnly` y nada de sesiones en `localStorage`.

**Historia (2026-11-10):** se empezó con Google y Facebook mediante Firebase Authentication. Luego el dueño lo cambió por
Facebook directo más un registro propio, y al final quitó Facebook («mucho problema; quedémonos con el registro»).
Queda solo el **registro propio**, y es **opcional**: sin cuenta se ve todo, se comparte y se reporta de forma anónima.

Todas las rutas `/api/cuenta/*` exigen `X-Requested-With: yaguachi` (anti-CSRF → 403 `auth.csrf`).

## 1. Registro e ingreso

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/api/cuenta/registro` | `{"nombre", "cedula", "email", "clave", "foto"?, "consentimiento": true}` | 201 `{"ciudadano": Ciudadano}` + `Set-Cookie` |
| POST | `/api/cuenta/ingresar` | `{"usuario": "<correo o cédula>", "clave"}` | 200 `{"ciudadano": Ciudadano}` + `Set-Cookie` |

Validación (la misma en el cliente, para avisar antes de enviar):
- **`nombre`:** nombres y apellidos en **un solo campo** (pedido del dueño). De 5 a 120 caracteres, solo letras (incluidas tildes y ñ), espacios, apóstrofo y guion, y **al menos dos palabras**. Se guarda sin espacios dobles. Error: 400 `cuenta.nombre`.
- **`cedula`:** cédula ecuatoriana. Son 10 dígitos numéricos. La provincia va de 01 a 24 o es 30. El tercer dígito es menor que 6. El último es el dígito verificador (módulo 10). Error: 400 `cuenta.cedula`. Es única → 409 `cuenta.cedula_existe`. No cambia nunca.
- **`email`:** formato `algo@dominio.tld`, de hasta 254 caracteres. Se guarda en minúsculas. Error: 400 `cuenta.email`. Es único → 409 `cuenta.email_existe`.
- **`clave`:** de **6** a 128 caracteres; su fuerza es responsabilidad de cada vecino (pedido del dueño). Error: 400 `cuenta.clave`. Se guarda con scrypt (`auth.hash_clave`).
- **`foto`** (opcional): data URL JPEG, como las fotos de los reportes (`foto.formato`, `foto.invalida`, `foto.espacio`).
- **`consentimiento`:** si no es `true` → 400 `cuenta.consentimiento`.

Ingreso:
- Si `usuario` lleva `@`, se busca por correo; si son 10 dígitos, por cédula.
- Credenciales malas → 401 `cuenta.credenciales`, siempre con el mismo mensaje.
- Tras 5 fallos seguidos, por IP o por cuenta, hay una espera creciente (1, 2, 4… min). La espera de la cuenta tiene un tope de 15 min → 429 `cuenta.espera`.
- Cuenta desactivada → 403 `cuenta.inactiva`.

## 2. Sesión y perfil

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/api/cuenta/yo` | — | 200 `{"ciudadano"}` o 401 `cuenta.sesion` (y borra la cookie si ya no valía) |
| POST | `/api/cuenta/perfil` | `{"nombre", "email"}` | 200 `{"ciudadano"}`. Si llega `cedula`, se ignora: la cédula no cambia |
| POST | `/api/cuenta/foto` | `{"foto": "<data URL JPEG>" \| null}` | 200 `{"ciudadano"}`. Con un data URL cambia la foto y con `null` la quita; en los dos casos borra el archivo anterior. Sin la clave `foto` → 400 `foto.formato` |
| GET | `/api/cuenta/foto` | — | `image/jpeg` de la foto propia (`Cache-Control: private, no-store`). 401 sin sesión, 404 si no tiene foto |
| POST | `/api/cuenta/salir` | — | 200 `{"ok": true}` y borra la cookie |
| POST | `/api/cuenta/eliminar` | — | 200 `{"ok": true}`. Borra la cuenta, sus sesiones y su foto; sus reportes quedan sin autor |

### Objeto `Ciudadano` (solo lo ve su dueño)

```json
{ "nombre": "Ana María Pérez Vera", "cedula": "0926687856", "email": "ana@…", "foto": true, "creado": "ISO" }
```

Nunca se exponen el id interno ni el hash de la clave.

### Cookie

- Con HTTPS: `__Host-yw_ciudadano` con `HttpOnly; SameSite=Strict; Path=/; Secure`. Con HTTP (desarrollo): `yw_ciudadano` con `Path=/api`.
- El valor es un token aleatorio de 32 bytes; en la base solo se guarda su SHA-256. Vence a los 30 días sin uso y a los 90 días como máximo.
- Es distinta de la cookie del panel.

## 3. La cuenta es opcional para reportar (2026-11-10)

Pedido del dueño: «al iniciar el cliente puede ver todo; cuando vaya a reportar, que lo pueda hacer de manera anónima;
el registro es opcional».

- La app **no** pide ingresar al abrir. Se ve todo y se comparte sin cuenta.
- `POST /api/reportes` **sin sesión** → se acepta y queda anónimo (`ciudadano_id` NULL), con los topes de siempre por
  teléfono e IP.
- **Con sesión:** se guarda `ciudadano_id`, salvo que el cuerpo traiga `"anonimo": true`. Se suma el tope de
  `max_reportes_hora_dispositivo` por cuenta y hora (429 sin `k`).
- Confirmar y dar «me gusta» siguen abiertos. `/r/{id}` es público.
- El nombre, la cédula y la foto del vecino **nunca** se publican con sus reportes.

## 4. Límites

| Caso | Límite | `k` |
|---|---|---|
| Cuentas nuevas por IP | 5 por hora, en la base y de forma atómica | `cuenta.espera` (429) |
| Fallos de ingreso | ver §1 | `cuenta.espera` (429) |
| Cambios de foto por cuenta | 20 por día, en memoria | `cuenta.espera` (429) |

## 5. Tablas (migración 4)

```sql
ciudadanos(id IDENTITY PK, nombre TEXT NOT NULL, cedula TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE,
           clave TEXT NOT NULL, foto TEXT NULL, activo INTEGER DEFAULT 1, consentimiento TEXT,
           creado TEXT, ultimo_ingreso TEXT, ip TEXT)
sesiones_ciudadanos(token_sha TEXT PK, ciudadano_id INTEGER, creado TEXT, ultimo_uso TEXT)
reportes + ciudadano_id INTEGER
```

- La columna `ip` solo sirve para el tope de cuentas nuevas. El mantenimiento la borra a las 48 h y también borra las sesiones vencidas.
- Las fotos de perfil se guardan en la carpeta de fotos como `perfil-<uuid>.jpg`. La limpieza de 90 días **no** las borra.

## 6. Sin configuración ni cabeceras nuevas

No hay variables nuevas, y la CSP y la COOP no cambian.

## 7. Claves de error nuevas

`cuenta.sesion`, `cuenta.credenciales` (401), `cuenta.espera` (429), `cuenta.inactiva` (403),
`cuenta.nombre`, `cuenta.cedula`, `cuenta.email`, `cuenta.clave`, `cuenta.consentimiento`,
`cuenta.cedula_existe` (409), `cuenta.email_existe` (409).
