# Funktionsspezifikation: Band-Planer-Software

Version 1.10 — Stand 21.08.2026

*Änderungen gegenüber Version 1.0: um bereits in der Anwendung umgesetzte Funktionen ergänzt, die in Version 1.0 noch nicht beschrieben waren — u. a. Songvorschläge mit Abstimmung (3.3), personalisierte Setlist-Kennzeichnung inkl. Bühnen-Hinweis-Icons (3.4), öffentliche Datei-Freigabelinks (3.7), Equipment-Kategorisierung und Zuständigkeiten (3.9) sowie Bandprofil/Stammdaten (3.11, neu).*

*Änderungen gegenüber Version 1.1: geplante Zukunftsfunktionen ergänzt — erleichterte Titelerfassung per automatischer Metadaten-Recherche über Spotify-/YouTube-URL sowie Musikdatenbanken wie MusicBrainz/Discogs (3.3), neues Modul Audio-/Video-Player mit Übungsfunktionen wie Tempo-/Tonart-Anpassung und Abschnitts-Loop (3.12); Abgrenzung in Abschnitt 5 entsprechend angepasst.*

*Änderungen gegenüber Version 1.2: Umsetzungsstand nachgeführt — Finanzverwaltung (3.8) inkl. Abrechnungsmodi umgesetzt, Kommunikation (3.6) teilweise umgesetzt (E-Mail-Benachrichtigungen und WhatsApp-Teilen), Audio-Player mit Übungsfunktionen (3.12) umgesetzt; Rollenmodell an die tatsächliche Umsetzung angepasst (Finanzadmin ist keine Rolle, sondern eine rollenunabhängige Kennzeichnung, Abschnitt 2); Coverbild-Übernahme aus Datei-Metadaten präzisiert (3.3); neuer Abschnitt 2.1 zu abschaltbaren Modulen; Grenzen der Streaming-Einbettung dokumentiert (3.12).*

*Änderungen gegenüber Version 1.3: Übungsmodus (3.12) erweitert — Loop-Bereich per Ziehen mit Maus/Finger direkt in der Wellenform markierbar (zusätzlich zu den bestehenden Buttons), Zeit-/Restzeitanzeige inkl. Millisekunden, automatische Tempoerkennung (BPM) inkl. Live-Anpassung bei Tempoänderung sowie auf Knopfdruck ausgelöste Tonart-Erkennung mit Übernahme-Rückfrage bei Abweichung von der hinterlegten Tonart; Tonart-Erkennung als eigener, granularer Unterschalter in Abschnitt 2.1 ergänzt.*

*Änderungen gegenüber Version 1.4: Schutz vor Brute-Force-Login-Versuchen ergänzt (Abschnitt 4) — Konten werden nach 5 fehlgeschlagenen Loginversuchen für 2 Tage automatisch gesperrt, als Vorbereitung darauf, den Server künftig auch aus dem Internet erreichbar zu machen.*

*Änderungen gegenüber Version 1.5: Mehrsprachigkeit (Abschnitt 4) umgesetzt — Deutsch und Englisch, umschaltbar über einen Sprachwähler im Kopfbereich, dauerhaft im Benutzerprofil hinterlegt; vor dem Login wird die Sprache aus den Browser-Einstellungen erkannt. Architektur ist auf weitere Sprachen erweiterbar.*

*Änderungen gegenüber Version 1.6: Veranstaltungsorte (3.5) als eigenständiges, abschaltbares Modul umgesetzt — bandweiter Ortskatalog mit Kartendarstellung (OpenStreetMap/Leaflet, Straßenkarte und Satellitenbild umschaltbar), Adress-Geokodierung sowie Punktsetzung direkt auf der Karte inklusive automatischer Rückwärts-Geokodierung, Datei-Upload je Ort und ein einziges, im Terminformular kombiniertes Ortsfeld (Freitext, Verknüpfung oder Neuanlage); neuer Unterschalter in Abschnitt 2.1. Gig-spezifische Detailinformationen und Statusverfolgung sind demgegenüber weiterhin nicht umgesetzt und als Ausbaustufe markiert.*

