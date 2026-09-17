import { ZipArchive } from "archiver";
import { PassThrough, Readable } from "stream";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { resolveStoredFilePath } from "@/lib/uploads";
import {
  BACKUP_FORMAT_VERSION,
  slugifyBandName,
  type BackupManifest,
} from "@/lib/band-backup-shared";
import packageJson from "../../package.json";

const PUBLIC_ROOT = path.join(process.cwd(), "public");

/** Vergibt einen frischen Archiv-Dateinamen fuer eine oeffentliche Bild-URL ("/uploads/<subdir>/<datei>"). */
function planPublicImage(url: string | null, subdir: "bands" | "songs") {
  if (!url) return null;
  const extension = path.extname(url) || "";
  const archiveName = `${randomUUID()}${extension}`;
  return {
    archivePath: `files/uploads/${subdir}/${archiveName}`,
    diskPath: path.join(PUBLIC_ROOT, url),
  };
}

/** Vergibt einen frischen Archiv-Dateinamen fuer eine private Datei (SongFile/BandFile.storageKey). */
function planPrivateFile(storageKey: string, kind: "song-files" | "band-files") {
  const extension = path.extname(storageKey) || "";
  const archiveName = `${randomUUID()}${extension}`;
  return {
    archivePath: `files/${kind}/${archiveName}`,
    diskPath: resolveStoredFilePath(storageKey),
  };
}

/**
 * Baut ein vollstaendiges Backup-Archiv (manifest.json + alle referenzierten
 * Dateien) einer Band und liefert es als Web-ReadableStream, direkt aus
 * archiver gestreamt - nie als Ganzes im Speicher gepuffert (Bands koennen
 * bis zu BAND_STORAGE_QUOTA_BYTES = 2GB an privaten Dateien haben).
 */
