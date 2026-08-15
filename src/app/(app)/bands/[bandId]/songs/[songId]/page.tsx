import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil, Save } from "lucide-react";
import { requireMembership, canManageBand, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import {
  deleteSongAction,
  saveNoteAction,
  saveSongCueAction,
  addSongLinkAction,
  deleteSongLinkAction,
  uploadSongFileAction,
  voteSongAction,
  adminDecideProposalAction,
} from "../actions";
import { DeleteButton } from "@/components/delete-button";
import { CueAnnotationEditor } from "@/components/cue-annotation-editor";
import { SongLinkForm } from "@/components/song-link-form";
import { SongLinkDeleteButton } from "@/components/song-link-delete-button";
import { SongFileUpload } from "@/components/song-file-upload";
import { SongFileList } from "@/components/song-file-list";
import { SongVoteForm } from "@/components/song-vote-form";
import { SongVoteList } from "@/components/song-vote-list";
import { AdminProposalDecision } from "@/components/admin-proposal-decision";
import { parseCues } from "@/lib/setlist-cues";

const statusLabels: Record<string, string> = {
  PROPOSED: "Vorschlag",
  NEW: "Neu",
  IN_PROGRESS: "In Erarbeitung",
  STAGE_READY: "Bühnenreif",
  ACTIVE: "Im aktiven Repertoire",
  ARCHIVED: "Archiviert",
};

export default async function SongDetailPage({
  params,
}: {
  params: Promise<{ bandId: string; songId: string }>;
}) {
  const { bandId, songId } = await params;
  const { user, membership } = await requireMembership(bandId);
  const canManage = canManageContent(membership.role);
  const isAdmin = canManageBand(membership.role);

  const song = await prisma.song.findUnique({
    where: { id: songId, bandId },
    include: {
      notes: { where: { userId: user.id } },
      links: { orderBy: { createdAt: "asc" } },
      files: {
        where: isAdmin ? {} : { OR: [{ visibility: "BAND" }, { uploadedById: user.id }] },
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
      proposedBy: { select: { name: true } },
      votes: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!song) notFound();

  const canDeleteSong = isAdmin && (song.status === "PROPOSED" || song.status === "ARCHIVED");
  const setlistUsages = canDeleteSong
    ? await prisma.setlistItem.findMany({
        where: { songId },
        select: { setlist: { select: { name: true } } },
        distinct: ["setlistId"],
      })
    : [];
  const setlistNames = setlistUsages.map((u) => u.setlist.name);
  const deleteConfirmMessage =
    setlistNames.length > 0
      ? `Dieser Song wird noch in ${setlistNames.length} Setlist${setlistNames.length > 1 ? "en" : ""} verwendet (${setlistNames.join(", ")}). Der Eintrag bleibt dort erhalten, wird grau markiert und zeigt weiterhin den zuletzt bekannten Songtitel – kann aber nicht mehr bearbeitet werden. Song wirklich endgültig löschen?`
      : "Bist du sicher? Dies kann nicht rückgängig gemacht werden.";

  const myNote = song.notes[0];
  const myVote = song.votes.find((v) => v.userId === user.id);
  const eligibleVoterCount =
    song.status === "PROPOSED"
      ? await prisma.membership.count({ where: { bandId, role: { not: "GUEST" } } })
      : 0;

  const formatDuration = (sec: number | null) => {
    if (!sec) return null;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/bands/${bandId}/songs`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zu Songs
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold text-foreground">{song.title}</h1>
          <div className="flex shrink-0 items-center gap-2">
            {song.rejected && song.status === "ARCHIVED" && (
              <Badge variant="danger">Abgelehnt</Badge>
            )}
            <Badge variant="accent">{statusLabels[song.status]}</Badge>
          </div>
        </div>
        {song.proposedBy && (
          <p className="mt-1 text-sm text-muted">Vorgeschlagen von {song.proposedBy.name}</p>
        )}
        {canManage && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href={`/bands/${bandId}/songs/${songId}/edit`}>
              <Button variant="secondary" size="sm">
                <Pencil className="h-4 w-4" />
                Bearbeiten
              </Button>
            </Link>
            {canDeleteSong && (
              <DeleteButton
                action={deleteSongAction.bind(null, bandId, songId)}
                label="Song löschen"
                confirmMessage={deleteConfirmMessage}
              />
            )}
          </div>
        )}
        {isAdmin && !canDeleteSong && (
          <p className="mt-2 text-xs text-muted">
            Löschen ist nur möglich, wenn der Song im Status „Vorschlag“ oder „Archiviert“ ist.
          </p>
        )}
      </div>

      {song.status === "PROPOSED" && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Abstimmung</h2>
            <span className="text-sm text-muted">
              {song.votes.length} von {eligibleVoterCount} abgestimmt
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Stimmen alle zu, wird der Song automatisch auf &bdquo;Neu&ldquo; gesetzt. Lehnen alle
            ab, wird er archiviert und als abgelehnt markiert. Bei Uneinigkeit entscheidet ein:e
            Administrator:in.
          </p>

          {canManage && (
            <div className="mt-4">
              <SongVoteForm
                action={voteSongAction.bind(null, bandId, songId)}
                currentVote={myVote?.vote}
                currentComment={myVote?.comment ?? ""}
              />
            </div>
          )}

          <div className="mt-4 border-t border-border pt-4">
            <SongVoteList votes={song.votes} />
          </div>

          {isAdmin && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-sm text-muted">Als Admin entscheiden:</p>
              <AdminProposalDecision
                onApprove={adminDecideProposalAction.bind(null, bandId, songId, "APPROVE")}
                onReject={adminDecideProposalAction.bind(null, bandId, songId, "REJECT")}
              />
            </div>
          )}
        </Card>
      )}

      <Card>
        <h2 className="font-semibold text-foreground">Bandweite Informationen</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Info label="Tonart" value={song.key} />
          <Info label="Tempo" value={song.bpm ? `${song.bpm} BPM` : null} />
          <Info label="Taktart" value={song.timeSignature} />
          <Info label="Dauer" value={formatDuration(song.durationSec)} />
          <Info label="Genre" value={song.genre} />
          <Info label="Interpret" value={song.artist} />
        </dl>
        {song.remarks && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-foreground">Notizen</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{song.remarks}</p>
          </div>
        )}
        {song.lyrics && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-foreground">Songtext</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{song.lyrics}</p>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">Links</h2>
        <div className="mt-3 space-y-2">
          {song.links.length === 0 && (
            <p className="text-sm text-muted">Noch keine Links hinterlegt.</p>
          )}
          {song.links.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
            >
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{link.label || link.url}</span>
              </a>
              {canManage && (
                <SongLinkDeleteButton
                  action={deleteSongLinkAction.bind(null, bandId, songId, link.id)}
                />
              )}
            </div>
          ))}
        </div>
        {canManage && (
          <div className="mt-3">
            <SongLinkForm action={addSongLinkAction.bind(null, bandId, songId)} />
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">Dateien</h2>
        <p className="mt-1 text-sm text-muted">
          Audio, PDF, Guitar Pro u. a. Administrator:innen sehen alle Dateien; private Dateien sind
          sonst nur für dich sichtbar.
        </p>
        <div className="mt-3">
          <SongFileList
            bandId={bandId}
            songId={songId}
            files={song.files}
            currentUserId={user.id}
            isAdmin={isAdmin}
          />
        </div>
        {canManage && (
          <div className="mt-4 border-t border-border pt-4">
            <SongFileUpload action={uploadSongFileAction.bind(null, bandId, songId)} />
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">Meine persönlichen Notizen</h2>
        <p className="mt-1 text-sm text-muted">Nur für dich sichtbar.</p>
        <form action={saveNoteAction.bind(null, bandId, songId)} className="mt-3 space-y-3">
          <Textarea name="content" rows={4} defaultValue={myNote?.content ?? ""} placeholder="z. B. eigene Spielhinweise, Fingersatz, Erinnerungen…" />
          <Button type="submit" size="sm">
            <Save className="h-4 w-4" />
            Notiz speichern
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">Meine Bühnen-Hinweise</h2>
        <p className="mt-1 text-sm text-muted">
          Nur für dich sichtbar. Wird beim Hinzufügen zu einer neuen Setlist automatisch übernommen.
        </p>
        <div className="mt-3">
          <CueAnnotationEditor
            defaultValues={{
              note: myNote?.shortNote ?? "",
              color: myNote?.color ?? null,
              cues: parseCues(myNote?.cues),
            }}
            onSave={saveSongCueAction.bind(null, bandId, songId)}
          />
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="text-foreground">{value || "—"}</dd>
    </div>
  );
}
