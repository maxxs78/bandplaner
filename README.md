Bandplaner ist eine webbasierte Band-Organisations-App (Kalender, Verfügbarkeit, Songs, Setlisten, Dateien) auf Basis von Next.js, Prisma und SQLite.

## Lokale Entwicklung

```bash
npm install
cp .env.example .env   # Werte anpassen, siehe Kommentare in der Datei
npx prisma migrate dev
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000). Die App legt beim ersten Start ein neues Konto über `/register` an; das erste Bandmitglied wird beim Anlegen der ersten Band automatisch deren Administrator:in.

## Deployment per Docker (z. B. Synology DiskStation)

Das Repository enthält ein `Dockerfile` (mehrstufiger Build, eigenständiges Next.js-Server-Bundle) sowie eine `docker-compose.yml` mit persistenten Volumes für Datenbank, hochgeladene Dateien und Profil-/Bandbilder.

**Voraussetzung**: Docker bzw. Container Manager auf der DiskStation, sowie SSH-Zugriff oder die Möglichkeit, ein `docker-compose.yml`-Projekt anzulegen.

1. Repository auf die DiskStation holen (z. B. per `git clone`, oder Ordner hochladen).
2. Neben `docker-compose.yml` eine eigene `.env`-Datei anlegen (Vorlage: `.env.example`):
   ```bash
   cp .env.example .env
   ```
   - `AUTH_SECRET`: eigenen, zufälligen Wert erzeugen, z. B. `openssl rand -base64 32`
   - `NEXT_PUBLIC_APP_URL`: die später genutzte URL der DiskStation (z. B. `http://diskstation.local:3000`)
   - `DATABASE_URL` wird für den Container bereits in `docker-compose.yml` auf das persistente Volume gesetzt und muss dort nicht angepasst werden.
3. Bauen und starten:
   ```bash
   docker compose up -d --build
   ```
   Beim Start wendet der Container automatisch ausstehende Datenbank-Migrationen an (`prisma migrate deploy`, siehe `docker-entrypoint.sh`).
4. App unter `http://<diskstation-ip>:3000` (Port in `docker-compose.yml` bei Bedarf anpassen) aufrufen und über `/register` das erste Konto anlegen.

**Updates einspielen** (nachdem lokal weiterentwickelt und gepusht wurde):

```bash
git pull
docker compose up -d --build
```

**Persistente Daten**: Datenbank (`bandplaner_data`), Song-/Band-Dateien (`bandplaner_storage`) und Profil-/Bandbilder (`bandplaner_uploads`) liegen in benannten Docker-Volumes und bleiben bei `docker compose up --build` erhalten. Ein `docker compose down -v` löscht sie unwiderruflich - nur bewusst verwenden.

> Hinweis: Der Docker-Build wurde in dieser Entwicklungsumgebung nicht selbst getestet (kein Docker verfügbar). Vor dem produktiven Einsatz einmal testweise auf der Zielumgebung durchlaufen lassen.

## Weitere Next.js-Ressourcen

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
