# Node plus OpenSSL, which Prisma's schema engine needs.
FROM node:22-bookworm-slim AS base
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dev toolbox (docker-compose.yml): source and node_modules come from bind mounts and volumes.
FROM base AS dev

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Nothing connects during the build, but the Prisma config and client want a URL to exist.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npx prisma generate && npx next build

# Production image (docker-compose.prod.yml). Keeps dev dependencies: the worker runs on tsx and
# migrations need the Prisma CLI.
FROM base AS prod
ENV NODE_ENV=production
RUN mkdir -p /data/uploads && chown node:node /data/uploads
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
