# Contributing / Mitwirken

**Bandplaner is a hobby project**, built and maintained in spare time. Please
set expectations accordingly.

**Bandplaner ist ein Hobbyprojekt**, das in der Freizeit entsteht und gepflegt
wird. Bitte die Erwartungen entsprechend einordnen.

---

## Bug reports & feature requests — welcome / Fehlerberichte & Funktionswünsche — willkommen

Open an [issue](https://github.com/maxxs78/bandplaner/issues) using the
templates. Reports in German or English are equally fine.

There is **no guarantee that anything will be implemented, or when.** Issues are
read and appreciated, but this is a spare-time project — some things will be
fixed quickly, others may sit for a long time or be declined.

Ein [Issue](https://github.com/maxxs78/bandplaner/issues) über die Vorlagen
anlegen, auf Deutsch oder Englisch.

Es gibt **keine Zusage, ob oder wann** etwas umgesetzt wird. Meldungen werden
gelesen und geschätzt, aber dies ist ein Freizeitprojekt – manches wird schnell
behoben, anderes bleibt lange liegen oder wird abgelehnt.

---

## Pull requests — not accepted / Pull Requests — werden nicht angenommen

To keep the maintenance load realistic for a single hobby maintainer, this
project **does not accept pull requests.** PRs opened from forks are closed
automatically with a pointer back to the issue tracker. This is not personal —
reviewing and taking responsibility for external code changes is more than a
spare-time project can sustain.

**Instead:** open an issue describing the problem or idea. That is the most
useful contribution.

You are, of course, free to **fork and modify** Bandplaner under the terms of
the [GNU AGPL-3.0](LICENSE).

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

## Questions / Fragen

Open a [Discussion](https://github.com/maxxs78/bandplaner/discussions) for
usage questions, self-hosting help, or open-ended ideas.

---

## Building from source / Aus dem Quellcode bauen

For self-hosting or for working on your own fork. Requires **Node.js 20**
(matches the Docker image) and npm. On Windows the native module
`better-sqlite3` needs build tools (Python, C++) — WSL or Linux/macOS is the
smoother path (see [INSTALLATION.md](INSTALLATION.md) §1).

```bash
npm install
cp .env.example .env        # adjust values, see comments in the file
npx prisma migrate dev
npm run dev
```

Open <http://localhost:3000> and create the first account via `/register`.

Sanity checks used by CI:

```bash
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript type check
npm run check:i18n    # translation keys present in de.json + en.json
npm run build         # production build
```

User-facing strings live in `src/messages/de.json` and `src/messages/en.json`
(`de.json` is the reference). Prisma schema changes need a migration:
`npx prisma migrate dev --name <short_description>`.

---

## No warranty / Keine Gewährleistung

Bandplaner is provided **without any warranty** and **use is at your own risk**
(see [LICENSE](LICENSE), sections 15–17). For production use and for hosting on
behalf of others, backups, data protection, and availability are entirely the
operator's responsibility.

Bandplaner wird **ohne jede Gewährleistung** bereitgestellt, die **Verwendung
erfolgt auf eigene Gefahr** (siehe [LICENSE](LICENSE), Abschnitte 15–17). Für
den produktiven Einsatz und das Hosten für Dritte liegen Sicherung, Datenschutz
und Verfügbarkeit vollständig bei der betreibenden Person.
