# Bandplaner – Installationsanleitung (Self-Hosting)

> 🇬🇧 This guide is also available [in English](INSTALLATION.md).

Diese Anleitung beschreibt die Installation von Bandplaner mit Schwerpunkt auf **Docker**. Sie deckt folgende Wege ab:

1. [Kurz: Lokales Testen](#1-kurz-lokales-testen-ohne-docker) (ohne Docker, zum Entwickeln/Ausprobieren)
2. [Docker-Grundlagen](#2-docker--grundlagen) (gilt für jede Plattform)
3. [Synology DiskStation mit Container Manager](#3-installation-auf-synology-diskstation-container-manager) (detailliert)
4. [Proxmox VE](#4-installation-auf-proxmox-ve) (detailliert)

Technischer Hintergrund: Bandplaner ist eine Next.js-App mit Prisma/SQLite als Datenbank und NextAuth (Auth.js) für den Login. Persistiert werden drei Dinge: die SQLite-Datenbankdatei, hochgeladene Song-/Band-Dateien sowie Profil-, Band- und Song-Coverbilder.

### Zwei Betriebsarten

| | **Fertiges Image (empfohlen)** | **Selbst bauen** |
|---|---|---|
| Herkunft | vorgebautes Multi-Arch-Image (amd64/arm64) aus der GitHub Container Registry: `ghcr.io/maxxs78/bandplaner` | lokaler Docker-Build aus dem Quellcode |
| Nötige Dateien | nur `docker-compose.yml` + `.env` | das komplette Repository |
| Erststart | Image-Download, ~1 Minute | nativer Build, auf schwacher Hardware 10–20 Minuten |
| Compose-Aufruf | `docker compose up -d` | `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build` |
| Update | `docker compose pull && docker compose up -d` | `git pull && docker compose … up -d --build` |
| Wofür | normaler Selbsthost-Betrieb | Entwicklung, eigene Code-Anpassungen/Forks |

Die restliche Anleitung geht vom **fertigen Image** aus. Die Selbst-Bauen-Variante unterscheidet sich nur im Compose-Aufruf und darin, dass das gesamte Repository vorliegen muss.

Das veröffentlichte Image ist **öffentlich** – `docker compose up -d` zieht es ohne `docker login` und ohne GitHub-Konto.

---

## 1. Kurz: Lokales Testen (ohne Docker)

Nur zum Entwickeln/Ausprobieren gedacht, nicht für den Dauerbetrieb. Die Schritte dafür (`npm install`, `.env` anlegen, `npx prisma migrate dev`, `npm run dev`) stehen im [README](README.de.md#lokale-entwicklung).

**Windows-Hinweis:** Beim `npm install` wird das native Modul `better-sqlite3` kompiliert – dafür sind Build-Tools (Python, C++-Compiler) nötig; falls das fehlschlägt, ist WSL (Windows Subsystem for Linux) oder ein Linux/macOS-Rechner der unkompliziertere Weg.

Für den produktiven Betrieb ab hier mit Docker weitermachen.

---

## 2. Docker – Grundlagen

Dieser Abschnitt gilt unabhängig davon, ob Sie auf einer Synology DiskStation, in Proxmox oder sonstwo hosten – die Konzepte sind überall identisch.

Sie brauchen **Docker mit dem Compose-Plugin** – sowohl `docker --version` als auch `docker compose version` sollten etwas ausgeben. Unter Windows/macOS ist das Docker Desktop; auf einem reinen Linux-Server die Docker Engine plus das Paket `docker-compose-plugin`. Die Abschnitte zu Synology und Proxmox decken diese Plattformen konkret ab.

### 2.1 Was im Repository bereits enthalten ist

| Datei | Zweck |
|---|---|
| `docker-compose.yml` | Startet den Container aus dem GHCR-Image, verbindet drei benannte Volumes, liest `AUTH_SECRET`/`NEXT_PUBLIC_APP_URL` aus einer `.env`-Datei und definiert einen Health-Check |
| `docker-compose.build.yml` | Override, um das Image lokal zu bauen statt es zu ziehen (nur für Entwicklung/Forks) |
| `.env.example` | Vorlage für die Umgebungsvariablen |
| `Dockerfile` | Mehrstufiger Build: `deps` (npm-Install inkl. Kompilierung von `better-sqlite3`), `builder` (Prisma-Client generieren, `next build`), `runner` (schlankes Produktions-Image, Port 3000). Wird bei der Image-Variante nicht gebraucht – GitHub Actions baut damit die veröffentlichten Images. |
| `docker-entrypoint.sh` | Läuft bei **jedem** Containerstart: repariert Dateirechte der Volumes, führt `prisma migrate deploy` aus, startet dann den Server (Teil des Images) |

### 2.2 Persistente Daten (Volumes)

| Volume | Inhalt | Container-Pfad |
|---|---|---|
| `bandplaner_data` | SQLite-Datenbankdatei | `/data` |
| `bandplaner_storage` | Song-/Band-Dateien | `/app/storage` |
| `bandplaner_uploads` | Profil-/Band-/Song-Coverbilder | `/app/public/uploads` |

Diese drei Docker-Volumes überleben Updates (`docker compose pull && docker compose up -d`) und Container-Neustarts. **`docker compose down -v` löscht sie unwiderruflich** – nur bewusst verwenden, und vorher ein Backup ziehen (siehe unten).

### 2.3 Umgebungsvariablen

Diese kommen aus einer `.env`-Datei, die **neben** der `docker-compose.yml` liegt (nicht im Container-Image, sondern von `docker compose` beim Start eingelesen):

| Variable | Bedeutung | Beispiel |
|---|---|---|
| `AUTH_SECRET` | Geheimer Schlüssel für NextAuth-Sessions. **Pflicht**, sonst startet der Login nicht sicher. | per `openssl rand -base64 32` erzeugen |
| `NEXT_PUBLIC_APP_URL` | Öffentlich erreichbare URL der App (für Links in E-Mails, ICS-Kalenderfeed) | `http://diskstation.local:3000` bzw. `https://bandplaner.example.com` |
| `REGISTRATION_ENABLED` | Offene Selbstregistrierung unter `/register`. **Optional**, Standard `false`: nur das erste Konto (Erstinbetriebnahme) und per Einladungslink eingeladene Personen können ein Konto anlegen – alle anderen kommen ausschließlich über einen Einladungslink dazu. `true` öffnet die Registrierung für beliebige Besucher (nur sinnvoll, wenn der Zugang ohnehin auf vertrauenswürdige Nutzer:innen beschränkt ist). | `false` |
| `SMTP_HOST` | Mailserver für Benachrichtigungen. **Optional** – bleibt er leer, verschickt die App keine E-Mails, funktioniert sonst aber unverändert. | `smtp.example.com` |
| `SMTP_PORT` | Port des Mailservers (Standard 587) | `587` |
| `SMTP_USER` / `SMTP_PASSWORD` | Zugangsdaten des Mailkontos, falls der Server Authentifizierung verlangt | `bandplaner@example.com` |
| `SMTP_FROM` | Absenderadresse der Benachrichtigungen (leer = `SMTP_USER`) | `Bandplaner <noreply@example.com>` |
| `SMTP_SECURE` | Nur nötig, wenn abweichend: `true` erzwingt TLS ab Verbindungsaufbau. Sonst automatisch aus dem Port abgeleitet (465 = TLS, sonst STARTTLS). | `true` |
| `MUSICBRAINZ_USER_AGENT` | Aktiviert MusicBrainz in der Online-Recherche des Anlageassistenten. **Optional** – ohne gesetzten Wert bleibt nur die ID3-Vorschau aus hochgeladenen Dateien aktiv. MusicBrainz verlangt laut Nutzungsbedingungen einen identifizierenden Wert aus Name und Kontakt, kein generischer String. | `Bandplaner/1.0 (kontakt@example.com)` |
| `DISCOGS_TOKEN` | Personal Access Token für Discogs; ergänzt Discogs als Ergebnisquelle des Assistenten (Genre, Jahr, Cover). **Optional.** | über den eigenen Discogs-Account unter „Developer Settings" erzeugen |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Zugangsdaten einer Spotify-App (Client-Credentials-Flow); ergänzt Spotify als Ergebnisquelle des Assistenten (Track-Link und Album-Cover). **Optional.** | über das [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) erzeugen |
| `NOMINATIM_BASE_URL` | Adresssuche/Kartenabgleich im Modul **Orte**. **Optional** – leer nutzt die öffentliche OpenStreetMap-Nominatim-Instanz; nur bei eigenem Nominatim-Betrieb anzupassen. | `https://nominatim.example.com` |

Die drei Anlageassistent-Quellen sind unabhängig voneinander optional konfigurierbar und degradieren bei fehlender Konfiguration still – die manuelle Song-Erfassung sowie die ID3-Vorschau bleiben davon unberührt.

Damit tatsächlich Mails verschickt werden, müssen **beide** Bedingungen erfüllt sein:

1. SMTP ist wie oben konfiguriert, **und**
2. das Modul **Kommunikation** ist für die jeweilige Band eingeschaltet (Band → Verwaltung → Funktionen; standardmäßig aus).

Ist eines von beidem nicht erfüllt, funktioniert die App normal weiter – es werden dann nur keine Benachrichtigungen versendet. Welche Benachrichtigungen jemand bekommt, stellt jede Person anschließend selbst im eigenen Profil je Band ein (neuer Termin, Terminänderung, Songvorschlag, neue Datei, eigene Gagen/Kostenanteile). Fehlt der Mailserver, weist die Profilseite ausdrücklich darauf hin.

`DATABASE_URL` und `AUTH_TRUST_HOST` sind bereits fest in `docker-compose.yml` gesetzt und müssen nicht angepasst werden. `AUTH_TRUST_HOST=true` ist nötig, weil der Host (IP, Hostname, Domain) je nach Netzwerk variiert – NextAuth würde im Produktionsmodus sonst mit „There was a problem with the server configuration“ abbrechen.

**`AUTH_SECRET` erzeugen:**

```bash
openssl rand -base64 32
```

Falls `openssl` nicht verfügbar ist (z. B. auf Windows ohne Git Bash), alternativ mit Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2.4 Medienplayer

Der Medienplayer benötigt **keine** zusätzliche Konfiguration – er wird lediglich je Band unter *Verwaltung → Funktionen* eingeschaltet (standardmäßig aus). Zwei Punkte sind für den Betrieb dennoch relevant:

- **Übungsmodus und Arbeitsspeicher:** Für Tempo-, Tonart- und Loop-Funktionen wird die Audiodatei vollständig dekodiert im Arbeitsspeicher gehalten – grob 20 MB je Minute Stereo, ein Vier-Minuten-Song also rund 85 MB. Das passiert ausschließlich **im Browser des jeweiligen Geräts**, nicht auf dem Server, und auch nur, wenn jemand den Übungsmodus aktiv startet. Auf älteren Mobilgeräten kann das spürbar sein; das normale Abspielen ist davon nicht betroffen.
- **Audio-Worklet-Datei:** Für das Transponieren wird `public/audio-worklet/soundtouch-processor.js` benötigt. Diese Datei wird beim `npm install` automatisch aus den Abhängigkeiten kopiert (`scripts/copy-audio-worklet.mjs`) und liegt deshalb bewusst nicht im Repository. Im Docker-Build passiert das automatisch – bei einer manuellen Installation ohne `npm install` würde lediglich der Übungsmodus mit einer Fehlermeldung starten, alles andere bliebe nutzbar.

Der Player streamt Dateien über HTTP-Range-Requests, damit im Titel gesprungen werden kann. Wird Bandplaner hinter einem Reverse Proxy betrieben, sollte dieser Range-Requests unverändert durchreichen – die in Abschnitt 3.8 beschriebene DSM-Konfiguration tut das bereits.

### 2.5 Erststart-Ablauf

Beim `docker compose up -d` passiert:

1. Das Image wird aus der GitHub Container Registry geladen (einige hundert MB, meist unter einer Minute). *(Selbst-Bauen-Variante: hier wird stattdessen lokal gebaut – bei schwacher CPU 10–20 Minuten wegen der nativen Kompilierung von `better-sqlite3`.)*
2. Container startet als `root`, `docker-entrypoint.sh` repariert die Besitzrechte der Volumes.
3. `npx prisma migrate deploy` wendet ausstehende Datenbank-Migrationen an (auch bei jedem späteren Neustart – das ist ungefährlich, bei bereits aktueller DB passiert nichts).
4. Der eigentliche Next.js-Server startet als unprivilegierter Benutzer `nextjs`, lauscht auf Port 3000.

Ein Health-Check (in `docker-compose.yml` definiert) prüft den Server danach alle 30 Sekunden; `docker compose ps` und Container Manager zeigen den Container als `healthy`, sobald er antwortet (bis zu einer Minute nach dem Start), sonst als `unhealthy`. Reines `docker compose` meldet diesen Status nur, handelt aber nicht darauf – `restart: unless-stopped` startet den Container nur neu, wenn der Prozess tatsächlich beendet wird. Für automatische Neustarts bei `unhealthy` einen kleinen Beiwagen wie `willfarrell/autoheal` ergänzen.

### 2.6 Updates einspielen (generisch)

```bash
docker compose pull      # neuestes Image aus GHCR holen
docker compose up -d     # Container mit dem neuen Image neu starten
```

Kein `git pull` nötig – bei der Image-Variante genügen `docker-compose.yml` und `.env`. Ausstehende Datenbank-Migrationen werden beim Neustart automatisch angewendet (Schritt 3 oben). Eine bestimmte Version statt `latest` betreiben? In `docker-compose.yml` den Tag anpassen (z. B. `:1.4.2`) – verfügbare Tags: <https://github.com/maxxs78/bandplaner/pkgs/container/bandplaner>.

*(Selbst-Bauen-Variante: `git pull` und danach `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`.)*

### 2.7 Backup (generisch)

Die drei Volumes enthalten alle produktiven Daten. Einfachster Weg für ein Ad-hoc-Backup:

```bash
docker run --rm -v bandplaner_data:/data -v bandplaner_storage:/storage -v bandplaner_uploads:/uploads \
  -v "$(pwd)":/backup alpine \
  tar czf /backup/bandplaner-backup-$(date +%Y%m%d).tar.gz /data /storage /uploads
```

Für regelmäßige/automatisierte Backups siehe die plattformspezifischen Abschnitte unten (Hyper Backup bzw. Proxmox vzdump/PBS).

Wiederherstellen: den Container stoppen (`docker compose down`), das Archiv in dieselben drei Volumes zurückspielen (umgekehrter `tar`-Aufruf), dann `docker compose up -d`. Beispiel:

```bash
docker compose down
docker run --rm -v bandplaner_data:/data -v bandplaner_storage:/storage -v bandplaner_uploads:/uploads \
  -v "$(pwd)":/backup alpine \
  sh -c "cd / && tar xzf /backup/bandplaner-backup-JJJJMMTT.tar.gz"
docker compose up -d
```

---

## 3. Installation auf Synology DiskStation (Container Manager)

Gilt für DSM 7.2+ (Paket heißt „Container Manager“). Auf älteren DSM-Versionen (7.0/7.1) heißt das Paket „Docker“ – die zugrunde liegende Docker-Engine und die Konzepte sind identisch, nur einzelne Menüpunkte heißen anders.

### 3.1 Voraussetzungen

- DiskStation mit x86_64- oder ARM-CPU, die **Container Manager** unterstützt (Paketzentrum zeigt es sonst nicht an). Das veröffentlichte Image deckt `linux/amd64` und `linux/arm64` ab – das schließt die Intel/AMD-Modelle sowie die 64-Bit-ARM-Modelle (ARMv8) wie DS124, DS223 oder DS423 ein. Sehr alte 32-Bit-ARM-NAS werden nicht abgedeckt; dort bleibt nur die Selbst-Bauen-Variante, sofern die CPU überhaupt reicht.
- Einige hundert MB Plattenplatz für das Image. Für die **Image-Variante** wird **kein** nennenswerter Arbeitsspeicher für einen Build benötigt; nur bei der Selbst-Bauen-Variante sollten ~2 GB RAM frei sein.
- Optional, aber empfohlen: SSH-Zugriff (Systemsteuerung → Terminal & SNMP → SSH-Dienst aktivieren), das macht das Anlegen der `.env`-Datei und spätere Updates deutlich einfacher als reines Klicken in File Station.

### 3.2 Container Manager installieren

Paketzentrum öffnen → „Container Manager“ suchen → Installieren.

### 3.3 Projektordner auf der DiskStation anlegen

Für die Image-Variante werden nur **zwei Dateien** benötigt – das komplette Repository ist nicht nötig.

1. In **File Station** einen Ordner anlegen, z. B. `/volume1/docker/bandplaner`.
2. Dort die Datei `docker-compose.yml` ablegen. Entweder aus dem Repository herunterladen (<https://github.com/maxxs78/bandplaner/blob/main/docker-compose.yml>) oder den Inhalt kopieren.
3. Die `.env`-Datei kommt in Schritt 3.4 in denselben Ordner.

Merken Sie sich den absoluten Pfad auf der DiskStation selbst (nicht den Windows-Laufwerksbuchstaben, sondern z. B. `/volume1/docker/bandplaner`) – Container Manager zeigt in Schritt 3.5 direkt darauf.

*(Selbst-Bauen-Variante: stattdessen das gesamte Repository per `git clone` oder File-Station-Upload in den Ordner bringen, inklusive `docker-compose.build.yml`.)*

### 3.4 `.env`-Datei anlegen

Im selben Ordner wie `docker-compose.yml` eine Datei `.env` anlegen. Als Vorlage dient `.env.example` aus dem Repository (<https://github.com/maxxs78/bandplaner/blob/main/.env.example>); wer das Repository lokal hat, kopiert einfach:

```bash
cp .env.example .env
```

Darin anpassen:

- `AUTH_SECRET` – eigenen Zufallswert erzeugen (siehe [2.3](#23-umgebungsvariablen))
- `NEXT_PUBLIC_APP_URL` – die später genutzte Adresse, z. B. `http://diskstation.local:3000` oder die spätere HTTPS-Domain (siehe [3.8](#38-aus-dem-internet-erreichbar-machen-https-reverse-proxy-absicherung))
- `SMTP_*` – optional, nur falls E-Mail-Benachrichtigungen gewünscht sind (siehe [2.3](#23-umgebungsvariablen)); kann auch später jederzeit nachgetragen werden
- `MUSICBRAINZ_USER_AGENT` / `DISCOGS_TOKEN` / `SPOTIFY_CLIENT_*` / `NOMINATIM_BASE_URL` – ebenfalls optional (Anlageassistent bzw. Orte-Adresssuche, siehe [2.3](#23-umgebungsvariablen)); ohne sie funktionieren die jeweiligen Grundfunktionen unverändert weiter

`DATABASE_URL` unverändert lassen – wird im Container ohnehin auf `/data` umgebogen.

Ohne SSH-Zugriff: `.env`-Datei lokal am PC erstellen und über File Station in den Projektordner hochladen (achten Sie darauf, dass sie wirklich `.env` heißt und nicht `.env.txt`).

### 3.5 Projekt in Container Manager erstellen

1. Container Manager öffnen → **Projekt** → **Erstellen**.
2. Projektname vergeben, z. B. `bandplaner`.
3. Pfad: den Ordner wählen, in dem `docker-compose.yml` und `.env` liegen.
4. Container Manager erkennt die `docker-compose.yml` automatisch und zeigt deren Inhalt an.
5. Bestätigen. Container Manager lädt das Image aus der GitHub Container Registry (`ghcr.io/maxxs78/bandplaner`) und startet den Container – meist innerhalb einer Minute.

*(Selbst-Bauen-Variante: der Assistent bietet stattdessen einen Build an – das kann je nach Modell 10–20 Minuten dauern, siehe [2.5](#25-erststart-ablauf); nicht abbrechen, auch wenn es lange „hängt“. Container Manager lädt die zweite Compose-Datei nicht automatisch mit – dafür entweder `docker-compose.build.yml` als weitere Datei im Projekt angeben oder den `build:`-Block manuell in `docker-compose.yml` ergänzen.)*

### 3.6 Port & Firewall

Standardmäßig ist die App über Port **3000** erreichbar (`http://<diskstation-ip>:3000`). Falls der Port schon belegt ist (z. B. durch DSM selbst auf 5000/5001 in der Regel nicht, aber ggf. durch andere Container), in `docker-compose.yml` den linken Wert der Portzuordnung ändern, z. B.:

```yaml
ports:
  - "8080:3000"
```

Danach das Projekt in Container Manager neu starten (**Aktion → Erstellen/Neu starten**).

Falls die DSM-Firewall aktiv ist (Systemsteuerung → Sicherheit → Firewall): eine Regel für den gewählten Port und die gewünschten Quell-IPs/Netze ergänzen.

### 3.7 Erststart prüfen

Container Manager → **Container** → `bandplaner` → **Details** → **Log**. Sie sollten dort nacheinander sehen:

```
Bandplaner: repariere Dateirechte der persistenten Volumes…
Bandplaner: wende ausstehende Datenbank-Migrationen an…
Bandplaner: starte Server…
```

Anschließend `http://<diskstation-ip>:3000` (bzw. gewählter Port) im Browser öffnen und über `/register` das erste Konto anlegen.

### 3.8 Aus dem Internet erreichbar machen (HTTPS, Reverse Proxy, Absicherung)

Standardmäßig ist Bandplaner nur im eigenen Netz über `http://<diskstation-ip>:3000` erreichbar. Sollen Bandmitglieder auch von unterwegs zugreifen können, braucht es zwei getrennte Bausteine: Die **Router-Portfreigabe** sorgt dafür, dass Anfragen aus dem Internet überhaupt bis zur DiskStation durchgelassen werden (reiner Transportweg); die **DSM-Einrichtung** unten sorgt für Verschlüsselung (TLS-Zertifikat) und reicht die Anfrage intern an den Container weiter. Beides zusammen ist nötig – Portfreigabe allein liefert weder Verschlüsselung noch ein gültiges Zertifikat.

**Voraussetzung:** eine Domain oder ein DDNS-Hostname, der auf Ihre öffentliche IP zeigt (bei dynamischer IP z. B. über Synologys eigenen DDNS-Dienst oder den Ihres Domain-Anbieters aktuell gehalten).

**1. Router-Portfreigabe**

Nur Port **443** (HTTPS) an die DiskStation weiterleiten. Port 3000 (der App-Port) darf **nicht** direkt weitergeleitet werden – sonst liefe der Traffic unverschlüsselt am Reverse Proxy vorbei. Port 80 wird nur kurzzeitig gebraucht, falls DSM für die Zertifikatsausstellung die HTTP-01-Challenge nutzt; danach kann er wieder geschlossen werden.

**2. Zertifikat**

Systemsteuerung → **Sicherheit** → **Zertifikat** → Hinzufügen → Let's Encrypt, Domain eintragen. Kostenlos, verlängert sich automatisch.

**3. Reverse-Proxy-Regel**

Systemsteuerung → **Anmeldeportal** → **Erweitert** → **Reverse-Proxy-Regel** → Erstellen:

| Feld | Wert |
|---|---|
| Beschreibung | z. B. `Bandplaner` |
| Quelle – Protokoll | HTTPS |
| Quelle – Hostname | `<ihre-domain>` |
| Quelle – Port | 443 |
| Quelle – HSTS | optional, sobald alles läuft empfehlenswert |
| Ziel – Protokoll | HTTP |
| Ziel – Hostname | `localhost` |
| Ziel – Port | 3000 (bzw. der in `docker-compose.yml` gewählte linke Port) |

Die Header `X-Forwarded-For`, `X-Forwarded-Proto` sowie der ursprüngliche `Host`-Header werden von DSMs Reverse Proxy bereits standardmäßig durchgereicht – dafür ist **keine** zusätzliche Einstellung im Reiter „Benutzerdefinierter Header" nötig. Das ist wichtig, weil `AUTH_TRUST_HOST=true` (bereits in `docker-compose.yml` gesetzt) NextAuth genau darauf verlässt, um zu erkennen, dass die Verbindung verschlüsselt ist.

**4. App-Konfiguration**

`NEXT_PUBLIC_APP_URL` in der `.env` auf die neue `https://…`-Adresse setzen und das Projekt neu starten, damit z. B. Links im ICS-Kalenderfeed, in WhatsApp-Teilen-Buttons und in Benachrichtigungs-Mails korrekt sind.

**5. Verifizieren**

Nach dem Umstellen einloggen und in den Browser-Entwicklertools unter *Application → Cookies* prüfen, ob der Session-Cookie mit `__Secure-` beginnt (`__Secure-authjs.session-token`). Ist das Präfix da, hat NextAuth HTTPS korrekt erkannt. Fehlt es, kommt der `X-Forwarded-Proto`-Header nicht an – typisches Symptom ist dann eine Login-Redirect-Schleife (siehe Fehlerbehebung unten). Anschließend auch von außerhalb des eigenen Netzes testen (z. B. Mobilfunknetz statt Heim-WLAN), da lokale Auflösung/Firewall-Effekte einen falschen Erfolg vortäuschen können.

**6. Absicherung, weil jetzt öffentlich erreichbar**

Sobald ein Port aus dem Internet erreichbar ist, gehört mehr zur Grundabsicherung als nur das Zertifikat:

- **Nur den nötigen Port exponieren:** Router leitet ausschließlich 443 weiter – nicht die DSM-Weboberfläche (5000/5001) und nicht SSH (22). SSH bleibt separat davon eine eigene Entscheidung; für reinen App-Zugriff wird es nicht gebraucht.
- **DSM Auto Block aktivieren:** Systemsteuerung → Sicherheit → Schutz – sperrt IP-Adressen automatisch nach mehreren Fehlversuchen gegen DSM selbst.
- **2FA für den DSM-Admin-Account** aktivieren, das Standardkonto „admin" deaktivieren oder umbenennen.
- **Login-Schutz auf App-Ebene ist bereits eingebaut:** Bandplaner sperrt ein Konto nach 5 fehlgeschlagenen Loginversuchen automatisch für 2 Tage (siehe [README](README.de.md)) – dafür ist keine zusätzliche Konfiguration nötig.
- **Registrierung geschlossen lassen:** `REGISTRATION_ENABLED` bleibt auf `false` (Standard), damit sich nicht beliebige Besucher ein Konto anlegen können (siehe [2.3](#23-umgebungsvariablen) und [7. Erstes Konto anlegen](#7-erstes-konto-anlegen)).
- **Backup vor der Umstellung** einmal gegenprüfen (siehe [3.10](#310-backup)), bevor der Server öffentlich erreichbar wird.

### 3.9 Updates

**Per SSH:**

```bash
cd /volume1/docker/bandplaner   # oder Ihr Projektpfad
docker compose pull
docker compose up -d
```

**Ohne SSH, in Container Manager:** Projekt `bandplaner` → **Aktion** → **Erstellen/Neu starten** (bzw. „Zurücksetzen“). Bei einem `latest`-Tag holt Container Manager dabei das aktuelle Image; wird eine feste Version in `docker-compose.yml` betrieben, dort zuerst den Tag hochziehen und die Datei speichern.

Die Datenbank-Migrationen laufen beim Neustart automatisch. Ein Backup vorher schadet nie (siehe [3.10](#310-backup)).

*(Selbst-Bauen-Variante: `git pull` und `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`; ohne SSH die neuen Dateien über File Station hochladen und das Projekt erneut bauen.)*

### 3.10 Backup

Die drei benannten Volumes liegen physisch unterhalb des Docker-Datenverzeichnisses (meist `/volume1/@docker` bzw. je nach DSM-Version im „docker“-Systemordner) und sind damit für Synologys **Hyper Backup** nicht ohne Weiteres als eigener Freigabeordner sichtbar. Zwei praktikable Wege:

- **Einfach:** Regelmäßig den Befehl aus [2.7](#27-backup-generisch) per Task-Planer (Systemsteuerung → Aufgabenplaner → geplante Aufgabe → Benutzerdefiniertes Skript) auf der DiskStation ausführen lassen; das Ergebnis-Archiv landet in einem normalen Freigabeordner, den Hyper Backup dann ganz regulär sichert.
- **Alternativ (mehr Kontrolle):** In `docker-compose.yml` statt benannter Volumes Bind-Mounts auf einen Freigabeordner verwenden (z. B. `/volume1/docker/bandplaner-data:/data`), den Hyper Backup dann direkt sichert. Das ist ein bewusster Eingriff in die mitgelieferte `docker-compose.yml` – vor der Umstellung ein Backup der bestehenden Volumes ziehen.

---

## 4. Installation auf Proxmox VE

Proxmox selbst ist ein Hypervisor – Docker sollte **nicht** direkt auf dem Proxmox-Host laufen, sondern in einem LXC-Container oder einer VM.

### 4.1 LXC vs. VM

| | LXC-Container | VM |
|---|---|---|
| Ressourcenverbrauch | gering (teilt sich den Host-Kernel) | höher (eigener Kernel) |
| Docker-Kompatibilität | sehr gut, benötigt aber „Nesting“-Feature | uneingeschränkt, da echter Kernel |
| Empfehlung | **Standardweg für diesen Anwendungsfall** | Alternative, falls maximale Isolation gewünscht ist |

Im Folgenden Variante A (LXC) im Detail, Variante B (VM) kurz als Alternative.

### 4.2 Variante A: Debian-LXC-Container (empfohlen)

**1. Container-Vorlage bereitstellen**

Im Proxmox-Webinterface: gewünschter Storage (z. B. `local`) → **CT-Vorlagen** → **Vorlagen** → `debian-12-standard` herunterladen (falls nicht vorhanden).

**2. Container erstellen**

„Create CT“ im Proxmox-UI, dabei:

- **General**: Hostname z. B. `bandplaner`, Passwort setzen. „Unprivileged container“ **aktiviert lassen** (Standard/sicherer) – das reicht für Docker, wenn zusätzlich die Features unten gesetzt werden.
- **Template**: `debian-12-standard`
- **Disks**: mind. 4 GB genügen für die Image-Variante; für die Selbst-Bauen-Variante mind. 16 GB (Build inkl. `node_modules` braucht Platz)
- **CPU**: 1 Core reicht für die Image-Variante; für einen lokalen Build mind. 2 Cores
- **Memory**: 512–1024 MB genügen für die Image-Variante; für einen lokalen Build mind. 2048 MB, Swap 512 MB (die native Kompilierung von `better-sqlite3` braucht RAM)
- **Network**: Bridge `vmbr0`, feste IP oder DHCP je nach Ihrem Netz

**3. Nesting aktivieren**

Nach dem Erstellen: Container auswählen → **Options** → **Features** → bearbeiten → **Nesting** und **keyctl** aktivieren. Ohne dieses Feature kann der Docker-Daemon in einem unprivilegierten LXC-Container nicht starten. Container danach neu starten.

**4. Docker Engine installieren**

Container-Konsole öffnen (`pct enter <ID>` auf dem Proxmox-Host, oder über die Web-Konsole) und ausführen:

```bash
apt update && apt install -y ca-certificates curl gnupg git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

**5. Projektordner anlegen**

Für die Image-Variante genügen `docker-compose.yml` und `.env`:

```bash
mkdir -p /opt/bandplaner && cd /opt/bandplaner
curl -fsSLO https://raw.githubusercontent.com/maxxs78/bandplaner/main/docker-compose.yml
curl -fsSL  https://raw.githubusercontent.com/maxxs78/bandplaner/main/.env.example -o .env
```

*(Selbst-Bauen-Variante: stattdessen `git clone https://github.com/maxxs78/bandplaner.git /opt/bandplaner`.)*

**6. `.env` ausfüllen und starten**

```bash
cd /opt/bandplaner
nano .env   # AUTH_SECRET und NEXT_PUBLIC_APP_URL setzen, siehe 2.3
docker compose up -d
```

*(Selbst-Bauen-Variante: `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`.)*

**7. Autostart & Firewall**

- Proxmox: Container → **Options** → „Start at boot“ aktivieren, damit der Container beim Hochfahren des Proxmox-Hosts mitstartet. Der Docker-Dienst selbst ist nach der Installation bereits als systemd-Dienst aktiviert und startet mit dem Container automatisch.
- Firewall: falls die Proxmox-Firewall oder `ufw` im Container aktiv ist, Port 3000 (bzw. den in `docker-compose.yml` gewählten Port) für Zugriffe aus Ihrem Netz freigeben.

### 4.3 Variante B: VM statt LXC

Falls Sie lieber eine VM verwenden (z. B. Ubuntu Server 22.04/24.04): VM wie gewohnt in Proxmox anlegen (mind. 2 vCPU, 2 GB RAM, 16 GB Disk), Docker darin exakt wie in Schritt 4.2.4 installieren (Repo-URL entsprechend `ubuntu` statt `debian` verwenden), dann Schritte 4.2.5–4.2.7 identisch. Nesting/keyctl entfällt, da eine VM einen eigenen Kernel hat.

### 4.4 Exkurs: Fertige Docker-LXC-Vorlagen per Community-Skript

Es existieren Community-Helferskripte (z. B. „Proxmox VE Helper-Scripts“), die einen fertig eingerichteten Docker-LXC-Container per Ein-Zeiler auf dem Proxmox-Host erzeugen. Das spart Schritte 4.2.1–4.2.4, ist aber ein Skript eines Drittanbieters, das mit Root-Rechten auf Ihrem Proxmox-Host läuft. Prüfen Sie den Skriptinhalt vor der Ausführung selbst, wenn Sie diesen Weg gehen möchten – die manuelle Variante oben ist der sicherere Standardweg und unterscheidet sich am Ende nur in wenigen Kommandos.

### 4.5 Updates

```bash
cd /opt/bandplaner
docker compose pull
docker compose up -d
```

*(Selbst-Bauen-Variante: `git pull` und `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`.)*

### 4.6 Backup

Da bei einem LXC-Container die Docker-Volumes Teil des Container-Dateisystems sind, sichert ein normaler Proxmox-Container-Snapshot/Backup automatisch auch die Bandplaner-Daten mit:

- **Datacenter → Backup** → geplanten Backup-Job für den `bandplaner`-Container anlegen (Ziel: lokaler Storage oder Proxmox Backup Server).
- Vor größeren Updates zusätzlich manuell: Container auswählen → **Backup** → **Backup jetzt**.

Das ist der empfohlene Weg unter Proxmox – deutlich einfacher als das volume-basierte Backup aus [2.7](#27-backup-generisch), da gleich der komplette Container gesichert wird.

---

## 5. Reverse Proxy & HTTPS (plattformübergreifend, optional)

Für eine eigene Domain mit HTTPS statt `http://ip:3000` gibt es unabhängig von der Plattform mehrere gängige Optionen: Synologys eingebauter Reverse-Proxy (siehe [3.8](#38-aus-dem-internet-erreichbar-machen-https-reverse-proxy-absicherung), inkl. Absicherungs-Checkliste, die sinngemäß auch auf anderen Plattformen gilt), oder – z. B. bei Proxmox – ein zusätzlicher Reverse Proxy wie **Nginx Proxy Manager**, **Caddy** oder **Traefik** in einem eigenen Container/LXC, der Let's-Encrypt-Zertifikate verwaltet und Anfragen an `bandplaner:3000` weiterleitet. `AUTH_TRUST_HOST=true` ist bereits in der `docker-compose.yml` gesetzt, wodurch der Login unabhängig vom verwendeten Host funktioniert. `NEXT_PUBLIC_APP_URL` sollte nach Einrichtung auf die finale `https://…`-Adresse gesetzt werden, damit Links (z. B. im ICS-Kalenderfeed) korrekt sind.

---

## 6. Fehlerbehebung

| Symptom | Ursache / Lösung |
|---|---|
| „There was a problem with the server configuration“ beim Login | `AUTH_SECRET` fehlt oder ist leer in der `.env` |
| Build bricht mit Speicherfehler ab / hängt sehr lange | Betrifft nur die **Selbst-Bauen-Variante**: zu wenig RAM für die Kompilierung von `better-sqlite3` – Container/VM-Speicher erhöhen (mind. 2 GB), ggf. Swap hinzufügen. Mit dem fertigen Image aus GHCR entfällt der Build ganz. |
| `docker compose pull` schlägt fehl (`denied` / `not found`) | Tag in `docker-compose.yml` prüfen (`:latest` oder eine existierende Version). Das Image ist öffentlich – kein `docker login` nötig. Sehr alte Docker-Versionen ohne Multi-Arch-Manifest-Unterstützung können scheitern; dann Docker aktualisieren. |
| Port bereits belegt | Linken Wert in `ports:` der `docker-compose.yml` ändern (z. B. `8080:3000`), Projekt neu starten |
| Container startet, aber Seite nicht erreichbar | Firewall (DSM-Firewall bzw. Proxmox-/`ufw`-Firewall) prüfen, ob der gewählte Port freigegeben ist |
| „Permission denied“ auf Datenbank/Uploads | Wird bei jedem Start automatisch durch `docker-entrypoint.sh` repariert (`chown`) – tritt in der Regel nur bei manuell veränderten Bind-Mounts mit exotischen Host-Rechten auf |
| Es kommen keine Benachrichtigungs-E-Mails an | Der Reihe nach prüfen: (1) `SMTP_*` in der `.env` gesetzt und Projekt danach neu gestartet? (2) Modul **Kommunikation** in der Band-Verwaltung eingeschaltet? (3) Im eigenen Profil der passende Ereignistyp aktiviert? (4) Container-Log auf `[mail] Versand fehlgeschlagen` prüfen. Hinweis: Über eigene Aktionen wird man bewusst nicht selbst benachrichtigt – zum Testen die Aktion von einem zweiten Konto aus auslösen. |
| Kein Ton / „Übungsmodus konnte nicht geladen werden“ | Modul **Medienplayer** in der Band-Verwaltung eingeschaltet? Fehlt `public/audio-worklet/soundtouch-processor.js` (siehe [2.4](#24-medienplayer)), lässt sich nur der Übungsmodus nicht starten – normales Abspielen bleibt nutzbar. Springen im Titel setzt voraus, dass ein vorgeschalteter Reverse Proxy HTTP-Range-Requests durchreicht. |
| Login-Redirect-Schleife bzw. Session hält nicht (hinter Reverse Proxy) | `X-Forwarded-Proto` kommt nicht beim Server an, NextAuth erkennt HTTPS nicht. Prüfen wie in [3.8](#38-aus-dem-internet-erreichbar-machen-https-reverse-proxy-absicherung) Schritt 5 beschrieben (Cookie-Präfix `__Secure-` in den Browser-Entwicklertools). |
| „Zu viele fehlgeschlagene Loginversuche“ trotz korrektem Passwort | Konto wurde nach 5 Fehlversuchen für 2 Tage automatisch gesperrt (Brute-Force-Schutz). Läuft von selbst ab, oder ein Admin setzt über Band → Mitglieder ein neues Initialpasswort – das hebt die Sperre sofort auf. |
| „Registrierung nicht möglich“ obwohl gewünscht | Die freie Registrierung ist standardmäßig aus. `REGISTRATION_ENABLED=true` in der `.env` setzen und das Projekt neu starten – oder neue Mitglieder per Einladungslink hinzufügen (siehe [7. Erstes Konto anlegen](#7-erstes-konto-anlegen)). |
| Nach Update Migrationsfehler | Vor dem Update ein Backup ziehen (siehe [2.7](#27-backup-generisch) bzw. [4.6](#46-backup)), Log per `docker compose logs -f` bzw. Container Manager prüfen |

---

## 7. Erstes Konto anlegen

Unabhängig von der gewählten Plattform: Nach erfolgreichem Start die App im Browser öffnen und über **`/register`** das erste Konto anlegen. Das Mitglied, das die erste Band anlegt, wird automatisch deren Administrator:in.

Das **erste** Konto lässt sich immer anlegen. Danach ist die freie Registrierung standardmäßig geschlossen (`REGISTRATION_ENABLED`, siehe [2.3](#23-umgebungsvariablen)): Weitere Mitglieder und Gäste werden dann über **Band → Mitglieder → Einladen** per Einladungslink hinzugefügt; die eingeladene Person kann sich über diesen Link ein Konto anlegen, auch bei geschlossener Registrierung. Wer stattdessen offene Selbstregistrierung möchte, setzt `REGISTRATION_ENABLED=true`.
