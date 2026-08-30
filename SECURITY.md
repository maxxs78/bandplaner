# Security policy

> 🇩🇪 Diese Datei gibt es auch [auf Deutsch](SECURITY.de.md).

## Supported versions

Security fixes are only provided for the latest released version. Please update
to the newest release before reporting an issue.

| Version | Supported |
|---|---|
| latest release (`main` + newest tag) | ✅ |
| older releases | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately via GitHub:

1. Open <https://github.com/maxxs78/bandplaner/security/advisories/new>
   (repository → **Security** → **Report a vulnerability**).
2. Describe the problem, affected version/commit, and steps to reproduce.
3. If possible, include the impact (what an attacker can read, change, or do).

## What to expect

Bandplaner is a hobby project maintained in spare time. Reports are read and
taken seriously, but there is **no guaranteed response or fix timeline**.

- Best effort: acknowledgement within about two weeks.
- Serious, clearly exploitable issues are prioritised over everything else.
- Coordinated disclosure: a fix is prepared and released first; only then are
  details published together with a GitHub Security Advisory crediting the
  reporter (unless anonymity is requested).

## Scope

In scope: the application code in this repository, the `Dockerfile`,
`docker-compose.yml`, and `docker-entrypoint.sh`.

Out of scope: vulnerabilities in third-party dependencies without a concrete
exploit path in Bandplaner (report those upstream), issues that require a
misconfigured reverse proxy or host, and self-hosting mistakes that contradict
[INSTALLATION.md](INSTALLATION.md).

## Self-hosting note

This is self-hosted software. Operators are responsible for keeping their
instance up to date, for transport security (HTTPS/reverse proxy), and — when
hosting for others — for their obligations as data controller under the GDPR.
