"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const WORKLET_URL = "/audio-worklet/soundtouch-processor.js";
const MIN_TEMPO = 0.5;
const MAX_TEMPO = 1.5;
const MAX_SEMITONES = 12;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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

export function PracticePlayer({ src, onClose }: { src: string; onClose: () => void }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tempo, setTempo] = useState(1);
  const [semitones, setSemitones] = useState(0);
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);

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
        const [{ SoundTouchNode }, response] = await Promise.all([
          import("@soundtouchjs/audio-worklet"),
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
      } catch (error) {
        if (cancelled) return;
        setErrorText(error instanceof Error ? error.message : "Unbekannter Fehler");
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

          const loop = loopRef.current;
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

  const loopActive = loopStart !== null && loopEnd !== null && loopEnd > loopStart;

  if (status === "error") {
    return (
      <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-foreground">
        <p>Übungsmodus konnte nicht geladen werden{errorText ? `: ${errorText}` : "."}</p>
        <Button variant="secondary" size="sm" className="mt-2" onClick={onClose}>
          Schließen
        </Button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-border p-3 text-sm text-muted">
        Übungsmodus wird vorbereitet – die Datei wird vollständig geladen und analysiert…
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <SlidersHorizontal className="h-4 w-4" />
          Übungsmodus
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Übungsmodus beenden"
          className="text-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={900}
        height={96}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seek(((e.clientX - rect.left) / rect.width) * duration);
        }}
        className="h-24 w-full cursor-pointer rounded-md bg-surface [--player-loop:rgba(139,92,246,0.18)] [--player-played:#8b5cf6] [--player-wave:#c4b5fd]"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={togglePlay}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? "Pause" : "Abspielen"}
        </Button>
        <span className="font-mono text-sm text-muted">
          {formatTime(position)} / {formatTime(duration)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="flex items-center justify-between text-xs font-medium text-foreground">
            Tempo
            <span className="font-mono text-muted">{Math.round(tempo * 100)} %</span>
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
            Tonart
            <span className="font-mono text-muted">
              {semitones > 0 ? `+${semitones}` : semitones} Halbtöne
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
        <span className="text-xs font-medium text-foreground">Abschnitt:</span>
        <Button variant="secondary" size="sm" onClick={() => applyLoop(position, loopEnd)}>
          A ab hier
        </Button>
        <Button variant="secondary" size="sm" onClick={() => applyLoop(loopStart, position)}>
          B bis hier
        </Button>
        {loopActive && (
          <>
            <span className="font-mono text-xs text-muted">
              {formatTime(loopStart ?? 0)} – {formatTime(loopEnd ?? 0)}
            </span>
            <Button variant="ghost" size="sm" onClick={() => applyLoop(null, null)}>
              <RotateCcw className="h-4 w-4" />
              Loop aus
            </Button>
          </>
        )}
      </div>

      <p className="text-xs text-muted">
        Tempo und Tonart lassen sich unabhängig voneinander einstellen. Klick in die Wellenform springt
        an die Stelle.
      </p>
    </div>
  );
}
