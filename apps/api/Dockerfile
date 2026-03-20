# ── TONPLAY API Service ──────────────────────────────────────────────────────
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./

# Copy package.json files for dependency resolution
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

# Copy prisma schema for generation
COPY apps/api/prisma apps/api/prisma/

# Install all dependencies (including devDependencies for build)
ENV NODE_ENV=development
RUN pnpm install --no-frozen-lockfile
ENV NODE_ENV=production

# Copy source code
COPY packages/shared packages/shared
COPY apps/api apps/api

# Build shared package
RUN pnpm --filter @tonplay/shared run build

# Generate Prisma client
RUN pnpm --filter @tonplay/api exec prisma generate

# Build API
RUN pnpm --filter @tonplay/api run build

WORKDIR /app/apps/api
EXPOSE 3000

# Run migrations then start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
