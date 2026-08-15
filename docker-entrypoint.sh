#!/bin/sh
set -e

echo "Bandplaner: wende ausstehende Datenbank-Migrationen an…"
npx prisma migrate deploy

echo "Bandplaner: starte Server…"
exec "$@"
