import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventLocationLabel } from "@/lib/event-colors";

function toICSDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeText(text: string) {
  return text.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bandId: string }> }
) {
  const { bandId } = await params;
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_bandId: { userId: session.user.id, bandId } },
  });
  if (!membership) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [band, events] = await Promise.all([
    prisma.band.findUnique({ where: { id: bandId } }),
    prisma.event.findMany({
      where: { bandId },
      orderBy: { startsAt: "asc" },
      include: { place: { select: { name: true, address: true } } },
    }),
  ]);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bandplaner//DE",
    `X-WR-CALNAME:${escapeText(band?.name ?? "Bandplaner")}`,
    "CALSCALE:GREGORIAN",
  ];

  for (const event of events) {
    const icsLocation = event.place
      ? [event.place.name, event.place.address].filter(Boolean).join(", ")
      : eventLocationLabel(event);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@bandplaner`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${toICSDate(event.startsAt)}`,
      `DTEND:${toICSDate(event.endsAt)}`,
      `SUMMARY:${escapeText(event.title)}`,
      ...(icsLocation ? [`LOCATION:${escapeText(icsLocation)}`] : []),
      ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="bandplaner-${bandId}.ics"`,
    },
  });
}
