#!/bin/bash
# Yaguachi Weather · despliegue en el servidor.
#
# Lo ejecuta el usuario `deployer` y SOLO esto: su llave SSH está atada a este script con
# `command=` en ~deployer/.ssh/authorized_keys, así que la llave no abre una shell.
# Se instala en /usr/local/bin/yaguachi-deploy (dueño root, 755) con deploy/preparar-servidor.sh.
#
# Órdenes (llegan en SSH_ORIGINAL_COMMAND):
#   deploy <sha>   stdin = tar con el código (git archive), .env y, si hay, secretos/*.json
#   status         estado de los contenedores
#
# Cada versión queda en /opt/yaguachi/releases/<sha>; /opt/yaguachi/current apunta a la activa.
# Los datos viven en /opt/database y /opt/files (compose.servidor.yaml): este script nunca los borra
# ni ejecuta `down -v`.
set -euo pipefail
# El código lo leen usuarios sin privilegios dentro de los contenedores: umask 022. Lo protege /opt/yaguachi (750,
# dueño deployer); el .env queda en 600 y los JSON de secretos/ en 644 (el usuario de la API debe poder leerlos).
umask 022

BASE=/opt/yaguachi
RELEASES="$BASE/releases"
CONSERVAR=5
MAX_PAQUETE=$((300 * 1024 * 1024))
# Datos en directorios del servidor (compose.servidor.yaml), no en volúmenes de Docker.
DIR_DB=/opt/database
DIR_DATOS=/opt/files
export COMPOSE_FILE=compose.yaml:compose.servidor.yaml DIR_DB DIR_DATOS

read -r -a args <<<"${SSH_ORIGINAL_COMMAND:-${*:-}}"
accion="${args[0]:-}"

case "$accion" in
  status)
    if [ -L "$BASE/current" ]; then
      echo "versión: $(basename "$(readlink -f "$BASE/current")")"
      cd "$BASE/current" && docker compose ps
    else
      echo "sin despliegues todavía"
    fi
    exit 0
    ;;
  deploy)
    sha="${args[1]:-}"
    if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
      echo "error: se espera «deploy <sha de 40 caracteres>»" >&2
      exit 2
    fi
    ;;
  *)
    echo "uso: deploy <sha> | status" >&2
    exit 2
    ;;
esac

mkdir -p "$RELEASES"
exec 9>"$BASE/.lock"
if ! flock -n 9; then
  echo "error: hay otro despliegue en curso" >&2
  exit 3
fi

tmp="$(mktemp -d "$RELEASES/.nuevo.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

# El paquete viene por stdin. Se corta en MAX_PAQUETE: un tar truncado hace fallar a tar.
head -c "$MAX_PAQUETE" | tar -x -C "$tmp" --no-same-owner --no-same-permissions --no-overwrite-dir
for d in "$DIR_DB" "$DIR_DATOS"; do
  [ -d "$d" ] || { echo "error: falta $d (ejecuta deploy/preparar-servidor.sh como root)" >&2; exit 4; }
done
for f in compose.yaml compose.servidor.yaml .env; do
  [ -f "$tmp/$f" ] || { echo "error: el paquete no trae $f" >&2; exit 4; }
done
chmod 600 "$tmp/.env"
if [ -d "$tmp/secretos" ]; then
  find "$tmp/secretos" -type f -name '*.json' -exec chmod 644 {} +
fi

destino="$RELEASES/$sha"
rm -rf "$destino"
mv "$tmp" "$destino"
trap - EXIT

cd "$destino"
echo "==> construyendo y levantando $sha"
# Si el build falla, los contenedores anteriores siguen corriendo y current no cambia.
docker compose up -d --build --remove-orphans --wait --wait-timeout 300

ln -sfn "$destino" "$BASE/current.nuevo"
mv -T "$BASE/current.nuevo" "$BASE/current"
echo "==> activo: $sha"
docker compose ps

# Limpieza: deja las últimas $CONSERVAR versiones y quita imágenes sin uso.
find "$RELEASES" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -printf '%T@ %p\n' \
  | sort -rn | tail -n +$((CONSERVAR + 1)) | cut -d' ' -f2- \
  | while read -r viejo; do
      [ "$viejo" = "$destino" ] || rm -rf -- "$viejo"
    done
docker image prune -f >/dev/null
