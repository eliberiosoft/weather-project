#!/bin/sh
# Yaguachi Weather · desarrollo sin Docker para la API y los frontends (macOS/Linux).
# Requisitos: Docker (solo para PostgreSQL y Redis), Python 3.10+ y Node 22+.
#   sh iniciar-dev.sh   → PostgreSQL en 127.0.0.1:5433, Redis en 127.0.0.1:6380, API en :8095, app en http://localhost:5173, panel en http://localhost:5174
# Ctrl+C detiene la API y los frontends (PostgreSQL y Redis siguen: docker compose stop db redis).
set -e
cd "$(dirname "$0")"
[ -f .env ] || { cp .env.example .env; sed -i.bak "s/^POSTGRES_PASSWORD=$/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env && rm -f .env.bak; echo "Se creó .env con una clave de PostgreSQL aleatoria"; }
set -a; . ./.env; set +a
docker compose up -d --wait db redis
python3 -c "import psycopg, psycopg_pool, redis" 2>/dev/null || python3 -m pip install -r api/requirements.txt
[ -d cliente/node_modules ] || (cd cliente && npm ci)
[ -d admin/node_modules ] || (cd admin && npm ci)
export REDIS_URL="redis://127.0.0.1:${PUERTO_REDIS:-6380}/0"
export DATABASE_URL="postgresql://yaguachi:${POSTGRES_PASSWORD}@127.0.0.1:${PUERTO_DB:-5433}/yaguachi"
trap 'kill 0' INT TERM EXIT
python3 api/servidor.py --puerto 8095 &
(cd cliente && npm run dev) &
(cd admin && npm run dev) &
wait
