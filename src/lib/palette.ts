export interface Palette {
  name: string;
  primary: string;
  secondary: string;
  tertiary: string;
  primaryRgb: string;
  secondaryRgb: string;
}

const PALETTES: Palette[] = [
  {
    name: "iris",
    primary: "#8b7cff",
    secondary: "#4de3c1",
    tertiary: "#6258f5",
    primaryRgb: "139, 124, 255",
    secondaryRgb: "77, 227, 193",
  },
  {
    name: "ember",
    primary: "#ff7a90",
    secondary: "#ffb65c",
    tertiary: "#ff5d73",
    primaryRgb: "255, 122, 144",
    secondaryRgb: "255, 182, 92",
  },
  {
    name: "azure",
    primary: "#56b8ff",
    secondary: "#9b8cff",
    tertiary: "#3e8fff",
    primaryRgb: "86, 184, 255",
    secondaryRgb: "155, 140, 255",
  },
  {
    name: "mint",
    primary: "#54dfa8",
    secondary: "#5ccfff",
    tertiary: "#2fcd92",
    primaryRgb: "84, 223, 168",
    secondaryRgb: "92, 207, 255",
  },
  {
    name: "bloom",
    primary: "#f08adf",
    secondary: "#9f91ff",
    tertiary: "#ed6dcc",
    primaryRgb: "240, 138, 223",
    secondaryRgb: "159, 145, 255",
  },
  {
    name: "gold",
    primary: "#f9c76a",
    secondary: "#ff8c9f",
    tertiary: "#efb34a",
    primaryRgb: "249, 199, 106",
    secondaryRgb: "255, 140, 159",
  },
  {
    name: "arctic",
    primary: "#7dd3fc",
    secondary: "#d0a9ff",
    tertiary: "#54b8f5",
    primaryRgb: "125, 211, 252",
    secondaryRgb: "208, 169, 255",
  },
  {
    name: "tide",
    primary: "#47e4d3",
    secondary: "#f3a6ff",
    tertiary: "#2acfc1",
    primaryRgb: "71, 228, 211",
    secondaryRgb: "243, 166, 255",
  },
];

const DEFAULT_PALETTE = PALETTES[0];

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function getPalette(seed: string | null | undefined): Palette {
  if (!seed) {
    return DEFAULT_PALETTE;
  }

  return PALETTES[hashString(seed) % PALETTES.length];
}

export function paletteStyle(palette: Palette): Record<string, string> {
  return {
    "--accent": palette.primary,
    "--accent-soft": palette.secondary,
    "--accent-deep": palette.tertiary,
    "--accent-rgb": palette.primaryRgb,
    "--accent-soft-rgb": palette.secondaryRgb,
  };
}
