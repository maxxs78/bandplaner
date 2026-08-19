Bandplaner ist eine webbasierte Band-Organisations-App auf Basis von Next.js, Prisma und SQLite. Sie bündelt die Organisation einer Band oder Musikgruppe – Termine, Verfügbarkeiten, Repertoire, Setlisten, Dateien, Equipment und Finanzen – an einem Ort, statt sie über E-Mail, Messenger-Gruppen und Tabellen zu verstreuen.

## Über die App

Ein Benutzerkonto kann Mitglied in mehreren Bands sein und zwischen diesen wechseln. Innerhalb jeder Band gilt ein Rollenmodell: **Administrator:in** (volle Rechte inkl. Mitglieder- und Rollenverwaltung), **Mitglied** sowie **Gast/Aushilfe** mit zeitlich befristetem Zugriff (`Zugriff bis`-Datum). Neue Mitglieder und Gäste werden per Einladungslink hinzugefügt.

Davon unabhängig lassen sich beliebig viele Personen als **Finanzadmin:in** kennzeichnen – bewusst losgelöst von der Rolle, damit dieselbe Person gleichzeitig Admin und Finanzadmin sein kann (Personalunion) und mehrere Personen die Finanzen betreuen können. Finanzadmin:innen sehen als Einzige die vollständige Finanzübersicht und erhalten zusätzlich admin-gleiche Rechte bei Songs, Equipment, Dateien und Terminen – aber keinen Zugriff auf Mitgliederverwaltung oder die Verwaltungsseite.

Die Anmeldung erfolgt wahlweise mit E-Mail-Adresse oder Benutzernamen. Alle Nutzer:innen können ihr Passwort im Profil selbst ändern; Admins können außerdem ein neues Initialpasswort für ein Mitglied vergeben, das dieses beim nächsten Login ändern muss.

Aktuell umgesetzte Module:

- **Kalender & Termine** – Proben, Auftritte, Meetings und sonstige Termine inkl. Terminserien; je Terminart vorbelegter Teilnehmerkreis (bei Proben/Auftritten standardmäßig alle Mitglieder, bei Meetings nur die erstellende Person), individuell anpassbar. Abonnierbar als ICS-Feed für externe Kalender-Apps.
- **Verfügbarkeiten** – Rückmeldung je Termin (Zusage/Absage/Vielleicht) sowie Eintragen längerfristiger persönlicher Abwesenheiten, unabhängig von konkreten Terminen.
- **Songbibliothek** – zentrale, bandweit geteilte Songs mit Metadaten (Tonart, BPM, Taktart, Dauer, Genre, Interpret bei Coversongs), Song-Dokumenten (Audiodateien mit Player, Songtexte, Tabulaturen/Noten) mit je Datei einstellbarer Sichtbarkeit, externen Links sowie persönlichen Notizen je Mitglied. Songs durchlaufen einen Status-Workflow von „vorgeschlagen" bis „archiviert"; Vorschläge werden per Daumen-hoch/-runter mit sichtbarem Namen abgestimmt, bei einstimmigem Downvote automatisch abgelehnt.
- **Setlisten** – Zusammenstellung aus der Songbibliothek, personalisierte Kennzeichnung einzelner Einträge je Mitglied (Farbe, Notiz, Bühnen-Hinweis-Icons wie Umstimmen/Instrumentwechsel/Programmwechsel), persönliche Gesamt-Anmerkung sowie PDF-/Druckexport – auch personalisiert je Mitglied.
- **Equipment & Packlisten** – Katalog mit Eigentum (Band oder Einzelperson) und optional zuständiger Person, Packlisten je Termin mit Abhak-Fortschritt und Druckexport. Beide Module lassen sich je Band ein-/ausschalten.
- **Finanzen** – Einnahmen und Ausgaben je Band bzw. Termin, anteilige Zuordnung an Mitglieder (Gagen bzw. Kostenanteile) mit Bestätigung durch die jeweils zuständige Seite, CSV-Export. Wahlweise ohne Bandkonto (alles wird zu 100 % verteilt) oder mit Bandkonto, das nicht verteilte Restbeträge hält; im Bandkonto-Modus sind zusätzlich direkte Aus- und Einzahlungen möglich. Je Band ein-/ausschaltbar.
- **Kommunikation** – E-Mail-Benachrichtigungen zu neuen/geänderten Terminen, Songvorschlägen, neuen Dateien und eigenen Gagen/Kostenanteilen; jede Person legt im eigenen Profil je Band fest, worüber sie informiert wird. Dazu Teilen-Buttons für WhatsApp bei Terminen und Setlisten. Je Band ein-/ausschaltbar; der Mailversand benötigt zusätzlich einen konfigurierten SMTP-Server (siehe [INSTALLATION.md](INSTALLATION.md)).
- **Dateiverwaltung** – bandinterner Dateispeicher, verknüpfbar mit Songs und Terminen; einzelne Dateien können optional über einen nicht erratbaren Link ohne Login freigegeben werden (Funktion je Band abschaltbar).
- **Bandprofil** – Genre, Kurzbeschreibung, Standort, Kontakt-E-Mail, Links zu Website/Social-Media/Streaming sowie Bandbild.
- **Benutzerprofil** – Anzeigename, E-Mail und Avatar, kontobezogen und unabhängig von der jeweiligen Bandzugehörigkeit; dazu Passwortänderung und Benachrichtigungs-Einstellungen.

Die vollständige, detailliertere fachliche Spezifikation – inklusive geplanter, noch nicht umgesetzter Erweiterungen wie Band-Chat/Umfragen/To-Dos, KI-gestützten Setlist-Vorschlägen und einem Audio-/Video-Player mit Übungsfunktionen – steht in [Funktionsspezifikation-Bandplaner.md](Funktionsspezifikation-Bandplaner.md).

Noch nicht umgesetzt ist ein Self-Service-„Passwort vergessen" per E-Mail-Link sowie automatisch verschickte WhatsApp-Nachrichten – Letzteres setzt zwingend ein WhatsApp-Business-Konto voraus (WhatsApp Channels haben keine API und lassen sich nicht automatisiert bespielen).

## Tech-Stack

Next.js 16 (App Router), Prisma 7 mit SQLite (`better-sqlite3`-Adapter), NextAuth (Auth.js) v5, TypeScript, Tailwind CSS.

## Lokale Entwicklung

```bash
npm install
cp .env.example .env   # Werte anpassen, siehe Kommentare in der Datei
npx prisma migrate dev
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000). Die App legt beim ersten Start ein neues Konto über `/register` an; das erste Bandmitglied wird beim Anlegen der ersten Band automatisch deren Administrator:in.

## Self-Hosting / Deployment

Für den produktiven Betrieb (z. B. per Docker auf einer Synology DiskStation oder in Proxmox VE) siehe die ausführliche [Installationsanleitung](INSTALLATION.md).

## Weitere Ressourcen

- [Funktionsspezifikation-Bandplaner.md](Funktionsspezifikation-Bandplaner.md) – vollständige fachliche Spezifikation inkl. Roadmap
- [INSTALLATION.md](INSTALLATION.md) – Installationsanleitung für den Selbsthost-Betrieb
- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
