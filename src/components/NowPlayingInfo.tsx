import { Film, Image as ImageIcon, Music2 } from "lucide-react";
import type { Palette } from "../lib/palette";
import { usePlayerStore } from "../store/usePlayerStore";
import type { Track } from "../types";

export function NowPlayingInfo({
  track,
  palette,
}: {
  track: Track;
  palette: Palette;
}) {
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const kindLabel =
    track.kind === "video"
      ? "Local video"
      : track.kind === "image"
        ? "Local image"
        : "Local audio";
  const detail =
    [track.artist, track.album].filter(Boolean).join(" · ") ||
    `${kindLabel} · ${track.extension.toUpperCase()}`;
  const monogram = track.title.trim().charAt(0).toUpperCase() || "V";
  const KindIcon =
    track.kind === "video" ? Film : track.kind === "image" ? ImageIcon : Music2;

  return (
    <div className="now-playing">
      <div
        className={`now-playing-art ${isPlaying ? "is-playing" : ""}`}
        style={{
          background: `linear-gradient(140deg, ${palette.primary} 0%, ${palette.secondary} 54%, ${palette.tertiary} 100%)`,
        }}
      >
        <span>{monogram}</span>
        <KindIcon size={11} className="now-playing-kind" />
        {isPlaying ? (
          <span className="now-playing-eq" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        ) : null}
      </div>

      <div className="now-playing-copy">
        <span className="now-playing-title" title={track.title}>
          {track.title}
        </span>
        <span className="now-playing-meta" title={detail}>
          {detail}
        </span>
      </div>
    </div>
  );
}
