import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil, Save } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageBand, canManageBandContent, canManageContent } from "@/lib/access";
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
  refreshSongMetadataAction,
} from "../actions";
import { hasRefreshableSongGaps } from "@/lib/song-metadata-lookup";
import { DeleteButton } from "@/components/delete-button";
import { RefreshCoverButton } from "@/components/refresh-cover-button";
import { CueAnnotationEditor } from "@/components/cue-annotation-editor";
import { SongLinkForm } from "@/components/song-link-form";
import { SongLinkDeleteButton } from "@/components/song-link-delete-button";
import { SongFileUpload } from "@/components/song-file-upload";
import { SongFileList } from "@/components/song-file-list";
import { SongVoteForm } from "@/components/song-vote-form";
import { SongVoteList } from "@/components/song-vote-list";
import { AdminProposalDecision } from "@/components/admin-proposal-decision";
import { parseCues } from "@/lib/setlist-cues";
import { getEnabledFeatures } from "@/lib/features";
import { detectStreamingEmbed } from "@/lib/media";
import { SongEmbed } from "@/components/song-embed";

export default async function SongDetailPage({
  params,
}: {
  params: Promise<{ bandId: string; songId: string }>;
}) {
  const { bandId, songId } = await params;
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);
  const canManage = canManageContent(membership.role);
  // Bewusst strikt (nur echte Admins): steuert Sichtbarkeit fremder privater Dateien
  // sowie das endgültige Löschen - beides nicht auf Finanzadmins erweitert.
  const isAdmin = canManageBand(membership.role);
  // Erweitert um Finanzadmins: Songs verwalten/überschreiben (Status setzen,
  // Vorschläge entscheiden, fremde hochgeladene Dateien umbenennen/löschen).
  const canManageSongs = canManageBandContent(membership.role, isFinanceAdmin);
  const features = getEnabledFeatures(membership.band);
  const t = await getTranslations("songs");
  const td = await getTranslations("songs.detail");

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
      ? td("deleteConfirmWithSetlists", { count: setlistNames.length, names: setlistNames.join(", ") })
      : td("deleteConfirmSimple");

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
          {td("backToSongs")}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {/* Bewusst unabhaengig vom Medienplayer-Schalter: das Cover ist
                Song-Metadatum (siehe Songbibliothek), keine Player-Funktion. */}
            {song.coverUrl && (
              <div className="group relative z-0 shrink-0 hover:z-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={song.coverUrl}
                  alt=""
                  className="h-16 w-16 origin-top-left rounded-md border border-border object-cover shadow-sm transition-transform duration-200 ease-out group-hover:scale-[3.5] group-hover:shadow-lg"
                />
              </div>
            )}
            <h1 className="text-2xl font-semibold text-foreground">{song.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {song.rejected && song.status === "ARCHIVED" && (
              <Badge variant="danger">{t("rejectedBadge")}</Badge>
            )}
            <Badge variant="accent">
              {song.status === "ACTIVE" ? td("activeStatusFull") : t(`statusLabels.${song.status}`)}
            </Badge>
          </div>
        </div>
        {song.proposedBy && (
          <p className="mt-1 text-sm text-muted">
            {song.status === "PROPOSED" ? td("proposedByPrefix") : td("createdByPrefix")}{" "}
            {td("byPerson", { name: song.proposedBy.name })}
          </p>
        )}
        {canManage && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href={`/bands/${bandId}/songs/${songId}/edit`}>
              <Button variant="secondary" size="sm">
                <Pencil className="h-4 w-4" />
                {td("edit")}
              </Button>
            </Link>
            {hasRefreshableSongGaps(song) && (
              <RefreshCoverButton action={refreshSongMetadataAction.bind(null, bandId, songId)} />
            )}
            {canDeleteSong && (
              <DeleteButton
                action={deleteSongAction.bind(null, bandId, songId)}
                label={td("delete")}
                confirmMessage={deleteConfirmMessage}
              />
            )}
          </div>
        )}
        {isAdmin && !canDeleteSong && (
          <p className="mt-2 text-xs text-muted">{td("deleteRestriction")}</p>
        )}
      </div>

      {song.status === "PROPOSED" && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">{td("voting")}</h2>
            <span className="text-sm text-muted">
              {td("votesOf", { votes: song.votes.length, total: eligibleVoterCount })}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{td("votingExplanation")}</p>

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

          {canManageSongs && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-sm text-muted">{td("adminDecide")}</p>
              <AdminProposalDecision
                onApprove={adminDecideProposalAction.bind(null, bandId, songId, "APPROVE")}
                onReject={adminDecideProposalAction.bind(null, bandId, songId, "REJECT")}
              />
            </div>
          )}
        </Card>
      )}

      <Card>
        <h2 className="font-semibold text-foreground">{td("bandInfo")}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Info label={td("key")} value={song.key} noValue={td("noValue")} />
          <Info label={td("tempo")} value={song.bpm ? `${song.bpm} BPM` : null} noValue={td("noValue")} />
          <Info label={td("timeSignature")} value={song.timeSignature} noValue={td("noValue")} />
          <Info label={td("duration")} value={formatDuration(song.durationSec)} noValue={td("noValue")} />
          <Info label={td("genre")} value={song.genre} noValue={td("noValue")} />
          <Info label={td("artist")} value={song.artist} noValue={td("noValue")} />
          <Info label={td("album")} value={song.album} noValue={td("noValue")} />
          <Info label={td("releaseYear")} value={song.releaseYear?.toString()} noValue={td("noValue")} />
        </dl>
        {song.remarks && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-foreground">{td("notes")}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{song.remarks}</p>
          </div>
        )}
        {song.lyrics && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-foreground">{td("lyrics")}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{song.lyrics}</p>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">{td("links")}</h2>
        <div className="mt-3 space-y-2">
          {song.links.length === 0 && (
            <p className="text-sm text-muted">{td("noLinks")}</p>
          )}
          {song.links.map((link) => {
            const embed = features.mediaPlayer ? detectStreamingEmbed(link.url) : null;
            return (
              <div key={link.id} className="rounded-lg border border-border px-3 py-2">
                <div className="flex items-center gap-2">
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
                {embed && (
                  <div className="mt-2">
                    <SongEmbed embed={embed} label={link.label || td("linkedSource")} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {canManage && (
          <div className="mt-3">
            <SongLinkForm action={addSongLinkAction.bind(null, bandId, songId)} />
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">{td("files")}</h2>
        <p className="mt-1 text-sm text-muted">{td("filesDescription")}</p>
        <div className="mt-3">
          <SongFileList
            bandId={bandId}
            songId={songId}
            files={song.files}
            currentUserId={user.id}
            isAdmin={canManageSongs}
            playerEnabled={features.mediaPlayer}
            keyDetectionEnabled={features.keyDetection}
            songKey={song.key}
            songBpm={song.bpm}
          />
        </div>
        {canManage && (
          <div className="mt-4 border-t border-border pt-4">
            <SongFileUpload action={uploadSongFileAction.bind(null, bandId, songId)} />
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">{td("myNotes")}</h2>
        <p className="mt-1 text-sm text-muted">{td("myNotesVisibility")}</p>
        <form action={saveNoteAction.bind(null, bandId, songId)} className="mt-3 space-y-3">
          <Textarea name="content" rows={4} defaultValue={myNote?.content ?? ""} placeholder={td("notesPlaceholder")} />
          <Button type="submit" size="sm">
            <Save className="h-4 w-4" />
            {td("saveNote")}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">{td("myCues")}</h2>
        <p className="mt-1 text-sm text-muted">{td("myCuesVisibility")}</p>
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

function Info({
  label,
  value,
  noValue,
}: {
  label: string;
  value: string | null | undefined;
  noValue: string;
}) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="text-foreground">{value || noValue}</dd>
    </div>
  );
}