*Änderungen gegenüber Version 1.7: Umsetzungsstand des Anlageassistenten (3.3) nachgeführt und korrigiert — die zuvor als „geplant" beschriebene URL-basierte Erfassung (Spotify-/YouTube-Link) wurde nicht so umgesetzt; tatsächlich umgesetzt ist stattdessen eine ID3-/Vorbis-Tag-Vorschau aus einer ausgewählten Audiodatei (Titel, Interpret, Genre, Album, Jahr, BPM, Cover) sowie eine ergänzende Online-Recherche auf Knopfdruck anhand von Titel/Interpret (MusicBrainz primär, Discogs-Fallback, Spotify-Link), beide mit stillem Degradieren bei fehlender Konfiguration.*

*Änderungen gegenüber Version 1.8: ID3-/Vorbis-Tag-Vorschau (3.3) um Spieldauer ergänzt; im Übungsmodus erkanntes Grundtempo (3.12) lässt sich analog zur Tonart-Erkennung nach Bestätigung in die Songdaten übernehmen. Größere Erweiterung: Dateien, Setlisten und Packlisten lassen sich jetzt mit mehreren Objekten bzw. Terminen gleichzeitig verknüpfen statt wie zuvor mit höchstens einem (3.4, 3.7, 3.9) — bei Setlisten/Packlisten bleibt die Song- bzw. Eintragsliste dabei geteilt, während Abhak-Status, Zuständigkeit und persönliche Hinweise je Termin getrennt geführt werden; für bereits vergangene Termine wird die Liste beim nächsten Änderungsversuch automatisch als historischer Stand eingefroren, damit spätere Bearbeitungen die Dokumentation vergangener Auftritte/Proben nicht verfälschen.*

*Änderungen gegenüber Version 1.9: Setlisten-Verwaltung (3.4) um weitere Eintragsarten ergänzt — manuelle Einträge (z. B. Umbaupausen) können optional eine Dauer erhalten und lassen sich einzeln von der fortlaufenden Nummerierung ausnehmen, ohne dass dabei eine Nummer übersprungen wird; neu hinzugekommen sind zudem bandweit sichtbare, kursiv dargestellte Kommentarzeilen sowie unnummerierte Abschnittstrenner mit optionaler Beschriftung zur Gliederung der Setlist.*

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
  - Mitglied (Standardrechte: einsehen, mitwirken, eigene Verfügbarkeit pflegen)
  - Gast/Aushilfe (zeitlich oder inhaltlich eingeschränkter Zugriff, z. B. nur auf einen Termin oder eine Setlist)
- **Finanzberechtigung** als eigenständige, von der Rolle unabhängige Kennzeichnung: Beliebig viele Personen einer Band können als Finanzadmin:in markiert werden, zusätzlich zu ihrer Rolle. Dadurch kann dieselbe Person gleichzeitig Administrator:in und Finanzadmin:in sein (Personalunion) und die Finanzverantwortung auf mehrere Personen verteilt werden. Finanzadmin:innen sehen als Einzige die vollständige Finanzübersicht und erhalten zusätzlich admin-gleiche Rechte bei Songs, Equipment, Dateien und Terminen — ausdrücklich jedoch keinen Zugriff auf Mitgliederverwaltung oder die Verwaltung der Band-Funktionen.
- **Einladungssystem** per E-Mail/Link mit Bestätigung, um neue Mitglieder oder Gäste hinzuzufügen.
- Granulare Sichtbarkeitseinstellungen für einzelne Bereiche (z. B. Finanzen nur für Administration sichtbar).
- **Persönliches Benutzerprofil**: eigener Anzeigename, E-Mail-Adresse und Profilbild (Avatar-Upload), kontobezogen und unabhängig von der jeweiligen Bandzugehörigkeit.

### 2.1 Abschaltbare Module

Nicht jede Gruppe benötigt jeden Funktionsbereich. Umfangreichere Module lassen sich deshalb je Band von der Administration ein- und ausschalten, damit die Oberfläche auf das tatsächlich Genutzte beschränkt bleibt:

