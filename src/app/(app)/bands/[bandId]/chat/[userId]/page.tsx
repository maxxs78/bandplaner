import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireMembership } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { toDirectMessageView } from "@/lib/chat";
import { Avatar } from "@/components/avatar";
import { ChatThread } from "../chat-thread";
import { sendDirectMessageAction } from "../actions";

const MESSAGE_PAGE_SIZE = 100;

export default async function DirectMessagePage({
  params,
}: {
  params: Promise<{ bandId: string; userId: string }>;
}) {
  const { bandId, userId } = await params;
  const { user, membership } = await requireMembership(bandId);
  const features = getEnabledFeatures(membership.band);
  if (!features.chat) redirect(`/bands/${bandId}`);
  if (userId === user.id) redirect(`/bands/${bandId}/chat`);

  const otherMembership = await prisma.membership.findUnique({
    where: { userId_bandId: { userId, bandId } },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  if (!otherMembership) notFound();

  const t = await getTranslations("chat");

  const recentMessages = await prisma.directMessage.findMany({
    where: {
      bandId,
      OR: [
        { senderId: user.id, recipientId: userId },
        { senderId: userId, recipientId: user.id },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: MESSAGE_PAGE_SIZE,
  });

  await prisma.directMessage.updateMany({
    where: { bandId, senderId: userId, recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  const messages = recentMessages
    .slice()
    .reverse()
    .map((m) => toDirectMessageView(m, user.id, otherMembership.user.name));

  return (
    <div>
      <Link
        href={`/bands/${bandId}/chat`}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("groupChat")}
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <Avatar src={otherMembership.user.avatarUrl} name={otherMembership.user.name} size="sm" />
        <h1 className="text-xl font-semibold text-foreground">{otherMembership.user.name}</h1>
      </div>
      <div className="mt-4">
        <ChatThread
          pollUrl={`/api/bands/${bandId}/chat/dm/${userId}`}
          initialMessages={messages}
          sendAction={sendDirectMessageAction.bind(null, bandId, userId)}
          placeholder={t("composerPlaceholder")}
          emptyLabel={t("emptyDirectMessages")}
        />
      </div>
    </div>
  );
}
