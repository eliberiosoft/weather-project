# Yaguachi Weather · panel del analista (React + Vite → nginx).
# Se construye desde la raíz del repositorio (usa compartido/i18n y compartido/capas): docker compose build admin
FROM node:22-alpine AS build
WORKDIR /src/admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY compartido/i18n/ /src/compartido/i18n/
COPY compartido/capas/limite_canton.geojson compartido/capas/calles.geojson /src/compartido/capas/
COPY admin/ ./
RUN npm run build

FROM nginx:1.31-alpine
COPY admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY admin/seguridad.conf /etc/nginx/snippets/seguridad.conf
COPY --from=build /src/admin/dist/ /usr/share/nginx/html/
