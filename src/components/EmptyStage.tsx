import { FolderOpen } from "lucide-react";
import { usePlayerControls } from "../contexts/PlayerControlsContext";
import { BrandMark } from "./BrandMark";

export function EmptyStage() {
  const { openFiles } = usePlayerControls();

  return (
    <div className="empty-stage">
      <div className="empty-visual" aria-hidden="true">
        <div className="empty-halo empty-halo--one" />
        <div className="empty-halo empty-halo--two" />
        <div className="empty-disc">
          <BrandMark className="empty-mark" />
        </div>
        <span className="empty-orbit-dot empty-orbit-dot--one" />
        <span className="empty-orbit-dot empty-orbit-dot--two" />
        <div className="empty-wave">
          {Array.from({ length: 18 }, (_, index) => (
            <i
              key={index}
              style={{
                height: `${22 + Math.round(Math.sin(index * 0.82) * 14 + 18)}%`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="empty-copy">
        <span className="eyebrow">LOCAL-FIRST PLAYBACK</span>
        <h1>
          Your media.
          <br />
          <em>Beautifully at home.</em>
        </h1>
        <p>
          Drop a video, song, or image anywhere. VANTA keeps playback local,
          fast, and focused on what matters.
        </p>
      </div>

      <div className="empty-actions">
        <button
          type="button"
          className="primary-button"
          onClick={() => void openFiles()}
        >
          <FolderOpen size={17} />
          <span>Choose media</span>
        </button>
        <span className="empty-hint">
          or press <kbd>Ctrl</kbd> <kbd>O</kbd>
        </span>
      </div>

      <div className="format-chips" aria-label="Popular supported formats">
        {["MP4", "MKV", "AVI", "MP3", "FLAC", "WAV", "PNG", "JPG"].map(
          (format) => (
            <span key={format}>{format}</span>
          ),
        )}
        <span className="format-more">+ more</span>
      </div>
    </div>
  );
}
