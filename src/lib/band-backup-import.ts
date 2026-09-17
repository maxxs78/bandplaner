import yauzl from "yauzl";
import { createWriteStream } from "fs";
import { mkdir, rm, rename, copyFile, unlink } from "fs/promises";
import { pipeline } from "stream/promises";
import { Transform } from "stream";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { resolveStoredFilePath } from "@/lib/uploads";
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_FILE_PREFIXES,
  BACKUP_MAX_ENTRY_COUNT,
  BACKUP_MAX_TOTAL_UNCOMPRESSED_BYTES,
  BACKUP_STAGING_ROOT,
  BandBackupImportError,
  type BackupManifest,
  type BandBackupImportResult,
} from "@/lib/band-backup-shared";
import type {
  Role,
  FinanceSettlementMode,
  EquipmentCategory,
  SongStatus,
  FileVisibility,
  VoteValue,
  EquipmentIconDisplay,
  SetlistItemKind,
  EventType,
  GigStatus,
  AvailabilityStatus,
  BandFileCategory,
  BandFileVisibility,
  FinanceEntryType,
} from "@/generated/prisma/client";

// --- Zip-Lesehilfen -------------------------------------------------------

/** "files/song-files/x.mp3" -> "song-files/x.mp3" (== SongFile/BandFile.storageKey) */
function archivePathToStorageKey(archivePath: string) {
  return archivePath.replace(/^files\//, "");
}

/** "files/uploads/songs/x.jpg" -> "/uploads/songs/x.jpg" (== Band.imageUrl/Song.coverUrl) */
function archivePathToPublicUrl(archivePath: string) {
  return `/${archivePath.replace(/^files\//, "")}`;
}

/** Absoluter Zielpfad auf Platte für einen archivePath - Gegenstück zu den obigen zwei Funktionen. */
function archivePathToDiskPath(archivePath: string) {
  const segments = archivePath.split("/");
  return archivePath.startsWith("files/uploads/")
    ? path.join(process.cwd(), "public", ...segments.slice(1))
    : resolveStoredFilePath(archivePathToStorageKey(archivePath));
}

/** Verhindert Zip-Slip: nur exakt die vier bekannten Praefixe, Rest muss ein einzelnes, traversal-freies Segment sein. */
function matchAllowedFilePrefix(fileName: string): boolean {
  return BACKUP_FILE_PREFIXES.some((prefix) => {
    if (!fileName.startsWith(prefix)) return false;
    const rest = fileName.slice(prefix.length);
    return rest.length > 0 && rest !== "." && rest !== ".." && !rest.includes("/") && !rest.includes("\\");
  });
}

function createByteCounter(onFlush: (total: number) => void) {
  let total = 0;
  return new Transform({
    transform(chunk, _enc, callback) {
      total += chunk.length;
      callback(null, chunk);
    },
    flush(callback) {
      onFlush(total);
      callback();
    },
  });
}

/**
 * Erster Durchgang: validiert jeden Zip-Eintrag (Name/Groesse), summiert die
 * unkomprimierte Gesamtgroesse und Eintragsanzahl gegen die Hard-Caps, und
 * liest ausschliesslich manifest.json vollstaendig ein. Fasst noch keine
 * Datei aus files/** an - das passiert erst in stageBackupFiles(), nachdem
 * das Manifest bekannt ist (siehe dort fuer die Groessen-Verifikation je Datei).
 */
async function readAndValidateManifest(zipPath: string): Promise<BackupManifest> {
  const zipfile = await yauzl.openPromise(zipPath, { lazyEntries: true, autoClose: true }).catch(() => {
    throw new BandBackupImportError("INVALID_ZIP", "Datei ist keine gültige Zip-Datei.");
  });

  let totalUncompressed = 0;
  let entryCount = 0;
  let manifestBuffer: Buffer | null = null;

  for await (const entry of zipfile.eachEntry()) {
    if (entry.fileName.endsWith("/")) continue; // Verzeichniseintrag, nichts zu tun

    entryCount += 1;
    if (entryCount > BACKUP_MAX_ENTRY_COUNT) {
      throw new BandBackupImportError("TOO_LARGE", "Archiv enthält zu viele Einträge.");
    }
    totalUncompressed += entry.uncompressedSize;
    if (totalUncompressed > BACKUP_MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new BandBackupImportError("TOO_LARGE", "Archiv ist entpackt zu groß.");
    }

    const isManifest = entry.fileName === "manifest.json";
    if (!isManifest && !matchAllowedFilePrefix(entry.fileName)) {
      throw new BandBackupImportError("INVALID_ENTRY", `Unerwarteter Eintrag im Archiv: ${entry.fileName}`);
    }

    if (isManifest && !manifestBuffer) {
      const stream = await zipfile.openReadStreamPromise(entry);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      manifestBuffer = Buffer.concat(chunks);
    }
  }

  if (!manifestBuffer) {
    throw new BandBackupImportError("MISSING_MANIFEST", "Archiv enthält keine manifest.json.");
  }

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(manifestBuffer.toString("utf-8"));
  } catch {
    throw new BandBackupImportError("MISSING_MANIFEST", "manifest.json ist kein gültiges JSON.");
  }
  if (manifest.backupFormatVersion !== BACKUP_FORMAT_VERSION) {
    throw new BandBackupImportError(
      "UNSUPPORTED_VERSION",
      `Backup-Format ${manifest.backupFormatVersion} wird von dieser App-Version nicht unterstützt.`
    );
  }
  return manifest;
}

