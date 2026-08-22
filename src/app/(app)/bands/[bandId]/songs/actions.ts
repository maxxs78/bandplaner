"use server";

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireMembership, canManageBand, canManageBandContent, canManageContent } from "@/lib/access";
import { getSongSchema, getSongLinkSchema, getSongVoteSchema } from "@/lib/validation";
import { notifyBand } from "@/lib/notifications";
import { serializeCues, type Cue } from "@/lib/setlist-cues";
import type { AnnotationValues } from "@/components/cue-annotation-editor";
import { saveSongFile, deleteStoredFile, extractEmbeddedCover, storeRemoteImage } from "@/lib/uploads";
import { previewAudioMetadata, previewStoredAudioMetadata, type AudioMetadataPreview } from "@/lib/audio-metadata";
import { isPlayableAudio } from "@/lib/media";
import {
  searchMusicBrainzCandidates,
  searchDiscogsGenre,
  searchSpotifyLink,
  getCoverArt,
  fetchRemoteCoverBytes,
  hasRefreshableSongGaps,
  type SongMetadataCandidate,
} from "@/lib/song-metadata-lookup";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SongStatus, FileVisibility } from "@/generated/prisma/client";

export type FormState = { error?: string } | undefined;

async function upsertOrPruneSongNote(
  songId: string,
  userId: string,
  patch: Partial<{ content: string; shortNote: string | null; color: string | null; cues: string | null }>
) {
  const existing = await prisma.songNote.findUnique({
    where: { songId_userId: { songId, userId } },
  });
  const merged = {
    content: patch.content ?? existing?.content ?? "",
    shortNote: patch.shortNote !== undefined ? patch.shortNote : (existing?.shortNote ?? null),
    color: patch.color !== undefined ? patch.color : (existing?.color ?? null),
    cues: patch.cues !== undefined ? patch.cues : (existing?.cues ?? null),
  };
  const isEmpty = !merged.content.trim() && !merged.shortNote && !merged.color && !merged.cues;

  if (isEmpty) {
    if (existing) await prisma.songNote.delete({ where: { id: existing.id } });
    return;
  }

  await prisma.songNote.upsert({
    where: { songId_userId: { songId, userId } },
    create: { songId, userId, ...merged },
    update: merged,
  });
}

async function parseSongForm(formData: FormData) {
  const minutes = Number(formData.get("durationMin") || 0);
  const seconds = Number(formData.get("durationSecPart") || 0);
  const totalSec = minutes * 60 + seconds;
  const t = await getTranslations("validation");

  return getSongSchema(t).safeParse({
    title: formData.get("title"),
    key: formData.get("key") || undefined,
    bpm: formData.get("bpm") || "",
    timeSignature: formData.get("timeSignature") || undefined,
    durationSec: totalSec > 0 ? totalSec : "",
    genre: formData.get("genre") || undefined,
    artist: formData.get("artist") || undefined,
    album: formData.get("album") || undefined,
    releaseYear: formData.get("releaseYear") || "",
    status: formData.get("status"),
    lyrics: formData.get("lyrics") || undefined,
    remarks: formData.get("remarks") || undefined,
  });
}

/**
 * Speichert eine Song-Datei und übernimmt bei noch fehlendem Cover das darin
 * eingebettete Bild - gemeinsame Logik für den nachträglichen Datei-Upload auf
 * der Song-Detailseite (uploadSongFileAction) und den optionalen Datei-Anhang
 * beim Anlegen eines Songs (createSongAction), statt sie zu duplizieren.
 */
async function saveSongFileWithCoverFallback(
  songId: string,
  userId: string,
  file: File,
  visibility: FileVisibility
): Promise<{ error: string } | { storageKey: string }> {
  const result = await saveSongFile(file);
  if ("error" in result) return result;

  await prisma.songFile.create({
    data: {
      songId,
      uploadedById: userId,
      filename: result.filename,
      storageKey: result.storageKey,
      mimeType: result.mimeType,
      size: result.size,
      visibility,
    },
  });

  const song = await prisma.song.findUnique({ where: { id: songId }, select: { coverUrl: true } });
  if (song && !song.coverUrl) {
    const coverUrl = await extractEmbeddedCover(result.storageKey);
    if (coverUrl) {
      await prisma.song.update({ where: { id: songId }, data: { coverUrl } });
    }
  }

  return { storageKey: result.storageKey };
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mimeType: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], bytes: new Uint8Array(Buffer.from(match[2], "base64")) };
}

