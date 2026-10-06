# Imagen de producción de la API (ADR 0003). Se construye desde la raíz del
# monorepo: docker build -f apps/api/Dockerfile .
FROM node:24.21.0-bookworm-slim AS base
# Prisma necesita OpenSSL para elegir su motor de consultas.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
# Los package.json de las dos apps: npm ci valida el lockfile contra todos los
# workspaces, aunque instale solo el de la API.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace api
COPY apps/api apps/api
RUN npm exec --workspace api -- prisma generate \
  && npm run build --workspace api

FROM base
ENV NODE_ENV=production
# Sin el aviso de versión nueva de npm en el log de cada migración.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
# Se copian también las dependencias de desarrollo: el CLI de Prisma corre las
# migraciones en cada deploy y ts-node corre la carga de producción.
COPY --from=build --chown=node:node /app /app
USER node
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main"]