/**
 * Zweiter Durchgang: extrahiert jede vom Manifest referenzierte Datei nach
 * stagingDir (gestreamt, nie vollständig im Speicher), prüft die geschriebene
 * Bytezahl bei SongFile/BandFile gegen die im Manifest hinterlegte Größe
 * (erkennt abgeschnittene/manipulierte Archive). Öffnet die Zip-Datei
 * separat neu, da eachEntry() pro ZipFile-Instanz nur einmal durchlaufen
 * werden kann.
 */
async function stageBackupFiles(
  zipPath: string,
  manifest: BackupManifest,
  stagingDir: string
): Promise<{ filesCopied: number; totalBytes: number }> {
  const expectedSizes = new Map<string, number>();
  for (const f of manifest.songFiles) expectedSizes.set(f.archivePath, f.size);
  for (const f of manifest.bandFiles) expectedSizes.set(f.archivePath, f.size);

  const expectedPaths = new Set<string>(expectedSizes.keys());
  if (manifest.band.imageUrl) expectedPaths.add(manifest.band.imageUrl);
  for (const s of manifest.songs) if (s.coverUrl) expectedPaths.add(s.coverUrl);

  const found = new Set<string>();
  let filesCopied = 0;
  let totalBytes = 0;

  const zipfile = await yauzl.openPromise(zipPath, { lazyEntries: true, autoClose: true });
  for await (const entry of zipfile.eachEntry()) {
    if (!expectedPaths.has(entry.fileName)) continue;

    const destPath = path.join(stagingDir, ...entry.fileName.split("/"));
    await mkdir(path.dirname(destPath), { recursive: true });
    const stream = await zipfile.openReadStreamPromise(entry);
    let writtenBytes = 0;
    const counter = createByteCounter((total) => (writtenBytes = total));
    await pipeline(stream, counter, createWriteStream(destPath));

    const expectedSize = expectedSizes.get(entry.fileName);
    if (expectedSize !== undefined && writtenBytes !== expectedSize) {
      throw new BandBackupImportError(
        "SIZE_MISMATCH",
        `Datei ${entry.fileName} hat eine unerwartete Größe (Archiv möglicherweise beschädigt).`
      );
    }

    found.add(entry.fileName);
    filesCopied += 1;
    totalBytes += writtenBytes;
  }

  for (const expected of expectedPaths) {
    if (!found.has(expected)) {
      throw new BandBackupImportError("INVALID_ENTRY", `Archiv ist unvollständig: ${expected} fehlt.`);
    }
  }

  return { filesCopied, totalBytes };
}

// --- Datenbank-Wiederherstellung ------------------------------------------

