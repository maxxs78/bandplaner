# Mitwirken

> 🇬🇧 This file is also available [in English](CONTRIBUTING.md).

**Bandplaner ist ein Hobbyprojekt**, das in der Freizeit entsteht und gepflegt
wird. Bitte die Erwartungen entsprechend einordnen. Meldungen auf Deutsch oder
Englisch sind gleichermaßen willkommen.

---

## Fehlerberichte & Funktionswünsche — willkommen

Ein [Issue](https://github.com/maxxs78/bandplaner/issues) über die Vorlagen
anlegen.

Es gibt **keine Zusage, ob oder wann** etwas umgesetzt wird. Meldungen werden
gelesen und geschätzt, aber dies ist ein Freizeitprojekt – manches wird schnell
behoben, anderes bleibt lange liegen oder wird abgelehnt.

---

## Pull Requests — werden nicht angenommen

Um den Aufwand für einen einzelnen Hobby-Maintainer realistisch zu halten,
nimmt dieses Projekt **keine Pull Requests an.** Aus Forks geöffnete PRs werden
automatisch geschlossen, mit Verweis auf die Issues. Das ist nicht persönlich
gemeint – externe Codeänderungen zu prüfen und dafür geradezustehen übersteigt
ein Freizeitprojekt.

**Stattdessen:** ein Issue mit der Fehlerbeschreibung oder Idee anlegen. Das
hilft am meisten.

**Forken und anpassen** ist unter der [GNU AGPL-3.0](LICENSE) selbstverständlich
erlaubt.

---

## Fragen

Eine [Discussion](https://github.com/maxxs78/bandplaner/discussions) für Fragen
zur Nutzung, Hilfe beim Selbsthosten oder offene Ideen öffnen.

---

## Aus dem Quellcode bauen

Für den Selbsthost-Betrieb oder die Arbeit am eigenen Fork. Benötigt
**Node.js 20** (wie im Docker-Image) und npm. Unter Windows braucht das native
Modul `better-sqlite3` Build-Tools (Python, C++) – WSL oder Linux/macOS ist der
unkompliziertere Weg (siehe [INSTALLATION.de.md](INSTALLATION.de.md) §1).

```bash
npm install
cp .env.example .env        # Werte anpassen, siehe Kommentare in der Datei
npx prisma migrate dev
npm run dev
```

<http://localhost:3000> öffnen und über `/register` das erste Konto anlegen.

Prüfungen wie in der CI:

```bash
npm run lint          # ESLint
npx next typegen      # Next.js-Routen-Typen generieren
npx tsc --noEmit      # TypeScript-Typprüfung
npm run check:i18n    # Übersetzungs-Keys in de.json + en.json vorhanden
npm run build         # Produktions-Build
```

Nutzertexte liegen in `src/messages/de.json` und `src/messages/en.json`
(`de.json` ist die Referenz). Prisma-Schema-Änderungen brauchen eine Migration:
`npx prisma migrate dev --name <kurzbeschreibung>`.

---

## Keine Gewährleistung

Bandplaner wird **ohne jede Gewährleistung** bereitgestellt, die **Verwendung
erfolgt auf eigene Gefahr** (siehe [LICENSE](LICENSE), Abschnitte 15–17). Für
den produktiven Einsatz und das Hosten für Dritte liegen Sicherung, Datenschutz
und Verfügbarkeit vollständig bei der betreibenden Person.
