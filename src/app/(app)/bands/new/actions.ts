"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { bandCreateSchema } from "@/lib/validation";
import { redirect } from "next/navigation";

export type FormState = { error?: string } | undefined;

export async function createBandAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();

  const parsed = bandCreateSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
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
