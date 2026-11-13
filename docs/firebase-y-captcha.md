# Configurar Firebase (web push) y Cloudflare Turnstile (captcha)

Sin estas variables la app funciona igual:

- **Sin Firebase**, el push queda apagado y la app usa solo las notificaciones locales.
- **Sin Turnstile**, el ingreso al panel usa las claves de prueba de Cloudflare, que siempre pasan. Sirven solo para desarrollo.

Cuentas ciudadanas: registro propio, no requiere configuración (spec 018).

Todo se configura en `.env`, que se crea copiando `.env.example`, y en la carpeta `secretos/`. Ninguno de los dos se sube al repositorio.

```bash
cp .env.example .env
```

## 1. Firebase Cloud Messaging (web push a la app ciudadana)

1. **Crear el proyecto.** Entra a https://console.firebase.google.com y elige **Crear un proyecto**. Nombre sugerido: `yaguachi-weather`. Puedes desactivar Google Analytics: la app no usa analítica.
2. **Registrar la app web.** En el proyecto, toca el ícono **`</>`** (Agregar app → Web).
   - Apodo: `Yaguachi Weather`. **No** marques Firebase Hosting.
   - Firebase muestra un bloque `firebaseConfig`. Copia estos valores a `.env`:

     | En `firebaseConfig` | En `.env` |
     |---|---|
     | `apiKey` | `FIREBASE_API_KEY` |
     | `authDomain` | `FIREBASE_AUTH_DOMAIN` |
     | `projectId` | `FIREBASE_PROJECT_ID` |
     | `messagingSenderId` | `FIREBASE_MESSAGING_SENDER_ID` |
     | `appId` | `FIREBASE_APP_ID` |

     Estos valores son públicos (los ve el navegador). Aun así, déjalos solo en `.env`.
3. **Clave VAPID.** Ve a ⚙️ **Configuración del proyecto → Cloud Messaging → Certificados push web → Generar par de claves**. Copia la **clave pública** a `FIREBASE_VAPID_KEY`.
4. **Cuenta de servicio.** Esto sí es un **secreto**. Ve a ⚙️ **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**.
   - Se descarga un JSON. Guárdalo exactamente como `secretos/firebase-cuenta-servicio.json`.
   - No lo pegues en chats, tickets ni correos. Si se filtra, bórralo en la misma pantalla y genera otro.
5. **API activada.** En la misma pestaña **Cloud Messaging**, comprueba que **Firebase Cloud Messaging API (V1)** diga «Habilitada». En proyectos nuevos ya viene así. Si no, toca los tres puntos → *Administrar API en Google Cloud Console* → **Habilitar**.
6. **Levanta y comprueba:**
   ```bash
   docker compose up -d --build
   curl -s http://localhost:8090/api/push/config     # debe decir "habilitado": true
   ```
7. **Prueba de punta a punta:**
   1. En Chrome, abre la app → **Avisos** → **Activar notificaciones** → acepta el permiso.
   2. En el panel, publica un aviso de prueba para tu recinto.
   3. Como máximo en 30 s debe llegar la notificación, aunque la app esté cerrada.

Ten en cuenta:

- El push web exige **HTTPS**; `localhost` funciona para pruebas.
- En iPhone, solo funciona con la app **instalada** en la pantalla de inicio y con iOS 16.4 o superior.

## 2. Cloudflare Turnstile (captcha del ingreso al panel)

1. Entra a https://dash.cloudflare.com → **Turnstile** → **Add widget**.
   - Nombre: `Yaguachi Weather · panel`.
   - Hostnames: el dominio donde publiques el panel, por ejemplo `panel.yaguachiweather.ec`.
   - Widget mode: **Managed**.
2. Copia la **Site Key** a `TURNSTILE_SITE_KEY` y la **Secret Key** a `TURNSTILE_SECRET_KEY`. La segunda es un **secreto**.
3. Reinicia: `docker compose up -d --build`.

En local (127.0.0.1:8091) deja las dos vacías: se usan las claves de prueba, que siempre pasan.

## 3. Primer ingreso al panel

1. La primera vez que arranca, la API crea el usuario **`admin`** (superadmin) con una clave temporal y la muestra **una sola vez** en su registro. Para verla:
   ```bash
   docker compose logs api | grep "CLAVE INICIAL"
   ```
2. Entra en http://127.0.0.1:8091 con `admin` y esa clave. El panel te obliga a cambiarla: usa una de al menos 12 caracteres.
3. En **Usuarios**, crea las cuentas del equipo con su nombre real, que es el que verán los vecinos en los incidentes publicados. Los roles:

   | Rol | Qué puede hacer |
   |---|---|
   | superadmin | Todo, más usuarios y configuración (por ejemplo, publicar los incidentes como anónimos) |
   | analista | Niveles, revisar reportes, publicar avisos (envían push), reglas, ajustes e incidentes |
   | operador | Ver el panel y publicar sus propios incidentes |

Si se pierde la clave del superadmin:

```bash
docker compose exec api python servidor.py --restablecer-clave admin
```

## 4. Producción (detrás de Cloudflare)

- Pon `COOKIE_SEGURA=1` y `URL_PUBLICA=https://<tu-dominio>` en `.env`.
- Sigue la lista de `docs/seguridad.md`: Tunnel, Full (strict), HSTS, la IP real con `CF-Connecting-IP` y Cloudflare Access para el panel.