export async function createSongAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);
  const t = await getTranslations("songs.actions");
  if (!canManageContent(membership.role)) {
    return { error: t("guestsCannotCreate") };
  }
  const isAdmin = canManageBandContent(membership.role, isFinanceAdmin);

  const parsed = await parseSongForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }
  const d = parsed.data;

  // Nicht-Admins reichen Songs nur als Vorschlag ein - serverseitig erzwungen,
  // unabhängig davon, was im (für sie ausgeblendeten) Status-Feld übermittelt wurde.
  const song = await prisma.song.create({
    data: {
      bandId,
      title: d.title,
      key: d.key || null,
      bpm: d.bpm === "" ? null : d.bpm,
      timeSignature: d.timeSignature || null,
      durationSec: d.durationSec === "" ? null : d.durationSec,
      genre: d.genre || null,
      artist: d.artist || null,
      album: d.album || null,
      releaseYear: d.releaseYear === "" ? null : d.releaseYear,
      status: isAdmin ? (d.status as SongStatus) : "PROPOSED",
      lyrics: d.lyrics || null,
      remarks: d.remarks || null,
      proposedById: user.id,
    },
  });

  // Online-Recherche-Cover hat Priorität vor einem ID3-Cover aus der unten
  // angehängten Datei, aber nur falls noch kein Cover gesetzt ist - beide
  // Wege prüfen das jeweils frisch aus der DB, überschreiben also nie.
  const pendingCoverDataUrl = formData.get("pendingCoverDataUrl") as string | null;
  if (pendingCoverDataUrl) {
    const decoded = decodeDataUrl(pendingCoverDataUrl);
    if (decoded) {
      const stored = await storeRemoteImage(decoded.bytes, decoded.mimeType, "songs");
      if (!("error" in stored)) {
        await prisma.song.update({ where: { id: song.id }, data: { coverUrl: stored.url } });
      }
    }
  }

  const attachedFile = formData.get("file") as File | null;
  if (attachedFile && attachedFile.size > 0) {
    // Fehler beim Speichern der angehängten Datei dürfen die bereits erfolgte
    // Song-Anlage nicht rückgängig machen - rein additiver Bonus, still übersprungen.
    const result = await saveSongFileWithCoverFallback(song.id, user.id, attachedFile, "BAND");
    if ("error" in result) {
      console.error("[songs] Angehängte Datei konnte nicht gespeichert werden:", result.error);
    }
  }

  const pendingLinksRaw = formData.get("pendingLinks") as string | null;
  if (pendingLinksRaw) {
    try {
      const links = JSON.parse(pendingLinksRaw) as { url: string; label?: string }[];
      const validLinks = Array.isArray(links)
        ? links.filter((l) => typeof l.url === "string" && l.url.trim())
        : [];
      if (validLinks.length > 0) {
        await prisma.songLink.createMany({
          data: validLinks.map((l) => ({
            songId: song.id,
            url: l.url.trim(),
            label: l.label?.trim() || null,
          })),
        });
      }
    } catch {
      // Ungültiges JSON ignorieren - Song-Anlage darf dadurch nicht scheitern.
    }
  }

  if (song.status === "PROPOSED") {
    await notifyBand({
      bandId,
      event: "SONG_PROPOSAL",
      excludeUserId: user.id,
      namespace: "songs.actions",
      buildMessage: (t) => ({
        subject: t("proposalSubject", { title: song.title }),
        body: t("proposalBody", {
          name: user.name ?? "",
          title: song.title,
          artistSuffix: song.artist ? ` (${song.artist})` : "",
        }),
      }),
      path: `/bands/${bandId}/songs/${song.id}`,
    });
  }

  revalidatePath(`/bands/${bandId}/songs`);
  redirect(`/bands/${bandId}/songs/${song.id}`);
}

