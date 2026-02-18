# ── TONPLAY API Service ──────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./

# Copy package.json files for dependency resolution
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

# Copy prisma schema for generation
COPY apps/api/prisma apps/api/prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared packages/shared
COPY apps/api apps/api

# Build shared package
RUN pnpm --filter @tonplay/shared run build

# Generate Prisma client
RUN pnpm --filter @tonplay/api exec prisma generate

# Build API
RUN pnpm --filter @tonplay/api run build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace structure
COPY --from=base /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json /app/turbo.json ./
COPY --from=base /app/packages/shared/package.json packages/shared/
COPY --from=base /app/packages/shared/dist packages/shared/dist
COPY --from=base /app/apps/api/package.json apps/api/
COPY --from=base /app/apps/api/dist apps/api/dist
COPY --from=base /app/apps/api/prisma apps/api/prisma

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Re-generate Prisma client in production image
RUN cd apps/api && pnpm exec prisma generate

WORKDIR /app/apps/api
EXPOSE 3000

# Run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
