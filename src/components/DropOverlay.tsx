import { FileUp } from "lucide-react";

export function DropOverlay() {
  return (
    <div className="drop-overlay" aria-hidden="true">
      <div className="drop-card">
        <div className="drop-icon">
          <FileUp size={30} />
        </div>
        <span className="eyebrow">DROP TO PLAY</span>
        <h2>Let it in.</h2>
        <p>Release your media anywhere in VANTA.</p>
        <div className="format-chips">
          {["MP4", "MKV", "AVI", "MP3", "FLAC", "PNG", "JPG"].map((format) => (
            <span key={format}>{format}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
