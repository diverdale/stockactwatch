# ── Stage 1: Install dependencies ──────────────────────────────────────────────
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Enable standalone output for Docker deployments (GCP, Fly.io, etc.)
ENV NEXT_OUTPUT=standalone
RUN pnpm build

# ── Stage 3: Production runner ─────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Cloud Run sets PORT; Next.js standalone server respects this env var
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Copy the standalone server bundle
COPY --from=builder /app/.next/standalone ./
# Copy static assets
COPY --from=builder /app/.next/static ./.next/static
# Copy public assets
COPY --from=builder /app/public ./public

EXPOSE 8080

CMD ["node", "server.js"]
