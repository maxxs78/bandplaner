"use server";

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/access";
import { getAbsenceSchema } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type FormState = { error?: string } | undefined;

export async function createAbsenceAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user } = await requireMembership(bandId);
  const t = await getTranslations("validation");

  const parsed = getAbsenceSchema(t).safeParse({
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }

  await prisma.absence.create({
    data: {
      bandId,
      userId: user.id,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      reason: parsed.data.reason || null,
    },
  });

  revalidatePath(`/bands/${bandId}/availability`);
}

export async function deleteAbsenceAction(bandId: string, absenceId: string) {
  const { user, membership } = await requireMembership(bandId);

  const absence = await prisma.absence.findUnique({ where: { id: absenceId } });
  if (!absence || absence.bandId !== bandId) return;
  if (absence.userId !== user.id && membership.role !== "ADMIN") return;

  await prisma.absence.delete({ where: { id: absenceId } });
  revalidatePath(`/bands/${bandId}/availability`);
}