| Modul | Standard | Hinweis |
|---|---|---|
| Equipment | ein | — |
| Packlisten | ein | benötigt Equipment; ohne dieses nicht aktivierbar |
| Finanzen | aus | beim Aktivieren wird die aktivierende Person automatisch Finanzadmin:in, sofern die Band noch keine hat |
| Kommunikation | aus | E-Mail-Versand erfordert zusätzlich einen konfigurierten Mailserver |
| Medienplayer | aus | steuert nur die Wiedergabe-Oberfläche; Dateien und Links bleiben unabhängig davon nutzbar |
| davon: Tonart-Erkennung | ein | granularer Unterschalter, nur wirksam bei aktiviertem Medienplayer |
| Orte | aus | ohne aktiviertes Modul bleibt im Terminformular nur das bisherige Freitext-Ortsfeld erhalten |

Leitprinzip: Ein ausgeschaltetes Modul verschwindet aus der Navigation, **löscht aber keine Daten**. Bereits erfasste Inhalte und persönliche Einstellungen bleiben erhalten und stehen unverändert wieder zur Verfügung, sobald das Modul erneut eingeschaltet wird. Einzige bewusste Ausnahme ist die Freigabe öffentlicher Datei-Links (3.7): Da sie als Sicherheitsschranke wirkt, sperrt ihre Deaktivierung auch bereits bestehende Links.

## 3. Kernmodule

### 3.1 Terminplanung und Kalender

- Gemeinsamer Bandkalender mit allen Terminarten (Proben, Auftritte, Meetings, private Abwesenheiten).
- Anlegen einzelner Termine sowie Terminserien (z. B. wöchentliche Probe).
- Termindetails: Datum/Zeit, Ort (Freitext oder Verknüpfung zu einem katalogisierten Veranstaltungsort samt Kartenvorschau, siehe 3.5), Beschreibung, beteiligte Mitglieder, angehängte Dateien, verknüpfte Setlist.
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

- Zentrale, bandweit geteilte Songbibliothek mit Metadaten: Titel, Tonart, Tempo (BPM), Taktart, Dauer, Genre, Lead-Gesang/Besetzung, Album und Erscheinungsjahr sowie optionalem Coverbild.
- **Anlageassistent beim Neuanlegen eines Songs:**
  - ID3-/Vorbis-Tag-Vorschau: Wird beim Anlegen eine Audiodatei ausgewählt (auch vor dem eigentlichen Hochladen), werden Titel, Interpret, Genre, Album, Erscheinungsjahr, BPM und Spieldauer aus den Datei-Metadaten ausgelesen und tragen sich automatisch in noch leere Formularfelder ein; bereits ausgefüllte Felder werden nicht überschrieben. Ein eingebettetes Coverbild (ID3v2 bei MP3, entsprechende Felder bei M4A/OGG/FLAC) wird ebenso übernommen, sofern noch keines hinterlegt ist. Das Coverbild gehört zu den Song-Stammdaten und wird unabhängig davon angezeigt, ob der Medienplayer (3.12) aktiviert ist.
  - Online-Recherche auf Knopfdruck: Titel und optional Interpret (aus den bereits erfassten oder per ID3 vorbefüllten Feldern) werden gegen Musikdatenbanken abgeglichen. MusicBrainz dient als Primärquelle und liefert bis zu fünf Kandidaten (Titel, Interpret, Album, Jahr, Genre); liefert MusicBrainz keinen Treffer, springt Discogs als Fallback für Genre/Jahr/Cover ein; ergänzend liefert eine Spotify-Suche einen Track-Link, der als externer Link am Song hinterlegt wird. Bei mehreren Treffern erscheint eine Auswahlliste zur Bestätigung; die Übernahme befüllt wie bei der ID3-Vorschau nur leere Felder, sämtliche Angaben bleiben zusätzlich vollständig manuell erfassbar bzw. änderbar.
  - Alle drei Online-Quellen sind einzeln optional konfigurierbar (Zugangsdaten je Instanz in den Umgebungsvariablen) und degradieren bei fehlender Konfiguration oder einem Fehler still, ohne die manuelle Song-Erfassung oder die ID3-Vorschau zu blockieren.
