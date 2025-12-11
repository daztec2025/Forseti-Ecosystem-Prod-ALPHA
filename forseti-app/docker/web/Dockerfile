# =============================================================================
# Forseti Web Dockerfile
# Multi-stage build for Next.js 15 with standalone output
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base - Common dependencies
# -----------------------------------------------------------------------------
FROM node:22-slim AS base

RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: Dependencies - Install all dependencies
# -----------------------------------------------------------------------------
FROM base AS deps

# Copy root package files for workspace resolution
COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/types/package.json ./packages/types/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Create a stub telemetry-recorder package without native dependencies
# (The real package uses node-irsdk which is Windows-only)
RUN mkdir -p packages/telemetry-recorder && \
    echo '{"name":"@repo/telemetry-recorder","version":"1.0.0","main":"dist/index.js"}' > packages/telemetry-recorder/package.json

# Install dependencies (ignoring optional native modules)
RUN npm install --legacy-peer-deps --ignore-scripts

# -----------------------------------------------------------------------------
# Stage 3: Builder - Build Next.js application
# -----------------------------------------------------------------------------
FROM deps AS builder

# Copy all source files (except telemetry-recorder which has native deps)
COPY apps/web ./apps/web/
COPY packages/ui ./packages/ui/
COPY packages/types ./packages/types/
COPY packages/eslint-config ./packages/eslint-config/
COPY packages/typescript-config ./packages/typescript-config/
COPY turbo.json ./

# Create stub telemetry-recorder dist
RUN mkdir -p packages/telemetry-recorder/dist && \
    echo 'module.exports = {};' > packages/telemetry-recorder/dist/index.js

# Build arguments for environment variables needed at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the Next.js application
WORKDIR /app/apps/web
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 4: Production - Minimal runtime image
# -----------------------------------------------------------------------------
FROM node:22-slim AS production

RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home forseti

WORKDIR /app

# Copy the standalone build output
# Note: outputFileTracingRoot puts files at apps/web/ within standalone
COPY --from=builder --chown=forseti:nodejs /app/apps/web/.next/standalone ./

# Copy static files to the correct location within the standalone structure
COPY --from=builder --chown=forseti:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Copy public files
COPY --from=builder --chown=forseti:nodejs /app/apps/web/public ./apps/web/public

# Switch to non-root user
USER forseti

WORKDIR /app/apps/web

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

CMD ["node", "server.js"]
