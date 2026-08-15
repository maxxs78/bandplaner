# Funktionsspezifikation: Band-Planer-Software

Version 1.1 — Stand 15.08.2026

*Änderungen gegenüber Version 1.0: um bereits in der Anwendung umgesetzte Funktionen ergänzt, die in Version 1.0 noch nicht beschrieben waren — u. a. Songvorschläge mit Abstimmung (3.3), personalisierte Setlist-Kennzeichnung inkl. Bühnen-Hinweis-Icons (3.4), öffentliche Datei-Freigabelinks (3.7), Equipment-Kategorisierung und Zuständigkeiten (3.9) sowie Bandprofil/Stammdaten (3.11, neu).*

## 1. Zweck und Zielgruppe

Die Anwendung ist ein webbasierter Dienst, der Bands und anderen Musikgruppen (Chöre, Orchester, DJ-Kollektive, Ensembles) hilft, ihren organisatorischen Alltag an einem zentralen Ort zu bündeln: Termine, Verfügbarkeiten, Repertoire, Setlisten, Kommunikation, Dateien, Finanzen und Equipment. Ziel ist es, die heute oft über E-Mail, Messenger-Gruppen, Tabellen und Papier verstreute Organisation in ein einziges, gemeinsam genutztes System zu überführen.

Primäre Nutzergruppen:

- Bandmitglieder (Musiker:innen), die Termine, Songs und Setlisten einsehen und daran mitwirken
- Bandadministration (z. B. Bandleitung, Management), die Termine, Finanzen und Mitgliederrechte verwaltet
- Gäste/Aushilfen (Subs, Crew, Techniker), die zeitlich begrenzten oder eingeschränkten Zugriff benötigen

Die Spezifikation beschreibt den fachlichen Funktionsumfang der Anwendung, gegliedert in Module. Sie beruht auf einer Analyse marktüblicher Funktionen vergleichbarer Werkzeuge, ist jedoch bewusst anbieterneutral formuliert und als eigenständige Grundlage für die Konzeption der App zu verstehen.

## 2. Nutzerrollen und Rechte

- **Mehrere Bands pro Konto**: Ein Benutzerkonto kann Mitglied in mehreren Bands/Gruppen sein und zwischen diesen wechseln.
- **Rollenmodell** pro Band, mindestens:
  - Administrator (volle Rechte inkl. Mitglieder- und Rollenverwaltung)
  - Finanz-Administrator (zusätzliche Rechte für den Finanzbereich, ggf. mit eingeschränkter Sichtbarkeit für andere)
  - Mitglied (Standardrechte: einsehen, mitwirken, eigene Verfügbarkeit pflegen)
  - Gast/Aushilfe (zeitlich oder inhaltlich eingeschränkter Zugriff, z. B. nur auf einen Termin oder eine Setlist)
- **Einladungssystem** per E-Mail/Link mit Bestätigung, um neue Mitglieder oder Gäste hinzuzufügen.
- Granulare Sichtbarkeitseinstellungen für einzelne Bereiche (z. B. Finanzen nur für Administration sichtbar).
- **Persönliches Benutzerprofil**: eigener Anzeigename, E-Mail-Adresse und Profilbild (Avatar-Upload), kontobezogen und unabhängig von der jeweiligen Bandzugehörigkeit.

## 3. Kernmodule

### 3.1 Terminplanung und Kalender

- Gemeinsamer Bandkalender mit allen Terminarten (Proben, Auftritte, Meetings, private Abwesenheiten).
- Anlegen einzelner Termine sowie Terminserien (z. B. wöchentliche Probe).
- Termindetails: Datum/Zeit, Ort, Beschreibung, beteiligte Mitglieder, angehängte Dateien, verknüpfte Setlist.
- Vorbelegter Teilnehmerkreis je Terminart: Proben und Auftritte schlagen standardmäßig alle Bandmitglieder als Teilnehmende vor, Meetings und sonstige Termine standardmäßig nur die erstellende Person; der Teilnehmerkreis lässt sich im Termin-Formular individuell anpassen.
- Monats-, Jahres- und Listenansicht der Termine.
- Synchronisation mit externen Kalendern (Google, Apple, Outlook) sowie Abonnement per iCal/ICS-Feed.
- Export von Terminen (z. B. als Tabelle) für Berichte oder Druck.

### 3.2 Verfügbarkeitsmanagement

