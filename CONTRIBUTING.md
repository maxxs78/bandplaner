# Contributing

> 🇩🇪 Diese Datei gibt es auch [auf Deutsch](CONTRIBUTING.de.md).

**Bandplaner is a hobby project**, built and maintained in spare time. Please
set expectations accordingly. Reports in German or English are equally fine.

---

## Bug reports & feature requests — welcome

Open an [issue](https://github.com/maxxs78/bandplaner/issues) using the
templates.

There is **no guarantee that anything will be implemented, or when.** Issues are
read and appreciated, but this is a spare-time project — some things will be
fixed quickly, others may sit for a long time or be declined.

---

## Pull requests — not accepted

To keep the maintenance load realistic for a single hobby maintainer, this
project **does not accept pull requests.** PRs opened from forks are closed
automatically with a pointer back to the issue tracker. This is not personal —
reviewing and taking responsibility for external code changes is more than a
spare-time project can sustain.

**Instead:** open an issue describing the problem or idea. That is the most
useful contribution.

You are, of course, free to **fork and modify** Bandplaner under the terms of
the [GNU AGPL-3.0](LICENSE).

---

## Questions

Open a [Discussion](https://github.com/maxxs78/bandplaner/discussions) for
usage questions, self-hosting help, or open-ended ideas.

---

## Building from source

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
npx next typegen      # generate Next.js route types
npx tsc --noEmit      # TypeScript type check
npm run check:i18n    # translation keys present in de.json + en.json
npm run build         # production build
```

User-facing strings live in `src/messages/de.json` and `src/messages/en.json`
(`de.json` is the reference). Prisma schema changes need a migration:
`npx prisma migrate dev --name <short_description>`.

---

## No warranty

Bandplaner is provided **without any warranty** and **use is at your own risk**
(see [LICENSE](LICENSE), sections 15–17). For production use and for hosting on
behalf of others, backups, data protection, and availability are entirely the
operator's responsibility.