export async function updateSongAction(
  bandId: string,
  songId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);
  const t = await getTranslations("songs.actions");
  if (!canManageContent(membership.role)) {
    return { error: t("guestsCannotEdit") };
  }
  const isAdmin = canManageBandContent(membership.role, isFinanceAdmin);

  const parsed = await parseSongForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }
  const d = parsed.data;

  const existing = await prisma.song.findUnique({
    where: { id: songId, bandId },
    select: { status: true, coverUrl: true },
  });
  if (!existing) return { error: t("songNotFound") };

  // Nur Admins dürfen den Status ändern (u. a. damit Abstimmungen über Vorschläge
  // nicht durch einfaches Bearbeiten umgangen werden können).
  const status = isAdmin ? (d.status as SongStatus) : existing.status;

  await prisma.song.update({
    where: { id: songId, bandId },
    data: {
      title: d.title,
      key: d.key || null,
      bpm: d.bpm === "" ? null : d.bpm,
      timeSignature: d.timeSignature || null,
      durationSec: d.durationSec === "" ? null : d.durationSec,
      genre: d.genre || null,
      artist: d.artist || null,
      album: d.album || null,
      releaseYear: d.releaseYear === "" ? null : d.releaseYear,
      status,
      // "Abgelehnt"-Markierung nur relevant, solange der Song archiviert bleibt
      rejected: status === "ARCHIVED" ? undefined : false,
      lyrics: d.lyrics || null,
      remarks: d.remarks || null,
    },
  });

  // Anlageassistent (Online-Recherche-Cover, angehängte Datei, Vorschlags-Links):
  // gleiche Logik wie beim Neuanlegen (createSongAction), nur zusätzlich mit
  // Schutz gegen Überschreiben eines bereits vorhandenen Covers, da hier - anders
  // als beim Neuanlegen - schon eines gesetzt sein kann.
  const pendingCoverDataUrl = formData.get("pendingCoverDataUrl") as string | null;
  if (pendingCoverDataUrl && !existing.coverUrl) {
    const decoded = decodeDataUrl(pendingCoverDataUrl);
    if (decoded) {
      const stored = await storeRemoteImage(decoded.bytes, decoded.mimeType, "songs");
      if (!("error" in stored)) {
        await prisma.song.update({ where: { id: songId }, data: { coverUrl: stored.url } });
      }
    }
  }

  const attachedFile = formData.get("file") as File | null;
  if (attachedFile && attachedFile.size > 0) {
    // Fehler beim Speichern der angehängten Datei dürfen die übrige Bearbeitung
    // nicht rückgängig machen - rein additiver Bonus, still übersprungen.
    const result = await saveSongFileWithCoverFallback(songId, user.id, attachedFile, "BAND");
    if ("error" in result) {
      console.error("[songs] Angehängte Datei konnte nicht gespeichert werden:", result.error);
    }
  }

  const pendingLinksRaw = formData.get("pendingLinks") as string | null;
  if (pendingLinksRaw) {
    try {
      const links = JSON.parse(pendingLinksRaw) as { url: string; label?: string }[];
      const validLinks = Array.isArray(links)
        ? links.filter((l) => typeof l.url === "string" && l.url.trim())
        : [];
      if (validLinks.length > 0) {
        await prisma.songLink.createMany({
          data: validLinks.map((l) => ({
            songId,
            url: l.url.trim(),
            label: l.label?.trim() || null,
          })),
        });
      }
    } catch {
      // Ungültiges JSON ignorieren - Bearbeitung darf dadurch nicht scheitern.
    }
  }

  revalidatePath(`/bands/${bandId}/songs`);
  redirect(`/bands/${bandId}/songs/${songId}`);
}

export async function deleteSongAction(bandId: string, songId: string) {
  const { membership } = await requireMembership(bandId);
  // Nur echte Admins dürfen Songs final löschen - bewusst nicht auf Finanzadmins
  // erweitert, da das endgültige Löschen die einschneidendste dieser Aktionen ist.
  if (!canManageBand(membership.role)) return;

  const song = await prisma.song.findUnique({ where: { id: songId, bandId }, select: { title: true, status: true } });
  if (!song) return;
  // Songs müssen im Status "Vorschlag" oder "Archiviert" stehen, bevor sie gelöscht werden dürfen.
  if (song.status !== "PROPOSED" && song.status !== "ARCHIVED") return;

  // Vor dem Löschen den Songtitel als Fallback in betroffene Setlist-Einträge übernehmen,
  // damit vergangene Setlists den Song weiterhin (als grau markierten Custom-Eintrag) zeigen.
  await prisma.$transaction([
    prisma.setlistItem.updateMany({
      where: { songId },
      data: { customTitle: song.title, songDeleted: true },
    }),
    prisma.song.delete({ where: { id: songId, bandId } }),
  ]);

  revalidatePath(`/bands/${bandId}/songs`);
  redirect(`/bands/${bandId}/songs`);
}

