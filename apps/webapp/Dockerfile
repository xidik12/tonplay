# ── TONPLAY Webapp (Static Build) ────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy package.json files for dependency resolution
COPY packages/shared/package.json packages/shared/
COPY apps/webapp/package.json apps/webapp/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared packages/shared
COPY apps/webapp apps/webapp

# Build (API URL injected via env at build time)
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm --filter @tonplay/shared run build
RUN pnpm --filter @tonplay/webapp run build

# ── Serve with lightweight static server ─────────────────────────────────────
FROM node:20-alpine
RUN npm install -g serve@14
WORKDIR /app
COPY --from=base /app/apps/webapp/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
