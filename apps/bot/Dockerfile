# ── TONPLAY Bot Service ──────────────────────────────────────────────────────
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./

# Copy package.json files for dependency resolution
COPY packages/shared/package.json packages/shared/
COPY apps/bot/package.json apps/bot/

# Install dependencies (ignore scripts to avoid prisma postinstall issues)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Manually run necessary postinstall scripts
RUN node node_modules/esbuild/install.js 2>/dev/null || true

# Copy prisma schema from API (bot uses @prisma/client)
COPY apps/api/prisma apps/bot/prisma/

# Copy source code
COPY packages/shared packages/shared
COPY apps/bot apps/bot

# Build
RUN pnpm --filter @tonplay/shared run build
RUN pnpm --filter @tonplay/bot run build

# Generate Prisma client using the API schema
RUN cd apps/bot && pnpm exec prisma generate --schema=prisma/schema.prisma

WORKDIR /app/apps/bot
EXPOSE 3001

CMD ["node", "dist/index.js"]
