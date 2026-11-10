import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { MediaKind, MediaMetadata, Track } from "../types";

const VIDEO_EXTENSIONS = [
  "mp4",
  "m4v",
  "webm",
  "mov",
  "mkv",
  "avi",
] as const;
const AUDIO_EXTENSIONS = [
  "mp3",
  "m4a",
  "aac",
  "wav",
  "flac",
  "ogg",
  "oga",
  "opus",
] as const;
const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
] as const;

export const SUPPORTED_EXTENSIONS = [
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
];

const VIDEO_SET = new Set<string>(VIDEO_EXTENSIONS);
const AUDIO_SET = new Set<string>(AUDIO_EXTENSIONS);
const IMAGE_SET = new Set<string>(IMAGE_EXTENSIONS);
const SUPPORTED_SET = new Set<string>(SUPPORTED_EXTENSIONS);

export function getExtension(path: string): string {
  const fileName = path.split(/[\\/]/).pop() ?? path;
  const lastDot = fileName.lastIndexOf(".");

  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return "";
  }

  return fileName.slice(lastDot + 1).toLowerCase();
}

export function getFileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function getFolderName(path: string): string {
  const parent = path.replace(/[\\/][^\\/]+$/, "");
  return parent.split(/[\\/]/).filter(Boolean).pop() ?? "";
}

export function fileKind(path: string): MediaKind | null {
  const extension = getExtension(path);

  if (VIDEO_SET.has(extension)) {
    return "video";
  }

  if (AUDIO_SET.has(extension)) {
    return "audio";
  }

  if (IMAGE_SET.has(extension)) {
    return "image";
  }

  return null;
}

export function isSupportedPath(path: string): boolean {
  return SUPPORTED_SET.has(getExtension(path));
}

export function titleFromFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const cleaned = withoutExtension
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || fileName;
}

export function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function pathKey(path: string): string {
  return path.trim().replace(/\//g, "\\").toLowerCase();
}

export function makeTrack(path: string): Track | null {
  const kind = fileKind(path);

  if (!kind) {
    return null;
  }

  const fileName = getFileName(path);
  const folder = getFolderName(path);

  return {
    id: createId(),
    path,
    fileName,
    title: titleFromFileName(fileName),
    artist: kind === "image" ? null : folder || null,
    album: null,
    duration: null,
    kind,
    extension: getExtension(path),
    hasArtwork: false,
  };
}

export function toAssetUrl(path: string): string {
  return convertFileSrc(path, "asset");
}

export async function openMediaDialog(): Promise<string[]> {
  const selection = await open({
    multiple: true,
    directory: false,
    title: "Open media",
    filters: [
      {
        name: "All media",
        extensions: SUPPORTED_EXTENSIONS,
      },
      {
        name: "Video",
        extensions: [...VIDEO_EXTENSIONS],
      },
      {
        name: "Audio",
        extensions: [...AUDIO_EXTENSIONS],
      },
      {
        name: "Images",
        extensions: [...IMAGE_EXTENSIONS],
      },
    ],
  });

  if (!selection) {
    return [];
  }

  return Array.isArray(selection) ? selection : [selection];
}

export const OPEN_FILES_EVENT = "vanta-open-files";

export async function takeLaunchPaths(): Promise<string[]> {
  return invoke<string[]>("take_launch_paths");
}

export async function probeMedia(path: string): Promise<MediaMetadata> {
  return invoke<MediaMetadata>("probe_media", { path });
}

const artworkCache = new Map<string, string | null>();
const ARTWORK_CACHE_LIMIT = 24;

export async function readArtwork(path: string): Promise<string | null> {
  const cached = artworkCache.get(path);
  if (cached !== undefined) {
    return cached;
  }

  const artwork = await invoke<string | null>("read_artwork", { path });

  if (artworkCache.size >= ARTWORK_CACHE_LIMIT) {
    const oldestKey = artworkCache.keys().next().value;
    if (oldestKey) {
      artworkCache.delete(oldestKey);
    }
  }

  artworkCache.set(path, artwork);
  return artwork;
}
