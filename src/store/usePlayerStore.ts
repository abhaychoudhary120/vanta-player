import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { clamp } from "../lib/format";
import {
  EQ_BAND_COUNT,
  EQ_PRESETS,
  clampGain,
  defaultEqGains,
  normalizeEqGains,
  presetForGains,
  type EqualizerPreset,
  type NamedEqualizerPreset,
} from "../lib/equalizer";
import {
  createId,
  makeTrack,
  pathKey,
  probeMedia,
  isSupportedPath,
} from "../lib/media";
import type {
  AddPathsResult,
  RepeatMode,
  Toast,
  ToastTone,
  Track,
  VisualizerMode,
} from "../types";

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const MIN_PLAYBACK_RATE = 0.25;
export const MAX_PLAYBACK_RATE = 3;

interface AddTracksOptions {
  play?: boolean;
}

interface PlayerState {
  tracks: Track[];
  currentId: string | null;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  rate: number;
  repeat: RepeatMode;
  shuffle: boolean;
  pendingPlay: boolean;
  error: string | null;
  sidebarOpen: boolean;
  toasts: Toast[];
  preservesPitch: boolean;
  hardwareAcceleration: boolean;
  visualizer: VisualizerMode;
  eqEnabled: boolean;
  eqGains: number[];
  eqPreset: EqualizerPreset;

  addPaths: (paths: string[], options?: AddTracksOptions) => AddPathsResult;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  clearQueue: () => void;
  selectTrack: (id: string, autoPlay?: boolean) => void;
  playNext: () => boolean;
  playPrevious: () => boolean;
  reorderTrack: (draggedId: string, beforeId: string | null) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setBuffered: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setBuffering: (buffering: boolean) => void;
  setPendingPlay: (pending: boolean) => void;
  setError: (message: string | null) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setRate: (rate: number) => void;
  setPreservesPitch: (enabled: boolean) => void;
  setHardwareAcceleration: (enabled: boolean) => void;
  setVisualizer: (mode: VisualizerMode) => void;
  setEqEnabled: (enabled: boolean) => void;
  setEqGain: (index: number, gain: number) => void;
  setEqPreset: (preset: NamedEqualizerPreset) => void;
  resetEqualizer: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  notify: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: string) => void;
}

function trackById(tracks: Track[], id: string | null): Track | undefined {
  return tracks.find((track) => track.id === id);
}

function playbackReset(track: Track | null, pendingPlay: boolean) {
  return {
    currentId: track?.id ?? null,
    pendingPlay,
    isBuffering: false,
    currentTime: 0,
    duration: track?.duration ?? 0,
    buffered: 0,
    error: null,
  };
}

