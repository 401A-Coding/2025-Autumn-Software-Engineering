## Multi-stage Dockerfile for NestJS + Prisma backend
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src
COPY prisma ./prisma

# Generate Prisma client for type safety and build
RUN npx prisma generate
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built artifacts and prisma folder (for migrate deploy)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Add entrypoint to run migrations then start server
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
