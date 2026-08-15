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

# ---- runner: Produktions-Image ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Ohne openssl kann Prismas Migrations-Engine die libssl-Version nicht
# erkennen ("Prisma failed to detect the libssl/openssl version") und
# faellt auf eine Vermutung zurueck - funktioniert meist, ist aber unnoetig
# unzuverlaessig.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

# Bewusst die komplette, unveränderte node_modules sowie den vollständigen
# Next.js-Build aus dem Builder übernehmen (statt einzelne Pakete von Hand
# zusammenzustellen) - deutlich robuster, da z. B. das Prisma-CLI-Startskript
# (node_modules/.bin/prisma) auf andere Dateien im selben Paket per relativem
# Pfad verweist und bei einer Teilkopie fehlschlägt ("Cannot find module").
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src/generated ./src/generated

COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Numerisches chmod (statt "+x"): wird absolut gesetzt und ist damit -
# anders als die symbolische Form - unabhängig vom umask des Build-Prozesses
# und von den Original-Dateirechten auf dem Host (z. B. DSM-ACLs/SMB-Freigabe).
# Mount-Punkte für persistente Daten (Datenbank, Song-/Band-Dateien,
# Profil-/Bandbilder) - siehe docker-compose.yml für die zugehörigen Volumes.
RUN chmod 755 ./docker-entrypoint.sh \
    && mkdir -p /data /app/storage /app/public/uploads/avatars /app/public/uploads/bands \
    && chown -R nextjs:nodejs /app /data

EXPOSE 3000

# Bewusst NICHT "USER nextjs" hier: der Container startet als root, damit
# docker-entrypoint.sh bei jedem Start die Rechte der gemounteten Volumes
# reparieren kann (siehe dort) - benannte Docker-Volumes behalten sonst
# dauerhaft den Eigentümer von ihrer allerersten Initialisierung, auch nach
# einem Image-Rebuild mit anderen Rechten. Der eigentliche Server läuft
# danach trotzdem als nextjs (Rechte werden im Entrypoint per su abgegeben).
ENTRYPOINT ["/bin/sh", "./docker-entrypoint.sh"]
CMD ["npm", "start"]
