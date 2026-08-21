"use server";

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/access";
import { getBandCreateSchema } from "@/lib/validation";
import { redirect } from "next/navigation";

export type FormState = { error?: string } | undefined;

export async function createBandAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireActiveUser();
  const t = await getTranslations("validation");

  const parsed = getBandCreateSchema(t).safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }

  const band = await prisma.band.create({
    data: {
      name: parsed.data.name.trim(),
      memberships: {
        create: { userId: user.id, role: "ADMIN" },
      },
    },
  });

  redirect(`/bands/${band.id}`);
}
