import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Captions,
  Maximize,
  Minimize,
  PictureInPicture,
  Play,
  Repeat2,
  X,
} from "lucide-react";
import { useMediaPlayback } from "../../hooks/useMediaPlayback";
import MediaTransportControls from "./MediaTransportControls";
import { cn } from "@/shared/ui/cn";
import {
  buttonActive,
  controlPanel,
  controlSkin,
  fileRow,
  hiddenInFullscreen,
  iconButton,
  mediaPlayer,
  mediaTime,
  overlayPlay,
  progressFill,
  progressTrack,
  secondaryAction,
  subtitleError,
  subtitleLayer,
  subtitleStatus,
  subtitleText,
  videoStage,
} from "../../lib/mediaStyles";
import { logClientError } from "@/shared/lib/logger";
import { parseSubtitleText, type SubtitleCue } from "../../lib/subtitles";
import type { FileItem } from "@/shared/files/types";
import SubtitleSourceDialog from "./SubtitleSourceDialog";
import { useMediaSpaceShortcut } from "../../hooks/useMediaSpaceShortcut";
import { loadSubtitleFile } from "../../api/viewerApi";

interface VideoPlayerProps {
  src: string;
  fileName: string;
  active?: boolean;
  onPrev?: (() => void) | null;
  onNext?: (() => void) | null;
}

