# Imagen de producción del front (ADR 0003). Se construye desde la raíz del
# monorepo: docker build -f apps/web/Dockerfile .
FROM node:24.21.0-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS build
# Los package.json de las dos apps: npm ci valida el lockfile contra todos los
# workspaces, aunque instale solo el del front.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace web
COPY apps/web apps/web
# Todas las páginas son dinámicas, así que el build no necesita API_URL ni las
# variables de horario: el servidor las lee en cada request.
RUN npm run build --workspace web

FROM base
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
WORKDIR /app/apps/web
EXPOSE 3001
CMD ["node", "/app/node_modules/next/dist/bin/next", "start", "-p", "3001"]
