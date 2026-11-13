# Tasks: Despliegue automático con GitHub Actions

- [X] T001 Generar la llave ed25519 de `deployer` y `POSTGRES_PASSWORD`; guardarlas en 1Password → yaguachiweather (secciones deployer y app)
- [X] T002 `deploy/preparar-servidor.sh`: instala Docker, crea `deployer`, instala el script y autoriza la llave con `command=`
- [X] T003 `deploy/yaguachi-deploy.sh`: `deploy <sha>` / `status`, `flock`, versiones, `--wait` y limpieza
- [X] T004 Preparar el servidor y comprobar que la llave no abre una shell
- [X] T005 `.github/workflows/desplegar.yml`
- [X] T006 Arreglar `.gitignore` (`datos/` → `/datos/`) y versionar `admin/src/features/datos/`
- [X] T007 `docs/despliegue.md`, enlace en el README y fila en `specs/README.md`
- [X] T011 Datos del servidor en `/opt/database` y `/opt/files` (`compose.servidor.yaml`); migrar los volúmenes existentes copiándolos
- [X] T008 Configurar las variables y los secretos en el repositorio que despliega
- [ ] T009 HTTPS con Cloudflare; después `URL_PUBLICA=https://…` y `COOKIE_SEGURA=1`
- [ ] T010 Endurecer SSH: solo llaves, `PermitRootLogin prohibit-password`
