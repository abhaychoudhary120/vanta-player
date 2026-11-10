export type SpatialMode = "music" | "cinema" | "voice";

export const SPATIAL_MODE_ORDER: readonly SpatialMode[] = [
  "music",
  "cinema",
  "voice",
];

export const SPATIAL_MODE_LABELS: Record<SpatialMode, string> = {
  music: "Music",
  cinema: "Cinema",
  voice: "Voice",
};

export const SPATIAL_MODE_HINTS: Record<SpatialMode, string> = {
  music: "Wide stage, warm bass and an open top end.",
  cinema: "The biggest stage with deep impact and room depth.",
  voice: "Keeps speech centred and clear with a light sense of space.",
};

export const SPATIAL_DEFAULT_INTENSITY = 68;

export interface SpatialProfile {
  /** Maximum stereo width multiplier at full intensity. */
  width: number;
  /** Low-shelf gain in dB at full intensity. */
  bass: number;
  /** High-shelf gain in dB at full intensity. */
  air: number;
  /** Reverb wet mix at full intensity. */
  reverb: number;
  /** Compressor threshold in dB at full intensity. */
  threshold: number;
  /** Compressor ratio at full intensity. */
  ratio: number;
  /** Make-up gain at full intensity. */
  makeup: number;
}

export const SPATIAL_PROFILES: Record<SpatialMode, SpatialProfile> = {
  music: {
    width: 1.42,
    bass: 4.5,
    air: 2.4,
    reverb: 0.16,
    threshold: -20,
    ratio: 2.4,
    makeup: 1.1,
  },
  cinema: {
    width: 1.58,
    bass: 6,
    air: 3.2,
    reverb: 0.24,
    threshold: -24,
    ratio: 3.2,
    makeup: 1.16,
  },
  voice: {
    width: 1.18,
    bass: 1.5,
    air: 3.4,
    reverb: 0.07,
    threshold: -18,
    ratio: 1.8,
    makeup: 1.04,
  },
};

export interface SpatialSettings {
  enabled: boolean;
  intensity: number;
  mode: SpatialMode;
  width: number;
  bass: number;
  air: number;
  reverb: number;
  threshold: number;
  ratio: number;
  makeup: number;
}

export function clampSpatialIntensity(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return SPATIAL_DEFAULT_INTENSITY;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeSpatialMode(value: unknown): SpatialMode {
  return SPATIAL_MODE_ORDER.includes(value as SpatialMode)
    ? (value as SpatialMode)
    : "music";
}

export function resolveSpatialSettings(
  enabled: boolean,
  intensity: number,
  mode: SpatialMode,
): SpatialSettings {
  const profile = SPATIAL_PROFILES[mode];
  const amount = enabled ? clampSpatialIntensity(intensity) / 100 : 0;

  return {
    enabled,
    intensity,
    mode,
    width: 1 + (profile.width - 1) * amount,
    bass: profile.bass * amount,
    air: profile.air * amount,
    reverb: profile.reverb * amount,
    threshold: profile.threshold * amount,
    ratio: 1 + (profile.ratio - 1) * amount,
    makeup: 1 + (profile.makeup - 1) * amount,
  };
}
