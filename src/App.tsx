import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AmbientBackground } from "./components/AmbientBackground";
import { DropOverlay } from "./components/DropOverlay";
import { PlayerConsole } from "./components/PlayerConsole";
import { PlayerStage } from "./components/PlayerStage";
import { PlaylistPanel } from "./components/PlaylistPanel";
import { SettingsModal } from "./components/SettingsModal";
import { TitleBar } from "./components/TitleBar";
import { ToastStack } from "./components/ToastStack";
import {
  PlayerControlsProvider,
  type PlayerControls,
} from "./contexts/PlayerControlsContext";
import { useArtwork } from "./hooks/useArtwork";
import { useEqualizer } from "./hooks/useEqualizer";
import { useMediaSession } from "./hooks/useMediaSession";
import { useSystemMediaControls } from "./hooks/useSystemMediaControls";
import { clamp } from "./lib/format";
import {
  OPEN_FILES_EVENT,
  openMediaDialog,
  takeLaunchPaths,
  toAssetUrl,
} from "./lib/media";
import { getPalette } from "./lib/palette";
import { usePlayerStore } from "./store/usePlayerStore";

function requestPlayback(element: HTMLVideoElement) {
  const attempt = element.play();
  if (!attempt) {
    return;
  }

  void attempt.catch((error: unknown) => {
    const state = usePlayerStore.getState();
    state.setPendingPlay(false);
    state.setBuffering(false);

    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }

    if (error instanceof DOMException && error.name === "NotAllowedError") {
      state.setPlaying(false);
      state.notify("Playback needs a direct click to begin.", "error");
    }
  });
}

