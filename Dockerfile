FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --ignore-scripts
RUN npx prisma generate

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/theme.config.yaml ./theme.config.yaml
COPY --from=builder /app/content.config.yaml ./content.config.yaml
COPY --from=builder /app/.env.example ./.env.example

# Standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Full node_modules for Prisma CLI migrations at startup
# (prisma has transitive deps like valibot, @prisma/dev that need to be present)
COPY --from=deps /app/node_modules ./node_modules

# Startup script
COPY --from=builder /app/scripts/start.sh ./scripts/start.sh
RUN chmod +x ./scripts/start.sh

# Create uploads directories (local fallback + volume mount point)
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads
RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["./scripts/start.sh"]