function inc(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

/**
 * Erstellt alle Datensaetze der Band in Abhaengigkeitsreihenfolge in einer
 * einzigen interaktiven Transaktion. Jede Zeile bekommt eine neue,
 * Prisma-generierte ID (die ID aus dem Manifest wird nie wiederverwendet) -
 * alte->neue IDs werden in Maps mitgefuehrt, um interne Querverweise
 * (SetlistItem.songId, PacklistItem.equipmentId, ...) aufzuloesen.
 *
 * Nutzer-Referenzen (userId/*ById) werden anhand einer einmalig ermittelten
 * Menge noch existierender User-IDs aufgeloest: existiert der Account auf
 * diesem Server noch, wird er 1:1 uebernommen; sonst wird die Referenz bei
 * optionalen Feldern auf null gesetzt, bei zwingenden/persoenlichen Feldern
 * (Stimmen, Notizen, Verfuegbarkeiten, Finanz-Zuweisungen, Mitgliedschaften, ...)
 * die gesamte Zeile ausgelassen (siehe droppedRows im Rueckgabewert).
 */
async function createBandFromManifest(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  manifest: BackupManifest,
  importingUserId: string
): Promise<{ bandId: string; rowCounts: Record<string, number>; droppedRows: Record<string, number> }> {
  const rowCounts: Record<string, number> = {};
  const droppedRows: Record<string, number> = {};

  const referencedUserIds = new Set<string>([importingUserId]);
  const collect = (id: string | null | undefined) => {
    if (id) referencedUserIds.add(id);
  };
  manifest.memberships.forEach((m) => collect(m.userId));
  manifest.bandFinanceAdmins.forEach((a) => collect(a.userId));
  manifest.equipment.forEach((e) => collect(e.responsibleId));
  manifest.bandLineupRoles.forEach((r) => collect(r.defaultAssigneeId));
  manifest.songs.forEach((s) => collect(s.proposedById));
  manifest.songFiles.forEach((f) => collect(f.uploadedById));
  manifest.songNotes.forEach((n) => collect(n.userId));
  manifest.practiceLoops.forEach((p) => collect(p.createdById));
  manifest.songVotes.forEach((v) => collect(v.userId));
  manifest.setlistNotes.forEach((n) => collect(n.userId));
  manifest.setlistItemAnnotations.forEach((a) => collect(a.userId));
  manifest.events.forEach((e) => collect(e.createdById));
  manifest.eventParticipants.forEach((p) => collect(p.userId));
  manifest.eventLineupEntries.forEach((e) => collect(e.assignedToId));
  manifest.availabilities.forEach((a) => collect(a.userId));
  manifest.absences.forEach((a) => collect(a.userId));
  manifest.rehearsalSongs.forEach((r) => collect(r.addedById));
  manifest.setlistItemEventAnnotations.forEach((a) => collect(a.userId));
  manifest.setlistEventNotes.forEach((n) => collect(n.userId));
  manifest.packlistItems.forEach((i) => collect(i.assignedToId));
  manifest.packlistItemEventStatuses.forEach((s) => collect(s.assignedToId));
  manifest.bandFiles.forEach((f) => collect(f.uploadedById));
  manifest.financeEntries.forEach((e) => collect(e.createdById));
  manifest.financeAllocations.forEach((a) => collect(a.userId));

  const existingUsers = await tx.user.findMany({
    where: { id: { in: [...referencedUserIds] } },
    select: { id: true },
  });
  const existingUserIds = new Set(existingUsers.map((u) => u.id));
  const remapUser = (id: string | null): string | null => (id && existingUserIds.has(id) ? id : null);

  // 1. Band
  const band = manifest.band;
  const newBand = await tx.band.create({
    data: {
      name: band.name,
      imageUrl: band.imageUrl ? archivePathToPublicUrl(band.imageUrl) : null,
      genre: band.genre,
      bio: band.bio,
      location: band.location,
      contactEmail: band.contactEmail,
      websiteUrl: band.websiteUrl,
      instagramUrl: band.instagramUrl,
      facebookUrl: band.facebookUrl,
      spotifyUrl: band.spotifyUrl,
      createdAt: new Date(band.createdAt),
      equipmentEnabled: band.equipmentEnabled,
      packlistsEnabled: band.packlistsEnabled,
      financeEnabled: band.financeEnabled,
      communicationEnabled: band.communicationEnabled,
      mediaPlayerEnabled: band.mediaPlayerEnabled,
      keyDetectionEnabled: band.keyDetectionEnabled,
      financeSettlementMode: band.financeSettlementMode as FinanceSettlementMode,
      defaultGuestAccessDays: band.defaultGuestAccessDays,
      publicFileLinksEnabled: band.publicFileLinksEnabled,
      locationsEnabled: band.locationsEnabled,
      rehearsalTrackingEnabled: band.rehearsalTrackingEnabled,
    },
  });
  const bandId = newBand.id;
  rowCounts.band = 1;

  // 2. Memberships - der Importierende wird immer Admin, unabhaengig von seiner
  // urspruenglichen Rolle; alle anderen noch existierenden Mitglieder werden mit
  // ihrer urspruenglichen Rolle uebernommen (bestaetigte Produktentscheidung).
  let importerHandled = false;
  for (const m of manifest.memberships) {
    if (!existingUserIds.has(m.userId)) {
      inc(droppedRows, "memberships");
      continue;
    }
    const isImporter = m.userId === importingUserId;
    await tx.membership.create({
      data: {
        userId: m.userId,
        bandId,
        role: isImporter ? "ADMIN" : (m.role as Role),
        guestUntil: m.guestUntil ? new Date(m.guestUntil) : null,
        createdAt: new Date(m.createdAt),
        defaultPayoutAmountCents: m.defaultPayoutAmountCents,
        notifyOnNewEvent: m.notifyOnNewEvent,
        notifyOnEventChange: m.notifyOnEventChange,
        notifyOnSongProposal: m.notifyOnSongProposal,
        notifyOnNewFile: m.notifyOnNewFile,
        notifyOnFinanceAllocation: m.notifyOnFinanceAllocation,
      },
    });
    inc(rowCounts, "memberships");
    if (isImporter) importerHandled = true;
  }
  if (!importerHandled) {
    await tx.membership.create({ data: { userId: importingUserId, bandId, role: "ADMIN" } });
    inc(rowCounts, "memberships");
  }

  // 3. BandFinanceAdmin
  for (const a of manifest.bandFinanceAdmins) {
    if (!existingUserIds.has(a.userId)) {
      inc(droppedRows, "bandFinanceAdmins");
      continue;
    }
    await tx.bandFinanceAdmin.create({ data: { bandId, userId: a.userId, createdAt: new Date(a.createdAt) } });
    inc(rowCounts, "bandFinanceAdmins");
  }

  // 4. Locations
  const locationIdMap = new Map<string, string>();
  for (const l of manifest.locations) {
    const created = await tx.location.create({
      data: {
        bandId,
        name: l.name,
        address: l.address,
        latitude: l.latitude,
        longitude: l.longitude,
        contactName: l.contactName,
        contactPhone: l.contactPhone,
        contactEmail: l.contactEmail,
        website: l.website,
        capacity: l.capacity,
        stageAndTechNotes: l.stageAndTechNotes,
        loadingAndParkingNotes: l.loadingAndParkingNotes,
        notes: l.notes,
        createdAt: new Date(l.createdAt),
      },
    });
    locationIdMap.set(l.id, created.id);
    inc(rowCounts, "locations");
  }

  // 5. Equipment (nur band-eigenes - private Ausruestung ist nie Teil des Backups)
  const equipmentIdMap = new Map<string, string>();
  for (const e of manifest.equipment) {
    const created = await tx.equipment.create({
      data: {
        ownerBandId: bandId,
        name: e.name,
        description: e.description,
        category: e.category as EquipmentCategory,
        location: e.location,
        icon: e.icon,
        color: e.color,
        createdAt: new Date(e.createdAt),
        responsibleId: remapUser(e.responsibleId),
      },
    });
    equipmentIdMap.set(e.id, created.id);
    inc(rowCounts, "equipment");
  }

  // 6. BandLineupRole
  for (const r of manifest.bandLineupRoles) {
    await tx.bandLineupRole.create({
      data: { bandId, name: r.name, order: r.order, defaultAssigneeId: remapUser(r.defaultAssigneeId) },
    });
    inc(rowCounts, "bandLineupRoles");
  }

  // 7. Songs
  const songIdMap = new Map<string, string>();
  for (const s of manifest.songs) {
    const created = await tx.song.create({
      data: {
        bandId,
        title: s.title,
        key: s.key,
        bpm: s.bpm,
        timeSignature: s.timeSignature,
        durationSec: s.durationSec,
        genre: s.genre,
        artist: s.artist,
        album: s.album,
        releaseYear: s.releaseYear,
        cast: s.cast,
        coverUrl: s.coverUrl ? archivePathToPublicUrl(s.coverUrl) : null,
        status: s.status as SongStatus,
        rejected: s.rejected,
        lyrics: s.lyrics,
        remarks: s.remarks,
        techNotes: s.techNotes,
        countInBeats: s.countInBeats,
        clickOffsetMs: s.clickOffsetMs,
        createdAt: new Date(s.createdAt),
        proposedById: remapUser(s.proposedById),
      },
    });
    songIdMap.set(s.id, created.id);
    inc(rowCounts, "songs");
  }

  // 8. SongLink / SongFile / SongNote / PracticeLoop / SongVote
  for (const l of manifest.songLinks) {
    const songId = songIdMap.get(l.songId);
    if (!songId) continue;
    await tx.songLink.create({ data: { songId, url: l.url, label: l.label, createdAt: new Date(l.createdAt) } });
    inc(rowCounts, "songLinks");
  }
  for (const f of manifest.songFiles) {
    const songId = songIdMap.get(f.songId);
    if (!songId) continue;
    await tx.songFile.create({
      data: {
        songId,
        filename: f.filename,
        storageKey: archivePathToStorageKey(f.archivePath),
        mimeType: f.mimeType,
        size: f.size,
        visibility: f.visibility as FileVisibility,
        createdAt: new Date(f.createdAt),
        uploadedById: remapUser(f.uploadedById),
      },
    });
    inc(rowCounts, "songFiles");
  }
  for (const n of manifest.songNotes) {
    const songId = songIdMap.get(n.songId);
    if (!songId || !existingUserIds.has(n.userId)) {
      inc(droppedRows, "songNotes");
      continue;
    }
    await tx.songNote.create({
      data: {
        songId,
        userId: n.userId,
        content: n.content,
        shortNote: n.shortNote,
        color: n.color,
        cues: n.cues,
        updatedAt: new Date(n.updatedAt),
      },
    });
    inc(rowCounts, "songNotes");
  }
  for (const p of manifest.practiceLoops) {
    const songId = songIdMap.get(p.songId);
    if (!songId) continue;
    await tx.practiceLoop.create({
      data: {
        songId,
        name: p.name,
        startSec: p.startSec,
        endSec: p.endSec,
        createdAt: new Date(p.createdAt),
        createdById: remapUser(p.createdById),
      },
    });
    inc(rowCounts, "practiceLoops");
  }
  for (const v of manifest.songVotes) {
    const songId = songIdMap.get(v.songId);
    if (!songId || !existingUserIds.has(v.userId)) {
      inc(droppedRows, "songVotes");
      continue;
    }
    await tx.songVote.create({
      data: {
        songId,
        userId: v.userId,
        vote: v.vote as VoteValue,
        comment: v.comment,
        createdAt: new Date(v.createdAt),
        updatedAt: new Date(v.updatedAt),
      },
    });
    inc(rowCounts, "songVotes");
  }

  // 9. Setlists + SetlistItems
  const setlistIdMap = new Map<string, string>();
  for (const s of manifest.setlists) {
    const created = await tx.setlist.create({
      data: {
        bandId,
        name: s.name,
        createdAt: new Date(s.createdAt),
        equipmentIconDisplay: s.equipmentIconDisplay as EquipmentIconDisplay,
        techNotes: s.techNotes,
      },
    });
    setlistIdMap.set(s.id, created.id);
    inc(rowCounts, "setlists");
  }
  const setlistItemIdMap = new Map<string, string>();
  for (const i of manifest.setlistItems) {
    const setlistId = setlistIdMap.get(i.setlistId);
    if (!setlistId) continue;
    const songId = i.songId ? (songIdMap.get(i.songId) ?? null) : null;
    const created = await tx.setlistItem.create({
      data: {
        setlistId,
        order: i.order,
        kind: i.kind as SetlistItemKind,
        customTitle: i.customTitle,
        durationSec: i.durationSec,
        excludeFromNumbering: i.excludeFromNumbering,
        songDeleted: i.songDeleted,
        techNotes: i.techNotes,
        segueToNext: i.segueToNext,
        songId,
      },
    });
    setlistItemIdMap.set(i.id, created.id);
    inc(rowCounts, "setlistItems");
  }
  for (const n of manifest.setlistNotes) {
    const setlistId = setlistIdMap.get(n.setlistId);
    if (!setlistId || !existingUserIds.has(n.userId)) {
      inc(droppedRows, "setlistNotes");
      continue;
    }
    await tx.setlistNote.create({
      data: { setlistId, userId: n.userId, content: n.content, updatedAt: new Date(n.updatedAt) },
    });
    inc(rowCounts, "setlistNotes");
  }
  for (const a of manifest.setlistItemAnnotations) {
    const itemId = setlistItemIdMap.get(a.itemId);
    if (!itemId || !existingUserIds.has(a.userId)) {
      inc(droppedRows, "setlistItemAnnotations");
      continue;
    }
    await tx.setlistItemAnnotation.create({
      data: { itemId, userId: a.userId, note: a.note, color: a.color, cues: a.cues, updatedAt: new Date(a.updatedAt) },
    });
    inc(rowCounts, "setlistItemAnnotations");
  }

  // 10. Events
  const eventIdMap = new Map<string, string>();
  for (const e of manifest.events) {
    const locationId = e.locationId ? (locationIdMap.get(e.locationId) ?? null) : null;
    const created = await tx.event.create({
      data: {
        bandId,
        title: e.title,
        type: e.type as EventType,
        startsAt: new Date(e.startsAt),
        endsAt: new Date(e.endsAt),
        location: e.location,
        description: e.description,
        seriesId: e.seriesId,
        createdAt: new Date(e.createdAt),
        arrivalAt: e.arrivalAt ? new Date(e.arrivalAt) : null,
        soundcheckAt: e.soundcheckAt ? new Date(e.soundcheckAt) : null,
        technicalRequirements: e.technicalRequirements,
        gigStatus: e.gigStatus as GigStatus | null,
        createdById: remapUser(e.createdById),
        locationId,
      },
    });
    eventIdMap.set(e.id, created.id);
    inc(rowCounts, "events");
  }

  // 11. Setlist<->Event (m:n) verbinden
  for (const link of manifest.setlistEventLinks) {
    const setlistId = setlistIdMap.get(link.setlistId);
    const eventId = eventIdMap.get(link.eventId);
    if (!setlistId || !eventId) continue;
    await tx.setlist.update({ where: { id: setlistId }, data: { events: { connect: { id: eventId } } } });
  }

  // 12. EventParticipant / EventLineupEntry / Availability / Absence / RehearsalSong
  for (const p of manifest.eventParticipants) {
    const eventId = eventIdMap.get(p.eventId);
    if (!eventId || !existingUserIds.has(p.userId)) {
      inc(droppedRows, "eventParticipants");
      continue;
    }
    await tx.eventParticipant.create({ data: { eventId, userId: p.userId } });
    inc(rowCounts, "eventParticipants");
  }
  for (const e of manifest.eventLineupEntries) {
    const eventId = eventIdMap.get(e.eventId);
    if (!eventId) continue;
    await tx.eventLineupEntry.create({
      data: { eventId, role: e.role, order: e.order, assignedToId: remapUser(e.assignedToId), assignedToName: e.assignedToName },
    });
    inc(rowCounts, "eventLineupEntries");
  }
  for (const a of manifest.availabilities) {
    const eventId = eventIdMap.get(a.eventId);
    if (!eventId || !existingUserIds.has(a.userId)) {
      inc(droppedRows, "availabilities");
      continue;
    }
    await tx.availability.create({
      data: {
        eventId,
        userId: a.userId,
        status: a.status as AvailabilityStatus,
        note: a.note,
        respondedAt: new Date(a.respondedAt),
      },
    });
    inc(rowCounts, "availabilities");
  }
  for (const a of manifest.absences) {
    if (!existingUserIds.has(a.userId)) {
      inc(droppedRows, "absences");
      continue;
    }
    await tx.absence.create({
      data: {
        bandId,
        userId: a.userId,
        startDate: new Date(a.startDate),
        endDate: new Date(a.endDate),
        reason: a.reason,
        createdAt: new Date(a.createdAt),
      },
    });
    inc(rowCounts, "absences");
  }
  for (const r of manifest.rehearsalSongs) {
    const eventId = eventIdMap.get(r.eventId);
    const songId = songIdMap.get(r.songId);
    if (!eventId || !songId) continue;
    await tx.rehearsalSong.create({
      data: { eventId, songId, note: r.note, createdAt: new Date(r.createdAt), addedById: remapUser(r.addedById) },
    });
    inc(rowCounts, "rehearsalSongs");
  }

  // 13. SetlistItemEventAnnotation / SetlistEventNote / SetlistEventSnapshot
  for (const a of manifest.setlistItemEventAnnotations) {
    const itemId = setlistItemIdMap.get(a.itemId);
    const eventId = eventIdMap.get(a.eventId);
    if (!itemId || !eventId || !existingUserIds.has(a.userId)) {
      inc(droppedRows, "setlistItemEventAnnotations");
      continue;
    }
    await tx.setlistItemEventAnnotation.create({
      data: { itemId, eventId, userId: a.userId, note: a.note, color: a.color, cues: a.cues, updatedAt: new Date(a.updatedAt) },
    });
    inc(rowCounts, "setlistItemEventAnnotations");
  }
  for (const n of manifest.setlistEventNotes) {
    const setlistId = setlistIdMap.get(n.setlistId);
    const eventId = eventIdMap.get(n.eventId);
    if (!setlistId || !eventId || !existingUserIds.has(n.userId)) {
      inc(droppedRows, "setlistEventNotes");
      continue;
    }
    await tx.setlistEventNote.create({
      data: { setlistId, eventId, userId: n.userId, content: n.content, updatedAt: new Date(n.updatedAt) },
    });
    inc(rowCounts, "setlistEventNotes");
  }
  for (const s of manifest.setlistEventSnapshots) {
    const setlistId = setlistIdMap.get(s.setlistId);
    const eventId = eventIdMap.get(s.eventId);
    if (!setlistId || !eventId) continue;
    await tx.setlistEventSnapshot.create({
      data: { setlistId, eventId, itemsJson: s.itemsJson, createdAt: new Date(s.createdAt) },
    });
    inc(rowCounts, "setlistEventSnapshots");
  }

  // 14. Packlists + PacklistItems
  const packlistIdMap = new Map<string, string>();
  for (const p of manifest.packlists) {
    const created = await tx.packlist.create({ data: { bandId, name: p.name, createdAt: new Date(p.createdAt) } });
    packlistIdMap.set(p.id, created.id);
    inc(rowCounts, "packlists");
  }
  const packlistItemIdMap = new Map<string, string>();
  for (const i of manifest.packlistItems) {
    const packlistId = packlistIdMap.get(i.packlistId);
    if (!packlistId) continue;
    const equipmentId = i.equipmentId ? (equipmentIdMap.get(i.equipmentId) ?? null) : null;
    const created = await tx.packlistItem.create({
      data: {
        packlistId,
        order: i.order,
        checked: i.checked,
        customName: i.customName,
        equipmentId,
        assignedToId: remapUser(i.assignedToId),
      },
    });
    packlistItemIdMap.set(i.id, created.id);
    inc(rowCounts, "packlistItems");
  }

  // 15. Packlist<->Event (m:n) verbinden
  for (const link of manifest.packlistEventLinks) {
    const packlistId = packlistIdMap.get(link.packlistId);
    const eventId = eventIdMap.get(link.eventId);
    if (!packlistId || !eventId) continue;
    await tx.packlist.update({ where: { id: packlistId }, data: { events: { connect: { id: eventId } } } });
  }

  // 16. PacklistEventSnapshot / PacklistItemEventStatus
  for (const s of manifest.packlistEventSnapshots) {
    const packlistId = packlistIdMap.get(s.packlistId);
    const eventId = eventIdMap.get(s.eventId);
    if (!packlistId || !eventId) continue;
    await tx.packlistEventSnapshot.create({
      data: { packlistId, eventId, itemsJson: s.itemsJson, createdAt: new Date(s.createdAt) },
    });
    inc(rowCounts, "packlistEventSnapshots");
  }
  for (const s of manifest.packlistItemEventStatuses) {
    const itemId = packlistItemIdMap.get(s.itemId);
    const eventId = eventIdMap.get(s.eventId);
    if (!itemId || !eventId) continue;
    await tx.packlistItemEventStatus.create({
      data: { itemId, eventId, checked: s.checked, assignedToId: remapUser(s.assignedToId) },
    });
    inc(rowCounts, "packlistItemEventStatuses");
  }

  // 17. BandFile (neuer shareToken - der alte wird nie uebernommen) + m:n-Reconnect
  for (const f of manifest.bandFiles) {
    const created = await tx.bandFile.create({
      data: {
        bandId,
        filename: f.filename,
        storageKey: archivePathToStorageKey(f.archivePath),
        mimeType: f.mimeType,
        size: f.size,
        category: f.category as BandFileCategory,
        visibility: f.visibility as BandFileVisibility,
        createdAt: new Date(f.createdAt),
        uploadedById: remapUser(f.uploadedById),
      },
    });
    inc(rowCounts, "bandFiles");

    const eventIds = f.eventIds.map((id) => eventIdMap.get(id)).filter((id): id is string => Boolean(id));
    const songIds = f.songIds.map((id) => songIdMap.get(id)).filter((id): id is string => Boolean(id));
    const equipmentIds = f.equipmentIds.map((id) => equipmentIdMap.get(id)).filter((id): id is string => Boolean(id));
    const locationIds = f.locationIds.map((id) => locationIdMap.get(id)).filter((id): id is string => Boolean(id));
    if (eventIds.length || songIds.length || equipmentIds.length || locationIds.length) {
      await tx.bandFile.update({
        where: { id: created.id },
        data: {
          events: { connect: eventIds.map((id) => ({ id })) },
          songs: { connect: songIds.map((id) => ({ id })) },
          equipment: { connect: equipmentIds.map((id) => ({ id })) },
          locations: { connect: locationIds.map((id) => ({ id })) },
        },
      });
    }
  }

  // 18. FinanceEntry / FinanceAllocation
  const financeEntryIdMap = new Map<string, string>();
  for (const e of manifest.financeEntries) {
    const eventId = e.eventId ? (eventIdMap.get(e.eventId) ?? null) : null;
    const created = await tx.financeEntry.create({
      data: {
        bandId,
        type: e.type as FinanceEntryType,
        amountCents: e.amountCents,
        currency: e.currency,
        category: e.category,
        description: e.description,
        date: new Date(e.date),
        createdAt: new Date(e.createdAt),
        eventId,
        createdById: remapUser(e.createdById),
      },
    });
    financeEntryIdMap.set(e.id, created.id);
    inc(rowCounts, "financeEntries");
  }
  for (const a of manifest.financeAllocations) {
    const financeEntryId = financeEntryIdMap.get(a.financeEntryId);
    if (!financeEntryId || !existingUserIds.has(a.userId)) {
      inc(droppedRows, "financeAllocations");
      continue;
    }
    await tx.financeAllocation.create({
      data: {
        financeEntryId,
        userId: a.userId,
        amountCents: a.amountCents,
        note: a.note,
        confirmedAt: a.confirmedAt ? new Date(a.confirmedAt) : null,
        createdAt: new Date(a.createdAt),
      },
    });
    inc(rowCounts, "financeAllocations");
  }

  return { bandId, rowCounts, droppedRows };
}

// --- Dateien platzieren ----------------------------------------------------

async function moveStagedFileIntoPlace(archivePath: string, stagedAbsPath: string) {
  const destAbsPath = archivePathToDiskPath(archivePath);
  await mkdir(path.dirname(destAbsPath), { recursive: true });
  try {
    await rename(stagedAbsPath, destAbsPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EXDEV") {
      await copyFile(stagedAbsPath, destAbsPath);
      await unlink(stagedAbsPath);
    } else {
      throw err;
    }
  }
  return destAbsPath;
}

// --- Öffentliche Einstiegsfunktion ------------------------------------------

/**
 * Importiert ein per buildBandBackupArchive() erzeugtes Zip als brandneue
 * Band (der importierende Nutzer wird deren Admin). Legt nie eine bestehende
 * Band an/ueberschreibt nie eine bestehende Band - siehe Produktentscheidung
 * im Plan. Zwei Phasen: (1) validieren + Dateien in ein Staging-Verzeichnis
 * entpacken, ohne die DB anzufassen; (2) eine DB-Transaktion, danach die
 * gestagten Dateien an ihren endgueltigen Platz verschieben. Schlaegt Schritt
 * (2)b fehl, wird die neu angelegte Band wieder geloescht (kaskadiert alles)
 * - SQLite-Transaktionen koennen keine Dateisystem-Operationen umfassen,
 * daher ist das die Rollback-Strategie statt einer einzigen atomaren Operation.
 */
export async function importBandBackupArchive(
  zipFilePath: string,
  importingUserId: string
): Promise<BandBackupImportResult> {
  const importId = randomUUID();
  const stagingDir = path.join(BACKUP_STAGING_ROOT, importId, "staged");

  try {
    const manifest = await readAndValidateManifest(zipFilePath);
    const { filesCopied, totalBytes } = await stageBackupFiles(zipFilePath, manifest, stagingDir);

    const txResult = await prisma.$transaction((tx) => createBandFromManifest(tx, manifest, importingUserId), {
      timeout: 300_000,
    });

    const stagedFiles: { archivePath: string; stagedAbsPath: string }[] = [];
    if (manifest.band.imageUrl) {
      stagedFiles.push({
        archivePath: manifest.band.imageUrl,
        stagedAbsPath: path.join(stagingDir, ...manifest.band.imageUrl.split("/")),
      });
    }
    for (const s of manifest.songs) {
      if (s.coverUrl) {
        stagedFiles.push({ archivePath: s.coverUrl, stagedAbsPath: path.join(stagingDir, ...s.coverUrl.split("/")) });
      }
    }
    for (const f of manifest.songFiles) {
      stagedFiles.push({ archivePath: f.archivePath, stagedAbsPath: path.join(stagingDir, ...f.archivePath.split("/")) });
    }
    for (const f of manifest.bandFiles) {
      stagedFiles.push({ archivePath: f.archivePath, stagedAbsPath: path.join(stagingDir, ...f.archivePath.split("/")) });
    }

    const movedDestPaths: string[] = [];
    try {
      for (const file of stagedFiles) {
        movedDestPaths.push(await moveStagedFileIntoPlace(file.archivePath, file.stagedAbsPath));
      }
    } catch (err) {
      await Promise.all(movedDestPaths.map((p) => unlink(p).catch(() => {})));
      await prisma.band.delete({ where: { id: txResult.bandId } }).catch(() => {});
      throw new BandBackupImportError("FILE_MOVE_FAILED", `Dateien konnten nicht abgelegt werden: ${String(err)}`);
    }

    return {
      bandId: txResult.bandId,
      bandName: manifest.band.name,
      rowCounts: txResult.rowCounts,
      droppedRows: txResult.droppedRows,
      filesCopied,
      totalBytes,
    };
  } finally {
    // Best-effort: ein Aufraeum-Fehler (z. B. ENOTEMPTY unter Windows, wenn ein
    // Datei-Handle noch kurz nachhaengt) darf niemals ein sonst erfolgreiches
    // Ergebnis (oder den echten Fehler aus dem try-Block) ueberschreiben -
    // ein liegen gebliebenes Staging-Verzeichnis ist unschoen, aber harmlos.
    await rm(path.dirname(stagingDir), { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch(
      (err) => console.error("Aufräumen des Backup-Staging-Verzeichnisses fehlgeschlagen:", err)
    );
  }
}
