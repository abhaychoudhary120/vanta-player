import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { usePlayerControls } from "../contexts/PlayerControlsContext";
import { usePlayerStore } from "../store/usePlayerStore";
import { IconButton } from "./ui/IconButton";

export function TransportControls() {
  const { togglePlay, previous, next, seekBy } = usePlayerControls();
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const repeat = usePlayerStore((state) => state.repeat);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat);

  const repeatLabel =
    repeat === "off" ? "Repeat off" : repeat === "all" ? "Repeat all" : "Repeat one";

  return (
    <div className="transport" aria-label="Playback controls">
      <IconButton
        label={shuffle ? "Shuffle on" : "Shuffle off"}
        active={shuffle}
        onClick={toggleShuffle}
        className="transport-button"
      >
        <Shuffle size={18} />
      </IconButton>

      <IconButton
        label="Previous track"
        onClick={previous}
        className="transport-button"
      >
        <SkipBack size={21} fill="currentColor" strokeWidth={1.5} />
      </IconButton>

      <IconButton
        label="Back 10 seconds"
        onClick={() => seekBy(-10)}
        className="transport-button skip-button"
      >
        <RotateCcw size={21} />
        <span className="skip-number">10</span>
      </IconButton>

      <button
        type="button"
        className="play-button"
        aria-label={isPlaying ? "Pause" : "Play"}
        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        onClick={togglePlay}
      >
        <span className="play-button-glow" aria-hidden="true" />
        {isPlaying ? (
          <Pause size={22} fill="currentColor" strokeWidth={1.5} />
        ) : (
          <Play
            size={22}
            fill="currentColor"
            strokeWidth={1.5}
            className="play-icon"
          />
        )}
      </button>

      <IconButton
        label="Forward 10 seconds"
        onClick={() => seekBy(10)}
        className="transport-button skip-button"
      >
        <RotateCw size={21} />
        <span className="skip-number">10</span>
      </IconButton>

      <IconButton
        label="Next track"
        onClick={next}
        className="transport-button"
      >
        <SkipForward size={21} fill="currentColor" strokeWidth={1.5} />
      </IconButton>

      <IconButton
        label={repeatLabel}
        active={repeat !== "off"}
        onClick={cycleRepeat}
        className={`transport-button ${repeat === "one" ? "repeat-one" : ""}`}
      >
        {repeat === "one" ? <Repeat1 size={19} /> : <Repeat size={19} />}
      </IconButton>
    </div>
  );
}
