import { useEffect, useState, type RefObject } from "react";

const VOLUME_KEY = "open-drive:media-volume";
const MUTED_KEY = "open-drive:media-muted";

function readVolume(): number {
  const saved = window.localStorage.getItem(VOLUME_KEY);
  const volume = saved === null ? 1 : Number(saved);
  return Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
}

function readMuted(): boolean {
  return window.localStorage.getItem(MUTED_KEY) === "true";
}

export function usePersistentMediaVolume(
  mediaRef: RefObject<HTMLMediaElement | null>,
) {
  const [volume, setVolume] = useState(readVolume);
  const [muted, setMuted] = useState(readMuted);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    media.volume = volume;
    media.muted = muted;

    const syncVolume = () => {
      setVolume(media.volume);
      setMuted(media.muted);
      window.localStorage.setItem(VOLUME_KEY, String(media.volume));
      window.localStorage.setItem(MUTED_KEY, String(media.muted));
    };

    media.addEventListener("volumechange", syncVolume);
    syncVolume();

    return () => media.removeEventListener("volumechange", syncVolume);
  }, [mediaRef, muted, volume]);

  return { volume, muted };
}