- Persönliche Notizen einzelner Mitglieder je Song (z. B. eigene Spielhinweise), getrennt von bandweiten Informationen. Diese persönliche Notiz kann zusätzlich eine kurze Bühnennotiz, eine Farbe sowie Hinweis-Icons enthalten, die als Vorgabewert übernommen werden, sobald der Song einer Setlist hinzugefügt wird (siehe 3.4).
- **Song-Dokumente je Song:**
  - Audiodateien mit integriertem Player zur direkten Wiedergabe in der App (z. B. Referenzaufnahmen, Proberaum-Mitschnitte); geplante Erweiterungen des Players (Streaming-Wiedergabe, Übungsfunktionen) siehe Abschnitt 3.12.
  - Songtexte inklusive Online-Suche zum Auffinden von Texten sowie Speicherung/Export als PDF.
  - Tabulaturen/Noten inklusive Verwaltung gängiger Dateiformate (z. B. Guitar-Pro-Dateien) sowie klassischer Notenblätter/Leadsheets als PDF.
  - Je Datei einstellbare Sichtbarkeit: nur für die hochladende Person oder für die gesamte Band.
- Verknüpfung von Songs mit externen Musikdiensten (z. B. Verlinkung zu Streaming-Plattformen) als Referenz.
- Songvorschläge und Abstimmung: Mitglieder können neue Songs im Status „vorgeschlagen" einstellen; alle Mitglieder können per Daumen-hoch/-runter-Stimme mit optionalem, namentlich sichtbarem Kommentar (kein anonymes Voting, vgl. Abschnitt 5) darüber abstimmen. Stimmt die gesamte Band einstimmig gegen einen Vorschlag, wird dieser automatisch archiviert/abgelehnt.
- Statusverfolgung pro Song entlang des Lebenszyklus „vorgeschlagen" → „neu" → „in Erarbeitung" → „bühnenreif" → „im aktiven Repertoire" → „archiviert".
- Optionaler Bezug zu Proben: Zuordnung geübter Songs zu Probenterminen inklusive Verlauf/Historie.

### 3.4 Setlisten-Verwaltung

- Erstellung von Setlisten per Drag-and-Drop aus der Songbibliothek oder aus zuvor gespeicherten Setlisten heraus.
- Mehrere Setlisten pro Termin/Auftritt möglich (z. B. Alternativversionen, mehrere Sets an einem Abend) — ebenso lässt sich dieselbe Setlist mit mehreren Terminen verknüpfen, etwa für ein wiederkehrendes Set.
- Automatisierte bzw. regelbasierte Vorschläge zur Zusammenstellung (z. B. nach Kriterien wie Instrumentenwechsel, Tempo- oder Stimmungsverlauf) als Unterstützung, nicht als Ersatz für manuelle Bearbeitung.
- Anzeige der geschätzten Gesamtspieldauer einer Setlist als Summe der hinterlegten Songdauern.
- Persönliche Kennzeichnung einzelner Setlist-Einträge je Mitglied: individuelle Farbe, kurze Notiz sowie Bühnen-Hinweis-Icons (Umstimmen, Instrumentwechsel mit optionaler Instrumentangabe, Programmwechsel mit Programmnummer, freier Hinweis) — nur für das jeweilige Mitglied sichtbar und unabhängig von den bandweiten Songdaten.
- Persönliche, freitextliche Anmerkung je Mitglied zur gesamten Setlist, unabhängig von den einzelnen Einträgen.
- PDF-/Druckexport der Setlist in konfigurierbaren Layouts (z. B. für die Bühne, für Technik/FOH, als Ansage-/Cue-Liste); der Bühnen-Layout-Export ist personalisiert und berücksichtigt die individuellen Farb-, Notiz- und Hinweis-Icon-Einstellungen des jeweiligen Mitglieds.
- Kopieren und Wiederverwenden bestehender Setlisten als Vorlage für neue Termine.
- Neben Songs aus der Songbibliothek lassen sich weitere Eintragsarten einfügen: **manuelle Einträge** (Freitext-Titel, optional mit Dauer, z. B. „Pause – 15 Minuten“), **Kommentarzeilen** (bandweit sichtbarer Freitext, kursiv dargestellt, unabhängig von den personalisierten Einträgshinweisen) sowie **Abschnittstrenner** zur Gliederung (Trennlinie mit optionaler Beschriftung, z. B. „Teil 2“). Songs und manuelle Einträge werden fortlaufend durchnummeriert, Kommentare und Abschnittstrenner nie. Bei manuellen Einträgen lässt sich die Zählung je Eintrag gezielt abwählen (der Eintrag wird dann übersprungen, ohne dass die folgende Nummer eine Lücke aufweist).
- **Mehrfachverknüpfung mit Terminen:** Eine Setlist kann gleichzeitig mit mehreren Terminen verknüpft sein; die Songliste ist dabei geteilt (Änderungen wirken sich auf alle verknüpften Termine aus), während persönliche Hinweise/Notizen je nach im Termin-Auswähler gewähltem Termin getrennt geführt werden — voreingestellt auf den nächsten anstehenden verknüpften Termin. Wird ein verknüpfter Termin nachträglich zu einem vergangenen (bzw. war er es bereits bei der Verknüpfung), friert die App die Songliste beim nächsten Änderungsversuch automatisch als „wie gespielt"-Stand für diesen Termin ein; die eingefrorene Fassung bleibt danach unverändert sichtbar und druckbar, unabhängig von weiteren Änderungen an der (für zukünftige Termine weiterhin geteilten) Liste.
- Verknüpfung der Setlist mit den zugehörigen Song-Dokumenten.

