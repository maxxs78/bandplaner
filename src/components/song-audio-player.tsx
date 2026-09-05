"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PracticePlayer, type PracticeLoopItem } from "@/components/practice-player";

/**
 * Zweistufiger Player: normal ein schlankes <audio>-Element, das die Datei
 * streamt. Der Uebungsmodus wird bewusst erst auf Klick geladen - er muss die
 * Datei komplett dekodiert im Speicher halten (grob 20 MB je Minute Stereo),
 * was man nicht jeder Wiedergabe aufbuerden will.
 */
export function SongAudioPlayer({
  src,
  filename,
  songKey,
  songBpm,
  bandId,
  songId,
  keyDetectionEnabled,
  timeSignature,
  countInBeats,
  clickOffsetMs,
  canManageSong = false,
  practiceLoops = [],
  saveLoopAction,
  deleteLoopAction,
  saveClickSettingsAction,
}: {
  src: string;
  filename: string;
  songKey?: string | null;
  songBpm?: number | null;
  bandId: string;
  songId: string;
  keyDetectionEnabled?: boolean;
  timeSignature?: string | null;
  countInBeats?: number | null;
  clickOffsetMs?: number | null;
  canManageSong?: boolean;
  practiceLoops?: PracticeLoopItem[];
  saveLoopAction?: (input: { name: string; startSec: number; endSec: number }) => Promise<{ error?: string; id?: string } | undefined>;
  deleteLoopAction?: (loopId: string) => Promise<{ error?: string } | undefined>;
  saveClickSettingsAction?: (settings: { countInBeats?: number | null; clickOffsetMs?: number | null }) => Promise<{ error?: string } | undefined>;
}) {
  const [practiceMode, setPracticeMode] = useState(false);
  const t = useTranslations("songs.audioPlayer");

  if (practiceMode) {
    return (
      <PracticePlayer
        src={src}
        songKey={songKey}
        songBpm={songBpm}
        bandId={bandId}
        songId={songId}
        keyDetectionEnabled={keyDetectionEnabled}
        timeSignature={timeSignature}
        countInBeats={countInBeats}
        clickOffsetMs={clickOffsetMs}
        canManageSong={canManageSong}
        practiceLoops={practiceLoops}
        saveLoopAction={saveLoopAction}
        deleteLoopAction={deleteLoopAction}
        saveClickSettingsAction={saveClickSettingsAction}
        onClose={() => setPracticeMode(false)}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <audio controls preload="metadata" src={src} className="h-9 min-w-0 flex-1" aria-label={filename}>
        {t("unsupported")}
      </audio>
      <Button variant="secondary" size="sm" onClick={() => setPracticeMode(true)}>
        <SlidersHorizontal className="h-4 w-4" />
        {t("practiceMode")}
      </Button>
    </div>
  );
}
