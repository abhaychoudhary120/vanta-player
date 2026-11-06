import { usePlayerStore } from "../store/usePlayerStore";
import { formatTime } from "../lib/format";
import type { Palette } from "../lib/palette";
import type { Track } from "../types";
import { NowPlayingInfo } from "./NowPlayingInfo";
import { SeekBar } from "./SeekBar";
import { TransportControls } from "./TransportControls";
import { UtilityControls } from "./UtilityControls";

export function PlayerConsole({
  track,
  palette,
}: {
  track: Track;
  palette: Palette;
}) {
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);

  return (
    <section className="console" aria-label="Player controls">
      <div className="console-progress">
        <SeekBar />
        <div className="console-time">
          <span>{formatTime(currentTime)}</span>
          <span className="time-divider">/</span>
          <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>

      <div className="console-main">
        <NowPlayingInfo track={track} palette={palette} />
        <TransportControls />
        <UtilityControls />
      </div>
    </section>
  );
}