export async function saveNoteAction(bandId: string, songId: string, formData: FormData) {
  const { user } = await requireMembership(bandId);
  const content = (formData.get("content") as string) ?? "";

  await upsertOrPruneSongNote(songId, user.id, { content });
  revalidatePath(`/bands/${bandId}/songs/${songId}`);
}

export async function saveSongCueAction(
  bandId: string,
  songId: string,
  data: AnnotationValues
): Promise<{ error?: string } | undefined> {
  const { user } = await requireMembership(bandId);

  await upsertOrPruneSongNote(songId, user.id, {
    shortNote: data.note.trim() || null,
    color: data.color,
    cues: serializeCues(data.cues as Cue[]),
  });

  revalidatePath(`/bands/${bandId}/songs/${songId}`);
  return undefined;
}

export async function uploadSongFileAction(
  bandId: string,
  songId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, membership } = await requireMembership(bandId);
  const t = await getTranslations("songs.actions");
  if (!canManageContent(membership.role)) {
    return { error: t("guestsCannotUpload") };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { error: t("selectFile") };
  }
  const visibility = formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "BAND";

  const result = await saveSongFileWithCoverFallback(songId, user.id, file, visibility);
  if ("error" in result) return { error: result.error };

  revalidatePath(`/bands/${bandId}/songs/${songId}`);
  return undefined;
}

export async function deleteSongFileAction(bandId: string, songId: string, fileId: string) {
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);

  const file = await prisma.songFile.findUnique({ where: { id: fileId } });
  if (!file || file.songId !== songId) return;

  const isAdmin = canManageBandContent(membership.role, isFinanceAdmin);
  if (!isAdmin && file.uploadedById !== user.id) return;

  await prisma.songFile.delete({ where: { id: fileId } });
  await deleteStoredFile(file.storageKey);
  revalidatePath(`/bands/${bandId}/songs/${songId}`);
  revalidatePath(`/bands/${bandId}/files`);
}

export async function updateSongFileAction(
  bandId: string,
  songId: string,
  fileId: string,
  data: { filename: string; visibility: string }
) {
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);

  const filename = data.filename.trim();
  if (!filename) return;
  if (data.visibility !== "PRIVATE" && data.visibility !== "BAND") return;

  const file = await prisma.songFile.findUnique({ where: { id: fileId } });
  if (!file || file.songId !== songId) return;

  const isAdmin = canManageBandContent(membership.role, isFinanceAdmin);
  if (!isAdmin && file.uploadedById !== user.id) return;

  await prisma.songFile.update({
    where: { id: fileId },
    data: { filename, visibility: data.visibility as FileVisibility },
  });
  revalidatePath(`/bands/${bandId}/songs/${songId}`);
  revalidatePath(`/bands/${bandId}/files`);
}

export async function addSongLinkAction(
  bandId: string,
  songId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  const [t, tValidation] = await Promise.all([
    getTranslations("songs.actions"),
    getTranslations("validation"),
  ]);
  if (!canManageContent(membership.role)) {
    return { error: t("guestsCannotAddLinks") };
  }

  const parsed = getSongLinkSchema(tValidation).safeParse({
    url: formData.get("url"),
    label: formData.get("label") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }

  await prisma.songLink.create({
    data: {
      songId,
      url: parsed.data.url,
      label: parsed.data.label || null,
    },
  });

  revalidatePath(`/bands/${bandId}/songs/${songId}`);
  return undefined;
}

export async function deleteSongLinkAction(bandId: string, songId: string, linkId: string) {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return;

  await prisma.songLink.delete({ where: { id: linkId, songId } });
  revalidatePath(`/bands/${bandId}/songs/${songId}`);
}

/** Übernimmt eine im Übungsmodus erkannte Tonart in die Songdaten (nach Bestätigung durch die Person). */
export async function updateSongKeyAction(
  bandId: string,
  songId: string,
  key: string
): Promise<{ error?: string } | undefined> {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) {
    const t = await getTranslations("songs.actions");
    return { error: t("guestsCannotChangeKey") };
  }

  await prisma.song.update({ where: { id: songId, bandId }, data: { key } });
  revalidatePath(`/bands/${bandId}/songs/${songId}`);
  return undefined;
}

