# Yaguachi Weather · app ciudadana (React + Vite, servida por nginx).
# Se construye desde la raíz del repositorio (necesita compartido/: motor i18n y capas):
#   docker build -f cliente/Dockerfile .        (o docker compose build cliente)
# Los archivos que entran al contexto los fija cliente/Dockerfile.dockerignore.

# Etapa 1: dependencias exactas (package-lock.json) y build (typecheck + vite build + service worker).
FROM node:22-alpine AS build
WORKDIR /src/cliente
COPY cliente/package.json cliente/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY compartido/ /src/compartido/
COPY cliente/ ./
RUN npm run build

# Etapa 2: nginx sirve dist/ y pasa /api/ y /r/ a la API.
FROM nginx:1.31-alpine
COPY cliente/nginx.conf /etc/nginx/conf.d/default.conf
COPY cliente/seguridad.conf /etc/nginx/snippets/seguridad.conf
COPY --from=build /src/cliente/dist/ /usr/share/nginx/html/
