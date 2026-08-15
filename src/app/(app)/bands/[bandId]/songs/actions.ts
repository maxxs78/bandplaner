"use server";

import { prisma } from "@/lib/prisma";
import { requireMembership, canManageBand, canManageContent } from "@/lib/access";
import { songSchema, songLinkSchema, songVoteSchema } from "@/lib/validation";
import { serializeCues, type Cue } from "@/lib/setlist-cues";
import type { AnnotationValues } from "@/components/cue-annotation-editor";
import { saveSongFile, deleteStoredFile } from "@/lib/uploads";
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

function parseSongForm(formData: FormData) {
  const minutes = Number(formData.get("durationMin") || 0);
  const seconds = Number(formData.get("durationSecPart") || 0);
  const totalSec = minutes * 60 + seconds;

  return songSchema.safeParse({
    title: formData.get("title"),
    key: formData.get("key") || undefined,
    bpm: formData.get("bpm") || "",
    timeSignature: formData.get("timeSignature") || undefined,
    durationSec: totalSec > 0 ? totalSec : "",
    genre: formData.get("genre") || undefined,
    artist: formData.get("artist") || undefined,
    status: formData.get("status"),
    lyrics: formData.get("lyrics") || undefined,
    remarks: formData.get("remarks") || undefined,
  });
}

export async function createSongAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) {
    return { error: "Gäste können keine Songs anlegen" };
  }
  const isAdmin = canManageBand(membership.role);

  const parsed = parseSongForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
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
      status: isAdmin ? (d.status as SongStatus) : "PROPOSED",
      lyrics: d.lyrics || null,
      remarks: d.remarks || null,
      proposedById: user.id,
    },
  });

  revalidatePath(`/bands/${bandId}/songs`);
  redirect(`/bands/${bandId}/songs/${song.id}`);
}

export async function updateSongAction(
  bandId: string,
  songId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) {
    return { error: "Gäste können Songs nicht bearbeiten" };
  }
  const isAdmin = canManageBand(membership.role);

  const parsed = parseSongForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }
  const d = parsed.data;

  const existing = await prisma.song.findUnique({
    where: { id: songId, bandId },
    select: { status: true },
  });
  if (!existing) return { error: "Song nicht gefunden" };

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
      status,
      // "Abgelehnt"-Markierung nur relevant, solange der Song archiviert bleibt
      rejected: status === "ARCHIVED" ? undefined : false,
      lyrics: d.lyrics || null,
      remarks: d.remarks || null,
    },
  });

  revalidatePath(`/bands/${bandId}/songs`);
  redirect(`/bands/${bandId}/songs/${songId}`);
}

export async function deleteSongAction(bandId: string, songId: string) {
  const { membership } = await requireMembership(bandId);
  // Nur Admins dürfen Songs final löschen.
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
  if (!canManageContent(membership.role)) {
    return { error: "Gäste können keine Dateien hochladen" };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { error: "Bitte eine Datei auswählen" };
  }
  const visibility = formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "BAND";

  const result = await saveSongFile(file);
  if ("error" in result) return { error: result.error };

  await prisma.songFile.create({
    data: {
      songId,
      uploadedById: user.id,
      filename: result.filename,
      storageKey: result.storageKey,
      mimeType: result.mimeType,
      size: result.size,
      visibility,
    },
  });

  revalidatePath(`/bands/${bandId}/songs/${songId}`);
  return undefined;
}

export async function deleteSongFileAction(bandId: string, songId: string, fileId: string) {
  const { user, membership } = await requireMembership(bandId);

  const file = await prisma.songFile.findUnique({ where: { id: fileId } });
  if (!file || file.songId !== songId) return;

  const isAdmin = canManageBand(membership.role);
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
  const { user, membership } = await requireMembership(bandId);

  const filename = data.filename.trim();
  if (!filename) return;
  if (data.visibility !== "PRIVATE" && data.visibility !== "BAND") return;

  const file = await prisma.songFile.findUnique({ where: { id: fileId } });
  if (!file || file.songId !== songId) return;

  const isAdmin = canManageBand(membership.role);
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
  if (!canManageContent(membership.role)) {
    return { error: "Gäste können keine Links hinzufügen" };
  }

  const parsed = songLinkSchema.safeParse({
    url: formData.get("url"),
    label: formData.get("label") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
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
  if (!canManageContent(membership.role)) {
    return { error: "Gäste können nicht abstimmen" };
  }

  const song = await prisma.song.findUnique({
    where: { id: songId, bandId },
    select: { status: true },
  });
  if (!song) return { error: "Song nicht gefunden" };
  if (song.status !== "PROPOSED") {
    return { error: "Über diesen Song kann nicht mehr abgestimmt werden" };
  }

  const parsed = songVoteSchema.safeParse({
    vote: formData.get("vote"),
    comment: formData.get("comment") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
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
  const { membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) return;

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
