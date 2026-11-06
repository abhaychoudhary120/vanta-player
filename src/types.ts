export type MediaKind = "audio" | "video" | "image";

export type VisualizerMode = "bars" | "waveform" | "circular";

export type RepeatMode = "off" | "all" | "one";

export type ToastTone = "default" | "success" | "error";

export interface Track {
  id: string;
  path: string;
  fileName: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration: number | null;
  kind: MediaKind;
  extension: string;
  hasArtwork: boolean;
}

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

export interface MediaMetadata {
  fileName: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number | null;
  hasArtwork: boolean;
}

export interface AddPathsResult {
  added: number;
  duplicates: number;
  unsupported: number;
}
