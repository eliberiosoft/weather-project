# Seguridad de Yaguachi Weather

Revisión hecha el 2026-11-09 sobre el código fuente (API, app ciudadana, panel, nginx, Docker). Aquí está qué se encontró, qué se corrigió y qué queda por hacer al publicar la app detrás de Cloudflare.

## Arquitectura y fronteras de confianza

```
Internet ──► Cloudflare (recomendado) ──► cliente (nginx :8090) ──► api (Python :8080, sin puerto publicado)
Equipo del analista ──► admin (nginx, solo 127.0.0.1:8091) ──────────┘
```

- **Ciudadanos** (sin cuenta): se identifican con un id aleatorio guardado en el teléfono. Pueden crear reportes, confirmar avisos de calles, dar «me gusta» y ver sus propios reportes.
- **Equipo del panel** (desde la spec 014): cada persona entra con su usuario, su clave y un captcha (Cloudflare Turnstile). Su rol (superadmin, analista u operador) decide qué puede hacer; la API lo verifica en cada ruta y deja todo en la auditoría.
- La app ciudadana responde **404** a `/api/panel/*`: el panel solo entra por el servicio `admin`, que no se publica a internet.

## Hallazgos y correcciones

| Gravedad | Hallazgo | Corrección |
|---|---|---|
| Alta | El PIN del panel tenía 6 dígitos y no había límite de intentos: se podía adivinar probando. | PIN de 16 caracteres (`secrets.token_urlsafe(12)`). Los PIN cortos se rotan solos al arrancar. `PIN_PANEL` exige ≥ 12 caracteres. Tras 5 fallos desde una IP, espera creciente (1 min, 2 min, 4 min… hasta 24 h) con respuesta 429. |
| Media | Tres teléfonos inventados podían cerrar cualquier reporte, incluso uno verificado, y quien lo creó también. | Los vecinos solo cierran avisos **sin verificar**. Se cuenta un voto por conexión (IP). Quien lo creó solo cierra sus avisos de calle. Máximo 30 confirmaciones por IP y hora. |
| Media | Denegación de servicio: `Content-Length` negativo, conexiones sin tiempo límite e hilos sin tope. | Se rechaza un `Content-Length` inválido o negativo. Tiempo límite de 20 s por conexión. Máximo 200 conexiones a la vez. Timeouts también en nginx. |
| Baja | Llenado de disco con fotos, y las fotos de 90 días solo se borraban al arrancar. | Máximo 20 fotos por IP al día. Sin fotos si quedan menos de 1 GB libres (507). Un hilo de mantenimiento cada 6 h borra las fotos viejas y la IP de los envíos de más de 48 h. La foto de un reporte descartado se borra enseguida. |
| Baja | Los límites por dispositivo e IP se comprobaban fuera del candado, así que varios envíos simultáneos se los saltaban. | Comprobación y guardado bajo el mismo candado. |
| Baja | Muchos avisos falsos podían desplazar a los verificados de la lista. | La lista ordena primero lo verificado. |
| Baja | «Me gusta» ilimitados. | Máximo 60 por IP y hora. |
| Info | El PIN salía en los registros en cada arranque. | Solo se muestra cuando se genera uno nuevo. |
| Info | El id del teléfono iba en la URL (queda en registros y proxies). | Va en la cabecera `X-Dispositivo`. Los registros de la API y de nginx omiten la query y la IP. Las fotos propias usan una llave firmada por foto (`?k=`, HMAC con `secreto_fotos` de `config.json`), no el id del teléfono. |
| Info | Leaflet se cargaba sin integridad, y el binario de Tailwind se descargaba sin verificar. | SRI (`integrity` sha256) en Leaflet. Huella sha256 de Tailwind verificada en los Dockerfile y en `estilos.sh`. |
| Info | Faltaban cabeceras de seguridad. | CSP estricta sin scripts en línea (se quitaron los `onclick` del HTML), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` y `COOP`, en nginx (`*/seguridad.conf`) y en la API. El panel no se indexa y no carga nada externo. La versión no se anuncia en `Server`. |
| Info | El id se generaba con `Math.random` cuando no había `crypto.randomUUID`. | Ahora con `crypto.getRandomValues`. |
| Info | El enlace compartido `/r/<id>` armaba la URL con la cabecera `Host`. | Variable `URL_PUBLICA` (ej. `https://yaguachiweather.ec`). |

