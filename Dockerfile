# Dev toolbox image: Node plus OpenSSL, which Prisma's schema engine needs.
FROM node:22-bookworm-slim
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
