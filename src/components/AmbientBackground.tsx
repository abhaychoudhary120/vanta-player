import type { CSSProperties } from "react";
import type { Palette } from "../lib/palette";

export function AmbientBackground({ palette }: { palette: Palette }) {
  const style = {
    "--ambient-a": palette.primary,
    "--ambient-b": palette.secondary,
    "--ambient-c": palette.tertiary,
    "--ambient-a-rgb": palette.primaryRgb,
    "--ambient-b-rgb": palette.secondaryRgb,
  } as CSSProperties;

  return (
    <div className="ambient" style={style} aria-hidden="true">
      <div className="ambient-grid" />
      <div className="ambient-orb ambient-orb--one" />
      <div className="ambient-orb ambient-orb--two" />
      <div className="ambient-orb ambient-orb--three" />
      <div className="ambient-grain" />
      <div className="ambient-vignette" />
    </div>
  );
}
