# Changelog

All notable changes to Bandplaner are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is
[semantic](https://semver.org/spec/v2.0.0.html). Dates are ISO 8601.

## [1.5.0] – 2026-09-05

### Added

- **Song field "Lead vocals / cast"** – free text (e.g. `Lead: Anna, BGV: Ben`),
  shown on the song detail page.
- **Rehearsal tracking** – a new per-band module (off by default). On a
  rehearsal event you record which songs were worked on (assigned individually,
  and/or taken automatically from linked setlists); the song detail page shows a
  "Practiced at …" history. Turning the module off hides the sections without
  deleting data.
- **Song library search & sorting** – a search box (title / artist / genre /
  album) and a sort selector (title, tempo, key, recently added); the sort
  choice is remembered per browser.
- **Setlist: copy to clipboard** – the plain-text setlist next to the WhatsApp
  share and print buttons.
- **Setlist: segue / medley marker** – mark an entry as running into the next
  without a pause; segued entries render as a connected block in the builder,
  the frozen view, the print layouts and the text export.
- **Setlist: re-sync personal cues from the song note** – per entry and a
  "update all" button, for songs whose personal note changed after they were
  added to the setlist.
- **Setlist: song documents** – a song's charts / lyrics / audio files are now
  reachable directly from the expanded setlist entry.
- **Setlist: segued entries are grouped visually** – a segue run now renders
  inside one bracketed "Segue / medley" block instead of loosely stacked cards,
  in the builder, the frozen view and both print layouts.
- **Practice mode: saved sections** – name and store loop ranges per song
  ("Solo", "Bridge"), shared band-wide, recall or delete them with one click.
- **Practice mode: click track** – a metronome synced to the song (tempo from
  the detected/stored BPM, downbeat phase auto-detected, fine offset adjustable
  and savable to the song), with a bar-one accent from the time signature.
- **Practice mode: count-in** – N count-in clicks before playback and before
  each loop repeat; the number of beats is stored on the song (default: the
  time-signature numerator).
- **Practice mode: tempo staircase** – automatically raise the tempo step by
  step on each loop pass up to a target.
- **Song fields "count-in beats" and "click offset"** for practice mode, in the
  song form and adjustable from the practice player itself.
- **Overview: personal "action required" panel** – events awaiting your
  availability, song proposals awaiting your vote, songs missing key/tempo.
- **Overview: richer event cards** – relative day ("today" / "in 3 days"),
  linked setlist name and a confirmation-status badge (no responses / partly
  confirmed / all confirmed).
- **Song list: sort direction toggle** – every sort order can be reversed; the
  direction is remembered per browser.

### Changed

- **Setlist: the clipboard "copy" button moved** into the header button row
  next to share / print / tech, leaving only "update all from song notes" above
  the list.

- **New-song assistant: richer, pickable result list.** The online lookup now
  queries MusicBrainz, Discogs and Spotify in parallel and shows all matches
  together – each with a source label, metadata (album · year · genre) and a
  cover thumbnail – instead of silently taking the first hit. A separate cover
  strip lets you pick the artwork independently of the metadata row.
- Picking a result now **replaces** existing title/artist/album/year/genre
  values (it previously only filled blank fields), so the assistant is usable
  for editing an existing song, not just for completing a new one. Fields the
  chosen result does not carry are left untouched. On the edit page an
  explicitly picked cover also replaces an existing one.

[1.5.0]: https://github.com/maxxs78/bandplaner/releases/tag/v1.5.0

## [1.4.2] – 2026-09-05

Supersedes 1.4.1: that tag's image build failed (see below) and was never
published to GHCR.

### Fixed

- Docker build: `npm ci` failed with an ERESOLVE peer-dependency conflict
  after the nodemailer 10 bump below (`next-auth`'s optional peer on
  nodemailer is pinned to `^7 || ^8`, unused here - this app has its own SMTP
  code, not next-auth's Email provider). Now installs with
  `--legacy-peer-deps`.

[1.4.2]: https://github.com/maxxs78/bandplaner/releases/tag/v1.4.2

## [1.4.1] – 2026-09-05

### Security

- Bumped `nodemailer` 8 → 10 (fixes a message-level `raw`-option bypass of
  `disableFileAccess`/`disableUrlAccess` that could allow arbitrary file read
  / SSRF via a crafted outgoing message).
- Forced `fast-uri` (transitive, via `ajv`) to `>=3.1.6`, fixing several host
  confusion / SSRF issues in URI normalization.
- Forced `mysql2` (transitive, via Prisma's optional MySQL driver – unused by
  this app, which only runs SQLite) to `>=3.23.1`, fixing an auth-downgrade
  credential leak and a decompression-bomb DoS.
- Forced `deepmerge-ts` (transitive, via Prisma's CLI config loader) to
  `>=8.0.0`, fixing a stack-exhaustion DoS when merging recursive objects.

[1.4.1]: https://github.com/maxxs78/bandplaner/releases/tag/v1.4.1

## [1.4.0] – 2026-09-05

### Added

- Spotify album cover as an additional automatic cover-art fallback (after
  Cover Art Archive and Discogs) when creating a song or refreshing an
  existing one's metadata. Requires `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`.
- Docker health check for the app container, so `docker compose ps` reports
  `healthy`/`unhealthy` instead of just `running`.

### Changed

- INSTALLATION: documented the Docker prerequisite and the prebuilt-image note.

[1.4.0]: https://github.com/maxxs78/bandplaner/releases/tag/v1.4.0

## [1.3.0] – 2026-08-30

First release prepared for public self-hosting.

### Added

- **Prebuilt multi-arch Docker images** (`linux/amd64` + `linux/arm64`),
  published to `ghcr.io/maxxs78/bandplaner` on every version tag. Self-hosting
  no longer requires a local build – see the installation guide.
- `docker-compose.build.yml` override for building the image locally
  (development / forks).
- `REGISTRATION_ENABLED` environment variable.
- `LICENSE` (GNU AGPL-3.0), `CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`,
  issue/PR templates, and a source-code + license link in the in-app info menu.
- Continuous integration (lint, type check, translation check, build) and an
  image-release workflow.
- English documentation: `README.md` and `INSTALLATION.md` are now English, with
  German versions as `README.de.md` / `INSTALLATION.de.md`.
- Restore procedure documented alongside the backup instructions.

### Changed

- **Open self-registration is now disabled by default.** Only the first account
  and people with a pending invitation can register. Set
  `REGISTRATION_ENABLED=true` to restore the previous behaviour.
- `docker-compose.yml` now pulls the prebuilt image instead of building locally;
  updates are `docker compose pull && docker compose up -d`.

### Fixed

- The "known limitations" note about password reset was corrected: a
  self-service email reset does exist when SMTP is configured.

[1.3.0]: https://github.com/maxxs78/bandplaner/releases/tag/v1.3.0
