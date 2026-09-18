"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/access";
import { getEnabledFeatures } from "@/lib/features";

export type FormState = { error?: string } | undefined;

const MAX_MESSAGE_LENGTH = 2000;

export async function sendGroupMessageAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, membership } = await requireMembership(bandId);
  const t = await getTranslations("chat");
  if (!getEnabledFeatures(membership.band).chat) {
    return { error: t("featureDisabled") };
  }

  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: t("emptyMessage") };
  if (content.length > MAX_MESSAGE_LENGTH) return { error: t("messageTooLong") };

  await prisma.chatMessage.create({ data: { bandId, authorId: user.id, content } });
  await prisma.chatReadMarker.upsert({
    where: { bandId_userId: { bandId, userId: user.id } },
    create: { bandId, userId: user.id, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });

  revalidatePath(`/bands/${bandId}/chat`);
  return undefined;
}

export async function sendDirectMessageAction(
  bandId: string,
  recipientId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, membership } = await requireMembership(bandId);
  const t = await getTranslations("chat");
  if (!getEnabledFeatures(membership.band).chat) {
    return { error: t("featureDisabled") };
  }
  if (recipientId === user.id) {
    return { error: t("cannotMessageSelf") };
  }

  const recipientMembership = await prisma.membership.findUnique({
    where: { userId_bandId: { userId: recipientId, bandId } },
    select: { userId: true },
  });
  if (!recipientMembership) {
    return { error: t("recipientNotAMember") };
  }

  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: t("emptyMessage") };
  if (content.length > MAX_MESSAGE_LENGTH) return { error: t("messageTooLong") };

  await prisma.directMessage.create({ data: { bandId, senderId: user.id, recipientId, content } });

  revalidatePath(`/bands/${bandId}/chat/${recipientId}`);
  return undefined;
}
