# Security Policy / Sicherheitsrichtlinie

## Supported versions / Unterstützte Versionen

Security fixes are only provided for the latest released version. Please update
to the newest release before reporting an issue.

Sicherheitskorrekturen gibt es nur für die jeweils aktuelle veröffentlichte
Version. Bitte vor einer Meldung auf den neuesten Release aktualisieren.

| Version | Supported |
|---|---|
| latest release (`main` + newest tag) | ✅ |
| older releases | ❌ |

## Reporting a vulnerability / Schwachstelle melden

**Please do not open a public issue for security problems.**
**Bitte für Sicherheitsprobleme kein öffentliches Issue anlegen.**

Report privately via GitHub:

1. Open <https://github.com/maxxs78/bandplaner/security/advisories/new>
   (repository → **Security** → **Report a vulnerability**).
2. Describe the problem, affected version/commit, and steps to reproduce.
3. If possible, include the impact (what an attacker can read, change, or do).

Meldung vertraulich über GitHub:

1. <https://github.com/maxxs78/bandplaner/security/advisories/new> öffnen
   (Repository → **Security** → **Report a vulnerability**).
2. Problem, betroffene Version/Commit und Reproduktionsschritte beschreiben.
3. Wenn möglich die Auswirkung angeben (was ein Angreifer lesen, ändern oder
   tun kann).

## What to expect / Ablauf

Bandplaner is a hobby project maintained in spare time. Reports are read and
taken seriously, but there is **no guaranteed response or fix timeline**.

- Best effort: acknowledgement within about two weeks.
- Serious, clearly exploitable issues are prioritised over everything else.
- Coordinated disclosure: a fix is prepared and released first; only then are
  details published together with a GitHub Security Advisory crediting the
  reporter (unless anonymity is requested).

Bandplaner ist ein Hobbyprojekt, das in der Freizeit gepflegt wird. Meldungen
werden gelesen und ernst genommen, es gibt aber **keine zugesicherte Reaktions-
oder Behebungsfrist**.

- Nach bestem Bemühen: Eingangsbestätigung innerhalb von etwa zwei Wochen.
- Schwerwiegende, klar ausnutzbare Probleme werden vor allem anderen behandelt.
- Koordinierte Veröffentlichung: Erst wird ein Fix erstellt und ausgeliefert,
  danach werden die Details zusammen mit einem GitHub Security Advisory
  veröffentlicht – mit Nennung der meldenden Person, sofern nicht Anonymität
  gewünscht ist.

## Scope / Geltungsbereich

In scope: the application code in this repository, the `Dockerfile`,
`docker-compose.yml`, and `docker-entrypoint.sh`.

Out of scope: vulnerabilities in third-party dependencies without a concrete
exploit path in Bandplaner (report those upstream), issues that require a
misconfigured reverse proxy or host, and self-hosting mistakes that contradict
[INSTALLATION.md](INSTALLATION.md).

## Self-hosting note / Hinweis für Betreiber

This is self-hosted software. Operators are responsible for keeping their
instance up to date, for transport security (HTTPS/reverse proxy), and — when
hosting for others — for their obligations as data controller under the GDPR.

Dies ist selbstgehostete Software. Betreiber sind selbst dafür verantwortlich,
ihre Instanz aktuell zu halten, für Transportverschlüsselung (HTTPS/Reverse
Proxy) zu sorgen und – beim Hosten für Dritte – ihren Pflichten als
Verantwortliche im Sinne der DSGVO nachzukommen.