/** Übernimmt ein im Übungsmodus erkanntes Grundtempo in die Songdaten (nach Bestätigung durch die Person). */
export async function updateSongBpmAction(
  bandId: string,
  songId: string,
  bpm: number
): Promise<{ error?: string } | undefined> {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) {
    const t = await getTranslations("songs.actions");
    return { error: t("guestsCannotChangeBpm") };
  }

  await prisma.song.update({ where: { id: songId, bandId }, data: { bpm } });
  revalidatePath(`/bands/${bandId}/songs/${songId}`);
  return undefined;
}

/**
 * Wertet die Stimmen zu einem Vorschlag aus, sobald alle stimmberechtigten Mitglieder
 * (alle Rollen außer Gast) abgestimmt haben: einstimmig dafür -> "Neu", einstimmig
 * dagegen -> "Archiviert" (als abgelehnt markiert). Bei Uneinigkeit bleibt der Song
 * als Vorschlag stehen, bis ein Admin manuell entscheidet.
 */
async function tallyProposalVotes(bandId: string, songId: string) {
  const song = await prisma.song.findUnique({ where: { id: songId }, select: { status: true } });
  if (!song || song.status !== "PROPOSED") return;

  const [eligibleCount, votes] = await Promise.all([
    prisma.membership.count({ where: { bandId, role: { not: "GUEST" } } }),
    prisma.songVote.findMany({ where: { songId }, select: { vote: true } }),
  ]);

  if (votes.length === 0 || votes.length < eligibleCount) return;

  const allUp = votes.every((v) => v.vote === "UP");
  const allDown = votes.every((v) => v.vote === "DOWN");

  if (allUp) {
    await prisma.song.update({ where: { id: songId }, data: { status: "NEW" } });
  } else if (allDown) {
    await prisma.song.update({
      where: { id: songId },
      data: { status: "ARCHIVED", rejected: true },
    });
  }
}

export async function voteSongAction(
  bandId: string,
  songId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, membership } = await requireMembership(bandId);
  const [t, tValidation] = await Promise.all([
    getTranslations("songs.actions"),
    getTranslations("validation"),
  ]);
  if (!canManageContent(membership.role)) {
    return { error: t("guestsCannotVote") };
  }

  const song = await prisma.song.findUnique({
    where: { id: songId, bandId },
    select: { status: true },
  });
  if (!song) return { error: t("songNotFound") };
  if (song.status !== "PROPOSED") {
    return { error: t("votingClosed") };
  }

  const parsed = getSongVoteSchema(tValidation).safeParse({
    vote: formData.get("vote"),
    comment: formData.get("comment") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }

  await prisma.songVote.upsert({
    where: { songId_userId: { songId, userId: user.id } },
    create: {
      songId,
      userId: user.id,
      vote: parsed.data.vote,
      comment: parsed.data.comment || null,
    },
    update: { vote: parsed.data.vote, comment: parsed.data.comment || null },
  });

  await tallyProposalVotes(bandId, songId);

  revalidatePath(`/bands/${bandId}/songs/${songId}`);
  revalidatePath(`/bands/${bandId}/songs`);
  return undefined;
}

export async function adminDecideProposalAction(
  bandId: string,
  songId: string,
  decision: "APPROVE" | "REJECT"
) {
  const { membership, isFinanceAdmin } = await requireMembership(bandId);
  if (!canManageBandContent(membership.role, isFinanceAdmin)) return;

  const song = await prisma.song.findUnique({
    where: { id: songId, bandId },
    select: { status: true },
  });
  if (!song || song.status !== "PROPOSED") return;

  await prisma.song.update({
    where: { id: songId },
    data:
      decision === "APPROVE" ? { status: "NEW" } : { status: "ARCHIVED", rejected: true },
  });

  revalidatePath(`/bands/${bandId}/songs/${songId}`);
  revalidatePath(`/bands/${bandId}/songs`);
}

