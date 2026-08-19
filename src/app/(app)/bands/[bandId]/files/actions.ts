"use server";

import { prisma } from "@/lib/prisma";
import { requireMembership, canManageBandContent, canManageContent } from "@/lib/access";
import { saveBandFile, deleteStoredFile, BAND_STORAGE_QUOTA_BYTES } from "@/lib/uploads";
import { bandFileCategoryLabels } from "@/lib/band-file-categories";
import { equipmentVisibleInBand } from "@/lib/equipment-visibility";
import { notifyBand } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import type { BandFileCategory, BandFileVisibility } from "@/generated/prisma/client";

export type FormState = { error?: string } | undefined;

const CATEGORIES = Object.keys(bandFileCategoryLabels);

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
  const wantsPublic = formData.get("visibility") === "PUBLIC";
  const visibility = wantsPublic && membership.band.publicFileLinksEnabled ? "PUBLIC" : "INTERNAL";

  const eventId = (formData.get("eventId") as string) || null;
  const songId = (formData.get("songId") as string) || null;
  const equipmentId = (formData.get("equipmentId") as string) || null;
  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId, bandId }, select: { id: true } });
    if (!event) return { error: "Ungültiger Termin" };
  }
  if (songId) {
    const song = await prisma.song.findUnique({ where: { id: songId, bandId }, select: { id: true } });
    if (!song) return { error: "Ungültiger Song" };
  }
  if (equipmentId) {
    const equipment = await prisma.equipment.findFirst({
      where: { id: equipmentId, ...equipmentVisibleInBand(bandId) },
      select: { id: true },
    });
    if (!equipment) return { error: "Ungültiges Equipment" };
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
      equipmentId,
    },
  });

  await notifyBand({
    bandId,
    event: "NEW_FILE",
    excludeUserId: user.id,
    subject: `Neue Datei: ${result.filename}`,
    body: `${user.name} hat eine Datei hochgeladen:\n\n${result.filename}`,
    path: `/bands/${bandId}/files`,
  });

  revalidatePath(`/bands/${bandId}/files`);
  return undefined;
}

export async function updateBandFileAction(
  bandId: string,
  fileId: string,
  data: { filename: string; category?: string; visibility: string }
) {
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);

  const filename = data.filename.trim();
  if (!filename) return;
  if (!CATEGORIES.includes(data.category as string)) return;
  if (data.visibility !== "INTERNAL" && data.visibility !== "PUBLIC") return;
  const visibility = data.visibility === "PUBLIC" && membership.band.publicFileLinksEnabled ? "PUBLIC" : "INTERNAL";

  const file = await prisma.bandFile.findUnique({ where: { id: fileId } });
  if (!file || file.bandId !== bandId) return;

  const isAdmin = canManageBandContent(membership.role, isFinanceAdmin);
  if (!isAdmin && file.uploadedById !== user.id) return;

  await prisma.bandFile.update({
    where: { id: fileId },
    data: { filename, category: data.category as BandFileCategory, visibility: visibility as BandFileVisibility },
  });
  revalidatePath(`/bands/${bandId}/files`);
}

export async function deleteBandFileAction(bandId: string, fileId: string) {
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);

  const file = await prisma.bandFile.findUnique({ where: { id: fileId } });
  if (!file || file.bandId !== bandId) return;

  const isAdmin = canManageBandContent(membership.role, isFinanceAdmin);
  if (!isAdmin && file.uploadedById !== user.id) return;

  await prisma.bandFile.delete({ where: { id: fileId } });
  await deleteStoredFile(file.storageKey);
  revalidatePath(`/bands/${bandId}/files`);
}