export async function buildBandBackupArchive(
  bandId: string,
  exportedByUserId: string
): Promise<{ stream: ReadableStream<Uint8Array>; filename: string }> {
  const band = await prisma.band.findUniqueOrThrow({ where: { id: bandId } });

  const [
    memberships,
    bandFinanceAdmins,
    locations,
    equipment,
    bandLineupRoles,
    songs,
    songLinks,
    songFiles,
    songNotes,
    practiceLoops,
    songVotes,
    setlists,
    setlistItems,
    setlistNotes,
    setlistItemAnnotations,
    events,
    eventParticipants,
    eventLineupEntries,
    availabilities,
    absences,
    rehearsalSongs,
    setlistItemEventAnnotations,
    setlistEventNotes,
    setlistEventSnapshots,
    packlists,
    packlistItems,
    packlistEventSnapshots,
    packlistItemEventStatuses,
    bandFiles,
    financeEntries,
    financeAllocations,
  ] = await Promise.all([
    prisma.membership.findMany({ where: { bandId } }),
    prisma.bandFinanceAdmin.findMany({ where: { bandId } }),
    prisma.location.findMany({ where: { bandId } }),
    prisma.equipment.findMany({ where: { ownerBandId: bandId } }),
    prisma.bandLineupRole.findMany({ where: { bandId } }),
    prisma.song.findMany({ where: { bandId } }),
    prisma.songLink.findMany({ where: { song: { bandId } } }),
    prisma.songFile.findMany({ where: { song: { bandId } } }),
    prisma.songNote.findMany({ where: { song: { bandId } } }),
    prisma.practiceLoop.findMany({ where: { song: { bandId } } }),
    prisma.songVote.findMany({ where: { song: { bandId } } }),
    prisma.setlist.findMany({ where: { bandId }, include: { events: { select: { id: true } } } }),
    prisma.setlistItem.findMany({ where: { setlist: { bandId } } }),
    prisma.setlistNote.findMany({ where: { setlist: { bandId } } }),
    prisma.setlistItemAnnotation.findMany({ where: { item: { setlist: { bandId } } } }),
    prisma.event.findMany({ where: { bandId } }),
    prisma.eventParticipant.findMany({ where: { event: { bandId } } }),
    prisma.eventLineupEntry.findMany({ where: { event: { bandId } } }),
    prisma.availability.findMany({ where: { event: { bandId } } }),
    prisma.absence.findMany({ where: { bandId } }),
    prisma.rehearsalSong.findMany({ where: { event: { bandId } } }),
    prisma.setlistItemEventAnnotation.findMany({ where: { item: { setlist: { bandId } } } }),
    prisma.setlistEventNote.findMany({ where: { setlist: { bandId } } }),
    prisma.setlistEventSnapshot.findMany({ where: { setlist: { bandId } } }),
    prisma.packlist.findMany({ where: { bandId }, include: { events: { select: { id: true } } } }),
    prisma.packlistItem.findMany({ where: { packlist: { bandId } } }),
    prisma.packlistEventSnapshot.findMany({ where: { packlist: { bandId } } }),
    prisma.packlistItemEventStatus.findMany({ where: { item: { packlist: { bandId } } } }),
    prisma.bandFile.findMany({
      where: { bandId },
      include: {
        events: { select: { id: true } },
        songs: { select: { id: true } },
        equipment: { select: { id: true } },
        locations: { select: { id: true } },
      },
    }),
    prisma.financeEntry.findMany({ where: { bandId } }),
    prisma.financeAllocation.findMany({ where: { financeEntry: { bandId } } }),
  ]);

  // Dateien planen (frische Archiv-Namen vergeben) - passiert vor dem Zusammenbau
  // des Manifests, da die neuen Pfade als coverUrl/imageUrl/archivePath hineinmuessen.
  const bandImage = planPublicImage(band.imageUrl, "bands");
  const songCovers = new Map<string, ReturnType<typeof planPublicImage>>();
  for (const s of songs) songCovers.set(s.id, planPublicImage(s.coverUrl, "songs"));
  const songFilePlans = new Map(songFiles.map((f) => [f.id, planPrivateFile(f.storageKey, "song-files")]));
  const bandFilePlans = new Map(bandFiles.map((f) => [f.id, planPrivateFile(f.storageKey, "band-files")]));

  const manifest: BackupManifest = {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    appVersion: packageJson.version,
    exportedAt: new Date().toISOString(),
    exportedByUserId,
    band: {
      id: band.id,
      name: band.name,
      imageUrl: bandImage?.archivePath ?? null,
      genre: band.genre,
      bio: band.bio,
      location: band.location,
      contactEmail: band.contactEmail,
      websiteUrl: band.websiteUrl,
      instagramUrl: band.instagramUrl,
      facebookUrl: band.facebookUrl,
      spotifyUrl: band.spotifyUrl,
      createdAt: band.createdAt.toISOString(),
      equipmentEnabled: band.equipmentEnabled,
      packlistsEnabled: band.packlistsEnabled,
      financeEnabled: band.financeEnabled,
      communicationEnabled: band.communicationEnabled,
      mediaPlayerEnabled: band.mediaPlayerEnabled,
      keyDetectionEnabled: band.keyDetectionEnabled,
      financeSettlementMode: band.financeSettlementMode,
      defaultGuestAccessDays: band.defaultGuestAccessDays,
      publicFileLinksEnabled: band.publicFileLinksEnabled,
      locationsEnabled: band.locationsEnabled,
      rehearsalTrackingEnabled: band.rehearsalTrackingEnabled,
    },
    memberships: memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      guestUntil: m.guestUntil?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      defaultPayoutAmountCents: m.defaultPayoutAmountCents,
      notifyOnNewEvent: m.notifyOnNewEvent,
      notifyOnEventChange: m.notifyOnEventChange,
      notifyOnSongProposal: m.notifyOnSongProposal,
      notifyOnNewFile: m.notifyOnNewFile,
      notifyOnFinanceAllocation: m.notifyOnFinanceAllocation,
    })),
    bandFinanceAdmins: bandFinanceAdmins.map((a) => ({
      id: a.id,
      userId: a.userId,
      createdAt: a.createdAt.toISOString(),
    })),
    locations: locations.map((l) => ({
      id: l.id,
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
      createdAt: l.createdAt.toISOString(),
    })),
    equipment: equipment.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      category: e.category,
      location: e.location,
      icon: e.icon,
      color: e.color,
      createdAt: e.createdAt.toISOString(),
      responsibleId: e.responsibleId,
    })),
    bandLineupRoles: bandLineupRoles.map((r) => ({
      id: r.id,
      name: r.name,
      order: r.order,
      defaultAssigneeId: r.defaultAssigneeId,
    })),
    songs: songs.map((s) => ({
      id: s.id,
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
      coverUrl: songCovers.get(s.id)?.archivePath ?? null,
      status: s.status,
      rejected: s.rejected,
      lyrics: s.lyrics,
      remarks: s.remarks,
      techNotes: s.techNotes,
      countInBeats: s.countInBeats,
      clickOffsetMs: s.clickOffsetMs,
      createdAt: s.createdAt.toISOString(),
      proposedById: s.proposedById,
    })),
    songLinks: songLinks.map((l) => ({
      id: l.id,
      songId: l.songId,
      url: l.url,
      label: l.label,
      createdAt: l.createdAt.toISOString(),
    })),
    songFiles: songFiles.map((f) => ({
      id: f.id,
      songId: f.songId,
      filename: f.filename,
      archivePath: songFilePlans.get(f.id)!.archivePath,
      mimeType: f.mimeType,
      size: f.size,
      visibility: f.visibility,
      createdAt: f.createdAt.toISOString(),
      uploadedById: f.uploadedById,
    })),
    songNotes: songNotes.map((n) => ({
      id: n.id,
      songId: n.songId,
      userId: n.userId,
      content: n.content,
      shortNote: n.shortNote,
      color: n.color,
      cues: n.cues,
      updatedAt: n.updatedAt.toISOString(),
    })),
    practiceLoops: practiceLoops.map((p) => ({
      id: p.id,
      songId: p.songId,
      name: p.name,
      startSec: p.startSec,
      endSec: p.endSec,
      createdAt: p.createdAt.toISOString(),
      createdById: p.createdById,
    })),
    songVotes: songVotes.map((v) => ({
      id: v.id,
      songId: v.songId,
      userId: v.userId,
      vote: v.vote,
      comment: v.comment,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    })),
    setlists: setlists.map((s) => ({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt.toISOString(),
      equipmentIconDisplay: s.equipmentIconDisplay,
      techNotes: s.techNotes,
    })),
    setlistItems: setlistItems.map((i) => ({
      id: i.id,
      setlistId: i.setlistId,
      order: i.order,
      kind: i.kind,
      customTitle: i.customTitle,
      durationSec: i.durationSec,
      excludeFromNumbering: i.excludeFromNumbering,
      songDeleted: i.songDeleted,
      techNotes: i.techNotes,
      segueToNext: i.segueToNext,
      songId: i.songId,
    })),
    setlistNotes: setlistNotes.map((n) => ({
      id: n.id,
      setlistId: n.setlistId,
      userId: n.userId,
      content: n.content,
      updatedAt: n.updatedAt.toISOString(),
    })),
    setlistItemAnnotations: setlistItemAnnotations.map((a) => ({
      id: a.id,
      itemId: a.itemId,
      userId: a.userId,
      note: a.note,
      color: a.color,
      cues: a.cues,
      updatedAt: a.updatedAt.toISOString(),
    })),
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      location: e.location,
      description: e.description,
      seriesId: e.seriesId,
      createdAt: e.createdAt.toISOString(),
      arrivalAt: e.arrivalAt?.toISOString() ?? null,
      soundcheckAt: e.soundcheckAt?.toISOString() ?? null,
      technicalRequirements: e.technicalRequirements,
      gigStatus: e.gigStatus,
      createdById: e.createdById,
      locationId: e.locationId,
    })),
    eventParticipants: eventParticipants.map((p) => ({ id: p.id, eventId: p.eventId, userId: p.userId })),
    eventLineupEntries: eventLineupEntries.map((e) => ({
      id: e.id,
      eventId: e.eventId,
      role: e.role,
      order: e.order,
      assignedToId: e.assignedToId,
      assignedToName: e.assignedToName,
    })),
    availabilities: availabilities.map((a) => ({
      id: a.id,
      eventId: a.eventId,
      userId: a.userId,
      status: a.status,
      note: a.note,
      respondedAt: a.respondedAt.toISOString(),
    })),
    absences: absences.map((a) => ({
      id: a.id,
      userId: a.userId,
      startDate: a.startDate.toISOString(),
      endDate: a.endDate.toISOString(),
      reason: a.reason,
      createdAt: a.createdAt.toISOString(),
    })),
    rehearsalSongs: rehearsalSongs.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      songId: r.songId,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      addedById: r.addedById,
    })),
    setlistItemEventAnnotations: setlistItemEventAnnotations.map((a) => ({
      id: a.id,
      itemId: a.itemId,
      eventId: a.eventId,
      userId: a.userId,
      note: a.note,
      color: a.color,
      cues: a.cues,
      updatedAt: a.updatedAt.toISOString(),
    })),
    setlistEventNotes: setlistEventNotes.map((n) => ({
      id: n.id,
      setlistId: n.setlistId,
      eventId: n.eventId,
      userId: n.userId,
      content: n.content,
      updatedAt: n.updatedAt.toISOString(),
    })),
    setlistEventSnapshots: setlistEventSnapshots.map((s) => ({
      id: s.id,
      setlistId: s.setlistId,
      eventId: s.eventId,
      itemsJson: s.itemsJson,
      createdAt: s.createdAt.toISOString(),
    })),
    setlistEventLinks: setlists.flatMap((s) => s.events.map((e) => ({ setlistId: s.id, eventId: e.id }))),
    packlists: packlists.map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt.toISOString() })),
    packlistItems: packlistItems.map((i) => ({
      id: i.id,
      packlistId: i.packlistId,
      order: i.order,
      checked: i.checked,
      customName: i.customName,
      equipmentId: i.equipmentId,
      assignedToId: i.assignedToId,
    })),
    packlistEventSnapshots: packlistEventSnapshots.map((s) => ({
      id: s.id,
      packlistId: s.packlistId,
      eventId: s.eventId,
      itemsJson: s.itemsJson,
      createdAt: s.createdAt.toISOString(),
    })),
    packlistItemEventStatuses: packlistItemEventStatuses.map((s) => ({
      id: s.id,
      itemId: s.itemId,
      eventId: s.eventId,
      checked: s.checked,
      assignedToId: s.assignedToId,
    })),
    packlistEventLinks: packlists.flatMap((p) => p.events.map((e) => ({ packlistId: p.id, eventId: e.id }))),
    bandFiles: bandFiles.map((f) => ({
      id: f.id,
      filename: f.filename,
      archivePath: bandFilePlans.get(f.id)!.archivePath,
      mimeType: f.mimeType,
      size: f.size,
      category: f.category,
      visibility: f.visibility,
      createdAt: f.createdAt.toISOString(),
      uploadedById: f.uploadedById,
      eventIds: f.events.map((e) => e.id),
      songIds: f.songs.map((s) => s.id),
      equipmentIds: f.equipment.map((e) => e.id),
      locationIds: f.locations.map((l) => l.id),
    })),
    financeEntries: financeEntries.map((e) => ({
      id: e.id,
      type: e.type,
      amountCents: e.amountCents,
      currency: e.currency,
      category: e.category,
      description: e.description,
      date: e.date.toISOString(),
      createdAt: e.createdAt.toISOString(),
      eventId: e.eventId,
      createdById: e.createdById,
    })),
    financeAllocations: financeAllocations.map((a) => ({
      id: a.id,
      financeEntryId: a.financeEntryId,
      userId: a.userId,
      amountCents: a.amountCents,
      note: a.note,
      confirmedAt: a.confirmedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  const archive = new ZipArchive({ zlib: { level: 6 } });
  const output = new PassThrough();
  archive.pipe(output);
  archive.on("warning", (err) => {
    if (err.code !== "ENOENT") output.destroy(err);
  });
  archive.on("error", (err) => output.destroy(err));

  archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
  if (bandImage) archive.file(bandImage.diskPath, { name: bandImage.archivePath });
  for (const plan of songCovers.values()) {
    if (plan) archive.file(plan.diskPath, { name: plan.archivePath });
  }
  for (const plan of songFilePlans.values()) archive.file(plan.diskPath, { name: plan.archivePath });
  for (const plan of bandFilePlans.values()) archive.file(plan.diskPath, { name: plan.archivePath });

  void archive.finalize();

  return {
    stream: Readable.toWeb(output) as ReadableStream<Uint8Array>,
    filename: `${slugifyBandName(band.name)}-backup-${new Date().toISOString().slice(0, 10)}.zip`,
  };
}