### 3.5 Veranstaltungsorte und Gigs

- Bandweiter Katalog wiederverwendbarer Veranstaltungsorte mit Name, Adresse, Ansprechpartner:in, Kontakt (Telefon/E-Mail), Website, Fassungsvermögen sowie Freitextfeldern für Bühne/Technik und Anfahrt/Parken.
- Kartendarstellung auf Basis von OpenStreetMap (Leaflet), umschaltbar zwischen Straßenkarte und Satellitenbild (Esri World Imagery, ohne zusätzlichen API-Schlüssel). Die Adresse kann eingegeben werden (automatische Geokodierung über Nominatim mit Trefferliste bei Mehrdeutigkeit) oder direkt auf der Karte gesetzt werden (Klick oder Ziehen des Markers, automatische Rückwärts-Geokodierung ins Adressfeld); die ermittelten Geokoordinaten werden zusätzlich als Text angezeigt.
- Datei-Upload je Veranstaltungsort (z. B. Buchungsunterlagen, Technical Rider, Bühnenpläne), analog zu Songs und Equipment.
- Verknüpfung mit Terminen: Im Terminformular steht ein einziges Ortsfeld zur Verfügung, das wahlweise Freitext, die Verknüpfung zu einem bestehenden Ort oder die Neuanlage eines Orts direkt beim Anlegen des Termins erlaubt. Ein verknüpfter Termin zeigt Ortsname, Adresse und eine kompakte Kartenvorschau.
- Als eigenständiges, je Band abschaltbares Modul nutzbar (Abschnitt 2.1); ohne aktiviertes Modul bleibt bei Terminen das bisherige Freitext-Ortsfeld erhalten.
- Gig-spezifische Detailinformationen wie Ankunfts-/Soundcheck-Zeiten, Besetzung und technische Anforderungen je Auftritt sowie eine durchgängige Statusverfolgung eines Gigs von der Anfrage bis zur Abrechnung sind als Ausbaustufe vorgesehen, aber noch nicht umgesetzt (Gagen selbst werden bereits über die Finanzverwaltung erfasst, siehe Abschnitt 3.8).

### 3.6 Kommunikation und Zusammenarbeit

