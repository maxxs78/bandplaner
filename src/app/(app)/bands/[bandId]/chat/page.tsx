import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireMembership } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { toGroupMessageView } from "@/lib/chat";
import { Avatar } from "@/components/avatar";
import { ChatThread } from "./chat-thread";
import { sendGroupMessageAction } from "./actions";

const MESSAGE_PAGE_SIZE = 100;

export default async function ChatPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  const { user, membership } = await requireMembership(bandId);
  const features = getEnabledFeatures(membership.band);
  if (!features.chat) redirect(`/bands/${bandId}`);

  const t = await getTranslations("chat");

  const [recentMessages, otherMembers] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { bandId },
      orderBy: { createdAt: "desc" },
      take: MESSAGE_PAGE_SIZE,
      include: { author: { select: { name: true } } },
    }),
    prisma.membership.findMany({
      where: { bandId, userId: { not: user.id } },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.chatReadMarker.upsert({
      where: { bandId_userId: { bandId, userId: user.id } },
      create: { bandId, userId: user.id, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    }),
  ]);

  const messages = recentMessages
    .slice()
    .reverse()
    .map((m) => toGroupMessageView(m, user.id, t("formerMember")));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("groupChat")}</h1>
        <div className="mt-4">
          <ChatThread
            pollUrl={`/api/bands/${bandId}/chat/messages`}
            initialMessages={messages}
            sendAction={sendGroupMessageAction.bind(null, bandId)}
            placeholder={t("composerPlaceholder")}
            emptyLabel={t("emptyGroupChat")}
          />
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{t("directMessages")}</h2>
        <p className="mt-1 text-xs text-muted">{t("directMessagesHint")}</p>
        <div className="mt-3 space-y-2">
          {otherMembers.length === 0 && (
            <p className="text-sm text-muted">{t("noOtherMembers")}</p>
          )}
          {otherMembers.map((m) => (
            <Link
              key={m.user.id}
              href={`/bands/${bandId}/chat/${m.user.id}`}
              className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm transition hover:border-primary"
            >
              <Avatar src={m.user.avatarUrl} name={m.user.name} size="sm" />
              <span className="font-medium text-foreground">{m.user.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
