# ── TONPLAY Bot Service ──────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./

# Copy package.json files for dependency resolution
COPY packages/shared/package.json packages/shared/
COPY apps/bot/package.json apps/bot/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared packages/shared
COPY apps/bot apps/bot

# Build
RUN pnpm --filter @tonplay/shared run build
RUN pnpm --filter @tonplay/bot run build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY --from=base /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json /app/turbo.json ./
COPY --from=base /app/packages/shared/package.json packages/shared/
COPY --from=base /app/packages/shared/dist packages/shared/dist
COPY --from=base /app/apps/bot/package.json apps/bot/
COPY --from=base /app/apps/bot/dist apps/bot/dist

RUN pnpm install --frozen-lockfile --prod

WORKDIR /app/apps/bot
EXPOSE 3001

CMD ["node", "dist/index.js"]
