# Despliegue al servidor con GitHub Actions

Cada push a `main` despliega solo. También se puede lanzar a mano en **Actions → Desplegar → Run workflow**.

## Cómo funciona

1. El workflow `.github/workflows/desplegar.yml` arma un paquete con:
   - el código del commit (`git archive`);
   - un `.env` generado con las variables y los secretos del repositorio;
   - si existe, la cuenta de servicio de Firebase en `secretos/firebase-cuenta-servicio.json`.
2. Envía el paquete por SSH al usuario **`deployer`** del servidor.
3. La llave de `deployer` está atada en `authorized_keys` (`command=`, sin pty ni túneles) a un solo script: `/usr/local/bin/yaguachi-deploy`, copia de `deploy/yaguachi-deploy.sh`. Con esa llave no se abre una shell: solo se puede desplegar o consultar el estado.
4. El script hace lo siguiente:
   - extrae el paquete en `/opt/yaguachi/releases/<sha>`;
   - ejecuta `docker compose up -d --build --wait`;
   - cuando todo queda arriba, apunta `/opt/yaguachi/current` a esa versión;
   - conserva las 5 últimas versiones.
5. El workflow comprueba que `/api/estado` responde.

Si el build falla, los contenedores anteriores siguen corriendo.

En el servidor, los datos viven en **directorios del host** y no en volúmenes de Docker. Los monta `compose.servidor.yaml`, que el script activa con `COMPOSE_FILE`. El despliegue nunca los borra.

| Directorio | Contenido | Dueño |
|---|---|---|
| `/opt/database` | PostgreSQL | uid 70, el usuario postgres de la imagen; permisos 700 |
| `/opt/files` | Fotos de reportes y `config.json` | uid 1000, el usuario de la API |

En desarrollo, `compose.yaml` usa los volúmenes `yaguachi-weather_pg` y `yaguachi-weather_datos`.

## Servidor

| | |
|---|---|
| Acceso | Registro **`yaguachiweather`** de 1Password (bóveda Personal): IP, root y su clave |
| Sistema | Ubuntu 24.04, Docker Engine y el plugin Compose |
| Usuario de despliegue | `deployer`: sin clave ni sudo, en el grupo `docker` |
| Llave de `deployer` | En el mismo registro, sección **deployer** (privada y pública) |
| `POSTGRES_PASSWORD` | En el mismo registro, sección **app**. **No se cambia**: la base ya se creó con ella |
| Código | `/opt/yaguachi/current` → `/opt/yaguachi/releases/<sha>` |
| Datos | `/opt/database` (PostgreSQL) y `/opt/files` (fotos y config) |

Para preparar un servidor nuevo, ejecuta esto una vez y como root (instala Docker, crea `deployer`, el script y los directorios de datos, y autoriza la llave):

```bash
scp deploy/yaguachi-deploy.sh root@SERVIDOR:/tmp/
ssh root@SERVIDOR 'bash -s' -- "\"$(cat deployer_ed25519.pub)\"" < deploy/preparar-servidor.sh
```

Si cambias `deploy/yaguachi-deploy.sh`, vuelve a ejecutar esos dos comandos. El script del servidor no se actualiza solo, a propósito: así la llave de GitHub no puede cambiar lo que ella misma tiene permitido.

## Variables y secretos del repositorio

Se configuran en **Settings → Secrets and variables → Actions**. Si falta el secreto `DEPLOY_HOST`, no se despliega (por ejemplo, en un fork sin configurar).

> **El servidor va en secretos, no en variables.** Los logs de Actions de un repositorio público los puede leer cualquiera, y GitHub solo tapa los secretos (`***`). Por eso `DEPLOY_HOST` y `DEPLOY_KNOWN_HOSTS` son secretos: así la IP del servidor no queda a la vista y nadie puede saltarse Cloudflare entrando directo al servidor.