async function enrichTracks(
  tracks: Track[],
  updateTrack: (id: string, patch: Partial<Track>) => void,
) {
  const queue = [...tracks];
  const workerCount = Math.min(3, queue.length);

  if (workerCount === 0) {
    return;
  }

  const worker = async () => {
    for (;;) {
      const track = queue.shift();
      if (!track) {
        return;
      }

      if (track.kind === "image") {
        continue;
      }

      try {
        const metadata = await probeMedia(track.path);
        updateTrack(track.id, {
          title: metadata.title ?? track.title,
          artist: metadata.artist ?? track.artist,
          album: metadata.album ?? track.album,
          duration: metadata.duration ?? track.duration,
          hasArtwork: metadata.hasArtwork,
        });
      } catch {
        // Metadata is a progressive enhancement. Playback still works without it.
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      tracks: [],
      currentId: null,
      isPlaying: false,
      isBuffering: false,
      currentTime: 0,
      duration: 0,
      buffered: 0,
      volume: 0.82,
      muted: false,
      rate: 1,
      repeat: "off",
      shuffle: false,
      pendingPlay: false,
      error: null,
      sidebarOpen: true,
      toasts: [],
      preservesPitch: true,
      hardwareAcceleration: true,
      visualizer: "bars",
      eqEnabled: false,
      eqGains: defaultEqGains(),
      eqPreset: "flat",

      addPaths: (paths, options = {}) => {
        const state = get();
        const shouldPlay = options.play ?? true;
        const knownPaths = new Set(state.tracks.map((track) => pathKey(track.path)));
        const additions: Track[] = [];
        let duplicates = 0;
        let unsupported = 0;

        for (const path of paths) {
          const key = pathKey(path);

          if (!path.trim() || knownPaths.has(key)) {
            duplicates += 1;
            continue;
          }

          if (!isSupportedPath(path)) {
            unsupported += 1;
            continue;
          }

          const track = makeTrack(path);
          if (!track) {
            unsupported += 1;
            continue;
          }

          knownPaths.add(key);
          additions.push(track);
        }

        const result: AddPathsResult = {
          added: additions.length,
          duplicates,
          unsupported,
        };

        if (additions.length > 0) {
          const shouldSelect = shouldPlay || state.currentId === null;
          const nextTracks = [...state.tracks, ...additions];
          const selectedTrack = shouldSelect
            ? (trackById(nextTracks, additions[0].id) ?? additions[0])
            : trackById(nextTracks, state.currentId);

          set({
            tracks: nextTracks,
            ...(shouldSelect
              ? playbackReset(selectedTrack ?? null, shouldPlay)
              : {}),
          });

          void enrichTracks(additions, get().updateTrack);
        }

        if (additions.length > 0 && (duplicates > 0 || unsupported > 0)) {
          get().notify(
            `${additions.length} added · ${duplicates + unsupported} skipped`,
          );
        } else if (additions.length > 0) {
          get().notify(
            additions.length === 1
              ? "Added to your queue"
              : `${additions.length} titles added to your queue`,
            "success",
          );
        } else if (unsupported > 0 && duplicates === 0) {
          get().notify("No supported media files were found", "error");
        } else if (duplicates > 0) {
          get().notify("Those titles are already in your queue");
        }

        return result;
      },

      updateTrack: (id, patch) => {
        set((state) => ({
          tracks: state.tracks.map((track) =>
            track.id === id ? { ...track, ...patch } : track,
          ),
        }));
      },

      removeTrack: (id) => {
        set((state) => {
          const index = state.tracks.findIndex((track) => track.id === id);
          if (index === -1) {
            return state;
          }

          const removingCurrent = state.currentId === id;
          const wasPlaying = state.isPlaying;
          const nextTracks = state.tracks.filter((track) => track.id !== id);

          if (!removingCurrent) {
            return { tracks: nextTracks };
          }

          if (nextTracks.length === 0) {
            return {
              tracks: [],
              ...playbackReset(null, false),
              isPlaying: false,
            };
          }

          const nextIndex = Math.min(index, nextTracks.length - 1);
          const nextTrack = nextTracks[nextIndex];

          return {
            tracks: nextTracks,
            ...playbackReset(nextTrack, wasPlaying),
            isPlaying: false,
          };
        });
      },

      clearQueue: () => {
        set({
          tracks: [],
          ...playbackReset(null, false),
          isPlaying: false,
        });
        get().notify("Queue cleared");
      },

      selectTrack: (id, autoPlay = true) => {
        const state = get();
        const track = trackById(state.tracks, id);
        if (!track) {
          return;
        }

        if (state.currentId === id) {
          set({
            pendingPlay: autoPlay,
            error: null,
          });
          return;
        }

        set({
          ...playbackReset(track, autoPlay),
          isPlaying: false,
        });
      },

      playNext: () => {
        const state = get();
        const { tracks, currentId } = state;

        if (tracks.length === 0) {
          return false;
        }

        const currentIndex = tracks.findIndex((track) => track.id === currentId);

        if (state.shuffle && tracks.length > 1) {
          let randomIndex = currentIndex;

          while (randomIndex === currentIndex) {
            randomIndex = Math.floor(Math.random() * tracks.length);
          }

          set({
            ...playbackReset(tracks[randomIndex], true),
            isPlaying: false,
          });
          return true;
        }

        let nextIndex = currentIndex + 1;
        if (nextIndex >= tracks.length) {
          if (state.repeat === "all") {
            nextIndex = 0;
          } else {
            return false;
          }
        }

        set({
          ...playbackReset(tracks[nextIndex], true),
          isPlaying: false,
        });
        return true;
      },

      playPrevious: () => {
        const state = get();
        const { tracks, currentId } = state;

        if (tracks.length === 0) {
          return false;
        }

        const currentIndex = tracks.findIndex((track) => track.id === currentId);

        if (state.shuffle && tracks.length > 1) {
          let randomIndex = currentIndex;

          while (randomIndex === currentIndex) {
            randomIndex = Math.floor(Math.random() * tracks.length);
          }

          set({
            ...playbackReset(tracks[randomIndex], true),
            isPlaying: false,
          });
          return true;
        }

        let previousIndex = currentIndex - 1;
        if (previousIndex < 0) {
          if (state.repeat === "all") {
            previousIndex = tracks.length - 1;
          } else {
            return false;
          }
        }

        set({
          ...playbackReset(tracks[previousIndex], true),
          isPlaying: false,
        });
        return true;
      },

      reorderTrack: (draggedId, beforeId) => {
        if (draggedId === beforeId) {
          return;
        }

        set((state) => {
          const draggedIndex = state.tracks.findIndex(
            (track) => track.id === draggedId,
          );
          if (draggedIndex === -1) {
            return state;
          }

          const draggedTrack = state.tracks[draggedIndex];
          const withoutDragged = state.tracks.filter(
            (track) => track.id !== draggedId,
          );
          const targetIndex = beforeId
            ? withoutDragged.findIndex((track) => track.id === beforeId)
            : withoutDragged.length;
          const insertAt = targetIndex === -1 ? withoutDragged.length : targetIndex;
          const nextTracks = [...withoutDragged];
          nextTracks.splice(insertAt, 0, draggedTrack);

          return { tracks: nextTracks };
        });
      },

      setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),

      setDuration: (duration) => {
        if (!Number.isFinite(duration) || duration < 0) {
          return;
        }

        set((state) => ({
          duration,
          tracks: state.tracks.map((track) => {
            if (track.id !== state.currentId) {
              return track;
            }

            if (
              track.duration !== null &&
              Math.abs(track.duration - duration) < 2
            ) {
              return track;
            }

            return { ...track, duration };
          }),
        }));
      },

      setBuffered: (time) => {
        set((state) => ({
          buffered: clamp(time, 0, state.duration || time || 0),
        }));
      },

      setPlaying: (playing) => set({ isPlaying: playing }),
      setBuffering: (buffering) => set({ isBuffering: buffering }),
      setPendingPlay: (pending) => set({ pendingPlay: pending }),
      setError: (message) => set({ error: message }),

      setVolume: (volume) => {
        const nextVolume = clamp(volume, 0, 1);
        set({
          volume: nextVolume,
          muted: nextVolume === 0,
        });
      },

      toggleMute: () => {
        set((state) => {
          if (state.muted && state.volume === 0) {
            return { muted: false, volume: 0.65 };
          }

          return { muted: !state.muted };
        });
      },

      setRate: (rate) => {
        if (!Number.isFinite(rate)) {
          return;
        }

        set({
          rate: clamp(
            Math.round(rate * 100) / 100,
            MIN_PLAYBACK_RATE,
            MAX_PLAYBACK_RATE,
          ),
        });
      },

      setPreservesPitch: (enabled) => set({ preservesPitch: enabled }),

      setHardwareAcceleration: (enabled) =>
        set({ hardwareAcceleration: enabled }),

      setVisualizer: (mode) => set({ visualizer: mode }),

      setEqEnabled: (enabled) => set({ eqEnabled: enabled }),

      setEqGain: (index, gain) => {
        if (!Number.isInteger(index) || index < 0 || index >= EQ_BAND_COUNT) {
          return;
        }

        set((state) => {
          const eqGains = [...state.eqGains];
          eqGains[index] = clampGain(gain);
          return { eqGains, eqPreset: presetForGains(eqGains) };
        });
      },

      setEqPreset: (preset) => {
        set({
          eqGains: [...EQ_PRESETS[preset]],
          eqPreset: preset,
        });
      },

      resetEqualizer: () => {
        set({ eqGains: defaultEqGains(), eqPreset: "flat" });
      },

      toggleShuffle: () => {
        set((state) => ({ shuffle: !state.shuffle }));
      },

      cycleRepeat: () => {
        set((state) => {
          const next: RepeatMode =
            state.repeat === "off"
              ? "all"
              : state.repeat === "all"
                ? "one"
                : "off";
          return { repeat: next };
        });
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },

      setSidebarOpen: (open) => {
        set({ sidebarOpen: open });
      },

      notify: (message, tone = "default") => {
        const id = createId();
        set((state) => ({
          toasts: [...state.toasts.slice(-2), { id, message, tone }],
        }));
        window.setTimeout(() => {
          get().dismissToast(id);
        }, 4200);
      },

      dismissToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        }));
      },
    }),
    {
      name: "vanta-player-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tracks: state.tracks,
        currentId: state.currentId,
        volume: state.volume,
        muted: state.muted,
        rate: state.rate,
        repeat: state.repeat,
        shuffle: state.shuffle,
        sidebarOpen: state.sidebarOpen,
        preservesPitch: state.preservesPitch,
        hardwareAcceleration: state.hardwareAcceleration,
        visualizer: state.visualizer,
        eqEnabled: state.eqEnabled,
        eqGains: state.eqGains,
        eqPreset: state.eqPreset,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PlayerState>;
        const rawTracks = Array.isArray(persisted.tracks) ? persisted.tracks : [];
        const tracks = rawTracks.filter(
          (track): track is Track =>
            Boolean(track?.id && track?.path && track?.fileName && track?.kind),
        );
        const currentId = tracks.some((track) => track.id === persisted.currentId)
          ? (persisted.currentId ?? null)
          : (tracks[0]?.id ?? null);
        const volume = clamp(
          typeof persisted.volume === "number" ? persisted.volume : 0.82,
          0,
          1,
        );
        const muted = volume === 0 ? true : Boolean(persisted.muted);
        const rate =
          typeof persisted.rate === "number" && Number.isFinite(persisted.rate)
            ? clamp(
                Math.round(persisted.rate * 100) / 100,
                MIN_PLAYBACK_RATE,
                MAX_PLAYBACK_RATE,
              )
            : 1;
        const repeat: RepeatMode = ["off", "all", "one"].includes(
          persisted.repeat ?? "",
        )
          ? (persisted.repeat as RepeatMode)
          : "off";
        const eqGains = normalizeEqGains(persisted.eqGains);
        const visualizer: VisualizerMode =
          persisted.visualizer === "waveform" ||
          persisted.visualizer === "circular"
            ? persisted.visualizer
            : "bars";

        return {
          ...currentState,
          tracks,
          currentId,
          volume,
          muted,
          rate,
          repeat,
          shuffle: Boolean(persisted.shuffle),
          sidebarOpen: persisted.sidebarOpen ?? true,
          preservesPitch:
            typeof persisted.preservesPitch === "boolean"
              ? persisted.preservesPitch
              : true,
          hardwareAcceleration:
            typeof persisted.hardwareAcceleration === "boolean"
              ? persisted.hardwareAcceleration
              : true,
          visualizer,
          eqEnabled: Boolean(persisted.eqEnabled),
          eqGains,
          eqPreset: presetForGains(eqGains),
          isPlaying: false,
          isBuffering: false,
          currentTime: 0,
          duration: trackById(tracks, currentId)?.duration ?? 0,
          buffered: 0,
          pendingPlay: false,
          error: null,
          toasts: [],
        };
      },
    },
  ),
);
