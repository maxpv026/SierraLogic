# ═══════════════════════════════════════════════════════════════════════════════
# SierraLogic — Production Dockerfile
# Multi-stage build: deps → builder → runner
# Base: node:20-alpine (small, security-patched)
# ═══════════════════════════════════════════════════════════════════════════════


# ───────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps
# ───────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# libc6-compat is required by some native Node addons on musl-based Alpine
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
# --frozen-lockfile equivalent for npm; fails if lock file is out of sync
RUN npm ci


# ───────────────────────────────────────────────────────────────────────────────
# Stage 2 — builder
# ───────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Bring in all deps installed in the previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the entire repository (respecting .dockerignore)
COPY . .

# Generate the Prisma client targeted at linux-musl-openssl-3.0.x (Alpine)
# Custom output path is defined in prisma.config.ts → ../src/generated/prisma
RUN npx prisma generate

# Disable Next.js telemetry and set production mode before building
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build


# ───────────────────────────────────────────────────────────────────────────────
# Stage 3 — runner
# ───────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run as a non-root system user — principle of least privilege
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Static assets (public directory)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Compiled Next.js application output
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

# Runtime npm dependencies (Next.js, React, Prisma client wrapper, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# package.json is needed so `npm start` resolves `next start`
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Next.js TypeScript config — loaded by the server process at runtime
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts

# Prisma generated client (includes the Alpine-native query engine .so binary)
# Output path matches the prisma.config.ts `output` setting: ../src/generated/prisma
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated

# Switch to the unprivileged user before the process starts
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
