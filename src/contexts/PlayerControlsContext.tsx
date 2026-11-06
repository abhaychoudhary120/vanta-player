import { createContext, useContext, type ReactNode } from "react";

export interface PlayerControls {
  openFiles: () => Promise<void>;
  togglePlay: () => void;
  seekTo: (time: number) => void;
  seekBy: (seconds: number) => void;
  previous: () => void;
  next: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setRate: (rate: number) => void;
  retry: () => void;
  toggleFullscreen: () => Promise<void>;
  isFullscreen: boolean;
}

const PlayerControlsContext = createContext<PlayerControls | null>(null);

export function PlayerControlsProvider({
  controls,
  children,
}: {
  controls: PlayerControls;
  children: ReactNode;
}) {
  return (
    <PlayerControlsContext.Provider value={controls}>
      {children}
    </PlayerControlsContext.Provider>
  );
}

export function usePlayerControls(): PlayerControls {
  const controls = useContext(PlayerControlsContext);

  if (!controls) {
    throw new Error("PlayerControlsProvider is missing");
  }

  return controls;
}
