# Implementation Plan: Despliegue automático con GitHub Actions

**Branch**: `017-despliegue-github-actions` | **Spec**: [spec.md](spec.md)

## Enfoque

GitHub Actions empaqueta y el servidor construye. El servidor no necesita acceso al repositorio (que es privado), así que no hay deploy keys de GitHub. El runner manda el código y la configuración por la misma conexión SSH.

```
push a main ─▶ runner: git archive + .env + secretos ─▶ ssh deployer@servidor "deploy <sha>" (stdin = tar)
                                                          └▶ /usr/local/bin/yaguachi-deploy
                                                               ├ releases/<sha>
                                                               ├ docker compose up -d --build --wait
                                                               └ current → releases/<sha>
```

## Decisiones

- **Llave con `command=`:** aunque `deployer` está en el grupo `docker`, que en la práctica equivale a root, su llave solo ejecuta el script. Si se filtra la llave, lo peor que se puede hacer es desplegar un paquete; no se obtiene una shell.
- **Script fuera del alcance de GitHub:** el script es de root y solo se actualiza volviendo a ejecutar `preparar-servidor.sh`.
- **Versiones por sha:** permite volver atrás con *Re-run* del workflow de un commit anterior. Los datos están en directorios fijos del host (`/opt/database`, `/opt/files`), así que todas las versiones los comparten.
- **`.env` desde GitHub:** la configuración vive en un solo lugar (Settings → Actions). Los secretos de origen están en 1Password, en el registro `yaguachiweather`.
- **Arreglo incluido:** `.gitignore` ignoraba cualquier carpeta `datos/` y dejaba fuera del repositorio `admin/src/features/datos/PanelDatos.tsx`, así que el panel no compilaba desde un clon limpio. Ahora la regla es `/datos/`, solo en la raíz.

## Constitution Check

| Compuerta | Estado |
|---|---|
| Impeccable / tsc / pruebas | Sin cambios de interfaz; el build del panel vuelve a compilar desde un clon limpio |
| i18n | N/A |
| VERSION del SW | N/A: no cambia ningún frontend |
| Dependencias nuevas | Ninguna en la app. En CI: `actions/checkout` fijada por SHA |
| Escrituras de la API | N/A |
| Probado de verdad | Despliegue real al servidor del registro `yaguachiweather` |
| VI (secretos) | Llaves y claves solo en 1Password y en los secretos de GitHub; nunca en el repositorio ni en los registros |
| VII (datos) | `/opt/database` y `/opt/files` nunca se borran; al migrar se copiaron los volúmenes, que siguen intactos; no se crean datos de prueba en producción |
