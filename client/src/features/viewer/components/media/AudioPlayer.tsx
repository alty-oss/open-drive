import { useCallback, useEffect, useRef, useState } from "react";
import { Repeat2 } from "lucide-react";
import { useMediaPlayback } from "../../hooks/useMediaPlayback";
import { useMediaSpaceShortcut } from "../../hooks/useMediaSpaceShortcut";
import { logClientError } from "@/shared/lib/logger";
import MediaTransportControls from "./MediaTransportControls";
import { cn } from "@/shared/ui/cn";
import {
  audioStage,
  controlSkin,
  audioVisualizer,
  buttonActive,
  controlPanel,
  fileName as fileNameClass,
  fileRow,
  iconButton,
  mediaPlayer,
  mediaTime,
  progressFill,
  progressTrack,
} from "../../lib/mediaStyles";

interface AudioPlayerProps {
  src: string;
  fileName: string;
  active?: boolean;
  onPrev?: (() => void) | null;
  onNext?: (() => void) | null;
}

const BAR_WIDTH = 4;
const BAR_GAP = 3;

function formatTime(secondsValue: number): string {
  if (!secondsValue || Number.isNaN(secondsValue)) return "0:00";
  const minutes = Math.floor(secondsValue / 60);
  const seconds = Math.floor(secondsValue % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function accent(alpha: number): string {
  const value =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim() || "#06704f";
  const hex = value.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!hex) return value;
  return `rgba(${parseInt(hex[1], 16)}, ${parseInt(hex[2], 16)}, ${parseInt(hex[3], 16)}, ${alpha})`;
}

export default function AudioPlayer({
  src,
  fileName,
  active = true,
  onPrev,
  onNext,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const graphDisposeTimerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const vizContainerRef = useRef<HTMLDivElement>(null);
  const [vizSize, setVizSize] = useState({ width: 320, height: 180 });
  const ensureAudioGraph = useCallback(async () => {
    if (graphDisposeTimerRef.current !== null) {
      window.clearTimeout(graphDisposeTimerRef.current);
      graphDisposeTimerRef.current = null;
    }

    let context = audioCtxRef.current;
    if (!context) {
      const audio = audioRef.current;
      if (!audio) return;

      try {
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.82;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        const source = context.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(context.destination);

        audioCtxRef.current = context;
        analyserRef.current = analyser;
        sourceNodeRef.current = source;
      } catch (error) {
        if (context && context.state !== "closed") void context.close();
        logClientError("audio.visualizer_init_failed", error, { src });
        return;
      }
    }

    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {}
    }
  }, [src]);
  const {
    playing,
    currentTime,
    duration,
    loop,
    muted,
    progress,
    displayVolume,
    seek,
    seekBy,
    seekTo,
    setVolume,
    toggleLoop,
    toggleMute,
    togglePlay,
  } = useMediaPlayback(audioRef, {
    src,
    active,
    beforePlay: ensureAudioGraph,
  });

  useMediaSpaceShortcut(togglePlay, active);

  useEffect(() => {
    if (graphDisposeTimerRef.current !== null) {
      window.clearTimeout(graphDisposeTimerRef.current);
      graphDisposeTimerRef.current = null;
    }

    return () => {
      cancelAnimationFrame(rafRef.current);


      graphDisposeTimerRef.current = window.setTimeout(() => {
        const context = audioCtxRef.current;
        sourceNodeRef.current?.disconnect();
        analyserRef.current?.disconnect();
        sourceNodeRef.current = null;
        analyserRef.current = null;
        audioCtxRef.current = null;
        graphDisposeTimerRef.current = null;
        if (context && context.state !== "closed") void context.close();
      }, 0);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const waveformData = new Uint8Array(analyser.fftSize);
    const nyquist = (audioCtxRef.current?.sampleRate ?? 44100) / 2;
    const logMin = Math.log10(40);
    const logMax = Math.log10(nyquist);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(frequencyData);
      analyser.getByteTimeDomainData(waveformData);
      context.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;
      const barCount = Math.floor(width / (BAR_WIDTH + BAR_GAP));

      context.fillStyle = accent(0.12);
      context.fillRect(0, Math.round(centerY), width, 1);

      for (let index = 0; index < barCount; index++) {
        const logFrequency =
          logMin + (index / barCount) * (logMax - logMin);
        const frequency = Math.pow(10, logFrequency);
        const binStart = Math.floor(
          (frequency / nyquist) * frequencyData.length,
        );
        const binEnd = Math.min(
          Math.ceil(
            (Math.pow(
              10,
              logMin + ((index + 1) / barCount) * (logMax - logMin),
            ) /
              nyquist) *
              frequencyData.length,
          ),
          frequencyData.length - 1,
        );
        let sum = 0;
        const count = Math.max(1, binEnd - binStart);
        for (let bin = binStart; bin < binStart + count; bin++) {
          sum += frequencyData[bin];
        }
        const value = sum / count / 255;
        if (value <= 0.025) continue;

        const barHeight = Math.max(3, value * height * 0.4);
        context.fillStyle = accent(Math.min(0.9, 0.24 + value * 0.72));
        context.fillRect(
          index * (BAR_WIDTH + BAR_GAP),
          centerY - barHeight,
          BAR_WIDTH,
          barHeight * 2,
        );
      }

      context.beginPath();
      for (let x = 0; x < width; x += 3) {
        const dateIndex = Math.floor((x / width) * waveformData.length);
        const value = (waveformData[dateIndex] - 128) / 128;
        const y = centerY + value * height * 0.25;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = accent(0.82);
      context.lineWidth = 1.5;
      context.stroke();
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [vizSize]);

  useEffect(() => {
    const container = vizContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setVizSize({
        width: Math.max(1, Math.floor(entry.contentRect.width)),
        height: Math.max(1, Math.floor(entry.contentRect.height)),
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={mediaPlayer} data-kind="audio">
      <audio ref={audioRef} src={src} />

      <div className={audioStage}>
        <div ref={vizContainerRef} className={audioVisualizer}>
          <canvas
            ref={canvasRef}
            width={vizSize.width}
            height={vizSize.height}
          />
        </div>
      </div>

      <div className={controlPanel}>
        <div className={fileRow}>
          <span className={fileNameClass}>{fileName}</span>
        </div>
        <div
          className={cn(progressTrack, "group/track")}
          onClick={seek}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              event.stopPropagation();
              seekBy(event.key === "ArrowRight" ? 5 : -5);
            } else if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              event.stopPropagation();
              seekTo(event.key === "End" ? 1 : 0);
            }
          }}
          role="slider"
          tabIndex={0}
          aria-label="Audio progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
        >
          <div
            className={progressFill}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <MediaTransportControls
          kind="audio"
          playing={playing}
          muted={muted}
          displayVolume={displayVolume}
          onTogglePlay={() => void togglePlay()}
          onToggleMute={toggleMute}
          onVolumeChange={setVolume}
          onVolumeStep={(delta) => setVolume(displayVolume + delta)}
          showNavigation
          onPrev={onPrev}
          onNext={onNext}
        >
          <div className="flex-1" />
          <span className={mediaTime}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <button
            type="button"
            onClick={toggleLoop}
            aria-label={loop ? "Disable loop" : "Loop audio"}
            aria-pressed={loop}
            className={cn(iconButton, controlSkin(false), loop && buttonActive)}
          >
            <Repeat2 />
          </button>
        </MediaTransportControls>
      </div>
    </div>
  );
}
