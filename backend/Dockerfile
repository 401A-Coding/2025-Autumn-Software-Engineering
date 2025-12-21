## Multi-stage Dockerfile for NestJS + Prisma backend
# Build stage
FROM docker.m.daocloud.io/library/node:20-alpine AS builder

# Use faster npm registry inside China
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry ${NPM_REGISTRY}

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy sources
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src
COPY prisma ./prisma

# Speed up Prisma engine downloads via mirror
ENV PRISMA_ENGINES_MIRROR=https://npmmirror.com/mirrors/prisma/
# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

# Runtime stage
FROM docker.m.daocloud.io/library/node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install production deps only
COPY package*.json ./
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry ${NPM_REGISTRY} \
    && npm ci --omit=dev

# Copy built app and prisma schema
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

## Ensure Prisma Client is generated in the runtime image
RUN npx prisma generate

# Entrypoint takes care of migrations
COPY docker-entrypoint.sh ./docker-entrypoint.sh
# Ensure Prisma engines mirror is available at runtime too
ENV PRISMA_ENGINES_MIRROR=https://npmmirror.com/mirrors/prisma/
# Normalize line endings (in case repo has CRLF on Windows) and make executable
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
