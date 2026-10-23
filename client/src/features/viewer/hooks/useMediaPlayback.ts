import { useEffect, useRef, useState, type RefObject } from "react";
import { usePersistentMediaVolume } from "./usePersistentMediaVolume";
import { logClientError } from "@/shared/lib/logger";

interface UseMediaPlaybackOptions {
  src: string;
  active?: boolean;
  beforePlay?: () => void | Promise<void>;
}

export function useMediaPlayback(
  mediaRef: RefObject<HTMLMediaElement | null>,
  { src, active = true, beforePlay }: UseMediaPlaybackOptions,
) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loop, setLoop] = useState(false);
  const beforePlayRef = useRef(beforePlay);
  const srcRef = useRef(src);
  const { volume, muted } = usePersistentMediaVolume(mediaRef);

  beforePlayRef.current = beforePlay;
  srcRef.current = src;

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    let animationFrame = 0;
    const syncTime = () => setCurrentTime(media.currentTime);
    const syncDuration = () =>
      setDuration(Number.isFinite(media.duration) ? media.duration : 0);
    const syncPlayback = () => setPlaying(!media.paused && !media.ended);
    const stopTimeSync = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };
    const syncTimeWhilePlaying = () => {
      syncTime();
      if (!media.paused && !media.ended) {
        animationFrame = requestAnimationFrame(syncTimeWhilePlaying);
      } else {
        animationFrame = 0;
      }
    };
    const startTimeSync = () => {
      syncPlayback();
      stopTimeSync();
      animationFrame = requestAnimationFrame(syncTimeWhilePlaying);
    };
    const stopPlaybackSync = () => {
      stopTimeSync();
      syncTime();
      syncPlayback();
    };
    const resetPlayback = () => {
      stopTimeSync();
      setCurrentTime(0);
      setDuration(0);
      setPlaying(false);
    };

    media.addEventListener("loadedmetadata", syncDuration);
    media.addEventListener("durationchange", syncDuration);
    media.addEventListener("timeupdate", syncTime);
    media.addEventListener("seeked", syncTime);
    media.addEventListener("play", startTimeSync);
    media.addEventListener("playing", startTimeSync);
    media.addEventListener("pause", stopPlaybackSync);
    media.addEventListener("ended", stopPlaybackSync);
    media.addEventListener("emptied", resetPlayback);
    media.addEventListener("loadstart", resetPlayback);
    syncTime();
    syncDuration();
    syncPlayback();

    return () => {
      stopTimeSync();
      media.removeEventListener("loadedmetadata", syncDuration);
      media.removeEventListener("durationchange", syncDuration);
      media.removeEventListener("timeupdate", syncTime);
      media.removeEventListener("seeked", syncTime);
      media.removeEventListener("play", startTimeSync);
      media.removeEventListener("playing", startTimeSync);
      media.removeEventListener("pause", stopPlaybackSync);
      media.removeEventListener("ended", stopPlaybackSync);
      media.removeEventListener("emptied", resetPlayback);
      media.removeEventListener("loadstart", resetPlayback);
    };
  }, [mediaRef]);




  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    let cancelled = false;

    media.pause();
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
    media.load();

    const start = async () => {
      if (!active) return;
      try {
        await beforePlayRef.current?.();
        if (cancelled || mediaRef.current !== media) return;
        await media.play();
      } catch (error) {
        if (cancelled) return;
        logClientError("media.playback_failed", error, { src: srcRef.current });
      }
    };
    void start();

    return () => {
      cancelled = true;
      media.pause();
    };
  }, [active, mediaRef, src]);

  const togglePlay = async () => {
    const media = mediaRef.current;
    if (!media) return;
    try {
      if (media.paused) {
        await beforePlay?.();
        await media.play();
      } else {
        media.pause();
      }
    } catch (error) {
      logClientError("media.playback_failed", error, { src });
    }
  };

  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    const media = mediaRef.current;
    if (!media || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width),
    );
    media.currentTime = ratio * duration;
    setCurrentTime(media.currentTime);
  };

  const seekBy = (seconds: number) => {
    const media = mediaRef.current;
    if (!media || !duration) return;
    media.currentTime = Math.max(
      0,
      Math.min(duration, media.currentTime + seconds),
    );
    setCurrentTime(media.currentTime);
  };

  const seekTo = (ratio: number) => {
    const media = mediaRef.current;
    if (!media || !duration) return;
    media.currentTime = Math.max(0, Math.min(1, ratio)) * duration;
    setCurrentTime(media.currentTime);
  };

  const setVolume = (nextVolume: number) => {
    const media = mediaRef.current;
    if (!media) return;
    media.volume = Math.max(0, Math.min(1, nextVolume));
    media.muted = false;
  };

  const toggleMute = () => {
    const media = mediaRef.current;
    if (media) media.muted = !media.muted;
  };

  const toggleLoop = () => {
    const media = mediaRef.current;
    if (!media) return;
    media.loop = !media.loop;
    setLoop(media.loop);
  };

  return {
    playing,
    currentTime,
    duration,
    loop,
    volume,
    muted,
    progress:
      duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0,
    displayVolume: muted ? 0 : volume,
    seek,
    seekBy,
    seekTo,
    setVolume,
    toggleLoop,
    toggleMute,
    togglePlay,
  };
}