| Variable | Valor |
|---|---|
| `DEPLOY_USER` | `deployer` |
| `PUERTO` | Puerto público de la app (`80`) |
| `PUERTO_ADMIN` | Puerto del panel, solo en 127.0.0.1 (`8091`) |
| `URL_PUBLICA` | `https://dominio`, detrás de Cloudflare. No pongas la IP: saldría en el log |
| `COOKIE_SEGURA` | `0` sin HTTPS, `1` con HTTPS |
| `TURNSTILE_SITE_KEY` | Vacía = claves de prueba |
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `FIREBASE_VAPID_KEY` | Configuración web de Firebase (ver `docs/firebase-y-captcha.md`) |

| Secreto | Valor |
|---|---|
| `DEPLOY_HOST` | IP o nombre del servidor (1Password → yaguachiweather → ip) |
| `DEPLOY_KNOWN_HOSTS` | Huella del servidor: la salida de `ssh-keyscan -t ed25519 SERVIDOR`, comprobada contra la del servidor |
| `DEPLOY_SSH_KEY` | Clave privada de `deployer` (1Password → yaguachiweather → deployer) |
| `POSTGRES_PASSWORD` | 1Password → yaguachiweather → app |
| `TURNSTILE_SECRET_KEY` | Vacío = claves de prueba |
| `FIREBASE_CUENTA_SERVICIO` | Contenido completo del JSON de la cuenta de servicio; vacío = push apagado |

Para cargarlos desde 1Password sin que pasen por la pantalla:

```bash
R=OWNER/REPO
op read "op://Personal/yaguachiweather/deployer/clave privada SSH" | gh secret set DEPLOY_SSH_KEY -R $R
op read "op://Personal/yaguachiweather/app/POSTGRES_PASSWORD"      | gh secret set POSTGRES_PASSWORD -R $R
op read "op://Personal/yaguachiweather/ip"                         | gh secret set DEPLOY_HOST -R $R
ssh-keyscan -t ed25519 "$(op read op://Personal/yaguachiweather/ip)" 2>/dev/null | gh secret set DEPLOY_KNOWN_HOSTS -R $R   # compárala con la del servidor
gh secret set FIREBASE_CUENTA_SERVICIO -R $R < secretos/firebase-cuenta-servicio.json
```

## Operación

- **Estado:**
  ```bash
  ssh -i <llave de deployer> deployer@SERVIDOR status
  ```
- **Registros** (como root):
  ```bash
  cd /opt/yaguachi/current && export COMPOSE_FILE=compose.yaml:compose.servidor.yaml
  docker compose logs api
  ```
- **Panel:** solo escucha en 127.0.0.1:8091 del servidor. Entra por un túnel, con root o con tu propio usuario:
  ```bash
  ssh -L 8091:127.0.0.1:8091 root@SERVIDOR
  ```
  Luego abre http://127.0.0.1:8091.
- **Volver a una versión anterior:** en Actions, vuelve a ejecutar el workflow de ese commit (*Re-run jobs*).
- Como root, antes de cualquier `docker compose …` en `/opt/yaguachi/current`, ejecuta `export COMPOSE_FILE=compose.yaml:compose.servidor.yaml`. Si no lo haces, compose usa los volúmenes en lugar de `/opt/database` y `/opt/files`.
- **Respaldo de la base:**
  ```bash
  docker compose exec db pg_dump -U yaguachi yaguachi > respaldo.sql
  ```
  O copia `/opt/database` con la base detenida. Las fotos están en `/opt/files/fotos`.
- **La clave inicial del superadmin solo aparece en los registros del primer contenedor**, y cada despliegue recrea los contenedores. Si ya no la encuentras:
  ```bash
  docker compose exec api python servidor.py --restablecer-clave admin
  ```

## Pendiente para producción

- Ponerla detrás de Cloudflare (Tunnel o proxy con Full strict), y después `URL_PUBLICA=https://…` y `COOKIE_SEGURA=1`. Sin HTTPS no funcionan la instalación de la PWA, el push ni el GPS.
- Endurecer SSH: hoy root entra con clave. Conviene usar solo llaves y `PermitRootLogin prohibit-password`.
- Firewall: abrir solo 22 y 80/443. Docker publica sus puertos por encima de `ufw`, y la base y el panel ya escuchan solo en 127.0.0.1.
