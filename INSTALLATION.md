# Bandplaner – Installationsanleitung (Self-Hosting)

Diese Anleitung beschreibt die Installation von Bandplaner mit Schwerpunkt auf **Docker**. Sie deckt drei Wege ab:

1. [Kurz: Lokales Testen](#1-kurz-lokales-testen-ohne-docker) (ohne Docker, zum Entwickeln/Ausprobieren)
2. [Docker-Grundlagen](#2-docker--grundlagen) (gilt für jede Plattform)
3. [Synology DiskStation mit Container Manager](#3-installation-auf-synology-diskstation-container-manager) (detailliert)
4. [Proxmox VE](#4-installation-auf-proxmox-ve) (detailliert)

Technischer Hintergrund: Bandplaner ist eine Next.js-App mit Prisma/SQLite als Datenbank und NextAuth (Auth.js) für den Login. Persistiert werden drei Dinge: die SQLite-Datenbankdatei, hochgeladene Song-/Band-Dateien sowie Profil-, Band- und Song-Coverbilder.

---

## 1. Kurz: Lokales Testen (ohne Docker)

Nur zum Entwickeln/Ausprobieren gedacht, nicht für den Dauerbetrieb. Die Schritte dafür (`npm install`, `.env` anlegen, `npx prisma migrate dev`, `npm run dev`) stehen im [README](README.md#lokale-entwicklung).

**Windows-Hinweis:** Beim `npm install` wird das native Modul `better-sqlite3` kompiliert – dafür sind Build-Tools (Python, C++-Compiler) nötig; falls das fehlschlägt, ist WSL (Windows Subsystem for Linux) oder ein Linux/macOS-Rechner der unkompliziertere Weg.

Für den produktiven Betrieb ab hier mit Docker weitermachen.

---

## 2. Docker – Grundlagen

Dieser Abschnitt gilt unabhängig davon, ob Sie auf einer Synology DiskStation, in Proxmox oder sonstwo hosten – die Konzepte sind überall identisch.

### 2.1 Was im Repository bereits enthalten ist

| Datei | Zweck |
|---|---|
| `Dockerfile` | Mehrstufiger Build: `deps` (npm-Install inkl. Kompilierung von `better-sqlite3`), `builder` (Prisma-Client generieren, `next build`), `runner` (schlankes Produktions-Image, Port 3000) |
| `docker-compose.yml` | Startet den Container, verbindet drei benannte Volumes und liest `AUTH_SECRET`/`NEXT_PUBLIC_APP_URL` aus einer `.env`-Datei |
| `docker-entrypoint.sh` | Läuft bei **jedem** Containerstart: repariert Dateirechte der Volumes, führt `prisma migrate deploy` aus, startet dann den Server |
| `.env.example` | Vorlage für die Umgebungsvariablen |

### 2.2 Persistente Daten (Volumes)

| Volume | Inhalt | Container-Pfad |
|---|---|---|
| `bandplaner_data` | SQLite-Datenbankdatei | `/data` |
| `bandplaner_storage` | Song-/Band-Dateien | `/app/storage` |
| `bandplaner_uploads` | Profil-/Band-/Song-Coverbilder | `/app/public/uploads` |

Diese drei Docker-Volumes überleben `docker compose up -d --build` (Updates) und Container-Neustarts. **`docker compose down -v` löscht sie unwiderruflich** – nur bewusst verwenden, und vorher ein Backup ziehen (siehe unten).

### 2.3 Umgebungsvariablen

Diese kommen aus einer `.env`-Datei, die **neben** der `docker-compose.yml` liegt (nicht im Container-Image, sondern von `docker compose` beim Start eingelesen):

| Variable | Bedeutung | Beispiel |
|---|---|---|
| `AUTH_SECRET` | Geheimer Schlüssel für NextAuth-Sessions. **Pflicht**, sonst startet der Login nicht sicher. | per `openssl rand -base64 32` erzeugen |
| `NEXT_PUBLIC_APP_URL` | Öffentlich erreichbare URL der App (für Links in E-Mails, ICS-Kalenderfeed) | `http://diskstation.local:3000` bzw. `https://bandplaner.example.com` |
| `SMTP_HOST` | Mailserver für Benachrichtigungen. **Optional** – bleibt er leer, verschickt die App keine E-Mails, funktioniert sonst aber unverändert. | `smtp.example.com` |
| `SMTP_PORT` | Port des Mailservers (Standard 587) | `587` |
| `SMTP_USER` / `SMTP_PASSWORD` | Zugangsdaten des Mailkontos, falls der Server Authentifizierung verlangt | `bandplaner@example.com` |
| `SMTP_FROM` | Absenderadresse der Benachrichtigungen (leer = `SMTP_USER`) | `Bandplaner <noreply@example.com>` |
| `SMTP_SECURE` | Nur nötig, wenn abweichend: `true` erzwingt TLS ab Verbindungsaufbau. Sonst automatisch aus dem Port abgeleitet (465 = TLS, sonst STARTTLS). | `true` |

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

Beim `docker compose up -d --build` passiert:

1. Image wird gebaut (dauert bei schwacher CPU – z. B. ARM-NAS mit wenig RAM – durchaus 10–20 Minuten, wegen der nativen Kompilierung von `better-sqlite3`).
2. Container startet als `root`, `docker-entrypoint.sh` repariert die Besitzrechte der Volumes.
3. `npx prisma migrate deploy` wendet ausstehende Datenbank-Migrationen an (auch bei jedem späteren Neustart – das ist ungefährlich, bei bereits aktueller DB passiert nichts).
4. Der eigentliche Next.js-Server startet als unprivilegierter Benutzer `nextjs`, lauscht auf Port 3000.

### 2.6 Updates einspielen (generisch)

```bash
git pull   # oder: neue Dateien ins Projektverzeichnis kopieren
docker compose up -d --build
```

### 2.7 Backup (generisch)

Die drei Volumes enthalten alle produktiven Daten. Einfachster Weg für ein Ad-hoc-Backup:

```bash
docker run --rm -v bandplaner_data:/data -v bandplaner_storage:/storage -v bandplaner_uploads:/uploads \
  -v "$(pwd)":/backup alpine \
  tar czf /backup/bandplaner-backup-$(date +%Y%m%d).tar.gz /data /storage /uploads
```

Für regelmäßige/automatisierte Backups siehe die plattformspezifischen Abschnitte unten (Hyper Backup bzw. Proxmox vzdump/PBS).

---

## 3. Installation auf Synology DiskStation (Container Manager)

Gilt für DSM 7.2+ (Paket heißt „Container Manager“). Auf älteren DSM-Versionen (7.0/7.1) heißt das Paket „Docker“ – die zugrunde liegende Docker-Engine und die Konzepte sind identisch, nur einzelne Menüpunkte heißen anders.

### 3.1 Voraussetzungen

- DiskStation mit x86_64- oder ARM-CPU, die **Container Manager** unterstützt (Paketzentrum zeigt es sonst nicht an).
- Genug freier Speicher: mind. ~2 GB RAM frei für den Build-Vorgang empfohlen, sowie einige hundert MB Plattenplatz für Image + `node_modules`.
- Optional, aber empfohlen: SSH-Zugriff (Systemsteuerung → Terminal & SNMP → SSH-Dienst aktivieren), das macht das Anlegen der `.env`-Datei und spätere Updates deutlich einfacher als reines Klicken in File Station.

### 3.2 Container Manager installieren

Paketzentrum öffnen → „Container Manager“ suchen → Installieren.

### 3.3 Projektdateien auf die DiskStation bringen

Sie haben zwei Möglichkeiten:

**Variante A – das Repository liegt bereits auf der DiskStation** (z. B. wenn Sie wie hier über eine SMB-Freigabe direkt auf der DiskStation entwickeln): Sie müssen nichts kopieren. Merken Sie sich einfach den absoluten Pfad auf der DiskStation selbst (nicht den Windows-Laufwerksbuchstaben, sondern z. B. `/volume1/daten/Markus/BandPlaner`) – Container Manager kann in Schritt 3.5 direkt darauf zeigen.

**Variante B – Repository liegt (noch) nicht auf der DiskStation:**

- Per SSH + `git`: `ssh admin@diskstation` und dort `git clone <repo-url> /volume1/docker/bandplaner` (Git muss ggf. vorher über das Paketzentrum oder Entware installiert werden).
- Oder ohne SSH: In **File Station** einen Freigabeordner-Unterordner anlegen (z. B. `docker/bandplaner`) und die Projektdateien per Drag & Drop / Upload dorthin kopieren.

### 3.4 `.env`-Datei anlegen

Im selben Ordner wie `docker-compose.yml` eine Datei `.env` anlegen (Vorlage: `.env.example`):

```bash
cp .env.example .env
```

Darin anpassen:

- `AUTH_SECRET` – eigenen Zufallswert erzeugen (siehe [2.3](#23-umgebungsvariablen))
- `NEXT_PUBLIC_APP_URL` – die später genutzte Adresse, z. B. `http://diskstation.local:3000` oder die spätere HTTPS-Domain (siehe [3.8](#38-aus-dem-internet-erreichbar-machen-https-reverse-proxy-absicherung))
- `SMTP_*` – optional, nur falls E-Mail-Benachrichtigungen gewünscht sind (siehe [2.3](#23-umgebungsvariablen)); kann auch später jederzeit nachgetragen werden

`DATABASE_URL` unverändert lassen – wird im Container ohnehin auf `/data` umgebogen.

Ohne SSH-Zugriff: `.env`-Datei lokal am PC erstellen und über File Station in den Projektordner hochladen (achten Sie darauf, dass sie wirklich `.env` heißt und nicht `.env.txt`).

### 3.5 Projekt in Container Manager erstellen & bauen

1. Container Manager öffnen → **Projekt** → **Erstellen**.
2. Projektname vergeben, z. B. `bandplaner`.
3. Pfad: den Ordner wählen, in dem `docker-compose.yml` und `.env` liegen.
4. Container Manager erkennt die `docker-compose.yml` automatisch und zeigt deren Inhalt an.
5. **Build starten**. Je nach DiskStation-Modell kann das mehrere Minuten dauern (native Kompilierung von `better-sqlite3`, siehe [2.5](#25-erststart-ablauf)) – nicht abbrechen, auch wenn es lange „hängt“.

### 3.6 Port & Firewall

Standardmäßig ist die App über Port **3000** erreichbar (`http://<diskstation-ip>:3000`). Falls der Port schon belegt ist (z. B. durch DSM selbst auf 5000/5001 in der Regel nicht, aber ggf. durch andere Container), in `docker-compose.yml` den linken Wert der Portzuordnung ändern, z. B.:

```yaml
ports:
  - "8080:3000"
```

Danach das Projekt in Container Manager neu bauen/starten.

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
- **Login-Schutz auf App-Ebene ist bereits eingebaut:** Bandplaner sperrt ein Konto nach 5 fehlgeschlagenen Loginversuchen automatisch für 2 Tage (siehe [README](README.md)) – dafür ist keine zusätzliche Konfiguration nötig.
- **Backup vor der Umstellung** einmal gegenprüfen (siehe [3.10](#310-backup)), bevor der Server öffentlich erreichbar wird.

### 3.9 Updates

```bash
cd /volume1/docker/bandplaner   # oder Ihr Projektpfad
git pull
docker compose up -d --build
```

Ohne SSH: neue Dateien über File Station hochladen (bestehende überschreiben), dann in Container Manager das Projekt erneut **bauen**.

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
- **Disks**: mind. 16 GB (Image-Build inkl. `node_modules` braucht Platz)
- **CPU**: mind. 2 Cores
- **Memory**: mind. 2048 MB, Swap 512 MB (der Image-Build kompiliert `better-sqlite3` nativ und braucht dafür etwas RAM)
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

**5. Projekt übertragen**

Falls Sie ein eigenes Git-Repository (GitHub/GitLab/Gitea o. ä.) für Bandplaner eingerichtet haben:

```bash
git clone <ihre-repo-url> /opt/bandplaner
cd /opt/bandplaner
```

Ohne eigenes Git-Repo: Projektordner per `scp`/`rsync` von Ihrem Rechner auf den Container kopieren, z. B. von Windows aus mit `scp` (Git Bash) oder einem SFTP-Client:

```bash
scp -r "M:/Markus/BandPlaner" root@<container-ip>:/opt/bandplaner
```

**6. `.env` anlegen und starten**

```bash
cd /opt/bandplaner
cp .env.example .env
nano .env   # AUTH_SECRET und NEXT_PUBLIC_APP_URL setzen, siehe 2.3
docker compose up -d --build
```

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
git pull   # oder erneut per scp/rsync übertragen
docker compose up -d --build
```

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
| Build bricht mit Speicherfehler ab / hängt sehr lange | Zu wenig RAM für die Kompilierung von `better-sqlite3` – Container/VM-Speicher erhöhen (mind. 2 GB), ggf. Swap hinzufügen |
| Port bereits belegt | Linken Wert in `ports:` der `docker-compose.yml` ändern (z. B. `8080:3000`), Projekt neu starten |
| Container startet, aber Seite nicht erreichbar | Firewall (DSM-Firewall bzw. Proxmox-/`ufw`-Firewall) prüfen, ob der gewählte Port freigegeben ist |
| „Permission denied“ auf Datenbank/Uploads | Wird bei jedem Start automatisch durch `docker-entrypoint.sh` repariert (`chown`) – tritt in der Regel nur bei manuell veränderten Bind-Mounts mit exotischen Host-Rechten auf |
| Es kommen keine Benachrichtigungs-E-Mails an | Der Reihe nach prüfen: (1) `SMTP_*` in der `.env` gesetzt und Projekt danach neu gestartet? (2) Modul **Kommunikation** in der Band-Verwaltung eingeschaltet? (3) Im eigenen Profil der passende Ereignistyp aktiviert? (4) Container-Log auf `[mail] Versand fehlgeschlagen` prüfen. Hinweis: Über eigene Aktionen wird man bewusst nicht selbst benachrichtigt – zum Testen die Aktion von einem zweiten Konto aus auslösen. |
| Kein Ton / „Übungsmodus konnte nicht geladen werden“ | Modul **Medienplayer** in der Band-Verwaltung eingeschaltet? Fehlt `public/audio-worklet/soundtouch-processor.js` (siehe [2.4](#24-medienplayer)), lässt sich nur der Übungsmodus nicht starten – normales Abspielen bleibt nutzbar. Springen im Titel setzt voraus, dass ein vorgeschalteter Reverse Proxy HTTP-Range-Requests durchreicht. |
| Login-Redirect-Schleife bzw. Session hält nicht (hinter Reverse Proxy) | `X-Forwarded-Proto` kommt nicht beim Server an, NextAuth erkennt HTTPS nicht. Prüfen wie in [3.8](#38-aus-dem-internet-erreichbar-machen-https-reverse-proxy-absicherung) Schritt 5 beschrieben (Cookie-Präfix `__Secure-` in den Browser-Entwicklertools). |
| „Zu viele fehlgeschlagene Loginversuche“ trotz korrektem Passwort | Konto wurde nach 5 Fehlversuchen für 2 Tage automatisch gesperrt (Brute-Force-Schutz). Läuft von selbst ab, oder ein Admin setzt über Band → Mitglieder ein neues Initialpasswort – das hebt die Sperre sofort auf. |
| Nach Update Migrationsfehler | Vor dem Update ein Backup ziehen (siehe [2.7](#27-backup-generisch) bzw. [4.6](#46-backup)), Log per `docker compose logs -f` bzw. Container Manager prüfen |

---

## 7. Erstes Konto anlegen

Unabhängig von der gewählten Plattform: Nach erfolgreichem Start die App im Browser öffnen und über **`/register`** das erste Konto anlegen. Das Mitglied, das die erste Band anlegt, wird automatisch deren Administrator:in.
