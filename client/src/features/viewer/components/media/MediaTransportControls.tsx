import type { ReactNode } from "react";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { useDragRatio } from "@/shared/hooks/useDragRatio";
import {
  controlSkin,
  navigationButton,
  playButton,
  playSkin,
  transportRow,
  volumeButton,
  volumeFill,
  volumeTrack,
} from "../../lib/mediaStyles";

interface MediaTransportControlsProps {
  kind: "audio" | "video";
  playing: boolean;
  muted: boolean;
  displayVolume: number;
  onTogglePlay: () => void;
  onToggleMute: () => void;

  onVolumeChange: (ratio: number) => void;
  onVolumeStep: (delta: number) => void;
  showNavigation?: boolean;
  onPrev?: (() => void) | null;
  onNext?: (() => void) | null;
  volumeClassName?: string;

  fullscreen?: boolean;
  children?: ReactNode;
}

export default function MediaTransportControls({
  kind,
  playing,
  muted,
  displayVolume,
  onTogglePlay,
  onToggleMute,
  onVolumeChange,
  onVolumeStep,
  showNavigation = false,
  onPrev,
  onNext,
  volumeClassName = "w-20",
  fullscreen = false,
  children,
}: MediaTransportControlsProps) {
  const { dragging: draggingVolume, dragHandlers: volumeDragHandlers } =
    useDragRatio(onVolumeChange);

  return (
    <div className={transportRow}>
      {showNavigation ? (
        <button
          type="button"
          onClick={() => onPrev?.()}
          disabled={!onPrev}
          aria-label={`${kind === "video" ? "Video" : "Audio"} previous`}
          className={cn(navigationButton, controlSkin(fullscreen))}
        >
          <SkipBack />
        </button>
      ) : null}

      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={playing ? `Pausar ${kind}` : `Reproduzir ${kind}`}
        className={cn(playButton, playSkin(fullscreen))}
      >
        {playing ? <Pause /> : <Play />}
      </button>

      {showNavigation ? (
        <button
          type="button"
          onClick={() => onNext?.()}
          disabled={!onNext}
          aria-label={`Next ${kind}`}
          className={cn(navigationButton, controlSkin(fullscreen))}
        >
          <SkipForward />
        </button>
      ) : null}

      <button
        type="button"
        onClick={onToggleMute}
        aria-label={
          muted || displayVolume === 0
            ? `Ativar ${kind}`
            : `Silenciar ${kind}`
        }
        className={cn(volumeButton, controlSkin(fullscreen))}
      >
        {muted || displayVolume === 0 ? <VolumeX /> : <Volume2 />}
      </button>

      <div
        className={cn(volumeTrack, volumeClassName)}
        data-dragging={draggingVolume ? "" : undefined}
        {...volumeDragHandlers}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          event.stopPropagation();
          onVolumeStep(event.key === "ArrowRight" ? 0.05 : -0.05);
        }}
        role="slider"
        tabIndex={0}
        aria-label={`Volume of ${kind}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(displayVolume * 100)}
      >
        <div
          className={volumeFill}
          style={{ width: `${displayVolume * 100}%` }}
        />
      </div>

      {children}
    </div>
  );
}
