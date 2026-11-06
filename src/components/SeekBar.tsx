import { useState, type PointerEvent } from "react";
import { usePlayerControls } from "../contexts/PlayerControlsContext";
import { usePlayerStore } from "../store/usePlayerStore";
import { formatTime } from "../lib/format";

export function SeekBar() {
  const { seekTo } = usePlayerControls();
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const buffered = usePlayerStore((state) => state.buffered);
  const hasError = usePlayerStore((state) => state.error !== null);
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);

  const canSeek = duration > 0 && !hasError;
  const visibleTime = Math.min(currentTime, duration || currentTime);
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (visibleTime / duration) * 100)) : 0;
  const bufferedPercent =
    duration > 0 ? Math.min(100, Math.max(0, (buffered / duration) * 100)) : 0;
  const hoverTime =
    hoverPercent !== null && duration > 0
      ? (hoverPercent / 100) * duration
      : null;

  const handlePointerMove = (event: PointerEvent<HTMLInputElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) {
      return;
    }

    const percent = Math.min(
      100,
      Math.max(0, ((event.clientX - rect.left) / rect.width) * 100),
    );
    setHoverPercent(percent);
  };

  return (
    <div
      className={`seek-bar ${scrubbing ? "is-scrubbing" : ""} ${
        !canSeek ? "is-disabled" : ""
      }`}
    >
      <div className="seek-rail">
        <div className="seek-buffer" style={{ width: `${bufferedPercent}%` }} />
        <div className="seek-progress" style={{ width: `${progressPercent}%` }}>
          <div className="seek-thumb" />
        </div>
      </div>

      <input
        className="seek-input"
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={visibleTime}
        disabled={!canSeek}
        aria-label="Seek"
        aria-valuetext={`${formatTime(visibleTime)} of ${formatTime(duration)}`}
        onChange={(event) => seekTo(Number(event.target.value))}
        onPointerDown={() => setScrubbing(true)}
        onPointerUp={() => setScrubbing(false)}
        onPointerCancel={() => setScrubbing(false)}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverPercent(null)}
        onFocus={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (rect.width > 0 && duration > 0) {
            setHoverPercent(
              Math.min(100, Math.max(0, (visibleTime / duration) * 100)),
            );
          }
        }}
        onBlur={() => {
          setScrubbing(false);
          setHoverPercent(null);
        }}
      />

      {hoverPercent !== null && hoverTime !== null ? (
        <div
          className="seek-tooltip"
          style={{ left: `${Math.min(94, Math.max(6, hoverPercent))}%` }}
        >
          {formatTime(hoverTime)}
        </div>
      ) : null}
    </div>
  );
}