export default function App() {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const dialogOpenRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [dragActive, setDragActive] = useState(false);

  const track = usePlayerStore(
    (state) => state.tracks.find((item) => item.id === state.currentId) ?? null,
  );
  const sidebarOpen = usePlayerStore((state) => state.sidebarOpen);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const hardwareAcceleration = usePlayerStore(
    (state) => state.hardwareAcceleration,
  );
  const settingsOpen = usePlayerStore((state) => state.settingsOpen);
  const setSettingsOpen = usePlayerStore((state) => state.setSettingsOpen);
  const addPaths = usePlayerStore((state) => state.addPaths);
  const notify = usePlayerStore((state) => state.notify);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const toggleMute = usePlayerStore((state) => state.toggleMute);
  const setRate = usePlayerStore((state) => state.setRate);
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);

  useMediaSession(mediaRef);
  useEqualizer(mediaRef);

  const artwork = useArtwork(track);
  useSystemMediaControls(mediaRef, track, artwork);
  const palette = useMemo(
    () => getPalette(track?.path ?? "vanta"),
    [track?.path],
  );

  const accentStyle = {
    "--accent": palette.primary,
    "--accent-rgb": palette.primaryRgb,
    "--accent-secondary": palette.secondary,
    "--accent-secondary-rgb": palette.secondaryRgb,
    "--accent-tertiary": palette.tertiary,
  } as CSSProperties;

  const openFiles = useCallback(async () => {
    if (dialogOpenRef.current) {
      return;
    }

    dialogOpenRef.current = true;

    try {
      const paths = await openMediaDialog();
      if (paths.length > 0) {
        addPaths(paths, { play: true });
      }
    } catch {
      notify("The file picker could not be opened.", "error");
    } finally {
      dialogOpenRef.current = false;
    }
  }, [addPaths, notify]);

  const togglePlay = useCallback(() => {
    const media = mediaRef.current;
    const state = usePlayerStore.getState();
    const activeTrack = state.tracks.find(
      (item) => item.id === state.currentId,
    );

    if (!media || !state.currentId || !activeTrack) {
      return;
    }

    if (activeTrack.kind === "image") {
      return;
    }

    if (media.paused) {
      state.setPendingPlay(false);
      state.setError(null);

      if (!media.hasAttribute("src")) {
        return;
      }

      requestPlayback(media);
    } else {
      state.setPendingPlay(false);
      media.pause();
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    if (!Number.isFinite(time)) {
      return;
    }

    const media = mediaRef.current;
    const state = usePlayerStore.getState();
    const activeTrack = state.tracks.find(
      (item) => item.id === state.currentId,
    );

    if (activeTrack?.kind === "image") {
      return;
    }

    const duration =
      media && Number.isFinite(media.duration) && media.duration > 0
        ? media.duration
        : state.duration;
    const target = clamp(time, 0, duration > 0 ? duration : Number.POSITIVE_INFINITY);

    if (media && media.readyState > 0) {
      try {
        media.currentTime = target;
      } catch {
        // Some partially loaded files reject an immediate seek.
      }
    }

    usePlayerStore.getState().setCurrentTime(target);
  }, []);

  const seekBy = useCallback(
    (seconds: number) => {
      const media = mediaRef.current;
      const state = usePlayerStore.getState();
      const current =
        media && Number.isFinite(media.currentTime)
          ? media.currentTime
          : state.currentTime;
      seekTo(current + seconds);
    },
    [seekTo],
  );

  const previous = useCallback(() => {
    const media = mediaRef.current;
    const state = usePlayerStore.getState();
    const activeTrack = state.tracks.find(
      (item) => item.id === state.currentId,
    );

    if (!state.currentId) {
      return;
    }

    if (media && activeTrack?.kind !== "image" && media.currentTime > 3) {
      media.currentTime = 0;
      state.setCurrentTime(0);
      return;
    }

    if (!state.playPrevious() && media && activeTrack?.kind !== "image") {
      media.currentTime = 0;
      state.setCurrentTime(0);
    }
  }, []);

  const next = useCallback(() => {
    const state = usePlayerStore.getState();
    if (!state.currentId) {
      return;
    }

    if (!state.playNext()) {
      const media = mediaRef.current;
      media?.pause();
      state.setPlaying(false);
      state.setBuffering(false);
      state.setPendingPlay(false);
    }
  }, []);

  const retry = useCallback(() => {
    const media = mediaRef.current;
    const state = usePlayerStore.getState();
    const current = state.tracks.find((item) => item.id === state.currentId);

    if (!media || !current) {
      return;
    }

    state.setError(null);
    state.setCurrentTime(0);
    state.setPendingPlay(false);
    media.src = toAssetUrl(current.path);
    media.load();
    requestPlayback(media);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      const next = await invoke<boolean>("toggle_fullscreen");
      setIsFullscreen(next);

      if (!next) {
        setChromeVisible(true);
      }
    } catch {
      notify("Fullscreen is unavailable right now.", "error");
    }
  }, [notify]);

  const controls = useMemo<PlayerControls>(
    () => ({
      openFiles,
      togglePlay,
      seekTo,
      seekBy,
      previous,
      next,
      setVolume,
      toggleMute,
      setRate,
      retry,
      toggleFullscreen,
      isFullscreen,
    }),
    [
      openFiles,
      togglePlay,
      seekTo,
      seekBy,
      previous,
      next,
      setVolume,
      toggleMute,
      setRate,
      retry,
      toggleFullscreen,
      isFullscreen,
    ],
  );

  useEffect(() => {
    if (!isFullscreen) {
      setChromeVisible(true);
      return;
    }

    let hideTimer: number | undefined;

    const revealChrome = () => {
      setChromeVisible(true);

      if (hideTimer) {
        window.clearTimeout(hideTimer);
      }

      if (usePlayerStore.getState().isPlaying) {
        hideTimer = window.setTimeout(() => setChromeVisible(false), 2600);
      }
    };

    revealChrome();
    window.addEventListener("pointermove", revealChrome, { passive: true });
    window.addEventListener("pointerdown", revealChrome, { passive: true });
    window.addEventListener("keydown", revealChrome);

    return () => {
      if (hideTimer) {
        window.clearTimeout(hideTimer);
      }
      window.removeEventListener("pointermove", revealChrome);
      window.removeEventListener("pointerdown", revealChrome);
      window.removeEventListener("keydown", revealChrome);
    };
  }, [isFullscreen, isPlaying]);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let syncTimer: number | undefined;

    const syncFullscreen = async () => {
      try {
        const value = await appWindow.isFullscreen();
        if (!disposed) {
          setIsFullscreen(value);
        }
      } catch {
        // Keep the last known state when the native window is unavailable.
      }
    };

    void syncFullscreen();

    void appWindow
      .onResized(() => {
        if (syncTimer) {
          window.clearTimeout(syncTimer);
        }

        // Let Windows finish the fullscreen transition before reading it back.
        syncTimer = window.setTimeout(() => {
          void syncFullscreen();
        }, 120);
      })
      .then((cleanup) => {
        if (disposed) {
          cleanup();
        } else {
          unlisten = cleanup;
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      if (syncTimer) {
        window.clearTimeout(syncTimer);
      }
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const ingestLaunchPaths = async () => {
      try {
        const paths = await takeLaunchPaths();
        if (!disposed && paths.length > 0) {
          usePlayerStore.getState().openPaths(paths);
        }
      } catch {
        // The browser preview has no native launcher to read paths from.
      }
    };

    void listen(OPEN_FILES_EVENT, () => {
      void ingestLaunchPaths();
    })
      .then((cleanup) => {
        if (disposed) {
          cleanup();
          return;
        }

        unlisten = cleanup;
        void ingestLaunchPaths();
      })
      .catch(() => {
        void ingestLaunchPaths();
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setDragActive(true);
          return;
        }

        if (event.payload.type === "leave") {
          setDragActive(false);
          return;
        }

        if (event.payload.type === "drop") {
          setDragActive(false);
          const paths = event.payload.paths.filter((path) => path.trim());
          if (paths.length > 0) {
            usePlayerStore.getState().addPaths(paths, { play: true });
          }
        }
      })
      .then((cleanup) => {
        if (disposed) {
          cleanup();
        } else {
          unlisten = cleanup;
        }
      })
      .catch(() => {
        usePlayerStore
          .getState()
          .notify("Drag and drop is unavailable in this environment.", "error");
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const interactiveTarget =
        target instanceof Element
          ? target.closest(
              "button, a, input, select, textarea, [contenteditable='true'], [role='menuitem'], [role='button']",
            )
          : null;
      const textEntry =
        target instanceof Element
          ? Boolean(
              target.closest(
                "input, select, textarea, [contenteditable='true']",
              ),
            )
          : false;
      const isButtonLike =
        interactiveTarget !== null && !textEntry;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void openFiles();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
        return;
      }

      if (
        textEntry ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (isButtonLike &&
          (event.key === " " ||
            event.key === "Enter" ||
            event.key.startsWith("Arrow")))
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (isFullscreen && key === "escape") {
        event.preventDefault();
        void toggleFullscreen();
        return;
      }

      if (event.repeat && [" ", "k", "m", "f", "n", "p", "r", "s"].includes(key)) {
        return;
      }

      switch (key) {
        case " ":
        case "k":
          event.preventDefault();
          togglePlay();
          break;
        case "arrowright":
          event.preventDefault();
          seekBy(5);
          break;
        case "arrowleft":
          event.preventDefault();
          seekBy(-5);
          break;
        case "arrowup":
          event.preventDefault();
          setVolume(clamp(usePlayerStore.getState().volume + 0.05, 0, 1));
          break;
        case "arrowdown":
          event.preventDefault();
          setVolume(clamp(usePlayerStore.getState().volume - 0.05, 0, 1));
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          void toggleFullscreen();
          break;
        case "n":
          next();
          break;
        case "p":
          previous();
          break;
        case "r":
          cycleRepeat();
          break;
        case "s":
          toggleShuffle();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    openFiles,
    togglePlay,
    seekBy,
    setVolume,
    toggleMute,
    toggleFullscreen,
    next,
    previous,
    cycleRepeat,
    toggleShuffle,
    isFullscreen,
    setSettingsOpen,
  ]);

  return (
    <PlayerControlsProvider controls={controls}>
      <div
        className={`app-shell ${sidebarOpen ? "has-sidebar" : ""} ${
          isFullscreen ? "is-fullscreen" : ""
        } ${isFullscreen && !chromeVisible ? "is-chrome-hidden" : ""}`}
        style={accentStyle}
        data-hwaccel={hardwareAcceleration ? "on" : "off"}
      >
        <AmbientBackground palette={palette} />

        <TitleBar />

        <main className="workspace">
          <div className="player-column">
            <PlayerStage
              mediaRef={mediaRef}
              track={track}
              artwork={artwork}
              palette={palette}
            />
            {track ? <PlayerConsole track={track} palette={palette} /> : null}
          </div>

          <PlaylistPanel open={sidebarOpen} />
        </main>

        <ToastStack />
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
        {dragActive ? <DropOverlay /> : null}
      </div>
    </PlayerControlsProvider>
  );
}