function formatTime(secondsValue: number): string {
  if (!secondsValue || Number.isNaN(secondsValue)) return "0:00";
  const hours = Math.floor(secondsValue / 3600);
  const minutes = Math.floor((secondsValue % 3600) / 60);
  const seconds = Math.floor(secondsValue % 60);
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function VideoPlayer({
  src,
  fileName,
  active = true,
  onPrev,
  onNext,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [pipSupported, setPipSupported] = useState(false);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitleName, setSubtitleName] = useState("");
  const [subtitleSource, setSubtitleSource] = useState<
    "OpenDrive" | "Temporary" | ""
  >("");
  const [subtitleError, setSubtitleError] = useState("");
  const [subtitleDialogOpen, setSubtitleDialogOpen] = useState(false);
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
  } = useMediaPlayback(videoRef, { src, active });

  useMediaSpaceShortcut(togglePlay, active && !subtitleDialogOpen);

  useEffect(() => {
    setSubtitleCues([]);
    setSubtitleName("");
    setSubtitleSource("");
    setSubtitleError("");
    setSubtitleDialogOpen(false);
    if (subtitleInputRef.current) subtitleInputRef.current.value = "";
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setPipSupported(
      document.pictureInPictureEnabled && !video.disablePictureInPicture,
    );
  }, [src]);

  useEffect(() => {
    const onFullscreenChange = () =>
      setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const clearControlsTimer = useCallback(() => {
    if (controlsTimerRef.current === null) return;
    window.clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = null;
  }, []);

  const scheduleControlsHide = useCallback(() => {
    clearControlsTimer();
    if (!fullscreen || !playing || subtitleDialogOpen) {
      setControlsVisible(true);
      return;
    }
    controlsTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
      controlsTimerRef.current = null;
    }, 2200);
  }, [
    clearControlsTimer,
    fullscreen,
    playing,
    subtitleDialogOpen,
  ]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  useEffect(() => {
    if (fullscreen) revealControls();
    else {
      clearControlsTimer();
      setControlsVisible(true);
    }
    return clearControlsTimer;
  }, [clearControlsTimer, fullscreen, revealControls]);

  const toggleFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell) return;
    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen();
      } else {
        await shell.requestFullscreen();
      }
    } catch (error) {
      logClientError("video.fullscreen_failed", error, { src });
    }
  };

  const togglePictureInPicture = async () => {
    const video = videoRef.current;
    if (!video || !pipSupported) return;
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (error) {
      logClientError("video.picture_in_picture_failed", error, { src });
    }
  };

  const activeCue = useMemo(
    () =>
      subtitleCues.find(
        (cue) => currentTime >= cue.start && currentTime <= cue.end,
      ) ?? null,
    [currentTime, subtitleCues],
  );

  const applySubtitle = (
    source: string,
    name: string,
    origin: "OpenDrive" | "Temporary",
  ) => {
    const cues = parseSubtitleText(source);
    if (cues.length === 0) {
      setSubtitleCues([]);
      setSubtitleName("");
      setSubtitleSource("");
      setSubtitleError("Unable to read this subtitle.");
      return false;
    }
    setSubtitleCues(cues);
    setSubtitleName(name);
    setSubtitleSource(origin);
    setSubtitleError("");
    return true;
  };

  const loadTemporarySubtitle = async (file: File) => {
    try {
      applySubtitle(await file.text(), file.name, "Temporary");
    } catch (error) {
      setSubtitleCues([]);
      setSubtitleName("");
      setSubtitleSource("");
      setSubtitleError("Unable to load a subtitle.");
      logClientError("video.subtitle_parse_failed", error, {
        subtitleName: file.name,
      });
    }
  };

  const loadOpenDriveSubtitle = async (file: FileItem) => {
    setSubtitleDialogOpen(false);
    setSubtitleError("");
    try {
      applySubtitle(await loadSubtitleFile(file.path), file.name, "OpenDrive");
    } catch (error) {
      setSubtitleCues([]);
      setSubtitleName("");
      setSubtitleSource("");
      setSubtitleError("Unable to load a subtitle from OpenDrive.");
      logClientError("video.subtitle_open-drive_failed", error, {
        subtitlePath: file.path,
      });
    }
  };

  const clearSubtitle = () => {
    setSubtitleCues([]);
    setSubtitleName("");
    setSubtitleSource("");
    setSubtitleError("");
    if (subtitleInputRef.current) subtitleInputRef.current.value = "";
  };

  return (
    <div
      ref={shellRef}
      className={mediaPlayer}
      data-kind="video"
      data-fullscreen={fullscreen || undefined}
      data-controls-hidden={
        fullscreen && !controlsVisible ? "" : undefined
      }
      onPointerMove={revealControls}
      onPointerLeave={() => {
        if (fullscreen && playing && !subtitleDialogOpen) {
          clearControlsTimer();
          setControlsVisible(false);
        }
      }}
    >
      <div className={videoStage}>
        <video
          ref={videoRef}
          src={src}
          playsInline
          className="h-full w-full object-contain outline-none"
          onClick={() => {
            void togglePlay();
            revealControls();
          }}
          onDoubleClick={toggleFullscreen}
          crossOrigin="use-credentials"
        >
          Your browser does not support this video.
        </video>

        {activeCue ? (
          <div className={subtitleLayer} aria-live="off">
            <div className={subtitleText}>
              {activeCue.text.split("\n").map((line, index) => (
                <span key={`${activeCue.start}-${index}`}>{line}</span>
              ))}
            </div>
          </div>
        ) : null}

        {!playing ? (
          <button
            type="button"
            onClick={() => void togglePlay()}
            aria-label="Play video"
            className={overlayPlay}
          >
            <Play />
          </button>
        ) : null}
      </div>

      <div className={controlPanel}>

        {subtitleName ? (
          <div className={cn(fileRow, hiddenInFullscreen)}>
            <span className={subtitleStatus}>
              <Captions />
              <span>{subtitleName}</span>
              <small>{subtitleSource}</small>
            </span>
          </div>
        ) : null}
        {subtitleError ? (
          <div className={cn(subtitleError, hiddenInFullscreen)} role="status">
            {subtitleError}
          </div>
        ) : null}

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
          aria-label="Video progress"
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
          kind="video"
          fullscreen={fullscreen}
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
          volumeClassName="w-24"
        >
          <span className={mediaTime}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="flex-1" />
          <input
            ref={subtitleInputRef}
            type="file"
            accept=".srt,.vtt,text/vtt,application/x-subrip"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadTemporarySubtitle(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => setSubtitleDialogOpen(true)}
            aria-label={
              subtitleName ? "Switch subtitle file" : "Load subtitle"
            }
            className={cn(iconButton, controlSkin(fullscreen), subtitleName && buttonActive)}
          >
            <Captions />
          </button>
          {subtitleName ? (
            <button
              type="button"
              onClick={clearSubtitle}
              aria-label="Remove subtitle"
              className={cn(iconButton, controlSkin(fullscreen))}
            >
              <X />
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggleLoop}
            aria-label={loop ? "Disable loop" : "Loop video"}
            aria-pressed={loop}
            className={cn(iconButton, controlSkin(fullscreen), secondaryAction, loop && buttonActive)}
          >
            <Repeat2 />
          </button>
          {pipSupported ? (
            <button
              type="button"
              onClick={togglePictureInPicture}
              aria-label="Open picture-in-picture"
              className={cn(iconButton, controlSkin(fullscreen), secondaryAction)}
            >
              <PictureInPicture />
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            className={cn(iconButton, controlSkin(fullscreen))}
          >
            {fullscreen ? <Minimize /> : <Maximize />}
          </button>
        </MediaTransportControls>
      </div>

      {subtitleDialogOpen ? (
        <SubtitleSourceDialog
          onClose={() => setSubtitleDialogOpen(false)}
          onSelectOpenDriveFile={(file) => void loadOpenDriveSubtitle(file)}
          onTemporaryUpload={() => subtitleInputRef.current?.click()}
        />
      ) : null}
    </div>
  );
}
