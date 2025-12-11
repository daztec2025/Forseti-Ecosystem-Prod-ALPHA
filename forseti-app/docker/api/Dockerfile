# =============================================================================
# Forseti API Dockerfile
# Multi-stage build for Express.js API with Prisma and native dependencies
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base - Common dependencies and setup
# -----------------------------------------------------------------------------
FROM node:22-slim AS base

# Install OpenSSL for Prisma and Python/build-essential for native modules (bcrypt)
RUN apt-get update && apt-get install -y \
    openssl \
    python3 \
    make \
    g++ \
    netcat-openbsd \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: Dependencies - Install all dependencies
# -----------------------------------------------------------------------------
FROM base AS deps

WORKDIR /app/apps/api

# Copy API package files and Prisma schema
COPY apps/api/package.json apps/api/package-lock.json* ./
COPY apps/api/prisma ./prisma/

# Install dependencies directly in API directory (not workspace)
RUN npm install --legacy-peer-deps

# -----------------------------------------------------------------------------
# Stage 3: Production - Final minimal image
# -----------------------------------------------------------------------------
FROM node:22-slim AS production

# Install OpenSSL (required by Prisma at runtime) and netcat for health checks
RUN apt-get update && apt-get install -y \
    openssl \
    curl \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home forseti

WORKDIR /app/apps/api

# Copy package files
COPY --from=deps /app/apps/api/package.json ./

# Copy node_modules from deps stage (includes native modules and Prisma client)
COPY --from=deps /app/apps/api/node_modules ./node_modules

# Copy API application code
COPY apps/api/index.js apps/api/config.js ./
COPY apps/api/prisma ./prisma/
COPY apps/api/routes ./routes/
COPY apps/api/services ./services/

# Copy entrypoint script and fix Windows line endings
COPY docker/api/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

# Create uploads directory with proper permissions
RUN mkdir -p ./uploads/media ./uploads/setups && \
    chown -R forseti:nodejs ./uploads

# Switch to non-root user
USER forseti

# Environment variables
ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:4000/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "index.js"]
