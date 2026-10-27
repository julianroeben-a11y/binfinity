# syntax=docker/dockerfile:1

# --- build the static site -------------------------------------------------
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG GIT_SHA=dev
RUN GIT_SHA=$GIT_SHA npm run build

# --- serve it with nginx ---------------------------------------------------
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/update-disabled.inc /etc/nginx/conf.d/update.inc
COPY docker/40-binfinity-update.sh /docker-entrypoint.d/40-binfinity-update.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
