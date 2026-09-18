import { NextResponse } from "next/server";
import { requireMembership } from "@/lib/access";
import { getEnabledFeatures } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { toDirectMessageView } from "@/lib/chat";

/**
 * Polling-Endpoint fuer einen DM-Thread (siehe ChatThread) - liefert neue
 * Nachrichten seit ?after=<ISO-Timestamp> und markiert dabei eingetroffene
 * Nachrichten der Gegenseite direkt als gelesen (haelt den Unread-Badge aktuell,
 * waehrend der Thread aktiv geoeffnet ist).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ bandId: string; userId: string }> }
) {
  const { bandId, userId } = await params;
  const { user, membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).chat) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const otherMembership = await prisma.membership.findUnique({
    where: { userId_bandId: { userId, bandId } },
    select: { user: { select: { name: true } } },
  });
  if (!otherMembership) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const after = new URL(request.url).searchParams.get("after");
  const afterDate = after ? new Date(after) : null;
  const hasValidAfter = afterDate !== null && !Number.isNaN(afterDate.getTime());

  const messages = await prisma.directMessage.findMany({
    where: {
      bandId,
      OR: [
        { senderId: user.id, recipientId: userId },
        { senderId: userId, recipientId: user.id },
      ],
      ...(hasValidAfter ? { createdAt: { gt: afterDate! } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  await prisma.directMessage.updateMany({
    where: { bandId, senderId: userId, recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({
    messages: messages.map((m) => toDirectMessageView(m, user.id, otherMembership.user.name)),
  });
}
