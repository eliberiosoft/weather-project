#!/bin/bash
# Yaguachi Weather · prepara un servidor Ubuntu 24.04 para recibir despliegues desde GitHub Actions.
# Se ejecuta UNA vez, como root, desde la raíz del repositorio:
#
#   scp deploy/yaguachi-deploy.sh root@SERVIDOR:/tmp/
#   ssh root@SERVIDOR 'bash -s' -- "ssh-ed25519 AAAA… deployer@…" < deploy/preparar-servidor.sh
#
# Hace:
#   1. Instala Docker Engine + Compose desde el repositorio oficial de Docker (si falta).
#   2. Crea el usuario `deployer` (sin clave, sin sudo) y lo agrega al grupo docker.
#   3. Instala /usr/local/bin/yaguachi-deploy (desde /tmp/yaguachi-deploy.sh).
#   4. Autoriza la llave pública recibida SOLO para ejecutar ese script (command=, sin pty ni túneles).
#   5. Crea /opt/yaguachi (dueño deployer) y los directorios de datos /opt/database y /opt/files.
# Se puede volver a ejecutar: es idempotente y reemplaza la llave autorizada.
set -euo pipefail

LLAVE="${1:-}"
if [[ ! "$LLAVE" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ .*)?$ ]]; then
  echo "uso: preparar-servidor.sh \"ssh-ed25519 AAAA… comentario\"" >&2
  exit 2
fi
[ "$(id -u)" -eq 0 ] || { echo "ejecútalo como root" >&2; exit 2; }
[ -f /tmp/yaguachi-deploy.sh ] || { echo "falta /tmp/yaguachi-deploy.sh" >&2; exit 2; }

export DEBIAN_FRONTEND=noninteractive

if ! command -v docker >/dev/null 2>&1; then
  echo "==> instalando Docker"
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl >/dev/null
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  systemctl enable --now docker >/dev/null
fi
docker --version
docker compose version

echo "==> usuario deployer"
if ! id deployer >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash deployer
fi
passwd -l deployer >/dev/null            # sin clave: solo entra con su llave
usermod -aG docker deployer

echo "==> script de despliegue"
install -o root -g root -m 0755 /tmp/yaguachi-deploy.sh /usr/local/bin/yaguachi-deploy
rm -f /tmp/yaguachi-deploy.sh

echo "==> llave SSH (solo puede ejecutar yaguachi-deploy)"
install -d -o deployer -g deployer -m 0700 /home/deployer/.ssh
printf 'command="/usr/local/bin/yaguachi-deploy",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty,no-user-rc %s\n' "$LLAVE" \
  > /home/deployer/.ssh/authorized_keys
chown deployer:deployer /home/deployer/.ssh/authorized_keys
chmod 0600 /home/deployer/.ssh/authorized_keys

echo "==> /opt/yaguachi"
install -d -o deployer -g deployer -m 0750 /opt/yaguachi /opt/yaguachi/releases

echo "==> directorios de datos (compose.servidor.yaml)"
# 70 = postgres en postgres:17-alpine; 1000 = yaguachi en api/Dockerfile. No se tocan si ya existen con datos.
[ -d /opt/database ] || install -d -o 70 -g 70 -m 0700 /opt/database
[ -d /opt/files ] || install -d -o 1000 -g 1000 -m 0750 /opt/files

echo "listo"
