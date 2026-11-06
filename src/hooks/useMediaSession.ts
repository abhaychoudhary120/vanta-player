import { useEffect, type RefObject } from "react";
import { usePlayerStore } from "../store/usePlayerStore";
import { toAssetUrl } from "../lib/media";

function mediaErrorMessage(error: MediaError | null): string {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return "Playback was interrupted.";
    case MediaError.MEDIA_ERR_NETWORK:
      return "This file could not be read. It may have moved, or access was denied.";
    case MediaError.MEDIA_ERR_DECODE:
      return "This file uses an audio or video codec that Windows cannot decode.";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "This format is not supported by the playback engine.";
    default:
      return "This file could not be played.";
  }
}

async function beginPlayback(element: HTMLVideoElement) {
  try {
    await element.play();
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === "AbortError") {
        return;
      }

      if (error.name === "NotAllowedError") {
        const state = usePlayerStore.getState();
        state.setPendingPlay(false);
        state.setBuffering(false);
        state.notify("Playback needs a click on the play button to begin.", "error");
      }
    }
  }
}

export function useMediaSession(mediaRef: RefObject<HTMLVideoElement | null>) {
  const currentId = usePlayerStore((state) => state.currentId);
  const currentTrack = usePlayerStore(
    (state) => state.tracks.find((track) => track.id === state.currentId) ?? null,
  );
  const volume = usePlayerStore((state) => state.volume);
  const muted = usePlayerStore((state) => state.muted);
  const rate = usePlayerStore((state) => state.rate);
  const preservesPitch = usePlayerStore((state) => state.preservesPitch);
  const pendingPlay = usePlayerStore((state) => state.pendingPlay);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) {
      return;
    }

    const handleLoadedMetadata = () => {
      const state = usePlayerStore.getState();
      const nextDuration = Number.isFinite(element.duration)
        ? element.duration
        : 0;

      if (nextDuration > 0) {
        state.setDuration(nextDuration);
      }
      state.setBuffering(false);
    };

    const handleDurationChange = () => {
      if (Number.isFinite(element.duration) && element.duration > 0) {
        usePlayerStore.getState().setDuration(element.duration);
      }
    };

    const handleTimeUpdate = () => {
      usePlayerStore.getState().setCurrentTime(element.currentTime);
    };

    const handleProgress = () => {
      if (element.buffered.length === 0) {
        usePlayerStore.getState().setBuffered(0);
        return;
      }

      let bufferedEnd = element.buffered.end(element.buffered.length - 1);
      for (let index = 0; index < element.buffered.length; index += 1) {
        if (
          element.currentTime >= element.buffered.start(index) &&
          element.currentTime <= element.buffered.end(index)
        ) {
          bufferedEnd = element.buffered.end(index);
          break;
        }
      }

      usePlayerStore.getState().setBuffered(bufferedEnd);
    };

    const handlePlay = () => {
      const state = usePlayerStore.getState();
      state.setPlaying(true);
      state.setError(null);
    };

    const handlePlaying = () => {
      const state = usePlayerStore.getState();
      state.setPlaying(true);
      state.setBuffering(false);
    };

    const handlePause = () => {
      const state = usePlayerStore.getState();
      state.setPlaying(false);
      state.setBuffering(false);
    };

    const handleWaiting = () => {
      usePlayerStore.getState().setBuffering(true);
    };

    const handleSeeking = () => {
      usePlayerStore.getState().setBuffering(true);
    };

    const handleSeeked = () => {
      usePlayerStore.getState().setBuffering(false);
    };

    const handlePlayPauseSettled = () => {
      if (!element.paused) {
        usePlayerStore.getState().setBuffering(false);
      }
    };

    const handleEnded = () => {
      const state = usePlayerStore.getState();

      if (state.repeat === "one") {
        element.currentTime = 0;
        void beginPlayback(element);
        return;
      }

      const advanced = state.playNext();
      if (!advanced) {
        state.setPlaying(false);
        state.setBuffering(false);
      }
    };

    const handleError = () => {
      const state = usePlayerStore.getState();
      if (!state.currentId || !element.getAttribute("src")) {
        return;
      }

      const message = mediaErrorMessage(element.error);
      if (state.error === message) {
        return;
      }

      state.setError(message);
      state.setBuffering(false);
      state.setPlaying(false);
      state.notify(message, "error");
    };

    element.addEventListener("loadedmetadata", handleLoadedMetadata);
    element.addEventListener("durationchange", handleDurationChange);
    element.addEventListener("timeupdate", handleTimeUpdate);
    element.addEventListener("progress", handleProgress);
    element.addEventListener("play", handlePlay);
    element.addEventListener("playing", handlePlaying);
    element.addEventListener("pause", handlePause);
    element.addEventListener("waiting", handleWaiting);
    element.addEventListener("seeking", handleSeeking);
    element.addEventListener("seeked", handleSeeked);
    element.addEventListener("canplay", handlePlayPauseSettled);
    element.addEventListener("ended", handleEnded);
    element.addEventListener("error", handleError);

    return () => {
      element.removeEventListener("loadedmetadata", handleLoadedMetadata);
      element.removeEventListener("durationchange", handleDurationChange);
      element.removeEventListener("timeupdate", handleTimeUpdate);
      element.removeEventListener("progress", handleProgress);
      element.removeEventListener("play", handlePlay);
      element.removeEventListener("playing", handlePlaying);
      element.removeEventListener("pause", handlePause);
      element.removeEventListener("waiting", handleWaiting);
      element.removeEventListener("seeking", handleSeeking);
      element.removeEventListener("seeked", handleSeeked);
      element.removeEventListener("canplay", handlePlayPauseSettled);
      element.removeEventListener("ended", handleEnded);
      element.removeEventListener("error", handleError);
    };
  }, [mediaRef]);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) {
      return;
    }

    const state = usePlayerStore.getState();

    if (!currentTrack) {
      element.pause();

      if (element.hasAttribute("src")) {
        element.removeAttribute("src");
        element.load();
      }

      state.setBuffering(false);
      return;
    }

    if (currentTrack.kind === "image") {
      element.pause();

      if (element.hasAttribute("src")) {
        element.removeAttribute("src");
        element.load();
      }

      state.setCurrentTime(0);
      state.setDuration(0);
      state.setBuffered(0);
      state.setError(null);
      state.setPlaying(false);
      state.setBuffering(false);
      return;
    }

    const nextSource = toAssetUrl(currentTrack.path);

    if (element.src !== nextSource) {
      element.src = nextSource;
      element.load();
    }

    element.playbackRate = state.rate;
    element.volume = state.volume;
    element.muted = state.muted;

    state.setCurrentTime(0);
    state.setDuration(currentTrack.duration ?? 0);
    state.setBuffered(0);
    state.setError(null);
    state.setPlaying(false);
    state.setBuffering(false);
  }, [currentTrack?.id, currentTrack?.path, mediaRef]);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) {
      return;
    }

    element.volume = volume;
    element.muted = muted;
  }, [volume, muted, mediaRef]);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) {
      return;
    }

    element.playbackRate = rate;
    element.defaultPlaybackRate = rate;
  }, [rate, mediaRef]);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) {
      return;
    }

    const media = element as HTMLVideoElement & {
      webkitPreservesPitch?: boolean;
    };
    media.preservesPitch = preservesPitch;
    media.webkitPreservesPitch = preservesPitch;
  }, [preservesPitch, mediaRef]);

  useEffect(() => {
    if (!pendingPlay) {
      return;
    }

    const element = mediaRef.current;
    const state = usePlayerStore.getState();
    state.setPendingPlay(false);

    if (!element || !state.currentId) {
      return;
    }

    const activeTrack = state.tracks.find(
      (track) => track.id === state.currentId,
    );
    if (!activeTrack || activeTrack.kind === "image") {
      return;
    }

    if (element.ended) {
      element.currentTime = 0;
    }

    void beginPlayback(element);
  }, [pendingPlay, mediaRef, currentId]);
}
