"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { redirect } from "next/navigation";

export async function acceptInvitationAction(token: string) {
  const user = await requireUser();

  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return;
  }
  if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
    return;
  }

  await prisma.$transaction([
    prisma.membership.upsert({
      where: { userId_bandId: { userId: user.id, bandId: invitation.bandId } },
      create: {
        userId: user.id,
        bandId: invitation.bandId,
        role: invitation.role,
        guestUntil: invitation.guestUntil,
      },
      update: { role: invitation.role, guestUntil: invitation.guestUntil },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  redirect(`/bands/${invitation.bandId}`);
}
