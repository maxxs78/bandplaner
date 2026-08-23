import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * DSGVO-Datenexport (Art. 15/20): liefert alle personenbezogenen Daten der
 * angemeldeten Person als herunterladbare JSON-Datei. Bewusst als eigene
 * Route statt Server Action, da eine Server Action keinen Datei-Download mit
 * Content-Disposition auslösen kann. Enthaelt nur Daten, die zu dieser Person
 * gehoeren (eigene Notizen/Hinweise/Uploads/...) - keine bandweiten Inhalte
 * anderer Mitglieder.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      avatarUrl: true,
      locale: true,
      createdAt: true,
      mustChangePassword: true,
    },
  });
  if (!user) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [
    memberships,
    financeAdminOf,
    createdEvents,
    eventParticipations,
    availabilities,
    absences,
    songNotes,
    songVotes,
    proposedSongs,
    setlistNotes,
    setlistEventNotes,
    setlistItemAnnotations,
    setlistItemEventAnnotations,
    uploadedSongFiles,
    uploadedBandFiles,
    ownedEquipment,
    responsibleForEquipment,
    assignedPacklistItems,
    financeAllocations,
    createdFinanceEntries,
    invitationsSent,
  ] = await Promise.all([
    prisma.membership.findMany({
      where: { userId },
      select: {
        role: true,
        guestUntil: true,
        createdAt: true,
        defaultPayoutAmountCents: true,
        notifyOnNewEvent: true,
        notifyOnEventChange: true,
        notifyOnSongProposal: true,
        notifyOnNewFile: true,
        notifyOnFinanceAllocation: true,
        band: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.bandFinanceAdmin.findMany({
      where: { userId },
      select: { createdAt: true, band: { select: { name: true } } },
    }),
    prisma.event.findMany({
      where: { createdById: userId },
      select: { title: true, type: true, startsAt: true, endsAt: true, location: true, band: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.eventParticipant.findMany({
      where: { userId },
      select: { event: { select: { title: true, startsAt: true, band: { select: { name: true } } } } },
    }),
    prisma.availability.findMany({
      where: { userId },
      select: {
        status: true,
        note: true,
        respondedAt: true,
        event: { select: { title: true, startsAt: true, band: { select: { name: true } } } },
      },
      orderBy: { respondedAt: "asc" },
    }),
    prisma.absence.findMany({
      where: { userId },
      select: { startDate: true, endDate: true, reason: true, createdAt: true, band: { select: { name: true } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.songNote.findMany({
      where: { userId },
      select: {
        content: true,
        shortNote: true,
        color: true,
        cues: true,
        updatedAt: true,
        song: { select: { title: true, band: { select: { name: true } } } },
      },
    }),
    prisma.songVote.findMany({
      where: { userId },
      select: {
        vote: true,
        comment: true,
        createdAt: true,
        song: { select: { title: true, band: { select: { name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.song.findMany({
      where: { proposedById: userId },
      select: { title: true, status: true, createdAt: true, band: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.setlistNote.findMany({
      where: { userId },
      select: { content: true, updatedAt: true, setlist: { select: { name: true, band: { select: { name: true } } } } },
    }),
    prisma.setlistEventNote.findMany({
      where: { userId },
      select: {
        content: true,
        updatedAt: true,
        setlist: { select: { name: true, band: { select: { name: true } } } },
        event: { select: { title: true, startsAt: true } },
      },
    }),
    prisma.setlistItemAnnotation.findMany({
      where: { userId },
      select: {
        note: true,
        color: true,
        cues: true,
        updatedAt: true,
        item: {
          select: {
            customTitle: true,
            song: { select: { title: true } },
            setlist: { select: { name: true, band: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.setlistItemEventAnnotation.findMany({
      where: { userId },
      select: {
        note: true,
        color: true,
        cues: true,
        updatedAt: true,
        item: {
          select: {
            customTitle: true,
            song: { select: { title: true } },
            setlist: { select: { name: true, band: { select: { name: true } } } },
          },
        },
        event: { select: { title: true, startsAt: true } },
      },
    }),
    prisma.songFile.findMany({
      where: { uploadedById: userId },
      select: {
        filename: true,
        mimeType: true,
        size: true,
        visibility: true,
        createdAt: true,
        song: { select: { title: true, band: { select: { name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.bandFile.findMany({
      where: { uploadedById: userId },
      select: {
        filename: true,
        mimeType: true,
        size: true,
        category: true,
        visibility: true,
        createdAt: true,
        band: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.equipment.findMany({
      where: { ownerUserId: userId },
      select: { name: true, category: true, description: true, location: true },
    }),
    prisma.equipment.findMany({
      where: { responsibleId: userId },
      select: { name: true, category: true, ownerBand: { select: { name: true } }, ownerUser: { select: { name: true } } },
    }),
    prisma.packlistItem.findMany({
      where: { assignedToId: userId },
      select: {
        checked: true,
        customName: true,
        equipment: { select: { name: true } },
        packlist: { select: { name: true, band: { select: { name: true } } } },
      },
    }),
    prisma.financeAllocation.findMany({
      where: { userId },
      select: {
        amountCents: true,
        note: true,
        confirmedAt: true,
        createdAt: true,
        financeEntry: {
          select: { type: true, category: true, date: true, band: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.financeEntry.findMany({
      where: { createdById: userId },
      select: {
        type: true,
        amountCents: true,
        currency: true,
        category: true,
        description: true,
        date: true,
        band: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.invitation.findMany({
      where: { invitedById: userId },
      select: {
        email: true,
        role: true,
        createdAt: true,
        acceptedAt: true,
        band: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    hinweis:
      "Dieser Export enthaelt die dich betreffenden personenbezogenen Daten gemaess Art. 15/20 DSGVO. " +
      "Bandweite Inhalte anderer Mitglieder sind nicht enthalten. Hochgeladene Dateien sind nur mit " +
      "Metadaten aufgefuehrt - die Dateien selbst laufen ueber den regulaeren Download in der App.",
    profil: user,
    mitgliedschaften: memberships,
    finanzverantwortungFuer: financeAdminOf,
    kalender: {
      erstellteTermine: createdEvents,
      teilnahmen: eventParticipations,
      verfuegbarkeiten: availabilities,
      abwesenheiten: absences,
    },
    songs: {
      persoenlicheNotizen: songNotes,
      abstimmungen: songVotes,
      vorgeschlageneSongs: proposedSongs,
    },
    setlisten: {
      persoenlicheNotizen: [...setlistNotes, ...setlistEventNotes],
      persoenlicheEintragsHinweise: [...setlistItemAnnotations, ...setlistItemEventAnnotations],
    },
    hochgeladeneDateien: {
      songDateien: uploadedSongFiles,
      bandDateien: uploadedBandFiles,
    },
    equipment: {
      eigenesEquipment: ownedEquipment,
      verantwortlichFuer: responsibleForEquipment,
      packlistenZuweisungen: assignedPacklistItems,
    },
    finanzen: {
      eigeneZuweisungen: financeAllocations,
      selbstErstellteEintraege: createdFinanceEntries,
    },
    versendeteEinladungen: invitationsSent,
  };

  const filename = `bandplaner-daten-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