- Verfügbarkeitsabfragen zu einzelnen Terminen mit Statusoptionen (z. B. Zusage / Absage / Vielleicht).
- Eintragen längerfristiger persönlicher Abwesenheiten (Urlaub, Sperrzeiten) unabhängig von konkreten Terminen.
- Übersicht/„Matrix", die Verfügbarkeiten aller Mitglieder gemeinsam darstellt, um Terminfindung zu erleichtern.
- Automatische Erkennung von Terminüberschneidungen mit bereits eingetragenen Abwesenheiten.
- Erinnerungen und Fristen für ausstehende Rückmeldungen.
- Automatische Benachrichtigung bei Änderungen von Verfügbarkeiten oder Terminen.

### 3.3 Song- und Repertoireverwaltung

- Zentrale, bandweit geteilte Songbibliothek mit Metadaten: Titel, Tonart, Tempo (BPM), Taktart, Dauer, Genre, Lead-Gesang/Besetzung.
- Persönliche Notizen einzelner Mitglieder je Song (z. B. eigene Spielhinweise), getrennt von bandweiten Informationen. Diese persönliche Notiz kann zusätzlich eine kurze Bühnennotiz, eine Farbe sowie Hinweis-Icons enthalten, die als Vorgabewert übernommen werden, sobald der Song einer Setlist hinzugefügt wird (siehe 3.4).
- **Song-Dokumente je Song:**
  - Audiodateien mit integriertem Player zur direkten Wiedergabe in der App (z. B. Referenzaufnahmen, Proberaum-Mitschnitte).
  - Songtexte inklusive Online-Suche zum Auffinden von Texten sowie Speicherung/Export als PDF.
  - Tabulaturen/Noten inklusive Verwaltung gängiger Dateiformate (z. B. Guitar-Pro-Dateien) sowie klassischer Notenblätter/Leadsheets als PDF.
  - Je Datei einstellbare Sichtbarkeit: nur für die hochladende Person oder für die gesamte Band.
- Verknüpfung von Songs mit externen Musikdiensten (z. B. Verlinkung zu Streaming-Plattformen) als Referenz.
- Songvorschläge und Abstimmung: Mitglieder können neue Songs im Status „vorgeschlagen" einstellen; alle Mitglieder können per Daumen-hoch/-runter-Stimme mit optionalem, namentlich sichtbarem Kommentar (kein anonymes Voting, vgl. Abschnitt 5) darüber abstimmen. Stimmt die gesamte Band einstimmig gegen einen Vorschlag, wird dieser automatisch archiviert/abgelehnt.
- Statusverfolgung pro Song entlang des Lebenszyklus „vorgeschlagen" → „neu" → „in Erarbeitung" → „bühnenreif" → „im aktiven Repertoire" → „archiviert".
- Optionaler Bezug zu Proben: Zuordnung geübter Songs zu Probenterminen inklusive Verlauf/Historie.

### 3.4 Setlisten-Verwaltung

- Erstellung von Setlisten per Drag-and-Drop aus der Songbibliothek oder aus zuvor gespeicherten Setlisten heraus.
- Mehrere Setlisten pro Termin/Auftritt möglich (z. B. Alternativversionen, mehrere Sets an einem Abend).
- Automatisierte bzw. regelbasierte Vorschläge zur Zusammenstellung (z. B. nach Kriterien wie Instrumentenwechsel, Tempo- oder Stimmungsverlauf) als Unterstützung, nicht als Ersatz für manuelle Bearbeitung.
- Anzeige der geschätzten Gesamtspieldauer einer Setlist als Summe der hinterlegten Songdauern.
- Persönliche Kennzeichnung einzelner Setlist-Einträge je Mitglied: individuelle Farbe, kurze Notiz sowie Bühnen-Hinweis-Icons (Umstimmen, Instrumentwechsel mit optionaler Instrumentangabe, Programmwechsel mit Programmnummer, freier Hinweis) — nur für das jeweilige Mitglied sichtbar und unabhängig von den bandweiten Songdaten.
- Persönliche, freitextliche Anmerkung je Mitglied zur gesamten Setlist, unabhängig von den einzelnen Einträgen.
- PDF-/Druckexport der Setlist in konfigurierbaren Layouts (z. B. für die Bühne, für Technik/FOH, als Ansage-/Cue-Liste); der Bühnen-Layout-Export ist personalisiert und berücksichtigt die individuellen Farb-, Notiz- und Hinweis-Icon-Einstellungen des jeweiligen Mitglieds.
- Kopieren und Wiederverwenden bestehender Setlisten als Vorlage für neue Termine.
- Verknüpfung der Setlist mit dem jeweiligen Termin und den zugehörigen Song-Dokumenten.

