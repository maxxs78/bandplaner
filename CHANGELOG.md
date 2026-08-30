# Changelog

All notable changes to Bandplaner are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is
[semantic](https://semver.org/spec/v2.0.0.html). Dates are ISO 8601.

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
