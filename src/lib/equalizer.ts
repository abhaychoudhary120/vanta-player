export const EQ_FREQUENCIES = [
  32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const;

export const EQ_MIN_GAIN = -12;
export const EQ_MAX_GAIN = 12;
export const EQ_BAND_COUNT = EQ_FREQUENCIES.length;

export type EqualizerPreset =
  | "flat"
  | "bass"
  | "rock"
  | "pop"
  | "vocal"
  | "custom";

export type NamedEqualizerPreset = Exclude<EqualizerPreset, "custom">;

export const EQ_PRESET_ORDER: readonly NamedEqualizerPreset[] = [
  "flat",
  "bass",
  "rock",
  "pop",
  "vocal",
];

export const EQ_PRESET_LABELS: Record<NamedEqualizerPreset, string> = {
  flat: "Flat",
  bass: "Bass Boost",
  rock: "Rock",
  pop: "Pop",
  vocal: "Vocal",
};

export const EQ_PRESETS: Record<NamedEqualizerPreset, readonly number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [9, 8, 6, 3, 1, 0, -1, -1, 0, 1],
  rock: [5, 4, 2, 0, -1, 1, 3, 5, 5, 4],
  pop: [-1, 1, 3, 4, 2, 0, -1, 0, 2, 3],
  vocal: [-3, -2, 0, 3, 5, 6, 5, 3, 1, -1],
};

export function clampGain(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(EQ_MAX_GAIN, Math.max(EQ_MIN_GAIN, Math.round(value)));
}

export function defaultEqGains(): number[] {
  return [...EQ_PRESETS.flat];
}

export function normalizeEqGains(value: unknown): number[] {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: EQ_BAND_COUNT }, (_, index) => {
    const gain = source[index];
    return clampGain(typeof gain === "number" ? gain : 0);
  });
}

export function presetForGains(gains: number[]): EqualizerPreset {
  for (const preset of EQ_PRESET_ORDER) {
    if (EQ_PRESETS[preset].every((gain, index) => gain === gains[index])) {
      return preset;
    }
  }

  return "custom";
}

export function formatFrequency(frequency: number): string {
  return frequency >= 1000 ? `${frequency / 1000}k` : `${frequency}`;
}
