# syntax=docker/dockerfile:1

# ---- deps: Abhängigkeiten installieren (Build-Tools für native Module wie better-sqlite3) ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: Prisma-Client generieren und Next.js-App bauen ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- runner: schlankes Produktions-Image ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

# Eigenständiges Next.js-Server-Bundle - enthält bereits die tatsächlich zur
# Laufzeit benötigten Abhängigkeiten (inkl. better-sqlite3 mit nativem Addon).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma-Schema, Migrationen und CLI zusätzlich kopieren: werden vom
# Server-Bundle nicht erfasst, aber für "prisma migrate deploy" beim
# Containerstart benötigt (siehe docker-entrypoint.sh).
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Numerisches chmod (statt "+x"): wird absolut gesetzt und ist damit -
# anders als die symbolische Form - unabhängig vom umask des Build-Prozesses
# und von den Original-Dateirechten auf dem Host (z. B. DSM-ACLs/SMB-Freigabe).
# Mount-Punkte für persistente Daten (Datenbank, Song-/Band-Dateien,
# Profil-/Bandbilder) - siehe docker-compose.yml für die zugehörigen Volumes.
RUN chmod 755 ./docker-entrypoint.sh \
    && mkdir -p /data /app/storage /app/public/uploads/avatars /app/public/uploads/bands \
    && chown -R nextjs:nodejs /data /app/storage /app/public/uploads

USER nextjs
EXPOSE 3000

# Explizit über /bin/sh aufrufen statt das Skript direkt auszuführen: so
# genügt Lese- statt Ausführrecht, als zusätzliche Absicherung gegen
# Berechtigungs-Eigenheiten des Build-Hosts.
ENTRYPOINT ["/bin/sh", "./docker-entrypoint.sh"]
CMD ["node", "server.js"]
