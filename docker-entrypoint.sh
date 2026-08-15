#!/bin/sh
set -e

# Läuft als root: benannte Docker-Volumes (Datenbank, Song-/Band-Dateien,
# Profil-/Bandbilder) behalten dauerhaft den Eigentümer ihrer allerersten
# Initialisierung, auch nach einem Image-Rebuild mit anderen Rechten im
# Image selbst. Deshalb hier bei jedem Start reparieren, statt sich auf den
# einmaligen "chown" im Dockerfile zu verlassen.
echo "Bandplaner: repariere Dateirechte der persistenten Volumes…"
chown -R nextjs:nodejs /data /app/storage /app/public/uploads

echo "Bandplaner: wende ausstehende Datenbank-Migrationen an…"
su nextjs -s /bin/sh -c "npx prisma migrate deploy"

echo "Bandplaner: starte Server…"
exec su nextjs -s /bin/sh -c "exec npm start"
