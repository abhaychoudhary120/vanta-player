import type { CSSProperties } from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { usePlayerControls } from "../contexts/PlayerControlsContext";
import { usePlayerStore } from "../store/usePlayerStore";
import { IconButton } from "./ui/IconButton";

export function VolumeControl() {
  const { toggleMute, setVolume } = usePlayerControls();
  const volume = usePlayerStore((state) => state.volume);
  const muted = usePlayerStore((state) => state.muted);
  const effectiveVolume = muted ? 0 : volume;
  const percent = Math.round(effectiveVolume * 100);
  const VolumeIcon = effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.5 ? Volume1 : Volume2;
  const sliderStyle = {
    "--range-value": `${percent}%`,
  } as CSSProperties;

  return (
    <div className="volume-control">
      <IconButton
        label={muted ? "Unmute" : "Mute"}
        active={muted}
        onClick={toggleMute}
        className="volume-button"
      >
        <VolumeIcon size={19} />
      </IconButton>

      <div className="volume-bubble">
        <div className="volume-card">
          <div className="volume-heading">
            <span>Volume</span>
            <span>{percent}%</span>
          </div>
          <input
            type="range"
            className="mini-range volume-range"
            min={0}
            max={100}
            step={1}
            value={percent}
            aria-label="Volume"
            style={sliderStyle}
            onChange={(event) => setVolume(Number(event.target.value) / 100)}
          />
        </div>
      </div>
    </div>
  );
}