- Kommentarfunktion an zentralen Objekten (Termine, Songs, Setlisten, Dateien), um Absprachen im Kontext zu führen.
- Band-interner Chat, sowohl bandweit als auch in themen- oder terminbezogenen Gruppen.
- Umfragen/Abstimmungen für Bandentscheidungen (z. B. Terminfindung, Repertoire-Auswahl, sonstige Beschlüsse).
- Aufgaben-/To-Do-Listen mit Zuweisung an einzelne Mitglieder und Fälligkeitsdatum.
- Benachrichtigungen per E-Mail, konfigurierbar je Ereignistyp und Person (neuer Termin, Terminänderung/-absage, neuer Songvorschlag, neue Datei, eigene Gagen und Kostenanteile). Über eigene Aktionen wird bewusst nicht benachrichtigt; bei Rundmails stehen die Empfänger im BCC, damit keine Adressen offengelegt werden. Der Versand setzt einen konfigurierten Mailserver voraus — fehlt dieser, bleibt die Anwendung uneingeschränkt nutzbar und überspringt lediglich den Versand. Push-Benachrichtigungen sind bislang nicht umgesetzt.
- Möglichkeit, Inhalte (Termine, Songs, Dateien) gezielt per Link mit einzelnen Mitgliedern oder extern zu teilen, ergänzt um Teilen-Schaltflächen für WhatsApp bei Terminen und Setlisten (vorbefüllte Nachricht zum manuellen Versenden).
- Automatisch verschickte WhatsApp-Nachrichten sind bewusst nicht vorgesehen: Sie setzen zwingend ein WhatsApp-Business-Konto samt vorab genehmigter Nachrichtenvorlagen und laufender Kosten voraus. WhatsApp-Kanäle („Channels") bieten keine Programmierschnittstelle und lassen sich nicht automatisiert bespielen.

### 3.7 Dateiverwaltung

- Zentraler, bandbezogener Dateispeicher mit Kategorisierung (z. B. Noten, Verträge, Fotos, Aufnahmen, Sonstiges).
- Unterscheidung zwischen bandintern sichtbaren und öffentlich freigegebenen Dateien. Öffentlich freigegebene Dateien erhalten einen eindeutigen, nicht erratbaren Freigabelink, über den sie ohne Login abrufbar sind; bandintern sichtbare Dateien bleiben ausschließlich angemeldeten Mitgliedern vorbehalten.
- Verknüpfung von Dateien mit anderen Objekten (Songs, Termine, Veranstaltungsorte, Equipment) — auch mehrfach gleichzeitig, z. B. ein am Veranstaltungsort hinterlegter Technical Rider zusätzlich an einen konkreten Termin. Verknüpfungen lassen sich nachträglich über eine „Bestehende Datei verknüpfen"-Auswahl je Objekt ergänzen sowie einzeln wieder lösen, ohne die Datei selbst zu löschen.
- Kontingentbasierter Speicherplatz pro Band mit Übersicht der aktuellen Auslastung.

### 3.8 Finanzverwaltung

- Erfassung von Einnahmen (z. B. Gagen) und Ausgaben je Band bzw. je Termin/Gig.
- Individuelle Gagen-/Auszahlungsbeträge je Mitglied und Termin, mit hinterlegbaren Standardwerten je Person.
- Zwei wählbare Abrechnungsmodi je Band: **ohne Bandkonto** (Einnahmen werden vollständig auf Mitglieder verteilt, Ausgaben vollständig anteilig getragen — der Saldo der Band ist immer ausgeglichen) oder **mit Bandkonto**, das nicht verteilte Restbeträge als Bandkapital hält. Im Bandkonto-Modus sind zusätzlich direkte Auszahlungen an Mitglieder und Einzahlungen von Mitgliedern möglich; ein Wechsel zurück auf „ohne Bandkonto" ist erst möglich, wenn der Saldo ausgeglichen ist.
- Bestätigungspflicht je zugeordnetem Betrag durch die jeweils empfangende Seite: Auszahlungen bestätigt das Mitglied selbst, eingehende Zahlungen die Finanzadministration. Bis dahin gilt der Posten als offen und ist für beide Seiten als solcher sichtbar.
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
- **Mehrfachverknüpfung mit Terminen:** Eine Packliste kann gleichzeitig mit mehreren Terminen verknüpft sein; die Eintragsliste ist dabei geteilt, während Abhak-Status und Zuständigkeit je nach im Termin-Auswähler gewähltem Termin getrennt geführt werden — voreingestellt auf den nächsten anstehenden verknüpften Termin. Wie bei Setlisten (3.4) wird die Eintragsliste für bereits vergangene Termine beim nächsten Änderungsversuch automatisch als „wie gepackt"-Stand eingefroren.
- Export der Packliste (z. B. als PDF) zum Ausdrucken — bei vergangenen Terminen mit eingefrorenem Stand basierend auf der historischen statt der aktuellen Liste.

### 3.10 KI-gestützte Unterstützungsfunktionen

- **Setlist-Vorschläge:** automatisch generierte Vorschläge für eine Setlist auf Basis von Kriterien wie Auftrittsart, gewünschter Stimmung/Energiekurve und bisheriger Song-Historie, die manuell übernommen oder weiter angepasst werden können.
- **Hinweise zum Veranstaltungsort:** unterstützende Einschätzungen zu Veranstaltungsort und Publikum (z. B. auf Basis hinterlegter Informationen zu Ort/Zielgruppe) inklusive darauf abgestimmter Song- bzw. Setlist-Empfehlungen.

Beide Funktionen sind als unterstützende Zusatzfunktionen zu verstehen, die bestehende manuelle Bearbeitungsmöglichkeiten ergänzen, nicht ersetzen.

### 3.11 Bandprofil und Stammdaten

- Verwaltbares Bandprofil je Band mit Bandname, Genre, Kurzbeschreibung, Standort, Kontakt-E-Mail sowie Links zu Website und Social-Media-/Streaming-Profilen (z. B. Spotify, Instagram, Facebook).
- Bandbild (Upload) zusätzlich zum individuellen Profilbild je Benutzerkonto (siehe Abschnitt 2).
- Diese Stammdaten dienen aktuell der internen Organisation und Wiederverwendung (z. B. in Exporten und künftigen Kommunikationsfunktionen); eine öffentlich zugängliche Profilseite ist damit nicht verbunden (vgl. die entsprechende Abgrenzung in Abschnitt 5).

### 3.12 Medienplayer und Übungsfunktionen

- Integrierter Player für am Song hinterlegte Audiodateien, direkt innerhalb der App abspielbar. Ergänzend werden per URL verlinkte Streaming-Quellen (Spotify, YouTube) über den jeweils offiziellen Player des Anbieters eingebettet; YouTube gibt dabei das Video wieder, Spotify seinen Audio-Player samt eigenem Coverbild.
- Übungsfunktionen für hochgeladene Audiodateien: Wiedergabegeschwindigkeit prozentual regelbar bei gleichbleibender Tonhöhe sowie Tonart in Halbtonschritten transponierbar, unabhängig von der Wiedergabegeschwindigkeit — vergleichbar mit Grundfunktionen bekannter Übungswerkzeuge wie Anytune. Ist am Song eine Tonart hinterlegt, zeigt die App bei aktiver Transposition die sich daraus ergebende Zieltonart mit an.
- Markieren eines Abschnitts innerhalb eines Songs sowie dessen Endlos-Wiedergabe (Loop) zum gezielten Üben einzelner Passagen, ergänzt um eine Wellenformdarstellung zur Orientierung und zum Anspringen einzelner Stellen. Der Loop-Bereich lässt sich sowohl über Buttons ("ab hier"/"bis hier") als auch direkt per Ziehen mit Maus oder Finger in der Wellenform festlegen.
- Anzeige von verstrichener Zeit und Restzeit inklusive Millisekunden während der Wiedergabe.
- Automatische Tempoerkennung: Das Grundtempo (BPM) der Datei wird beim Laden ermittelt und angezeigt, die Anzeige aktualisiert sich live entsprechend der eingestellten Wiedergabegeschwindigkeit. Weicht das erkannte Grundtempo vom am Song hinterlegten BPM-Wert ab, fragt die App nach, ob es in die Songdaten übernommen werden soll — wie bei der Tonart-Erkennung ausschließlich nach aktiver Bestätigung, nie automatisch.
- Tonart-Erkennung auf Knopfdruck (eigener, granularer Unterschalter unter dem Medienplayer-Modul, siehe Abschnitt 2.1): Schätzt die Tonart der Audiodatei per Chromagramm-Analyse. Weicht das Ergebnis von der am Song hinterlegten Tonart ab, fragt die App nach, ob es in die Songdaten übernommen werden soll — die Übernahme erfolgt ausschließlich nach aktiver Bestätigung, nie automatisch. Da sich Dur-Tonarten von ihrer parallelen Molltonart (z. B. C-Dur/a-Moll) anhand der reinen Tonhöhen kaum unterscheiden lassen, weist die App in solchen Fällen im Ergebnis auf die naheliegende Alternative hin, statt eine falsche Eindeutigkeit vorzutäuschen.
- Zweistufige Wiedergabe: Standardmäßig läuft ein schlanker, streamender Player. Der Übungsmodus wird bewusst erst auf Anforderung geladen, da er die Datei vollständig verarbeitet im Speicher hält.

**Abgrenzung:** Die Übungsfunktionen stehen ausschließlich für hochgeladene Audiodateien zur Verfügung, nicht für eingebettete Streaming-Quellen. Das ist keine Frage des Umsetzungsaufwands, sondern eine Grenze der Anbieter: Spotify bietet über seinen Player keinerlei Tempo- oder Tonhöhensteuerung, YouTube nur feste Geschwindigkeitsstufen und kein Transponieren. Ein Zugriff auf die Audiodaten selbst wäre bei beiden Anbietern nicht zulässig.

## 4. Nicht-funktionale Anforderungen

- **Plattformen**: Responsive Webanwendung, nutzbar auf Desktop-Browsern sowie mobilen Endgeräten; native Apps optional als spätere Ausbaustufe.
- **Darstellung**: Hell- und Dunkelmodus.
- **Mehrsprachigkeit** (umgesetzt): Deutsch und Englisch, umschaltbar über einen Sprachwähler im Kopfbereich der Anwendung; die Wahl wird dauerhaft im Benutzerprofil gespeichert und gilt bandübergreifend. Vor dem Login (z. B. auf der Anmeldeseite) wird die Sprache automatisch aus den Browser-Einstellungen erkannt. Die Architektur ist so ausgelegt, dass weitere Sprachen ergänzt werden können.
- **Datenschutz**: DSGVO-konforme Datenhaltung (Serverstandort/Datenverarbeitung innerhalb der EU), transparente Datenschutzerklärung, Exportmöglichkeit der eigenen Daten.
- **Schutz vor Brute-Force-Login-Versuchen**: Nach 5 fehlgeschlagenen Loginversuchen in Folge wird das betroffene Konto für 2 Tage gesperrt, unabhängig davon, von welcher IP-Adresse die Versuche stammen. Die Sperre läuft danach automatisch ab; ein Admin-Passwort-Reset hebt sie zusätzlich sofort auf.
- **Zuverlässigkeit**: nachvollziehbare Benachrichtigungslogik, keine automatische kostenpflichtige Verlängerung ohne ausdrückliche Zustimmung, falls ein Testzeitraum angeboten wird.
- **Skalierbarkeit der Bandgröße**: Unterstützung unterschiedlich großer Gruppen, von kleinen Bands bis zu größeren Ensembles/Orchestern.

## 5. Bewusst nicht in diese Version aufgenommene Funktionen

Im Rahmen der Recherche wurden weitere, bei einzelnen Anbietern vorkommende Funktionen identifiziert, die auf Wunsch aktuell **nicht** Teil dieser Spezifikation sind:

- Beleg-Scanner (automatische Betragserkennung aus fotografierten Quittungen, OCR)
- KI-gestützte Reise-/Fahrgemeinschaftsplanung
- Bühnentechnik-Integrationen wie MIDI-/DMX-Steuerung, Playback-/Click-Track-Wiedergabe sowie Bluetooth-Fußschalter-Steuerung — der Übungsmodus mit Tempo-/Tonart-Anpassung und Abschnitts-Loop ist demgegenüber als geplante Funktion in Abschnitt 3.12 vorgesehen
- Öffentliches Band-Profil („Link-in-Bio"-Seite) — zu unterscheiden von den intern gepflegten Bandprofil-Stammdaten ohne öffentliche Seite gemäß Abschnitt 3.11
- Vertragsbaukasten mit digitaler Signatur
- Bandübergreifende Musiker-/Vertretungssuche
- Einbettbares Anfrage-Erfassungsformular für die Band-Webseite
- GEMA-spezifisches Exportformat für Setlisten
- Anonyme Song-Bewertung/Voting — die App nutzt stattdessen ein nicht-anonymes Voting mit sichtbarem Namen und optionalem Kommentar, siehe Abschnitt 3.3
- Separates Kundenportal für Booking-Agenturen
- Speziell auf Farbenblindheit ausgelegter Barrierefreiheits-Modus

Diese Liste kann in einer späteren Phase erneut bewertet werden, sollte sich der Bedarf ändern.