### 3.5 Veranstaltungsorte und Gigs

- Verwaltung wiederverwendbarer Veranstaltungsorte (Adresse, Ansprechpartner, Kontaktdaten, Anfahrtshinweise).
- Gig-spezifische Detailinformationen: Zeiten (Ankunft, Soundcheck, Beginn, Ende), Gage, Besetzung, technische Anforderungen.
- Datei-Upload je Veranstaltungsort/Gig (z. B. Buchungsunterlagen, Technical Rider, Bühnenpläne).
- Statusverfolgung eines Gigs von der Anfrage bis zur Durchführung und Abrechnung.

### 3.6 Kommunikation und Zusammenarbeit

- Kommentarfunktion an zentralen Objekten (Termine, Songs, Setlisten, Dateien), um Absprachen im Kontext zu führen.
- Band-interner Chat, sowohl bandweit als auch in themen- oder terminbezogenen Gruppen.
- Umfragen/Abstimmungen für Bandentscheidungen (z. B. Terminfindung, Repertoire-Auswahl, sonstige Beschlüsse).
- Aufgaben-/To-Do-Listen mit Zuweisung an einzelne Mitglieder und Fälligkeitsdatum.
- Benachrichtigungen per Push und E-Mail, konfigurierbar je Ereignistyp.
- Möglichkeit, Inhalte (Termine, Songs, Dateien) gezielt per Link mit einzelnen Mitgliedern oder extern zu teilen.

### 3.7 Dateiverwaltung

- Zentraler, bandbezogener Dateispeicher mit Kategorisierung (z. B. Noten, Verträge, Fotos, Aufnahmen, Sonstiges).
- Unterscheidung zwischen bandintern sichtbaren und öffentlich freigegebenen Dateien. Öffentlich freigegebene Dateien erhalten einen eindeutigen, nicht erratbaren Freigabelink, über den sie ohne Login abrufbar sind; bandintern sichtbare Dateien bleiben ausschließlich angemeldeten Mitgliedern vorbehalten.
- Verknüpfung von Dateien mit anderen Objekten (Songs, Termine, Veranstaltungsorte, Equipment).
- Kontingentbasierter Speicherplatz pro Band mit Übersicht der aktuellen Auslastung.

### 3.8 Finanzverwaltung

- Erfassung von Einnahmen (z. B. Gagen) und Ausgaben je Band bzw. je Termin/Gig.
- Individuelle Gagen-/Auszahlungsbeträge je Mitglied und Termin, mit hinterlegbaren Standardwerten je Person.
- Eingeschränkte Sichtbarkeit von Finanzdaten (z. B. nur für Finanz-Administration und direkt betroffene Mitglieder).
- Auswertungen/Berichte über Einnahmen- und Ausgabenverlauf (z. B. je Zeitraum, je Auftrittsart).
- Export von Finanzdaten für die Steuererklärung bzw. externe Buchhaltung (z. B. als Tabellendatei).

### 3.9 Equipment- und Packlistenverwaltung

- Katalog des Bandequipments mit Angabe von Besitzer:in bzw. Eigentum (Band oder Einzelperson) und Lagerort.
- Kategorisierung des Equipments (z. B. Instrumente, Instrumentenzubehör, Verstärker/Pedalboard, Bühnentechnik, PA, Monitoring, persönliches Equipment, Sonstiges).
- Von der Eigentumsfrage unabhängige, optionale Zuweisung einer verantwortlichen Person je Equipment-Eintrag; ist eine solche Person hinterlegt, wird sie beim Hinzufügen zu einer Packliste automatisch als Standard-Zuständige:r vorgeschlagen (sonst der/die Eigentümer:in).
- Verknüpfung von Dateien (z. B. Fotos, Anleitungen) mit einzelnen Equipment-Einträgen.
- Erstellung von Packlisten für einzelne Gigs oder Proben, inklusive Zuweisung an Mitglieder.
- Abhak-/Fortschrittsfunktion beim Packen, um Vollständigkeit vor der Abfahrt zu prüfen.
- Export der Packliste (z. B. als PDF) zum Ausdrucken.

