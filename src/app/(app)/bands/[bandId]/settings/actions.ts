"use server";

import { prisma } from "@/lib/prisma";
import { requireMembership, canManageBand } from "@/lib/access";
import { revalidatePath } from "next/cache";

export type FormState = { error?: string } | undefined;

export async function updateBandFeaturesAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) {
    return { error: "Nur Admins können Funktionen für die Band verwalten" };
  }

  const equipmentEnabled = formData.get("equipmentEnabled") === "on";
  const packlistsEnabled = formData.get("packlistsEnabled") === "on";

  await prisma.band.update({
    where: { id: bandId },
    data: { equipmentEnabled, packlistsEnabled },
  });

  revalidatePath(`/bands/${bandId}`, "layout");
  return undefined;
}

export async function updateBandSettingsAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) {
    return { error: "Nur Admins können Einstellungen für die Band verwalten" };
  }

  const daysRaw = (formData.get("defaultGuestAccessDays") as string)?.trim();
  let defaultGuestAccessDays: number | null = null;
  if (daysRaw) {
    const parsed = Number(daysRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
      return { error: "Gastzugangsdauer muss eine Zahl zwischen 1 und 3650 Tagen sein" };
    }
    defaultGuestAccessDays = parsed;
  }

  const publicFileLinksEnabled = formData.get("publicFileLinksEnabled") === "on";

  await prisma.band.update({
    where: { id: bandId },
    data: { defaultGuestAccessDays, publicFileLinksEnabled },
  });

  revalidatePath(`/bands/${bandId}`, "layout");
  return undefined;
}
