"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Timer,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { transposeKey, keysMatch } from "@/lib/music-key";
import { detectKey, type DetectedKey } from "@/lib/key-detection";
import { updateSongKeyAction, updateSongBpmAction } from "@/app/(app)/bands/[bandId]/songs/actions";

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

export type PracticeLoopItem = {
  id: string;
  name: string;
  startSec: number;
  endSec: number;
  canDelete: boolean;
};

/** Parst den Zähler einer Taktart-Angabe wie "4/4" oder "3/4"; Fallback 4. */
function beatsPerBarFrom(timeSignature?: string | null) {
  const n = Number(String(timeSignature ?? "").split("/")[0]);
  return Number.isFinite(n) && n >= 1 && n <= 16 ? Math.round(n) : 4;
}

export function PracticePlayer({
  src,
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
  onClose,
}: {
  src: string;
  /** Bandweit hinterlegte Tonart des Songs (freies Kurzschreibweise-Format, z. B. "Am"). */
  songKey?: string | null;
  /** Bandweit hinterlegtes Grundtempo des Songs. */
  songBpm?: number | null;
  bandId: string;
  songId: string;
  keyDetectionEnabled?: boolean;
  timeSignature?: string | null;
  /** Song.countInBeats - Vorzähler-Schläge (null/0 = Grundwert aus Taktart). */
  countInBeats?: number | null;
  /** Song.clickOffsetMs - Feinversatz der Klick-Spur zum Downbeat. */
  clickOffsetMs?: number | null;
  /** Darf der Nutzer die Klick-Einstellungen dauerhaft am Song speichern? */
  canManageSong?: boolean;
  /** Bandweit gespeicherte Übungsabschnitte. */
  practiceLoops?: PracticeLoopItem[];
  saveLoopAction?: (input: {
    name: string;
    startSec: number;
    endSec: number;
  }) => Promise<{ error?: string; id?: string } | undefined>;
  deleteLoopAction?: (loopId: string) => Promise<{ error?: string } | undefined>;
  saveClickSettingsAction?: (settings: {
    countInBeats?: number | null;
    clickOffsetMs?: number | null;
  }) => Promise<{ error?: string } | undefined>;
  onClose: () => void;
}) {
  const router = useRouter();
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
  const [bpmAdopted, setBpmAdopted] = useState(false);
  const [bpmBannerDismissed, setBpmBannerDismissed] = useState(false);
  const [adoptPending, startAdopt] = useTransition();
  const [adoptBpmPending, startAdoptBpm] = useTransition();
  const t = useTranslations("practicePlayer");

  const beatsPerBar = beatsPerBarFrom(timeSignature);

  // --- Klick-Spur / Einzähler / Tempo-Treppe / gespeicherte Loops ------------
  const [clickEnabled, setClickEnabled] = useState(false);
  const [countInEnabled, setCountInEnabled] = useState(false);
  const [countingIn, setCountingIn] = useState(false);
  // Erkannte Downbeat-Phase aus der Beat-Analyse (Sekunden) - Vorbelegung fuer
  // den Klick-Versatz, solange am Song nichts Eigenes hinterlegt ist.
  const [detectedOffsetSec, setDetectedOffsetSec] = useState<number | null>(null);
  const [localOffsetMs, setLocalOffsetMs] = useState<number | null>(
    clickOffsetMs ?? null
  );
  const [localCountIn, setLocalCountIn] = useState<number>(
    countInBeats && countInBeats > 0 ? countInBeats : beatsPerBar
  );
  const [staircaseEnabled, setStaircaseEnabled] = useState(false);
  const [staircaseToPct, setStaircaseToPct] = useState(100);
  const [staircaseStepPct, setStaircaseStepPct] = useState(5);
  const [staircaseEveryLoops, setStaircaseEveryLoops] = useState(2);
  const [staircasePass, setStaircasePass] = useState(0);
  const [loopName, setLoopName] = useState("");
  const [savePending, startSave] = useTransition();
  const [clickSettingsSaved, setClickSettingsSaved] = useState(false);

  const countInTimerRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  const countingInRef = useRef(false);
  const manualLoopRef = useRef(false);
  // Verhindert Doppel-Auslösung des Loop-Nachtriggers, bis der nächste
  // Durchlauf (ggf. nach Einzähler) tatsächlich gestartet ist.
  const repeatingRef = useRef(false);

  // Grundtempo für das Klick-Raster: erkanntes Tempo bevorzugt (passt zur
  // erkannten Phase), sonst das bandweit hinterlegte.
  const clickBpm = baseBpm ?? songBpm ?? null;
  const storedOffsetMs = localOffsetMs ?? clickOffsetMs ?? null;
  const clickOffsetSec =
    storedOffsetMs != null ? storedOffsetMs / 1000 : detectedOffsetSec ?? 0;
  const effectiveCountIn = Math.max(0, Math.round(localCountIn || 0));
  const loopIsSet = loopStart !== null && loopEnd !== null && loopEnd > loopStart;
  const manualLoop = loopIsSet && (staircaseEnabled || countInEnabled);

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
          .then(({ bpm, offset }) => {
            if (cancelled) return;
            setBaseBpm(bpm);
            // "offset" ist die erkannte Phase des ersten Beats - Vorgabe fuer die
            // Klick-Spur, sofern am Song nichts Eigenes hinterlegt ist.
            if (typeof offset === "number" && Number.isFinite(offset)) {
              setDetectedOffsetSec(((offset % (60 / bpm)) + 60 / bpm) % (60 / bpm));
            }
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
      if (countInTimerRef.current) window.clearTimeout(countInTimerRef.current);
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

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    countingInRef.current = countingIn;
  }, [countingIn]);
  useEffect(() => {
    manualLoopRef.current = manualLoop;
  }, [manualLoop]);

  const currentPosition = useCallback(() => {
    const context = contextRef.current;
    if (!context || !playing || countingIn) return anchorRef.current.offset;
    const elapsed = (context.currentTime - anchorRef.current.contextTime) * tempoRef.current;
    let next = anchorRef.current.offset + elapsed;

    const loop = loopRef.current;
    if (loop && next > loop.end) {
      const span = loop.end - loop.start;
      next = span > 0 ? loop.start + ((next - loop.start) % span) : loop.start;
    }
    return Math.min(next, bufferRef.current?.duration ?? 0);
  }, [playing, countingIn]);

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
      // Bei aktiver Tempo-Treppe / Einzähler-pro-Durchlauf wird die Schleife
      // manuell nachgetriggert (siehe Loop-Supervisor), sonst nativ und
      // sample-genau lückenlos.
      if (loop && !manualLoopRef.current) {
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

  /** Kurzer synthetischer Klick zum Zeitpunkt "when" (Kontextzeit). */
  const playClick = useCallback((when: number, accent: boolean) => {
    const ctx = contextRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = accent ? 1600 : 1040;
    const vol = accent ? 0.5 : 0.3;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(vol, when + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + 0.06);
  }, []);

  /** Spielt "beats" Vorzähler-Klicks im aktuellen Tempo und ruft danach onDone. */
  const runCountIn = useCallback(
    (beats: number, onDone: () => void) => {
      const ctx = contextRef.current;
      if (!ctx || !clickBpm || beats <= 0) {
        onDone();
        return;
      }
      if (countInTimerRef.current) window.clearTimeout(countInTimerRef.current);
      setCountingIn(true);
      const beatReal = 60 / clickBpm / tempoRef.current;
      const t0 = ctx.currentTime + 0.12;
      for (let i = 0; i < beats; i++) {
        playClick(t0 + i * beatReal, i % beatsPerBar === 0);
      }
      const ms = Math.max(0, (t0 + beats * beatReal - ctx.currentTime) * 1000);
      countInTimerRef.current = window.setTimeout(() => {
        countInTimerRef.current = null;
        setCountingIn(false);
        onDone();
      }, ms);
    },
    [clickBpm, beatsPerBar, playClick]
  );

  const togglePlay = useCallback(async () => {
    const context = contextRef.current;
    if (!context || status !== "ready") return;
    if (context.state === "suspended") await context.resume();

    if (playing) {
      repeatingRef.current = false;
      if (countInTimerRef.current) {
        window.clearTimeout(countInTimerRef.current);
        countInTimerRef.current = null;
        setCountingIn(false);
      }
      const pausedAt = currentPosition();
      stopSource();
      anchorRef.current = { contextTime: context.currentTime, offset: pausedAt };
      setPosition(pausedAt);
      setPlaying(false);
    } else {
      const startOffset = anchorRef.current.offset;
      if (countInEnabled && effectiveCountIn > 0 && clickBpm) {
        setPlaying(true);
        runCountIn(effectiveCountIn, () => startAt(startOffset));
      } else {
        startAt(startOffset);
        setPlaying(true);
      }
    }
  }, [
    currentPosition,
    playing,
    startAt,
    status,
    stopSource,
    countInEnabled,
    effectiveCountIn,
    clickBpm,
    runCountIn,
  ]);

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

  // Setzt nur den Tempo-Wert an Quelle und Processor (Tonhöhe bleibt konstant),
  // ohne die Position neu zu eichen - für den internen Gebrauch beim manuellen
  // Loop-Nachtriggern, wo direkt danach startAt() folgt.
  const setTempoValue = useCallback((value: number) => {
    tempoRef.current = value;
    setTempo(value);
    const node = soundTouchRef.current as { playbackRate?: AudioParam } | null;
    if (node?.playbackRate) node.playbackRate.value = value;
  }, []);

  // Tempo wirkt sofort. Vorher wird die Position neu geeicht.
  const applyTempo = useCallback(
    (value: number) => {
      const context = contextRef.current;
      const here = currentPosition();
      setTempoValue(value);

      if (playing) {
        startAt(here);
      } else if (context) {
        anchorRef.current = { contextTime: context.currentTime, offset: here };
      }
    },
    [currentPosition, playing, startAt, setTempoValue]
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
      const loop = loopRef.current;
      if (source) {
        if (loop && !manualLoopRef.current) {
          source.loop = true;
          source.loopStart = loop.start;
          source.loopEnd = loop.end;
        } else {
          source.loop = false;
        }
      }
      // Neue Schleife: Tempo-Treppe von vorn beginnen.
      setStaircasePass(0);
      repeatingRef.current = false;

      // Sobald ein Loop-Bereich gesetzt wird, sofort an dessen Anfang springen -
      // ausser der Abspielcursor liegt bereits darin. Sonst liefe der Titel erst
      // in den Bereich hinein, bevor er anfaengt zu wiederholen.
      if (loop) {
        const here = currentPosition();
        if (here < loop.start || here >= loop.end) {
          seek(loop.start);
        }
      }
    },
    [currentPosition, seek]
  );

  // --- Metronom / Einzähler: Loop-Nachtrigger + Scheduler ------------------

  /** Nächster Schleifendurchlauf: ggf. Tempo-Treppe stufen und Einzähler. */
  const repeatLoopNow = useCallback(() => {
    const loop = loopRef.current;
    if (!loop || repeatingRef.current) return;
    repeatingRef.current = true;
    stopSource();

    let nextTempo = tempoRef.current;
    if (staircaseEnabled) {
      const pass = staircasePass + 1;
      if (pass >= staircaseEveryLoops) {
        setStaircasePass(0);
        nextTempo = Math.min(
          Math.round(tempoRef.current * 100 + staircaseStepPct) / 100,
          staircaseToPct / 100
        );
      } else {
        setStaircasePass(pass);
      }
    }

    const go = () => {
      if (Math.abs(nextTempo - tempoRef.current) > 1e-4) setTempoValue(nextTempo);
      startAt(loop.start);
      repeatingRef.current = false;
    };
    if (countInEnabled && effectiveCountIn > 0 && clickBpm) {
      runCountIn(effectiveCountIn, go);
    } else {
      go();
    }
  }, [
    stopSource,
    startAt,
    setTempoValue,
    runCountIn,
    staircaseEnabled,
    staircasePass,
    staircaseEveryLoops,
    staircaseStepPct,
    staircaseToPct,
    countInEnabled,
    effectiveCountIn,
    clickBpm,
  ]);

  // Kontinuierliches Metronom während der Wiedergabe: Lookahead-Scheduler, der
  // die Klicks der nächsten ~150 ms anhand des Beat-Rasters (Phase + Tempo) an
  // der Kontext-Uhr plant. Rechnet über dieselbe Anker-Mathematik wie die
  // Positionsanzeige, bleibt also bei Tempo-Wechsel, Loop und Sprung synchron.
  useEffect(() => {
    if (status !== "ready" || !clickEnabled || !clickBpm) return;
    const ctx = contextRef.current;
    if (!ctx) return;
    let lastBeat = -Infinity;
    let prevPos = 0;
    const beatDur = 60 / clickBpm;

    const id = window.setInterval(() => {
      if (!playingRef.current || countingInRef.current) return;
      const tempo = tempoRef.current;
      const anchor = anchorRef.current;
      const loop = loopRef.current;
      const pos = currentPosition();
      if (pos < prevPos - 0.05) lastBeat = -Infinity; // Loop-Wrap / Sprung
      prevPos = pos;

      const horizon = pos + 0.15 * tempo;
      let n = Math.ceil((pos - clickOffsetSec) / beatDur);
      for (let bt = clickOffsetSec + n * beatDur; bt < horizon; n += 1, bt = clickOffsetSec + n * beatDur) {
        if (bt <= pos || bt <= lastBeat + 1e-4) continue;
        if (loop && (bt < loop.start - 1e-3 || bt >= loop.end - 1e-3)) continue;
        const ctxTime = anchor.contextTime + (bt - anchor.offset) / tempo;
        if (ctxTime <= ctx.currentTime + 0.01) continue;
        const beatInBar = ((n % beatsPerBar) + beatsPerBar) % beatsPerBar;
        playClick(ctxTime, beatInBar === 0);
        lastBeat = bt;
      }
    }, 25);
    return () => window.clearInterval(id);
  }, [status, clickEnabled, clickBpm, clickOffsetSec, beatsPerBar, currentPosition, playClick]);

  // Loop-Supervisor: nur bei manuell nachgetriggerter Schleife (Tempo-Treppe
  // oder Einzähler pro Durchlauf) aktiv - erkennt das Erreichen des Loop-Endes
  // und stößt repeatLoopNow() an.
  useEffect(() => {
    if (status !== "ready" || !manualLoop) return;
    const id = window.setInterval(() => {
      if (!playingRef.current || countingInRef.current) return;
      const loop = loopRef.current;
      if (loop && currentPosition() >= loop.end - 0.05) repeatLoopNow();
    }, 40);
    return () => window.clearInterval(id);
  }, [status, manualLoop, currentPosition, repeatLoopNow]);

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

  const handleAdoptBpm = useCallback(
    (bpm: number) => {
      startAdoptBpm(async () => {
        await updateSongBpmAction(bandId, songId, bpm);
        setBpmAdopted(true);
      });
    },
    [bandId, songId]
  );

  function handleSaveLoop() {
    if (!saveLoopAction || loopStart === null || loopEnd === null) return;
    const name = loopName.trim();
    if (!name) return;
    startSave(async () => {
      const res = await saveLoopAction({ name, startSec: loopStart, endSec: loopEnd });
      if (!res?.error) {
        setLoopName("");
        router.refresh();
      }
    });
  }

  function handleDeleteLoop(loopId: string) {
    if (!deleteLoopAction) return;
    startSave(async () => {
      await deleteLoopAction(loopId);
      router.refresh();
    });
  }

  function handleApplySavedLoop(l: PracticeLoopItem) {
    applyLoop(l.startSec, Math.min(l.endSec, duration || l.endSec));
  }

  function handleSaveClickSettings() {
    if (!saveClickSettingsAction) return;
    startSave(async () => {
      const res = await saveClickSettingsAction({
        countInBeats: effectiveCountIn,
        clickOffsetMs: storedOffsetMs != null ? Math.round(storedOffsetMs) : null,
      });
      if (!res?.error) {
        setClickSettingsSaved(true);
        setTimeout(() => setClickSettingsSaved(false), 2000);
        router.refresh();
      }
    });
  }

  const clickSettingsDirty =
    (localOffsetMs != null && localOffsetMs !== (clickOffsetMs ?? null)) ||
    effectiveCountIn !== (countInBeats && countInBeats > 0 ? countInBeats : beatsPerBar);

  const nudgeOffset = (deltaMs: number) =>
    setLocalOffsetMs((current) => {
      const base = current ?? storedOffsetMs ?? Math.round((detectedOffsetSec ?? 0) * 1000);
      return Math.max(-2000, Math.min(2000, base + deltaMs));
    });

  const loopActive = loopStart !== null && loopEnd !== null && loopEnd > loopStart;
  const detectedBaseBpm = baseBpm !== null ? Math.round(baseBpm) : null;
  const bpmDiffers = detectedBaseBpm !== null && detectedBaseBpm !== songBpm;
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

      {detectedBaseBpm !== null && bpmDiffers && !bpmAdopted && !bpmBannerDismissed && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 p-2 text-sm">
          <span className="text-foreground">
            {t("bpmDiffers", { detected: detectedBaseBpm, current: songBpm != null ? `${songBpm} BPM` : t("noBpm") })}
          </span>
          <Button size="sm" onClick={() => handleAdoptBpm(detectedBaseBpm)} disabled={adoptBpmPending}>
            {t("adopt")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setBpmBannerDismissed(true)}>
            {t("discard")}
          </Button>
        </div>
      )}
      {bpmAdopted && <p className="text-xs text-muted">{t("bpmAdopted")}</p>}

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

      {/* Gespeicherte Übungsabschnitte (bandweit) */}
      {(practiceLoops.length > 0 || (saveLoopAction && loopActive)) && (
        <div className="space-y-2 border-t border-border pt-2">
          <span className="text-xs font-medium text-foreground">{t("savedLoops")}</span>
          {practiceLoops.length > 0 ? (
            <ul className="space-y-1">
              {practiceLoops.map((l) => (
                <li key={l.id} className="flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => handleApplySavedLoop(l)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:border-primary"
                  >
                    <Play className="h-3 w-3" />
                    {l.name}
                  </button>
                  <span className="font-mono text-xs text-muted">
                    {formatTime(l.startSec)} – {formatTime(l.endSec)}
                  </span>
                  {l.canDelete && deleteLoopAction && (
                    <button
                      type="button"
                      onClick={() => handleDeleteLoop(l.id)}
                      aria-label={t("deleteLoop")}
                      className="text-muted hover:text-danger"
                      disabled={savePending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">{t("noSavedLoops")}</p>
          )}
          {saveLoopAction && loopActive && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={loopName}
                onChange={(e) => setLoopName(e.target.value)}
                placeholder={t("loopNamePlaceholder")}
                className="h-8 w-40 text-xs"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveLoop}
                disabled={savePending || !loopName.trim()}
              >
                {t("saveLoop")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Klick-Spur / Einzähler */}
      <div className="space-y-2 border-t border-border pt-2">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <input
              type="checkbox"
              checked={clickEnabled}
              onChange={(e) => setClickEnabled(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            {t("metronome")}
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <input
              type="checkbox"
              checked={countInEnabled}
              onChange={(e) => setCountInEnabled(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            {t("countIn")}
          </label>
          {countInEnabled && (
            <label className="flex items-center gap-1.5 text-xs text-muted">
              {t("countInBeatsLabel")}
              <input
                type="number"
                min={1}
                max={16}
                value={localCountIn}
                onChange={(e) =>
                  setLocalCountIn(Math.max(1, Math.min(16, Number(e.target.value) || 1)))
                }
                className="w-14 rounded border border-border bg-surface px-1.5 py-0.5 text-xs"
              />
            </label>
          )}
          {countingIn && <span className="text-xs font-medium text-primary">{t("countingIn")}</span>}
        </div>

        {!clickBpm && (clickEnabled || countInEnabled) && (
          <p className="text-xs text-danger">{t("needBpmForClick")}</p>
        )}

        {clickEnabled && clickBpm && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{t("clickOffset")}</span>
            <button
              type="button"
              onClick={() => nudgeOffset(-10)}
              className="rounded border border-border p-1 hover:border-primary"
              aria-label="-10 ms"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="font-mono">{Math.round((storedOffsetMs ?? (detectedOffsetSec ?? 0) * 1000))} ms</span>
            <button
              type="button"
              onClick={() => nudgeOffset(10)}
              className="rounded border border-border p-1 hover:border-primary"
              aria-label="+10 ms"
            >
              <Plus className="h-3 w-3" />
            </button>
            {detectedOffsetSec !== null && (
              <button
                type="button"
                onClick={() => setLocalOffsetMs(Math.round(detectedOffsetSec * 1000))}
                className="underline hover:text-foreground"
              >
                {t("clickOffsetAuto")}
              </button>
            )}
          </div>
        )}

        {canManageSong && saveClickSettingsAction && clickSettingsDirty && (
          <Button variant="secondary" size="sm" onClick={handleSaveClickSettings} disabled={savePending}>
            {clickSettingsSaved ? t("clickSettingsSaved") : t("saveClickSettings")}
          </Button>
        )}
      </div>

      {/* Tempo-Treppe */}
      <div className="space-y-2 border-t border-border pt-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <input
            type="checkbox"
            checked={staircaseEnabled}
            onChange={(e) => setStaircaseEnabled(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
          <Timer className="h-3.5 w-3.5" />
          {t("staircase")}
        </label>
        {staircaseEnabled && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
              <label className="flex items-center gap-1.5">
                {t("staircaseTo")}
                <input
                  type="number"
                  min={Math.round(tempo * 100)}
                  max={MAX_TEMPO * 100}
                  step={5}
                  value={staircaseToPct}
                  onChange={(e) => setStaircaseToPct(Number(e.target.value) || 100)}
                  className="w-16 rounded border border-border bg-surface px-1.5 py-0.5"
                />
                %
              </label>
              <label className="flex items-center gap-1.5">
                {t("staircaseStep")}
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={staircaseStepPct}
                  onChange={(e) => setStaircaseStepPct(Math.max(1, Number(e.target.value) || 5))}
                  className="w-14 rounded border border-border bg-surface px-1.5 py-0.5"
                />
                %
              </label>
              <label className="flex items-center gap-1.5">
                {t("staircaseEvery")}
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={staircaseEveryLoops}
                  onChange={(e) => setStaircaseEveryLoops(Math.max(1, Number(e.target.value) || 2))}
                  className="w-14 rounded border border-border bg-surface px-1.5 py-0.5"
                />
              </label>
            </div>
            <p className="text-xs text-muted">
              {t("staircaseHint")}
              {loopActive
                ? ` · ${t("staircasePassLabel", { pass: staircasePass + 1, every: staircaseEveryLoops })}`
                : ` · ${t("staircaseNeedsLoop")}`}
            </p>
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