/**
 * Liest ID3/Vorbis-Tags einer gerade ausgewählten (noch nicht hochgeladenen)
 * Datei rein zur Formular-Vorschau aus - keine Datenbank-Schreibaktion, siehe
 * previewAudioMetadata() in audio-metadata.ts.
 */
export async function previewAudioMetadataAction(
  bandId: string,
  formData: FormData
): Promise<AudioMetadataPreview | null> {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return null;

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return null;

  return previewAudioMetadata(file);
}

export type SongMetadataSearchResult = {
  candidates: SongMetadataCandidate[];
  spotifyUrl?: string;
};

/**
 * Kombiniert MusicBrainz (primäre Quelle), Discogs (Fallback für Genre/Cover,
 * falls MusicBrainz nichts liefert) und Spotify (nur der Track-Link) zu einer
 * Kandidatenliste fürs UI. Alle drei Quellen sind einzeln optional
 * konfiguriert und degradieren still, siehe song-metadata-lookup.ts.
 */
export async function searchSongMetadataAction(
  bandId: string,
  title: string,
  artist?: string
): Promise<SongMetadataSearchResult> {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role) || !title.trim()) return { candidates: [] };

  const [mbCandidates, spotifyUrl] = await Promise.all([
    searchMusicBrainzCandidates(title, artist),
    searchSpotifyLink(title, artist),
  ]);

  let candidates = mbCandidates;
  if (candidates.length === 0) {
    const discogsResult = await searchDiscogsGenre(title, artist);
    if (discogsResult) {
      candidates = [
        {
          title,
          artist,
          genre: discogsResult.genre,
          year: discogsResult.year,
          mbid: "discogs-fallback",
          coverImageUrl: discogsResult.coverImageUrl,
        },
      ];
    }
  }

  return { candidates, spotifyUrl: spotifyUrl ?? undefined };
}

/**
 * Läd das Cover eines ausgewählten Kandidaten erst bei tatsächlicher Auswahl
 * nach (nicht schon für alle Treffer der Liste), um unnötige Bild-Downloads
 * zu vermeiden. Rückgabe als data:-URL für die sofortige Vorschau sowie zur
 * Zwischenspeicherung im Formular bis zum Absenden (siehe createSongAction).
 */
export async function fetchCandidateCoverAction(
  bandId: string,
  candidate: { releaseMbid?: string; coverImageUrl?: string; title: string; artist?: string }
): Promise<{ dataUrl: string } | null> {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return null;

  let result = candidate.releaseMbid
    ? await getCoverArt(candidate.releaseMbid)
    : candidate.coverImageUrl
      ? await fetchRemoteCoverBytes(candidate.coverImageUrl)
      : null;

  // Cover Art Archive deckt bei weitem nicht jedes MusicBrainz-Release ab (kein
  // Cover ist dort der Normalfall, kein Fehler) - ohne diesen Fallback bliebe
  // ein MusicBrainz-Treffer mit Metadaten, aber ohne Cover, obwohl Discogs
  // eines haette liefern koennen. Nur relevant, wenn die Metadatensuche schon
  // ueber MusicBrainz lief (sonst kam candidate.coverImageUrl bereits von Discogs).
  if (!result && candidate.releaseMbid) {
    const discogsResult = await searchDiscogsGenre(candidate.title, candidate.artist);
    if (discogsResult?.coverImageUrl) {
      result = await fetchRemoteCoverBytes(discogsResult.coverImageUrl);
    }
  }

  if (!result) return null;

  return { dataUrl: `data:${result.mimeType};base64,${Buffer.from(result.bytes).toString("base64")}` };
}

/**
 * Manuelles Nachladen von Cover und fehlenden Metadaten (Interpret, Album,
 * Genre, Jahr, Tempo, Dauer) fuer bereits bestehende Songs - deckt zwei Faelle
 * ab, die der Anlageassistent beim Neuanlegen automatisch abdeckt, beim
 * Bearbeiten eines Songs mit bereits verknuepfter Datei aber nicht von selbst
 * passiert: Songs, die vor Einfuehrung dieses Features angelegt wurden, sowie
 * Faelle, in denen die automatische Suche beim Anlegen schlicht nichts fand.
 * Primärquelle sind eingebettete ID3-Tags einer bereits verknuepften
 * Audiodatei (kein Netzwerkzugriff noetig); nur was danach noch fehlt, wird
 * per Online-Recherche (MusicBrainz, bei fehlendem Cover-Art-Archive-Treffer
 * Discogs als Fallback) ergaenzt. Ueberschreibt nie einen bereits vorhandenen
 * Wert - wer einen anderen moechte, aendert ihn manuell ueber "Bearbeiten".
 */
