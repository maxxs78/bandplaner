# Bandplaner – installation guide (self-hosting)

> 🇩🇪 Diese Anleitung gibt es auch [auf Deutsch](INSTALLATION.de.md).

This guide describes installing Bandplaner with a focus on **Docker**. It covers the following paths:

1. [Quick: local testing](#1-quick-local-testing-without-docker) (without Docker, for development/trying it out)
2. [Docker basics](#2-docker-basics) (applies to every platform)
3. [Synology DiskStation with Container Manager](#3-installing-on-a-synology-diskstation-container-manager) (detailed)
4. [Proxmox VE](#4-installing-on-proxmox-ve) (detailed)

Technical background: Bandplaner is a Next.js app with Prisma/SQLite as the database and NextAuth (Auth.js) for login. Three things are persisted: the SQLite database file, uploaded song/band files, and profile, band, and song cover images.

### Two operating modes

| | **Prebuilt image (recommended)** | **Build it yourself** |
|---|---|---|
| Origin | prebuilt multi-arch image (amd64/arm64) from the GitHub Container Registry: `ghcr.io/maxxs78/bandplaner` | local Docker build from source |
| Files needed | only `docker-compose.yml` + `.env` | the complete repository |
| First start | image download, ~1 minute | native build, 10–20 minutes on weak hardware |
| Compose command | `docker compose up -d` | `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build` |
| Update | `docker compose pull && docker compose up -d` | `git pull && docker compose … up -d --build` |
| For whom | normal self-hosting | development, your own code changes/forks |

The rest of the guide assumes the **prebuilt image**. The build-it-yourself variant differs only in the compose command and in that the whole repository must be present.

The published image is **public** — `docker compose up -d` pulls it with no `docker login` and no GitHub account.

---

## 1. Quick: local testing (without Docker)

Intended only for development/trying it out, not for permanent operation. The steps for that (`npm install`, create `.env`, `npx prisma migrate dev`, `npm run dev`) are in the [README](README.md#local-development).

**Windows note:** `npm install` compiles the native module `better-sqlite3` – this needs build tools (Python, a C++ compiler); if that fails, WSL (Windows Subsystem for Linux) or a Linux/macOS machine is the easier path.

For production use, continue with Docker from here.

---

## 2. Docker basics

This section applies regardless of whether you host on a Synology DiskStation, in Proxmox, or elsewhere – the concepts are identical everywhere.

You need **Docker with the Compose plugin** – both `docker --version` and `docker compose version` should print something. On Windows/macOS that is Docker Desktop; on a plain Linux server, install Docker Engine plus the `docker-compose-plugin` package. The Synology and Proxmox sections below cover those platforms specifically.

### 2.1 What the repository already contains

| File | Purpose |
|---|---|
| `docker-compose.yml` | Starts the container from the GHCR image, connects three named volumes, reads `AUTH_SECRET`/`NEXT_PUBLIC_APP_URL` from a `.env` file, and defines a health check |
| `docker-compose.build.yml` | Override to build the image locally instead of pulling it (development/forks only) |
| `.env.example` | Template for the environment variables |
| `Dockerfile` | Multi-stage build: `deps` (npm install incl. compiling `better-sqlite3`), `builder` (generate the Prisma client, `next build`), `runner` (slim production image, port 3000). Not needed for the image variant – GitHub Actions uses it to build the published images. |
| `docker-entrypoint.sh` | Runs on **every** container start: repairs file permissions on the volumes, runs `prisma migrate deploy`, then starts the server (part of the image) |

### 2.2 Persistent data (volumes)

| Volume | Content | Container path |
|---|---|---|
| `bandplaner_data` | SQLite database file | `/data` |
| `bandplaner_storage` | song/band files | `/app/storage` |
| `bandplaner_uploads` | profile/band/song cover images | `/app/public/uploads` |

These three Docker volumes survive updates (`docker compose pull && docker compose up -d`) and container restarts. **`docker compose down -v` deletes them irreversibly** – use it deliberately only, and take a backup first (see below).

### 2.3 Environment variables

These come from a `.env` file that sits **next to** `docker-compose.yml` (not inside the container image, but read by `docker compose` at start):

| Variable | Meaning | Example |
|---|---|---|
| `AUTH_SECRET` | Secret key for NextAuth sessions. **Required**, otherwise login does not start securely. | generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Publicly reachable URL of the app (for links in emails, the ICS calendar feed) | `http://diskstation.local:3000` or `https://bandplaner.example.com` |
| `REGISTRATION_ENABLED` | Open self-registration at `/register`. **Optional**, default `false`: only the first account (initial setup) and people invited via an invitation link can create an account – everyone else joins exclusively via an invitation link. `true` opens registration to any visitor (only sensible if access is already restricted to trusted users). | `false` |
| `SMTP_HOST` | Mail server for notifications. **Optional** – if empty, the app sends no email but otherwise works unchanged. | `smtp.example.com` |
| `SMTP_PORT` | Mail server port (default 587) | `587` |
| `SMTP_USER` / `SMTP_PASSWORD` | Credentials for the mail account, if the server requires authentication | `bandplaner@example.com` |
| `SMTP_FROM` | Sender address of the notifications (empty = `SMTP_USER`) | `Bandplaner <noreply@example.com>` |
| `SMTP_SECURE` | Only needed if it differs: `true` forces TLS from connection setup. Otherwise derived automatically from the port (465 = TLS, otherwise STARTTLS). | `true` |
| `MUSICBRAINZ_USER_AGENT` | Enables MusicBrainz in the new-song assistant's online lookup. **Optional** – without a value, only the ID3 preview from uploaded files stays active. MusicBrainz's terms require an identifying value made of name and contact, not a generic string. | `Bandplaner/1.0 (contact@example.com)` |
| `DISCOGS_TOKEN` | Personal access token for Discogs; adds Discogs to the assistant's result sources (genre, year, cover). **Optional.** | create via your own Discogs account under "Developer Settings" |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Credentials for a Spotify app (client-credentials flow); adds Spotify to the assistant's result sources (track link and album cover). **Optional.** | create via the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) |
| `NOMINATIM_BASE_URL` | Address search / map matching in the **Venues** module. **Optional** – empty uses the public OpenStreetMap Nominatim instance; only adjust if you run your own Nominatim. | `https://nominatim.example.com` |

The three new-song-assistant sources are independently optional and degrade silently when unconfigured – manual song entry and the ID3 preview are unaffected.

For mail to actually be sent, **both** conditions must be met:

1. SMTP is configured as above, **and**
2. the **Communication** module is enabled for the band in question (Band → Management → Features; off by default).

If either is not met, the app keeps working normally – it just sends no notifications. Which notifications someone receives is then set by each person in their own profile, per band (new event, event change, song proposal, new file, one's own fees/cost shares). If the mail server is missing, the profile page points this out explicitly.

`DATABASE_URL` and `AUTH_TRUST_HOST` are already set fixed in `docker-compose.yml` and do not need changing. `AUTH_TRUST_HOST=true` is needed because the host (IP, hostname, domain) varies by network – otherwise NextAuth would abort in production mode with "There was a problem with the server configuration".

**Generate `AUTH_SECRET`:**

```bash
openssl rand -base64 32
```

If `openssl` is not available (e.g. on Windows without Git Bash), use Node.js instead:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2.4 Media player

The media player needs **no** additional configuration – it is simply enabled per band under *Management → Features* (off by default). Two points are still relevant for operation:

- **Practice mode and memory:** for the tempo, key, and loop features, the audio file is held fully decoded in memory – roughly 20 MB per minute of stereo, so a four-minute song is around 85 MB. This happens exclusively **in the browser of the respective device**, not on the server, and only when someone actively starts practice mode. On older mobile devices it can be noticeable; normal playback is unaffected.
- **Audio worklet file:** transposition needs `public/audio-worklet/soundtouch-processor.js`. This file is copied automatically from the dependencies during `npm install` (`scripts/copy-audio-worklet.mjs`) and is therefore deliberately not in the repository. In the Docker build this happens automatically – with a manual install without `npm install`, only practice mode would start with an error message; everything else stays usable.

The player streams files via HTTP range requests so you can seek within a track. If Bandplaner runs behind a reverse proxy, that proxy should pass range requests through unchanged – the DSM configuration described in section 3.8 already does this.

### 2.5 First-start sequence

On `docker compose up -d` the following happens:

1. The image is pulled from the GitHub Container Registry (a few hundred MB, usually under a minute). *(Build-it-yourself variant: it builds locally here instead – 10–20 minutes on a weak CPU due to the native compilation of `better-sqlite3`.)*
2. The container starts as `root`; `docker-entrypoint.sh` repairs ownership of the volumes.
3. `npx prisma migrate deploy` applies pending database migrations (also on every later restart – harmless, nothing happens if the DB is already up to date).
4. The actual Next.js server starts as the unprivileged user `nextjs`, listening on port 3000.

A health check (defined in `docker-compose.yml`) then polls the server every 30 seconds; `docker compose ps` and Container Manager show the container as `healthy` once it responds (allow up to a minute after start), or `unhealthy` if it stops responding. Plain `docker compose` reports this status but does not act on it — `restart: unless-stopped` only restarts the container if the process actually exits. If you want automatic restarts on `unhealthy`, add a small sidecar such as `willfarrell/autoheal`.

### 2.6 Applying updates (generic)

```bash
docker compose pull      # fetch the latest image from GHCR
docker compose up -d     # restart the container with the new image
```

No `git pull` needed – for the image variant, `docker-compose.yml` and `.env` are enough. Pending database migrations are applied automatically on restart (step 3 above). Want to run a specific version instead of `latest`? Adjust the tag in `docker-compose.yml` (e.g. `:1.4.2`) – available tags: <https://github.com/maxxs78/bandplaner/pkgs/container/bandplaner>.

*(Build-it-yourself variant: `git pull`, then `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`.)*

### 2.7 Backup (generic)

The three volumes contain all production data. Simplest way to take an ad-hoc backup:

```bash
docker run --rm -v bandplaner_data:/data -v bandplaner_storage:/storage -v bandplaner_uploads:/uploads \
  -v "$(pwd)":/backup alpine \
  tar czf /backup/bandplaner-backup-$(date +%Y%m%d).tar.gz /data /storage /uploads
```

For regular/automated backups, see the platform-specific sections below (Hyper Backup or Proxmox vzdump/PBS).

To restore: stop the container (`docker compose down`), extract the archive back into the same three volumes (the reverse `tar` call), then `docker compose up -d`. Example:

```bash
docker compose down
docker run --rm -v bandplaner_data:/data -v bandplaner_storage:/storage -v bandplaner_uploads:/uploads \
  -v "$(pwd)":/backup alpine \
  sh -c "cd / && tar xzf /backup/bandplaner-backup-YYYYMMDD.tar.gz"
docker compose up -d
```

---

## 3. Installing on a Synology DiskStation (Container Manager)

Applies to DSM 7.2+ (the package is called "Container Manager"). On older DSM versions (7.0/7.1) the package is called "Docker" – the underlying Docker engine and the concepts are identical, only some menu items are named differently.

### 3.1 Requirements

- A DiskStation with an x86_64 or ARM CPU that supports **Container Manager** (otherwise the Package Center does not show it). The published image covers `linux/amd64` and `linux/arm64` – this includes the Intel/AMD models as well as the 64-bit ARM (ARMv8) models such as the DS124, DS223 or DS423. Very old 32-bit ARM NAS units are not covered; there, only the build-it-yourself variant remains, if the CPU is even sufficient.
- A few hundred MB of disk space for the image. For the **image variant**, **no** meaningful amount of memory is needed for a build; only the build-it-yourself variant should have ~2 GB RAM free.
- Optional but recommended: SSH access (Control Panel → Terminal & SNMP → enable the SSH service), which makes creating the `.env` file and later updates much easier than clicking around in File Station.

### 3.2 Install Container Manager

Open Package Center → search for "Container Manager" → Install.

### 3.3 Create the project folder on the DiskStation

For the image variant, only **two files** are needed – the complete repository is not required.

1. In **File Station**, create a folder, e.g. `/volume1/docker/bandplaner`.
2. Put the file `docker-compose.yml` there. Either download it from the repository (<https://github.com/maxxs78/bandplaner/blob/main/docker-compose.yml>) or copy its contents.
3. The `.env` file goes into the same folder in step 3.4.

Note the absolute path on the DiskStation itself (not the Windows drive letter, but e.g. `/volume1/docker/bandplaner`) – Container Manager points directly at it in step 3.5.

*(Build-it-yourself variant: instead, bring the whole repository into the folder via `git clone` or a File Station upload, including `docker-compose.build.yml`.)*

### 3.4 Create the `.env` file

Create a file named `.env` in the same folder as `docker-compose.yml`. The template is `.env.example` from the repository (<https://github.com/maxxs78/bandplaner/blob/main/.env.example>); if you have the repository locally, simply copy it:

```bash
cp .env.example .env
```

Adjust in it:

- `AUTH_SECRET` – generate your own random value (see [2.3](#23-environment-variables))
- `NEXT_PUBLIC_APP_URL` – the address you will use later, e.g. `http://diskstation.local:3000` or the later HTTPS domain (see [3.8](#38-making-it-reachable-from-the-internet-https-reverse-proxy-hardening))
- `SMTP_*` – optional, only if email notifications are wanted (see [2.3](#23-environment-variables)); can also be added later at any time
- `MUSICBRAINZ_USER_AGENT` / `DISCOGS_TOKEN` / `SPOTIFY_CLIENT_*` / `NOMINATIM_BASE_URL` – also optional (new-song assistant and venue address search, see [2.3](#23-environment-variables)); without them the respective core functions work unchanged

Leave `DATABASE_URL` unchanged – inside the container it is redirected to `/data` anyway.

Without SSH access: create the `.env` file locally on your PC and upload it into the project folder via File Station (make sure it is really named `.env` and not `.env.txt`).

### 3.5 Create the project in Container Manager

1. Open Container Manager → **Project** → **Create**.
2. Give it a project name, e.g. `bandplaner`.
3. Path: choose the folder that contains `docker-compose.yml` and `.env`.
4. Container Manager detects the `docker-compose.yml` automatically and shows its contents.
5. Confirm. Container Manager pulls the image from the GitHub Container Registry (`ghcr.io/maxxs78/bandplaner`) and starts the container – usually within a minute.

*(Build-it-yourself variant: the wizard offers a build instead – this can take 10–20 minutes depending on the model, see [2.5](#25-first-start-sequence); do not abort, even if it seems to "hang" for a long time. Container Manager does not load the second compose file automatically – either add `docker-compose.build.yml` as an additional file in the project or add the `build:` block to `docker-compose.yml` manually.)*

### 3.6 Port and firewall

By default the app is reachable on port **3000** (`http://<diskstation-ip>:3000`). If the port is already taken (usually not by DSM itself on 5000/5001, but possibly by other containers), change the left value of the port mapping in `docker-compose.yml`, e.g.:

```yaml
ports:
  - "8080:3000"
```

Then restart the project in Container Manager (**Action → Build/Restart**).

If the DSM firewall is active (Control Panel → Security → Firewall): add a rule for the chosen port and the desired source IPs/networks.

### 3.7 Check the first start

Container Manager → **Container** → `bandplaner` → **Details** → **Log**. You should see, in order (the entrypoint logs in German):

```
Bandplaner: repariere Dateirechte der persistenten Volumes…
Bandplaner: wende ausstehende Datenbank-Migrationen an…
Bandplaner: starte Server…
```

Then open `http://<diskstation-ip>:3000` (or the chosen port) in a browser and create the first account via `/register`.

### 3.8 Making it reachable from the internet (HTTPS, reverse proxy, hardening)

By default Bandplaner is reachable only on your own network via `http://<diskstation-ip>:3000`. If band members should be able to access it from elsewhere, you need two separate building blocks: the **router port forward** ensures requests from the internet reach the DiskStation at all (pure transport); the **DSM setup** below provides encryption (TLS certificate) and forwards the request internally to the container. Both together are needed – a port forward alone provides neither encryption nor a valid certificate.

**Prerequisite:** a domain or a DDNS hostname that points to your public IP (with a dynamic IP, kept current e.g. via Synology's own DDNS service or your domain provider's).

**1. Router port forward**

Forward only port **443** (HTTPS) to the DiskStation. Port 3000 (the app port) must **not** be forwarded directly – otherwise traffic would run unencrypted past the reverse proxy. Port 80 is only needed briefly if DSM uses the HTTP-01 challenge to issue the certificate; it can be closed again afterwards.

**2. Certificate**

Control Panel → **Security** → **Certificate** → Add → Let's Encrypt, enter the domain. Free, renews automatically.

**3. Reverse proxy rule**

Control Panel → **Login Portal** → **Advanced** → **Reverse Proxy** → Create:

| Field | Value |
|---|---|
| Description | e.g. `Bandplaner` |
| Source – Protocol | HTTPS |
| Source – Hostname | `<your-domain>` |
| Source – Port | 443 |
| Source – HSTS | optional, recommended once everything works |
| Destination – Protocol | HTTP |
| Destination – Hostname | `localhost` |
| Destination – Port | 3000 (or the left port chosen in `docker-compose.yml`) |

The headers `X-Forwarded-For`, `X-Forwarded-Proto`, and the original `Host` header are already passed through by DSM's reverse proxy by default – **no** additional setting in the "Custom Header" tab is needed. This matters because `AUTH_TRUST_HOST=true` (already set in `docker-compose.yml`) relies on exactly this to recognize that the connection is encrypted.

**4. App configuration**

Set `NEXT_PUBLIC_APP_URL` in the `.env` to the new `https://…` address and restart the project, so that e.g. links in the ICS calendar feed, in WhatsApp share buttons, and in notification emails are correct.

**5. Verify**

After switching, log in and check in the browser dev tools under *Application → Cookies* whether the session cookie starts with `__Secure-` (`__Secure-authjs.session-token`). If the prefix is there, NextAuth recognized HTTPS correctly. If it is missing, the `X-Forwarded-Proto` header is not arriving – the typical symptom is then a login redirect loop (see Troubleshooting below). Afterwards also test from outside your own network (e.g. mobile data instead of home Wi-Fi), since local name resolution/firewall effects can fake a false success.

**6. Hardening, since it is now publicly reachable**

Once a port is reachable from the internet, basic hardening involves more than just the certificate:

- **Expose only the necessary port:** the router forwards only 443 – not the DSM web interface (5000/5001) and not SSH (22). SSH remains a separate decision; it is not needed for pure app access.
- **Enable DSM Auto Block:** Control Panel → Security → Protection – automatically blocks IP addresses after several failed attempts against DSM itself.
- **Enable 2FA for the DSM admin account**, disable or rename the default "admin" account.
- **App-level login protection is already built in:** Bandplaner automatically locks an account for 2 days after 5 failed login attempts (see [README](README.md)) – no additional configuration needed.
- **Keep registration closed:** leave `REGISTRATION_ENABLED` at `false` (the default) so that arbitrary visitors cannot create accounts (see [2.3](#23-environment-variables) and [7. Creating the first account](#7-creating-the-first-account)).
- **Re-check the backup before the switch** (see [3.10](#310-backup)) before the server becomes publicly reachable.

### 3.9 Updates

**Via SSH:**

```bash
cd /volume1/docker/bandplaner   # or your project path
docker compose pull
docker compose up -d
```

**Without SSH, in Container Manager:** project `bandplaner` → **Action** → **Build/Restart** (or "Reset"). With a `latest` tag, Container Manager pulls the current image; if a fixed version is used in `docker-compose.yml`, bump the tag there first and save the file.

Database migrations run automatically on restart. A backup beforehand never hurts (see [3.10](#310-backup)).

*(Build-it-yourself variant: `git pull` and `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`; without SSH, upload the new files via File Station and rebuild the project.)*

### 3.10 Backup

The three named volumes physically live below the Docker data directory (usually `/volume1/@docker`, or in the "docker" system folder depending on DSM version) and are therefore not readily visible to Synology's **Hyper Backup** as a shared folder of their own. Two practical paths:

- **Simple:** run the command from [2.7](#27-backup-generic) regularly via Task Scheduler (Control Panel → Task Scheduler → scheduled task → user-defined script) on the DiskStation; the resulting archive lands in a normal shared folder that Hyper Backup then backs up as usual.
- **Alternative (more control):** use bind mounts to a shared folder in `docker-compose.yml` instead of named volumes (e.g. `/volume1/docker/bandplaner-data:/data`), which Hyper Backup then backs up directly. This is a deliberate change to the shipped `docker-compose.yml` – take a backup of the existing volumes before switching.

---

## 4. Installing on Proxmox VE

Proxmox itself is a hypervisor – Docker should **not** run directly on the Proxmox host, but in an LXC container or a VM.

### 4.1 LXC vs. VM

| | LXC container | VM |
|---|---|---|
| Resource usage | low (shares the host kernel) | higher (own kernel) |
| Docker compatibility | very good, but needs the "nesting" feature | unrestricted, since a real kernel |
| Recommendation | **the standard path for this use case** | alternative if maximum isolation is wanted |

Below, option A (LXC) in detail, option B (VM) briefly as an alternative.

### 4.2 Option A: Debian LXC container (recommended)

**1. Provide the container template**

In the Proxmox web interface: desired storage (e.g. `local`) → **CT Templates** → **Templates** → download `debian-12-standard` (if not present).

**2. Create the container**

"Create CT" in the Proxmox UI, with:

- **General**: hostname e.g. `bandplaner`, set a password. **Leave "Unprivileged container" enabled** (default/safer) – that is enough for Docker if the features below are also set.
- **Template**: `debian-12-standard`
- **Disks**: 4 GB is enough for the image variant; for the build-it-yourself variant at least 16 GB (build incl. `node_modules` needs space)
- **CPU**: 1 core is enough for the image variant; for a local build at least 2 cores
- **Memory**: 512–1024 MB is enough for the image variant; for a local build at least 2048 MB, swap 512 MB (the native compilation of `better-sqlite3` needs RAM)
- **Network**: bridge `vmbr0`, static IP or DHCP depending on your network

**3. Enable nesting**

After creating: select the container → **Options** → **Features** → edit → enable **Nesting** and **keyctl**. Without this feature the Docker daemon cannot start in an unprivileged LXC container. Restart the container afterwards.

**4. Install the Docker engine**

Open the container console (`pct enter <ID>` on the Proxmox host, or via the web console) and run:

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

**5. Create the project folder**

For the image variant, `docker-compose.yml` and `.env` are enough:

```bash
mkdir -p /opt/bandplaner && cd /opt/bandplaner
curl -fsSLO https://raw.githubusercontent.com/maxxs78/bandplaner/main/docker-compose.yml
curl -fsSL  https://raw.githubusercontent.com/maxxs78/bandplaner/main/.env.example -o .env
```

*(Build-it-yourself variant: instead `git clone https://github.com/maxxs78/bandplaner.git /opt/bandplaner`.)*

**6. Fill in `.env` and start**

```bash
cd /opt/bandplaner
nano .env   # set AUTH_SECRET and NEXT_PUBLIC_APP_URL, see 2.3
docker compose up -d
```

*(Build-it-yourself variant: `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`.)*

**7. Autostart & firewall**

- Proxmox: container → **Options** → enable "Start at boot" so the container starts with the Proxmox host. The Docker service itself is already enabled as a systemd service after installation and starts automatically with the container.
- Firewall: if the Proxmox firewall or `ufw` inside the container is active, open port 3000 (or the port chosen in `docker-compose.yml`) for access from your network.

### 4.3 Option B: VM instead of LXC

If you prefer a VM (e.g. Ubuntu Server 22.04/24.04): create the VM as usual in Proxmox (at least 2 vCPU, 2 GB RAM, 16 GB disk), install Docker in it exactly as in step 4.2.4 (use the `ubuntu` repo URL instead of `debian`), then steps 4.2.5–4.2.7 identically. Nesting/keyctl is not needed, since a VM has its own kernel.

### 4.4 Aside: ready-made Docker LXC templates via community scripts

There are community helper scripts (e.g. "Proxmox VE Helper-Scripts") that create a fully set-up Docker LXC container via a one-liner on the Proxmox host. That saves steps 4.2.1–4.2.4, but it is a third-party script that runs with root rights on your Proxmox host. Review the script's contents yourself before running it if you want to go this way – the manual variant above is the safer standard path and differs only in a few commands in the end.

### 4.5 Updates

```bash
cd /opt/bandplaner
docker compose pull
docker compose up -d
```

*(Build-it-yourself variant: `git pull` and `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`.)*

### 4.6 Backup

Since with an LXC container the Docker volumes are part of the container file system, a normal Proxmox container snapshot/backup automatically backs up the Bandplaner data as well:

- **Datacenter → Backup** → create a scheduled backup job for the `bandplaner` container (target: local storage or Proxmox Backup Server).
- Before larger updates, additionally do a manual one: select the container → **Backup** → **Backup now**.

This is the recommended path on Proxmox – considerably simpler than the volume-based backup from [2.7](#27-backup-generic), since the whole container is backed up at once.

---

## 5. Reverse proxy and HTTPS (cross-platform, optional)

For your own domain with HTTPS instead of `http://ip:3000` there are several common options regardless of platform: Synology's built-in reverse proxy (see [3.8](#38-making-it-reachable-from-the-internet-https-reverse-proxy-hardening), incl. the hardening checklist, which applies analogously on other platforms), or – e.g. on Proxmox – an additional reverse proxy such as **Nginx Proxy Manager**, **Caddy**, or **Traefik** in its own container/LXC that manages Let's Encrypt certificates and forwards requests to `bandplaner:3000`. `AUTH_TRUST_HOST=true` is already set in `docker-compose.yml`, so login works regardless of the host used. `NEXT_PUBLIC_APP_URL` should be set to the final `https://…` address after setup so that links (e.g. in the ICS calendar feed) are correct.

---

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "There was a problem with the server configuration" on login | `AUTH_SECRET` is missing or empty in the `.env` |
| Build aborts with a memory error / hangs for a very long time | Affects only the **build-it-yourself variant**: too little RAM to compile `better-sqlite3` – increase container/VM memory (at least 2 GB), add swap if needed. With the prebuilt image from GHCR the build is skipped entirely. |
| `docker compose pull` fails (`denied` / `not found`) | Check the tag in `docker-compose.yml` (`:latest` or an existing version). The image is public – no `docker login` needed. Very old Docker versions without multi-arch manifest support can fail; update Docker then. |
| Port already in use | Change the left value in `ports:` of `docker-compose.yml` (e.g. `8080:3000`), restart the project |
| Container starts, but the page is not reachable | Check the firewall (DSM firewall or Proxmox/`ufw` firewall) for whether the chosen port is open |
| "Permission denied" on the database/uploads | Repaired automatically on every start by `docker-entrypoint.sh` (`chown`) – usually only occurs with manually changed bind mounts with unusual host permissions |
| No notification emails arrive | Check in order: (1) `SMTP_*` set in the `.env` and the project restarted afterwards? (2) the **Communication** module enabled in the band management? (3) the matching event type enabled in your own profile? (4) check the container log for `[mail] Versand fehlgeschlagen`. Note: you are deliberately not notified about your own actions – to test, trigger the action from a second account. |
| No sound / "Practice mode could not be loaded" | Is the **media player** module enabled in the band management? If `public/audio-worklet/soundtouch-processor.js` is missing (see [2.4](#24-media-player)), only practice mode fails to start – normal playback stays usable. Seeking within a track requires an upstream reverse proxy to pass HTTP range requests through. |
| Login redirect loop / session does not persist (behind a reverse proxy) | `X-Forwarded-Proto` does not arrive at the server, NextAuth does not recognize HTTPS. Check as described in [3.8](#38-making-it-reachable-from-the-internet-https-reverse-proxy-hardening) step 5 (cookie prefix `__Secure-` in the browser dev tools). |
| "Too many failed login attempts" despite the correct password | The account was automatically locked for 2 days after 5 failed attempts (brute-force protection). It expires on its own, or an admin sets a new initial password via Band → Members – which lifts the lock immediately. |
| "Registration unavailable" although wanted | Open registration is off by default. Set `REGISTRATION_ENABLED=true` in the `.env` and restart the project – or add new members via an invitation link (see [7. Creating the first account](#7-creating-the-first-account)). |
| Migration error after an update | Take a backup before updating (see [2.7](#27-backup-generic) or [4.6](#46-backup)), check the log via `docker compose logs -f` or Container Manager |

---

## 7. Creating the first account

Regardless of the chosen platform: after a successful start, open the app in a browser and create the first account via **`/register`**. The member who creates the first band automatically becomes its administrator.

The **first** account can always be created. After that, open registration is closed by default (`REGISTRATION_ENABLED`, see [2.3](#23-environment-variables)): further members and guests are then added via **Band → Members → Invite** using an invitation link; the invited person can create an account via that link even with registration closed. If you want open self-registration instead, set `REGISTRATION_ENABLED=true`.
