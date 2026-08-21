"use client";

import { useActionState, useRef, useState } from "react";
import { Save, Upload, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { FormState, SongMetadataSearchResult } from "@/app/(app)/bands/[bandId]/songs/actions";
import type { AudioMetadataPreview } from "@/lib/audio-metadata";
import type { SongMetadataCandidate } from "@/lib/song-metadata-lookup";

const statusValues = ["PROPOSED", "NEW", "IN_PROGRESS", "STAGE_READY", "ACTIVE", "ARCHIVED"] as const;

type PendingLink = { url: string; label?: string };

export function SongForm({
  action,
  defaultValues,
  submitLabel,
  canEditStatus = true,
  previewMetadataAction,
  searchMetadataAction,
  fetchCoverAction,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: {
    title?: string;
    key?: string;
    bpm?: string;
    timeSignature?: string;
    durationSec?: string;
    genre?: string;
    artist?: string;
    album?: string;
    releaseYear?: string;
    status?: string;
    lyrics?: string;
    remarks?: string;
  };
  submitLabel: string;
  /** Nur Admins dürfen den Status setzen/ändern - andere reichen Songs als Vorschlag ein. */
  canEditStatus?: boolean;
  /**
   * Anlageassistent (ID3-Vorschau + Online-Recherche) - nur beim Neuanlegen
   * verfügbar (siehe new/page.tsx), daher optional. Alle drei bereits mit der
   * Band-ID gebundenen Server Actions werden zusammen gereicht oder gar nicht.
   */
  previewMetadataAction?: (formData: FormData) => Promise<AudioMetadataPreview | null>;
  searchMetadataAction?: (title: string, artist?: string) => Promise<SongMetadataSearchResult>;
  fetchCoverAction?: (
    candidate: { releaseMbid?: string; coverImageUrl?: string }
  ) => Promise<{ dataUrl: string } | null>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const t = useTranslations("songs");
  const td = useTranslations("songs.detail");
  const tf = useTranslations("songs.form");
  const ta = useTranslations("songs.form.assistant");
  const totalDurationSec = Number(defaultValues?.durationSec) || 0;
  const defaultDurationMin = totalDurationSec ? Math.floor(totalDurationSec / 60) : undefined;
  const defaultDurationSecPart = totalDurationSec ? totalDurationSec % 60 : undefined;

  const titleRef = useRef<HTMLInputElement>(null);
  const artistRef = useRef<HTMLInputElement>(null);
  const genreRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const releaseYearRef = useRef<HTMLInputElement>(null);
  const bpmRef = useRef<HTMLInputElement>(null);
  const durationMinRef = useRef<HTMLInputElement>(null);
  const durationSecPartRef = useRef<HTMLInputElement>(null);

  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [pendingCoverDataUrl, setPendingCoverDataUrl] = useState<string | null>(null);
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([]);
  const [spotifyUrl, setSpotifyUrl] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<SongMetadataCandidate[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [fetchingCoverFor, setFetchingCoverFor] = useState<string | null>(null);

  const showAssistant = Boolean(previewMetadataAction && searchMetadataAction);

  function fillIfEmpty(ref: React.RefObject<HTMLInputElement | null>, value: string | number | undefined) {
    if (ref.current && !ref.current.value && value !== undefined && value !== "") {
      ref.current.value = String(value);
    }
  }

  /** Nur befuellen, wenn BEIDE Teilfelder noch leer sind, um ein manuell erfasstes Ergebnis nie teilweise zu ueberschreiben. */
  function fillDurationIfEmpty(totalSec: number | undefined) {
    if (totalSec === undefined || !durationMinRef.current || !durationSecPartRef.current) return;
    if (durationMinRef.current.value || durationSecPartRef.current.value) return;
    durationMinRef.current.value = String(Math.floor(totalSec / 60));
    durationSecPartRef.current.value = String(totalSec % 60);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !previewMetadataAction) return;
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await previewMetadataAction(formData);
      if (result) {
        fillIfEmpty(titleRef, result.title);
        fillIfEmpty(artistRef, result.artist);
        fillIfEmpty(genreRef, result.genre);
        fillIfEmpty(albumRef, result.album);
        fillIfEmpty(releaseYearRef, result.year);
        fillIfEmpty(bpmRef, result.bpm);
        fillDurationIfEmpty(result.durationSec);
        if (result.coverDataUrl) setCoverPreview(result.coverDataUrl);
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleResearch() {
    if (!searchMetadataAction) return;
    const title = titleRef.current?.value.trim();
    if (!title) return;
    setSearching(true);
    setCandidates(null);
    try {
      const result = await searchMetadataAction(title, artistRef.current?.value.trim() || undefined);
      setCandidates(result.candidates);
      setSpotifyUrl(result.spotifyUrl ?? null);
    } finally {
      setSearching(false);
    }
  }

  async function handleSelectCandidate(candidate: SongMetadataCandidate) {
    fillIfEmpty(titleRef, candidate.title);
    fillIfEmpty(artistRef, candidate.artist);
    fillIfEmpty(genreRef, candidate.genre);
    fillIfEmpty(albumRef, candidate.album);
    fillIfEmpty(releaseYearRef, candidate.year);

    if (spotifyUrl && !pendingLinks.some((l) => l.url === spotifyUrl)) {
      setPendingLinks((prev) => [...prev, { url: spotifyUrl, label: ta("spotifyLinkLabel") }]);
    }

    if ((candidate.releaseMbid || candidate.coverImageUrl) && fetchCoverAction) {
      setFetchingCoverFor(candidate.mbid);
      try {
        const cover = await fetchCoverAction({
          releaseMbid: candidate.releaseMbid,
          coverImageUrl: candidate.coverImageUrl,
        });
        if (cover) {
          setCoverPreview(cover.dataUrl);
          setPendingCoverDataUrl(cover.dataUrl);
        }
      } finally {
        setFetchingCoverFor(null);
      }
    }
    setCandidates(null);
  }

  const statusLabel = (value: string) =>
    value === "ACTIVE" ? td("activeStatusFull") : t(`statusLabels.${value}`);

  return (
    <form action={formAction} className="space-y-4">
      {pendingCoverDataUrl && <input type="hidden" name="pendingCoverDataUrl" value={pendingCoverDataUrl} />}
      {pendingLinks.length > 0 && (
        <input type="hidden" name="pendingLinks" value={JSON.stringify(pendingLinks)} />
      )}

      {showAssistant && (
        <Card className="bg-surface-muted">
          <div className="flex items-start gap-3">
            {coverPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverPreview}
                alt={ta("coverPreviewAlt")}
                className="h-16 w-16 shrink-0 rounded-md border border-border object-cover"
              />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <Label htmlFor="assistant-file">{ta("uploadLabel")}</Label>
                <input
                  id="assistant-file"
                  type="file"
                  name="file"
                  accept=".mp3,.wav,.ogg,.m4a,audio/*"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-border"
                />
                {analyzing && <p className="mt-1 text-xs text-muted">{ta("analyzing")}</p>}
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={handleResearch} disabled={searching}>
                <Search className="h-4 w-4" />
                {searching ? ta("researching") : ta("researchButton")}
              </Button>
            </div>
          </div>

          {candidates && (
            <div className="mt-3 space-y-1.5 border-t border-border pt-3">
              {candidates.length === 0 ? (
                <p className="text-sm text-muted">{ta("noResults")}</p>
              ) : (
                candidates.map((c) => (
                  <button
                    key={c.mbid}
                    type="button"
                    onClick={() => handleSelectCandidate(c)}
                    disabled={fetchingCoverFor === c.mbid}
                    className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-primary hover:bg-surface disabled:opacity-60"
                  >
                    <span className="min-w-0 truncate text-foreground">
                      {c.title}
                      {c.artist && <span className="text-muted"> – {c.artist}</span>}
                      {c.album && <span className="text-muted"> – {c.album}</span>}
                      {c.year && <span className="text-muted"> ({c.year})</span>}
                    </span>
                    <Upload className="h-3.5 w-3.5 shrink-0 text-primary" />
                  </button>
                ))
              )}
            </div>
          )}
        </Card>
      )}

      <div>
        <Label htmlFor="title">{tf("title")}</Label>
        <Input id="title" name="title" required defaultValue={defaultValues?.title} ref={titleRef} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="key">{tf("key")}</Label>
          <Input id="key" name="key" placeholder={tf("keyPlaceholder")} defaultValue={defaultValues?.key} />
        </div>
        <div>
          <Label htmlFor="bpm">{tf("tempo")}</Label>
          <Input id="bpm" name="bpm" type="number" min={1} defaultValue={defaultValues?.bpm} ref={bpmRef} />
        </div>
        <div>
          <Label htmlFor="timeSignature">{tf("timeSignature")}</Label>
          <Input id="timeSignature" name="timeSignature" placeholder="4/4" defaultValue={defaultValues?.timeSignature} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="durationMin">{tf("duration")}</Label>
          <div className="flex items-center gap-1">
            <Input
              id="durationMin"
              name="durationMin"
              type="number"
              min={0}
              placeholder={tf("durationMinPlaceholder")}
              className="w-full"
              defaultValue={defaultDurationMin}
              ref={durationMinRef}
            />
            <span className="text-muted">:</span>
            <Input
              id="durationSecPart"
              name="durationSecPart"
              type="number"
              min={0}
              max={59}
              placeholder={tf("durationSecPlaceholder")}
              className="w-full"
              defaultValue={defaultDurationSecPart}
              ref={durationSecPartRef}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="genre">{tf("genre")}</Label>
          <Input id="genre" name="genre" defaultValue={defaultValues?.genre} ref={genreRef} />
        </div>
        <div>
          <Label htmlFor="artist">{tf("artist")}</Label>
          <Input
            id="artist"
            name="artist"
            placeholder={tf("artistPlaceholder")}
            defaultValue={defaultValues?.artist}
            ref={artistRef}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="album">{tf("album")}</Label>
          <Input id="album" name="album" defaultValue={defaultValues?.album} ref={albumRef} />
        </div>
        <div>
          <Label htmlFor="releaseYear">{tf("releaseYear")}</Label>
          <Input
            id="releaseYear"
            name="releaseYear"
            type="number"
            min={1000}
            max={9999}
            defaultValue={defaultValues?.releaseYear}
            ref={releaseYearRef}
          />
        </div>
      </div>

      {canEditStatus ? (
        <div>
          <Label htmlFor="status">{tf("status")}</Label>
          <Select id="status" name="status" defaultValue={defaultValues?.status ?? "NEW"}>
            {statusValues.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <div>
          <input type="hidden" name="status" value={defaultValues?.status ?? "PROPOSED"} />
          <Label htmlFor="status">{tf("status")}</Label>
          <p className="text-sm text-muted">
            {defaultValues?.status
              ? `${statusLabel(defaultValues.status)} ${tf("statusReadonlySuffix")}`
              : tf("statusProposalHint")}
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="lyrics">{tf("lyrics")}</Label>
        <Textarea id="lyrics" name="lyrics" rows={6} defaultValue={defaultValues?.lyrics} />
      </div>

      <div>
        <Label htmlFor="remarks">{tf("notes")}</Label>
        <Textarea
          id="remarks"
          name="remarks"
          rows={3}
          placeholder={tf("notesPlaceholder")}
          defaultValue={defaultValues?.remarks}
        />
        <p className="mt-1 text-xs text-muted">{tf("notesVisibility")}</p>
      </div>

      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? tf("saving") : submitLabel}
      </Button>
    </form>
  );
}
