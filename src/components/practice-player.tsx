"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Pause, Play, RotateCcw, SlidersHorizontal, Wand2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { transposeKey, keysMatch } from "@/lib/music-key";
import { detectKey, type DetectedKey } from "@/lib/key-detection";
import { updateSongKeyAction } from "@/app/(app)/bands/[bandId]/songs/actions";

const WORKLET_URL = "/audio-worklet/soundtouch-processor.js";
const MIN_TEMPO = 0.5;
const MAX_TEMPO = 1.5;
const MAX_SEMITONES = 12;
// Deckt vom langsamen Ballad-Tempo bis zu schnellem Punk/Metal praktisch alles ab,
// was bei einer Bandprobe realistisch vorkommt.
const BPM_DETECTION_RANGE = { minTempo: 60, maxTempo: 200 };
// Kleinste Ziehbewegung in der Wellenform, die noch als Loop-Auswahl statt als
// einfacher Klick zum Springen gilt (in CSS-Pixeln der angezeigten Breite).
const DRAG_THRESHOLD_PX = 4;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTimeMs(seconds: number) {
  const clamped = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.floor((clamped - Math.floor(clamped)) * 1000);
  return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

/** Reduziert den AudioBuffer auf Min/Max-Werte je Pixelspalte fuer die Wellenform. */
function computePeaks(buffer: AudioBuffer, columns: number) {
  const channel = buffer.getChannelData(0);
  const blockSize = Math.floor(channel.length / columns) || 1;
  const peaks = new Float32Array(columns * 2);

  for (let i = 0; i < columns; i++) {
    let min = 0;
    let max = 0;
    const start = i * blockSize;
    for (let j = 0; j < blockSize; j++) {
      const value = channel[start + j] ?? 0;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    peaks[i * 2] = min;
    peaks[i * 2 + 1] = max;
  }
  return peaks;
}

export function PracticePlayer({
  src,
  songKey,
  bandId,
  songId,
  keyDetectionEnabled,
  onClose,
}: {
  src: string;
  /** Bandweit hinterlegte Tonart des Songs (freies Kurzschreibweise-Format, z. B. "Am"). */
  songKey?: string | null;
  bandId: string;
  songId: string;
  keyDetectionEnabled?: boolean;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tempo, setTempo] = useState(1);
  const [semitones, setSemitones] = useState(0);
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  // Erkanntes Grundtempo (bei 100% Wiedergabegeschwindigkeit), unabhaengig vom
  // Tempo-Regler ermittelt - null, solange die Analyse noch laeuft oder
  // fehlgeschlagen ist.
  const [baseBpm, setBaseBpm] = useState<number | null>(null);
  const [keyDetection, setKeyDetection] = useState<
    | { status: "idle" }
    | { status: "detecting" }
    | { status: "done"; result: DetectedKey }
    | { status: "error" }
  >({ status: "idle" });
  const [keyAdopted, setKeyAdopted] = useState(false);
  const [keyBannerDismissed, setKeyBannerDismissed] = useState(false);
  const [adoptPending, startAdopt] = useTransition();
  const t = useTranslations("practicePlayer");

  const contextRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const soundTouchRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const peaksRef = useRef<Float32Array | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Bezugspunkte fuer die Positionsberechnung - AudioBufferSourceNode hat selbst
  // keine currentTime, die Position wird aus der verstrichenen Kontextzeit
  // hochgerechnet und bei jeder Aenderung neu geeicht.
  const anchorRef = useRef({ contextTime: 0, offset: 0 });
  const tempoRef = useRef(1);
  const loopRef = useRef<{ start: number; end: number } | null>(null);

  // Datei laden, dekodieren und den Worklet-Graphen aufbauen.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const context = new AudioContext();
        const [{ SoundTouchNode }, { guess }, response] = await Promise.all([
          import("@soundtouchjs/audio-worklet"),
          import("web-audio-beat-detector"),
          fetch(src),
        ]);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await context.decodeAudioData(arrayBuffer);
        await SoundTouchNode.register(context, WORKLET_URL);
        if (cancelled) {
          void context.close();
          return;
        }

        const node = new SoundTouchNode({ context });
        node.connect(context.destination);

        contextRef.current = context;
        bufferRef.current = audioBuffer;
        soundTouchRef.current = node;
        peaksRef.current = computePeaks(audioBuffer, 900);
        setDuration(audioBuffer.duration);
        setStatus("ready");

        // Laeuft in einem Web Worker und blockiert den Player nicht - die
        // BPM-Anzeige erscheint einfach etwas spaeter, sobald fertig.
        guess(audioBuffer, BPM_DETECTION_RANGE)
          .then(({ bpm }) => {
            if (!cancelled) setBaseBpm(bpm);
          })
          .catch(() => {
            // Tempo nicht sicher ermittelbar (z. B. sehr kurze/leise Datei) -
            // die Anzeige bleibt dann einfach aus.
          });
      } catch (error) {
        if (cancelled) return;
        setErrorText(error instanceof Error ? error.message : t("unknownError"));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  // Aufraeumen beim Verlassen des Uebungsmodus.
  useEffect(() => {
    return () => {
      try {
        sourceRef.current?.stop();
      } catch {
        // bereits gestoppt
      }
      sourceRef.current?.disconnect();
      soundTouchRef.current?.disconnect();
      void contextRef.current?.close();
    };
  }, []);

  const currentPosition = useCallback(() => {
    const context = contextRef.current;
    if (!context || !playing) return anchorRef.current.offset;
    const elapsed = (context.currentTime - anchorRef.current.contextTime) * tempoRef.current;
    let next = anchorRef.current.offset + elapsed;

    const loop = loopRef.current;
    if (loop && next > loop.end) {
      const span = loop.end - loop.start;
      next = span > 0 ? loop.start + ((next - loop.start) % span) : loop.start;
    }
    return Math.min(next, bufferRef.current?.duration ?? 0);
  }, [playing]);

  const stopSource = useCallback(() => {
    const source = sourceRef.current;
    if (!source) return;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // bereits beendet
    }
    source.disconnect();
    sourceRef.current = null;
  }, []);

  const startAt = useCallback(
    (offset: number) => {
      const context = contextRef.current;
      const buffer = bufferRef.current;
      const node = soundTouchRef.current;
      if (!context || !buffer || !node) return;

      stopSource();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = tempoRef.current;

      const loop = loopRef.current;
      if (loop) {
        source.loop = true;
        source.loopStart = loop.start;
        source.loopEnd = loop.end;
      }
      source.connect(node);
      source.onended = () => {
        if (sourceRef.current === source && !loopRef.current) {
          setPlaying(false);
          anchorRef.current = { contextTime: context.currentTime, offset: 0 };
          setPosition(0);
        }
      };

      const clamped = Math.max(0, Math.min(offset, buffer.duration - 0.01));
      source.start(0, clamped);
      sourceRef.current = source;
      anchorRef.current = { contextTime: context.currentTime, offset: clamped };
      setPosition(clamped);
    },
    [stopSource]
  );

  const togglePlay = useCallback(async () => {
    const context = contextRef.current;
    if (!context || status !== "ready") return;
    if (context.state === "suspended") await context.resume();

    if (playing) {
      const pausedAt = currentPosition();
      stopSource();
      anchorRef.current = { contextTime: context.currentTime, offset: pausedAt };
      setPosition(pausedAt);
      setPlaying(false);
    } else {
      startAt(anchorRef.current.offset);
      setPlaying(true);
    }
  }, [currentPosition, playing, startAt, status, stopSource]);

  const seek = useCallback(
    (target: number) => {
      const context = contextRef.current;
      if (!context) return;
      if (playing) {
        startAt(target);
      } else {
        anchorRef.current = { contextTime: context.currentTime, offset: target };
        setPosition(target);
      }
    },
    [playing, startAt]
  );

  // Tempo wirkt sofort: Quelle und Processor bekommen denselben Wert, damit die
  // Tonhoehe konstant bleibt. Vorher wird die Position neu geeicht.
  const applyTempo = useCallback(
    (value: number) => {
      const context = contextRef.current;
      const here = currentPosition();
      tempoRef.current = value;
      setTempo(value);

      const node = soundTouchRef.current as { playbackRate?: AudioParam } | null;
      if (node?.playbackRate) node.playbackRate.value = value;

      if (playing) {
        startAt(here);
      } else if (context) {
        anchorRef.current = { contextTime: context.currentTime, offset: here };
      }
    },
    [currentPosition, playing, startAt]
  );

  const applySemitones = useCallback((value: number) => {
    setSemitones(value);
    const node = soundTouchRef.current as { pitchSemitones?: AudioParam } | null;
    if (node?.pitchSemitones) node.pitchSemitones.value = value;
  }, []);

  const applyLoop = useCallback(
    (start: number | null, end: number | null) => {
      setLoopStart(start);
      setLoopEnd(end);
      loopRef.current = start !== null && end !== null && end > start ? { start, end } : null;

      const source = sourceRef.current;
      if (!source) return;
      if (loopRef.current) {
        source.loop = true;
        source.loopStart = loopRef.current.start;
        source.loopEnd = loopRef.current.end;
      } else {
        source.loop = false;
      }
    },
    []
  );

  // Ziehauswahl des Loop-Bereichs direkt in der Wellenform (Maus oder Touch).
  // "anchor" ist der fest bleibende Startpunkt der Geste, "current" die aktuelle
  // Zeigerposition - der gezeichnete/uebernommene Bereich ist stets ihr Min/Max,
  // damit auch ein Zurueckziehen ueber den Anker hinaus korrekt bleibt. Waehrend
  // des Ziehens wird nur die Vorschau aktualisiert; erst beim Loslassen wird
  // applyLoop() aufgerufen, damit ein einfacher Klick weiterhin nur springt.
  const dragRef = useRef<{ anchor: number; current: number } | null>(null);

  const timeFromPointer = useCallback(
    (e: { clientX: number; currentTarget: HTMLCanvasElement }) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
      return Math.max(0, Math.min(ratio, 1)) * duration;
    },
    [duration]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const time = timeFromPointer(e);
      dragRef.current = { anchor: time, current: time };
    },
    [timeFromPointer]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragRef.current) return;
      dragRef.current = { anchor: dragRef.current.anchor, current: timeFromPointer(e) };
    },
    [timeFromPointer]
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>, commit: boolean) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag || !commit) return;

      const start = Math.min(drag.anchor, drag.current);
      const end = Math.max(drag.anchor, drag.current);
      const rect = e.currentTarget.getBoundingClientRect();
      const thresholdSeconds = rect.width > 0 ? (DRAG_THRESHOLD_PX / rect.width) * duration : 0;
      if (end - start < thresholdSeconds) {
        seek(drag.anchor);
      } else {
        applyLoop(start, end);
      }
    },
    [applyLoop, duration, seek]
  );

  // Fortschrittsanzeige und Wellenform zeichnen.
  useEffect(() => {
    if (status !== "ready") return;
    let frame = 0;

    const draw = () => {
      const canvas = canvasRef.current;
      const peaks = peaksRef.current;
      const total = bufferRef.current?.duration ?? 0;
      const pos = currentPosition();
      setPosition(pos);

      if (canvas && peaks && total > 0) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const { width, height } = canvas;
          const columns = peaks.length / 2;
          const styles = getComputedStyle(canvas);
          ctx.clearRect(0, 0, width, height);

          const drag = dragRef.current;
          const loop = drag ? { start: Math.min(drag.anchor, drag.current), end: Math.max(drag.anchor, drag.current) } : loopRef.current;
          if (loop) {
            ctx.fillStyle = styles.getPropertyValue("--player-loop") || "rgba(139,92,246,0.18)";
            ctx.fillRect((loop.start / total) * width, 0, ((loop.end - loop.start) / total) * width, height);
          }

          const playedX = (pos / total) * width;
          const mid = height / 2;
          for (let i = 0; i < columns; i++) {
            const x = (i / columns) * width;
            ctx.fillStyle =
              x <= playedX
                ? styles.getPropertyValue("--player-played") || "#8b5cf6"
                : styles.getPropertyValue("--player-wave") || "#c4b5fd";
            const min = peaks[i * 2];
            const max = peaks[i * 2 + 1];
            const top = mid + min * mid;
            const barHeight = Math.max((max - min) * mid, 1);
            ctx.fillRect(x, top, Math.max(width / columns, 1), barHeight);
          }
        }
      }
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [currentPosition, status]);

  const handleDetectKey = useCallback(async () => {
    const buffer = bufferRef.current;
    if (!buffer) return;
    setKeyDetection({ status: "detecting" });
    setKeyAdopted(false);
    setKeyBannerDismissed(false);
    try {
      const result = await detectKey(buffer);
      setKeyDetection(result ? { status: "done", result } : { status: "error" });
    } catch {
      setKeyDetection({ status: "error" });
    }
  }, []);

  const handleAdoptKey = useCallback(
    (label: string) => {
      startAdopt(async () => {
        await updateSongKeyAction(bandId, songId, label);
        setKeyAdopted(true);
      });
    },
    [bandId, songId]
  );

  const loopActive = loopStart !== null && loopEnd !== null && loopEnd > loopStart;
  const transposedKey = songKey ? transposeKey(songKey, semitones) : null;

  if (status === "error") {
    return (
      <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-foreground">
        <p>{t("loadError")}{errorText ? `: ${errorText}` : "."}</p>
        <Button variant="secondary" size="sm" className="mt-2" onClick={onClose}>
          {t("closeButton")}
        </Button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-border p-3 text-sm text-muted">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <SlidersHorizontal className="h-4 w-4" />
          {t("title")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="text-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={900}
        height={96}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => endDrag(e, true)}
        onPointerCancel={(e) => endDrag(e, false)}
        className="h-24 w-full touch-none cursor-pointer rounded-md bg-surface [--player-loop:rgba(139,92,246,0.18)] [--player-played:#8b5cf6] [--player-wave:#c4b5fd]"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={togglePlay}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? t("pause") : t("play")}
        </Button>
        <span className="font-mono text-sm text-muted">
          {formatTimeMs(position)} / {formatTimeMs(duration)} · −{formatTimeMs(duration - position)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="flex items-center justify-between text-xs font-medium text-foreground">
            {t("tempo")}
            <span className="font-mono text-muted">
              {Math.round(tempo * 100)} %
              {baseBpm !== null ? ` · ${Math.round(baseBpm * tempo)} BPM` : ""}
            </span>
          </span>
          <input
            type="range"
            min={MIN_TEMPO * 100}
            max={MAX_TEMPO * 100}
            step={5}
            value={Math.round(tempo * 100)}
            onChange={(e) => applyTempo(Number(e.target.value) / 100)}
            className="mt-1 w-full accent-primary"
          />
        </label>

        <label className="block">
          <span className="flex items-center justify-between text-xs font-medium text-foreground">
            {t("key")}
            <span className="font-mono text-muted">
              {semitones > 0 ? `+${semitones}` : semitones} {t("semitones")}
              {semitones !== 0 && transposedKey ? ` · ${transposedKey}` : ""}
            </span>
          </span>
          <input
            type="range"
            min={-MAX_SEMITONES}
            max={MAX_SEMITONES}
            step={1}
            value={semitones}
            onChange={(e) => applySemitones(Number(e.target.value))}
            className="mt-1 w-full accent-primary"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
        <span className="text-xs font-medium text-foreground">{t("section")}</span>
        <Button variant="secondary" size="sm" onClick={() => applyLoop(position, loopEnd)}>
          {t("loopFromHere")}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => applyLoop(loopStart, position)}>
          {t("loopToHere")}
        </Button>
        {loopActive && (
          <>
            <span className="font-mono text-xs text-muted">
              {formatTime(loopStart ?? 0)} – {formatTime(loopEnd ?? 0)}
            </span>
            <Button variant="ghost" size="sm" onClick={() => applyLoop(null, null)}>
              <RotateCcw className="h-4 w-4" />
              {t("loopOff")}
            </Button>
          </>
        )}
      </div>

      {keyDetectionEnabled && (
        <div className="border-t border-border pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDetectKey}
              disabled={keyDetection.status === "detecting"}
            >
              <Wand2 className="h-4 w-4" />
              {keyDetection.status === "detecting" ? t("analyzing") : t("detectKey")}
            </Button>
            {keyDetection.status === "done" && (
              <span className="text-sm text-muted">
                {t("detected")} <span className="font-medium text-foreground">{keyDetection.result.label}</span>
                {keyDetection.result.ambiguousWith && (
                  <>
                    {" "}
                    {t("ambiguousHint", { label: keyDetection.result.ambiguousWith.label })}
                  </>
                )}
              </span>
            )}
            {keyDetection.status === "error" && (
              <span className="text-sm text-danger">{t("detectionFailed")}</span>
            )}
          </div>

          {keyDetection.status === "done" &&
            !keyAdopted &&
            !keyBannerDismissed &&
            !keysMatch(songKey, keyDetection.result.label) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 p-2 text-sm">
                <span className="text-foreground">
                  {t("keyDiffers", { key: songKey || t("noKey") })}
                </span>
                <Button
                  size="sm"
                  onClick={() => handleAdoptKey(keyDetection.result.label)}
                  disabled={adoptPending}
                >
                  {t("adopt")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setKeyBannerDismissed(true)}>
                  {t("discard")}
                </Button>
              </div>
            )}
          {keyAdopted && <p className="mt-2 text-xs text-muted">{t("keyAdopted")}</p>}
        </div>
      )}

      <p className="text-xs text-muted">{t("hint")}</p>
    </div>
  );
}
