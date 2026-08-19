"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PracticePlayer } from "@/components/practice-player";

/**
 * Zweistufiger Player: normal ein schlankes <audio>-Element, das die Datei
 * streamt. Der Uebungsmodus wird bewusst erst auf Klick geladen - er muss die
 * Datei komplett dekodiert im Speicher halten (grob 20 MB je Minute Stereo),
 * was man nicht jeder Wiedergabe aufbuerden will.
 */
export function SongAudioPlayer({ src, filename }: { src: string; filename: string }) {
  const [practiceMode, setPracticeMode] = useState(false);

  if (practiceMode) {
    return <PracticePlayer src={src} onClose={() => setPracticeMode(false)} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <audio controls preload="metadata" src={src} className="h-9 min-w-0 flex-1" aria-label={filename}>
        Dein Browser kann diese Audiodatei nicht abspielen.
      </audio>
      <Button variant="secondary" size="sm" onClick={() => setPracticeMode(true)}>
        <SlidersHorizontal className="h-4 w-4" />
        Übungsmodus
      </Button>
    </div>
  );
}
