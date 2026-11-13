#!/bin/sh
# Yaguachi Weather · la app por HTTPS en la red local (solo desarrollo), para probar la ubicación desde el celular.
# El navegador solo da la ubicación en https:// o en localhost; por http://192.168.x.x:8090 la bloquea.
# Requisitos: Docker y mkcert (brew install mkcert). Uso: sh iniciar-https.sh [IP]   (por defecto, la IP de en0)
set -e
cd "$(dirname "$0")"
IP="${1:-$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | cut -d' ' -f1)}"
mkdir -p secretos/https
# un certificado para localhost y para la IP de este equipo en la red (se rehace si cambió la IP)
if ! grep -qs "$IP" secretos/https/ip.txt; then
  mkcert -cert-file secretos/https/cert.pem -key-file secretos/https/key.pem localhost 127.0.0.1 ::1 "$IP"
  echo "$IP" > secretos/https/ip.txt
fi
PUERTO="${PUERTO:-8090}" docker compose -f compose.yaml -f compose.https.yaml up -d --build
echo
echo "App por HTTPS:  https://localhost:${PUERTO_HTTPS:-8443}   y desde el celular (misma red):  https://$IP:${PUERTO_HTTPS:-8443}"
echo "En el celular, acepta el aviso del certificado («Avanzado» → «Continuar»). En esta Mac, para que no avise:"
echo "  mkcert -install   (una sola vez; pide la clave del equipo)"
