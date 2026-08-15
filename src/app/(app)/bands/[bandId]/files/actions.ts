"use server";

import { prisma } from "@/lib/prisma";
import { requireMembership, canManageBand, canManageContent } from "@/lib/access";
import { saveBandFile, deleteStoredFile, BAND_STORAGE_QUOTA_BYTES } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import type { BandFileCategory } from "@/generated/prisma/client";

export type FormState = { error?: string } | undefined;

const CATEGORIES = ["NOTES", "CONTRACTS", "PHOTOS", "RECORDINGS", "OTHER"];

export async function bandFileStorageUsage(bandId: string) {
  const [bandFiles, songFiles] = await Promise.all([
    prisma.bandFile.aggregate({ where: { bandId }, _sum: { size: true } }),
    prisma.songFile.aggregate({ where: { song: { bandId } }, _sum: { size: true } }),
  ]);
  return (bandFiles._sum.size ?? 0) + (songFiles._sum.size ?? 0);
}

export async function uploadBandFileAction(
  bandId: string,
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

  const used = await bandFileStorageUsage(bandId);
  if (used + file.size > BAND_STORAGE_QUOTA_BYTES) {
    const usedMb = Math.round(used / (1024 * 1024));
    const quotaMb = Math.round(BAND_STORAGE_QUOTA_BYTES / (1024 * 1024));
    return { error: `Speicherkontingent überschritten (${usedMb} von ${quotaMb} MB belegt)` };
  }

  const categoryRaw = formData.get("category");
  const category = (CATEGORIES.includes(categoryRaw as string) ? categoryRaw : "OTHER") as BandFileCategory;
  const visibility = formData.get("visibility") === "PUBLIC" ? "PUBLIC" : "INTERNAL";

  const eventId = (formData.get("eventId") as string) || null;
  const songId = (formData.get("songId") as string) || null;
  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId, bandId }, select: { id: true } });
    if (!event) return { error: "Ungültiger Termin" };
  }
  if (songId) {
    const song = await prisma.song.findUnique({ where: { id: songId, bandId }, select: { id: true } });
    if (!song) return { error: "Ungültiger Song" };
  }

  const result = await saveBandFile(file);
  if ("error" in result) return { error: result.error };

  await prisma.bandFile.create({
    data: {
      bandId,
      uploadedById: user.id,
      filename: result.filename,
      storageKey: result.storageKey,
      mimeType: result.mimeType,
      size: result.size,
      category,
      visibility,
      eventId,
      songId,
    },
  });

  revalidatePath(`/bands/${bandId}/files`);
  return undefined;
}

export async function deleteBandFileAction(bandId: string, fileId: string) {
  const { user, membership } = await requireMembership(bandId);

  const file = await prisma.bandFile.findUnique({ where: { id: fileId } });
  if (!file || file.bandId !== bandId) return;

  const isAdmin = canManageBand(membership.role);
  if (!isAdmin && file.uploadedById !== user.id) return;

  await prisma.bandFile.delete({ where: { id: fileId } });
  await deleteStoredFile(file.storageKey);
  revalidatePath(`/bands/${bandId}/files`);
}
