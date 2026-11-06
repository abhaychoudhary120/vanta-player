import { useEffect, type RefObject } from "react";
import { usePlayerStore } from "../store/usePlayerStore";
import type { Track } from "../types";

function hasMediaSession(): boolean {
  return "mediaSession" in navigator;
}

export function useSystemMediaControls(
  mediaRef: RefObject<HTMLVideoElement | null>,
  track: Track | null,
  artwork: string | null,
) {
  const isPlaying = usePlayerStore((state) => state.isPlaying);

  useEffect(() => {
    if (!hasMediaSession()) {
      return;
    }

    const handlers: Partial<
      Record<MediaSessionAction, MediaSessionActionHandler>
    > = {
      play: () => {
        const media = mediaRef.current;
        if (!media) {
          return;
        }

        usePlayerStore.getState().setError(null);
        const attempt = media.play();
        if (attempt) {
          void attempt.catch(() => undefined);
        }
      },
      pause: () => {
        mediaRef.current?.pause();
      },
      previoustrack: () => {
        const state = usePlayerStore.getState();
        const media = mediaRef.current;

        if (media && media.currentTime > 3) {
          media.currentTime = 0;
          return;
        }

        if (!state.playPrevious() && media) {
          media.currentTime = 0;
        }
      },
      nexttrack: () => {
        const state = usePlayerStore.getState();

        if (!state.playNext()) {
          mediaRef.current?.pause();
          state.setPlaying(false);
          state.setBuffering(false);
          state.setPendingPlay(false);
        }
      },
      seekbackward: (details) => {
        const media = mediaRef.current;
        if (!media) {
          return;
        }

        const offset = details.seekOffset ?? 10;
        media.currentTime = Math.max(0, media.currentTime - offset);
      },
      seekforward: (details) => {
        const media = mediaRef.current;
        if (!media) {
          return;
        }

        const offset = details.seekOffset ?? 10;
        const maximum = Number.isFinite(media.duration)
          ? media.duration
          : Number.POSITIVE_INFINITY;
        media.currentTime = Math.min(maximum, media.currentTime + offset);
      },
      seekto: (details) => {
        const media = mediaRef.current;
        const time = details.seekTime;

        if (!media || time === undefined || !Number.isFinite(time)) {
          return;
        }

        media.currentTime = Math.max(0, time);
      },
    };

    const entries = Object.entries(handlers) as [
      MediaSessionAction,
      MediaSessionActionHandler,
    ][];

    for (const [action, handler] of entries) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Unsupported actions are optional.
      }
    }

    return () => {
      for (const [action] of entries) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // The platform may have already released the action.
        }
      }
    };
  }, [mediaRef]);

  useEffect(() => {
    if (!hasMediaSession()) {
      return;
    }

    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    if (typeof MediaMetadata === "undefined") {
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist ?? "VANTA",
      album: track.album ?? "",
      artwork: artwork ? [{ src: artwork }] : [],
    });
  }, [track, artwork]);

  useEffect(() => {
    if (!hasMediaSession()) {
      return;
    }

    navigator.mediaSession.playbackState = !track
      ? "none"
      : isPlaying
        ? "playing"
        : "paused";
  }, [track, isPlaying]);
}
