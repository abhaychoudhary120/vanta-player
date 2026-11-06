import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePlayerControls } from "../contexts/PlayerControlsContext";
import { formatRate } from "../lib/format";
import {
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE,
  PLAYBACK_RATES,
  usePlayerStore,
} from "../store/usePlayerStore";

const RATES = PLAYBACK_RATES;

export function RateMenu() {
  const { setRate } = usePlayerControls();
  const rate = usePlayerStore((state) => state.rate);
  const preservesPitch = usePlayerStore((state) => state.preservesPitch);
  const setPreservesPitch = usePlayerStore(
    (state) => state.setPreservesPitch,
  );
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleOutside = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const percent =
    ((rate - MIN_PLAYBACK_RATE) / (MAX_PLAYBACK_RATE - MIN_PLAYBACK_RATE)) * 100;

  return (
    <div className="rate-control" ref={rootRef}>
      <button
        type="button"
        className={`rate-button ${open ? "is-open" : ""}`}
        aria-label="Playback speed"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Playback speed"
        onClick={() => setOpen((value) => !value)}
      >
        {formatRate(rate)}
      </button>

      {open ? (
        <div className="rate-menu" role="dialog" aria-label="Playback speed">
          <div className="rate-menu-head">
            <span className="rate-menu-title">Speed</span>
            <span className="rate-readout">{formatRate(rate)}</span>
          </div>

          <input
            type="range"
            className="mini-range rate-slider"
            min={MIN_PLAYBACK_RATE}
            max={MAX_PLAYBACK_RATE}
            step={0.05}
            value={rate}
            aria-label="Playback speed"
            style={
              {
                "--range-value": `${percent}%`,
              } as CSSProperties
            }
            onChange={(event) => setRate(Number(event.currentTarget.value))}
          />
          <div className="rate-scale">
            <span>0.25×</span>
            <span>1×</span>
            <span>3×</span>
          </div>

          <div className="rate-quick">
            {RATES.map((option) => (
              <button
                key={option}
                type="button"
                className={rate === option ? "is-active" : ""}
                onClick={() => {
                  setRate(option);
                  setOpen(false);
                }}
              >
                {formatRate(option)}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="rate-pitch"
            onClick={() => setPreservesPitch(!preservesPitch)}
          >
            <span>Keep pitch</span>
            <span
              className={`rate-pitch-state ${preservesPitch ? "is-on" : ""}`}
            >
              {preservesPitch ? "On" : "Off"}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
