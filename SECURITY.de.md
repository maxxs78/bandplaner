# Sicherheitsrichtlinie

> 🇬🇧 This file is also available [in English](SECURITY.md).

## Unterstützte Versionen

Sicherheitskorrekturen gibt es nur für die jeweils aktuelle veröffentlichte
Version. Bitte vor einer Meldung auf den neuesten Release aktualisieren.

| Version | Unterstützt |
|---|---|
| aktueller Release (`main` + neuester Tag) | ✅ |
| ältere Releases | ❌ |

## Schwachstelle melden

**Bitte für Sicherheitsprobleme kein öffentliches Issue anlegen.**

Meldung vertraulich über GitHub:

1. <https://github.com/maxxs78/bandplaner/security/advisories/new> öffnen
   (Repository → **Security** → **Report a vulnerability**).
2. Problem, betroffene Version/Commit und Reproduktionsschritte beschreiben.
3. Wenn möglich die Auswirkung angeben (was ein Angreifer lesen, ändern oder
   tun kann).

## Ablauf

Bandplaner ist ein Hobbyprojekt, das in der Freizeit gepflegt wird. Meldungen
werden gelesen und ernst genommen, es gibt aber **keine zugesicherte Reaktions-
oder Behebungsfrist**.

- Nach bestem Bemühen: Eingangsbestätigung innerhalb von etwa zwei Wochen.
- Schwerwiegende, klar ausnutzbare Probleme werden vor allem anderen behandelt.
- Koordinierte Veröffentlichung: Erst wird ein Fix erstellt und ausgeliefert,
  danach werden die Details zusammen mit einem GitHub Security Advisory
  veröffentlicht – mit Nennung der meldenden Person, sofern nicht Anonymität
  gewünscht ist.

## Geltungsbereich

Im Geltungsbereich: der Anwendungscode in diesem Repository, `Dockerfile`,
`docker-compose.yml` und `docker-entrypoint.sh`.

Nicht im Geltungsbereich: Schwachstellen in Drittabhängigkeiten ohne konkreten
Angriffsweg in Bandplaner (diese bitte beim jeweiligen Projekt melden), Probleme,
die einen fehlkonfigurierten Reverse Proxy oder Host voraussetzen, sowie
Selbsthost-Fehler, die [INSTALLATION.de.md](INSTALLATION.de.md) widersprechen.

## Hinweis für Betreiber

Dies ist selbstgehostete Software. Betreiber sind selbst dafür verantwortlich,
ihre Instanz aktuell zu halten, für Transportverschlüsselung (HTTPS/Reverse
Proxy) zu sorgen und – beim Hosten für Dritte – ihren Pflichten als
Verantwortliche im Sinne der DSGVO nachzukommen.
