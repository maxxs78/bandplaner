# Changelog

All notable changes to Bandplaner are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is
[semantic](https://semver.org/spec/v2.0.0.html). Dates are ISO 8601.

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