### 3.10 KI-gestützte Unterstützungsfunktionen

- **Setlist-Vorschläge:** automatisch generierte Vorschläge für eine Setlist auf Basis von Kriterien wie Auftrittsart, gewünschter Stimmung/Energiekurve und bisheriger Song-Historie, die manuell übernommen oder weiter angepasst werden können.
- **Hinweise zum Veranstaltungsort:** unterstützende Einschätzungen zu Veranstaltungsort und Publikum (z. B. auf Basis hinterlegter Informationen zu Ort/Zielgruppe) inklusive darauf abgestimmter Song- bzw. Setlist-Empfehlungen.

Beide Funktionen sind als unterstützende Zusatzfunktionen zu verstehen, die bestehende manuelle Bearbeitungsmöglichkeiten ergänzen, nicht ersetzen.

### 3.11 Bandprofil und Stammdaten

- Verwaltbares Bandprofil je Band mit Bandname, Genre, Kurzbeschreibung, Standort, Kontakt-E-Mail sowie Links zu Website und Social-Media-/Streaming-Profilen (z. B. Spotify, Instagram, Facebook).
- Bandbild (Upload) zusätzlich zum individuellen Profilbild je Benutzerkonto (siehe Abschnitt 2).
- Diese Stammdaten dienen aktuell der internen Organisation und Wiederverwendung (z. B. in Exporten und künftigen Kommunikationsfunktionen); eine öffentlich zugängliche Profilseite ist damit nicht verbunden (vgl. die entsprechende Abgrenzung in Abschnitt 5).

## 4. Nicht-funktionale Anforderungen

- **Plattformen**: Responsive Webanwendung, nutzbar auf Desktop-Browsern sowie mobilen Endgeräten; native Apps optional als spätere Ausbaustufe.
- **Darstellung**: Hell- und Dunkelmodus.
- **Mehrsprachigkeit**: mindestens Deutsch und Englisch, Architektur so ausgelegt, dass weitere Sprachen ergänzt werden können.
- **Datenschutz**: DSGVO-konforme Datenhaltung (Serverstandort/Datenverarbeitung innerhalb der EU), transparente Datenschutzerklärung, Exportmöglichkeit der eigenen Daten.
- **Zuverlässigkeit**: nachvollziehbare Benachrichtigungslogik, keine automatische kostenpflichtige Verlängerung ohne ausdrückliche Zustimmung, falls ein Testzeitraum angeboten wird.
- **Skalierbarkeit der Bandgröße**: Unterstützung unterschiedlich großer Gruppen, von kleinen Bands bis zu größeren Ensembles/Orchestern.

## 5. Bewusst nicht in diese Version aufgenommene Funktionen

Im Rahmen der Recherche wurden weitere, bei einzelnen Anbietern vorkommende Funktionen identifiziert, die auf Wunsch aktuell **nicht** Teil dieser Spezifikation sind:

- Beleg-Scanner (automatische Betragserkennung aus fotografierten Quittungen, OCR)
- KI-gestützte Reise-/Fahrgemeinschaftsplanung
- Bühnentechnik-Integrationen wie MIDI-/DMX-Steuerung, Playback-/Click-Track-Wiedergabe, Bluetooth-Fußschalter-Steuerung und ein dedizierter Übungsmodus mit Audio-Loop/Tempo-Verlangsamung
- Öffentliches Band-Profil („Link-in-Bio"-Seite) — zu unterscheiden von den intern gepflegten Bandprofil-Stammdaten ohne öffentliche Seite gemäß Abschnitt 3.11
- Vertragsbaukasten mit digitaler Signatur
- Bandübergreifende Musiker-/Vertretungssuche
- Einbettbares Anfrage-Erfassungsformular für die Band-Webseite
- GEMA-spezifisches Exportformat für Setlisten
- Anonyme Song-Bewertung/Voting — die App nutzt stattdessen ein nicht-anonymes Voting mit sichtbarem Namen und optionalem Kommentar, siehe Abschnitt 3.3
- Separates Kundenportal für Booking-Agenturen
- Speziell auf Farbenblindheit ausgelegter Barrierefreiheits-Modus

Diese Liste kann in einer späteren Phase erneut bewertet werden, sollte sich der Bedarf ändern.