export async function refreshSongMetadataAction(
  bandId: string,
  songId: string
): Promise<{ found: boolean }> {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return { found: false };

  const song = await prisma.song.findUnique({
    where: { id: songId, bandId },
    select: {
      title: true,
      artist: true,
      album: true,
      genre: true,
      releaseYear: true,
      bpm: true,
      durationSec: true,
      coverUrl: true,
      files: {
        orderBy: { createdAt: "desc" },
        select: { storageKey: true, filename: true, mimeType: true },
      },
    },
  });
  if (!song || !hasRefreshableSongGaps(song)) return { found: false };

  const patch: {
    artist?: string;
    album?: string;
    genre?: string;
    releaseYear?: number;
    bpm?: number;
    durationSec?: number;
    coverUrl?: string;
  } = {};

  // 1. Guenstigster Weg zuerst: Tags/eingebettetes Cover einer bereits
  // hochgeladenen Audiodatei, ganz ohne Netzwerkzugriff.
  const audioFile = song.files.find((f) => isPlayableAudio(f.filename, f.mimeType));
  if (audioFile) {
    const id3 = await previewStoredAudioMetadata(audioFile.storageKey);
    if (id3) {
      if (!song.artist && id3.artist) patch.artist = id3.artist;
      if (!song.album && id3.album) patch.album = id3.album;
      if (!song.genre && id3.genre) patch.genre = id3.genre;
      if (!song.releaseYear && id3.year) patch.releaseYear = id3.year;
      if (!song.bpm && id3.bpm) patch.bpm = id3.bpm;
      if (!song.durationSec && id3.durationSec) patch.durationSec = id3.durationSec;
    }
    if (!song.coverUrl) {
      const coverUrl = await extractEmbeddedCover(audioFile.storageKey);
      if (coverUrl) patch.coverUrl = coverUrl;
    }
  }

  // 2. Online-Recherche wie beim Anlageassistenten fuer alles, was per ID3
  // nicht zu ermitteln war: MusicBrainz zuerst, Discogs als Fallback fuer
  // Genre/Jahr sowie fuer das Cover, falls Cover Art Archive nichts liefert.
  const stillMissingCover = !song.coverUrl && !patch.coverUrl;
  const stillMissingGenreOrYear = (!song.genre && !patch.genre) || (!song.releaseYear && !patch.releaseYear);
  if (stillMissingCover || stillMissingGenreOrYear) {
    const effectiveArtist = patch.artist ?? song.artist ?? undefined;
    const candidates = await searchMusicBrainzCandidates(song.title, effectiveArtist);
    const primary = candidates[0];
    if (!song.genre && !patch.genre && primary?.genre) patch.genre = primary.genre;
    if (!song.releaseYear && !patch.releaseYear && primary?.year) patch.releaseYear = primary.year;
    if (!song.album && !patch.album && primary?.album) patch.album = primary.album;

    if (stillMissingCover) {
      const withRelease = candidates.find((c) => c.releaseMbid);
      let bytes = withRelease?.releaseMbid ? await getCoverArt(withRelease.releaseMbid) : null;
      if (!bytes) {
        const discogsResult = await searchDiscogsGenre(song.title, effectiveArtist);
        if (discogsResult) {
          if (!song.genre && !patch.genre && discogsResult.genre) patch.genre = discogsResult.genre;
          if (!song.releaseYear && !patch.releaseYear && discogsResult.year) patch.releaseYear = discogsResult.year;
          if (discogsResult.coverImageUrl) bytes = await fetchRemoteCoverBytes(discogsResult.coverImageUrl);
        }
      }
      if (bytes) {
        const stored = await storeRemoteImage(bytes.bytes, bytes.mimeType, "songs");
        if (!("error" in stored)) patch.coverUrl = stored.url;
      }
    }
  }

  if (Object.keys(patch).length === 0) return { found: false };

  await prisma.song.update({ where: { id: songId }, data: patch });
  revalidatePath(`/bands/${bandId}/songs/${songId}`);
  return { found: true };
}