Lo que ya estaba bien: todas las consultas SQL usan parámetros; el texto de los reportes pasa por `esc()` antes de ir al HTML; el PIN se compara en tiempo constante (`hmac.compare_digest`); las fotos se validan como JPEG y con un tamaño máximo; la IP real solo se acepta de proxies de confianza (`YAGUACHI_PROXIES`); el contenedor de la API no corre como root.

### Acceso al panel (desde la spec 014; reemplaza al PIN)

El PIN compartido ya no existe. Ahora:

- Se entra con usuario y clave (`scrypt`, 12 caracteres como mínimo), con captcha Turnstile y con la espera creciente tras 5 fallos: por IP y por IP + usuario hasta 24 h; por la cuenta sola (desde cualquier IP) como mucho 15 min, para que nadie pueda dejar fuera a `admin` por horas fallando a propósito. Los fallos se olvidan tras un día sin ninguno. Cada fallo se audita, exista o no el usuario.
- Si la dirección pública es https y falta `TURNSTILE_SECRET_KEY`, la API rechaza el ingreso (la clave de prueba aprobaría a cualquiera).
- La sesión va en una cookie `HttpOnly` + `SameSite=Strict`; con HTTPS se llama `__Host-yw_sesion` (`Secure`, `Path=/`, sin `Domain`), así ningún otro subdominio del mismo dominio puede plantarla. Las escrituras exigen `X-Requested-With: yaguachi`.
- Hay tres roles, que se verifican en la API, y la auditoría guarda cada acción.

Clave inicial del superadmin: `docker compose logs api | grep "CLAVE INICIAL"` (se muestra una sola vez). Si se pierde: `docker compose exec api python servidor.py --restablecer-clave admin`. Guía completa: [firebase-y-captcha.md](firebase-y-captcha.md).

Las tablas de arriba describen la revisión del 2026-11-09, cuando todavía existía el PIN.

## Publicar detrás de Cloudflare (lista de verificación)

1. **Origen cerrado.** Usa **Cloudflare Tunnel** (`cloudflared`) apuntando a `http://cliente:80` en la red de Docker. Así no hace falta abrir puertos y nadie llega al origen saltándose Cloudflare. Si no usas Tunnel, el firewall del servidor solo debe aceptar los [rangos de Cloudflare](https://www.cloudflare.com/ips/).
2. **IP real.** Ya está en `cliente/nginx.conf` y `admin/nginx.conf` (desde el 2026-11-10): se cree `CF-Connecting-IP` solo si la conexión llega por la red privada de Docker o desde un rango de Cloudflare. Sin esto, todos los límites por IP contaban la IP del proxy y un abusador, o una crecida con muchos reportes, bloqueaba a todo el cantón. Si cambian los [rangos de Cloudflare](https://www.cloudflare.com/ips/), actualízalos ahí. Para que la cabecera no se pueda falsificar, el origen solo debe aceptar conexiones de Cloudflare (punto 1).
3. **TLS.** Modo SSL **Full (strict)**, «Always Use HTTPS» y TLS mínimo 1.2. **HSTS** lo envían ahora los dos nginx (`seguridad.conf`, un año), porque Cloudflare no lo estaba poniendo. El GPS del navegador solo funciona con HTTPS.
4. **Panel.** No lo publiques. Si hace falta usarlo desde fuera, ponlo detrás de **Cloudflare Access** (correo o SSO del equipo de la UGR) con otro hostname de Tunnel hacia `admin:80`. El usuario con captcha queda como segunda llave. Pon `COOKIE_SEGURA=1`.
5. **WAF y límites.** Activa las reglas administradas. Agrega límites por IP:
   - `POST /api/reportes`: 10 por minuto.
   - `POST /api/reportes/*/confirmar` y `*/megusta`: 30 por minuto.
   - `/api/panel/*`: bloquear siempre desde el hostname público.
6. **Turnstile.** Sirve contra bots en `POST /api/reportes`, pero exige conexión con Cloudflare y puede fallar con señal débil o en el modo sin conexión (los reportes en cola se reenvían luego). Si se agrega, que sea solo en el envío y con un plan alternativo; hoy no está.
7. **Caché.** Bypass para `/api/*` y `/r/*`. Las capas `*.geojson` y los íconos pueden cachearse en el borde; `sw.js` nunca (ya va con `no-store`).
8. **URL pública.** Define `URL_PUBLICA=https://<tu-dominio>` en el servicio `api` para que las vistas previas de Facebook apunten bien.

## Pendiente

- Una pantalla para leer la auditoría (hoy solo está en la tabla `auditoria`).
- Revisión legal de la política de privacidad y cookies, y el correo de contacto del proyecto en esa sección.
