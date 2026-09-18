import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireMembership } from "@/lib/access";
import { getEnabledFeatures } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { toGroupMessageView } from "@/lib/chat";

/**
 * Polling-Endpoint fuer den Gruppenchat (siehe ChatThread) - liefert alle
 * Nachrichten nach dem per ?after=<ISO-Timestamp> uebergebenen Cursor.
 */
export async function GET(request: Request, { params }: { params: Promise<{ bandId: string }> }) {
  const { bandId } = await params;
  const { user, membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).chat) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const after = new URL(request.url).searchParams.get("after");
  const afterDate = after ? new Date(after) : null;
  const hasValidAfter = afterDate !== null && !Number.isNaN(afterDate.getTime());

  const messages = await prisma.chatMessage.findMany({
    where: { bandId, ...(hasValidAfter ? { createdAt: { gt: afterDate! } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { author: { select: { name: true } } },
  });

  const t = await getTranslations("chat");
  return NextResponse.json({
    messages: messages.map((m) => toGroupMessageView(m, user.id, t("formerMember"))),
  });
}
