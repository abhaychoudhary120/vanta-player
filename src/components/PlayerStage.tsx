import {
  useEffect,
  useMemo,
  type CSSProperties,
  type MouseEvent,
  type RefObject,
} from "react";
import { CircleAlert, LoaderCircle, Play, RotateCcw } from "lucide-react";
import { usePlayerControls } from "../contexts/PlayerControlsContext";
import { formatTime } from "../lib/format";
import type { Palette } from "../lib/palette";
import { useSubtitle } from "../hooks/useSubtitle";
import { usePlayerStore } from "../store/usePlayerStore";
import type { Track, VisualizerMode } from "../types";
import { EmptyStage } from "./EmptyStage";
import { ImageViewer } from "./ImageViewer";

function createBars(seed: string): number[] {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  let state = Math.abs(hash) || 1;

  return Array.from({ length: 46 }, (_, index) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const wave = Math.sin(index * 0.64 + (state % 100) / 14) * 0.5 + 0.5;
    return Math.round(22 + wave * 78);
  });
}

function AudioVisual({
  track,
  artwork,
  palette,
  isPlaying,
  visualizer,
}: {
  track: Track;
  artwork: string | null;
  palette: Palette;
  isPlaying: boolean;
  visualizer: VisualizerMode;
}) {
  const bars = useMemo(() => createBars(track.path), [track.path]);
  const monogram = track.title.trim().charAt(0).toUpperCase() || "V";
  const motionClass = isPlaying ? "is-playing" : "is-paused";

  return (
    <div className="audio-stage">
      {artwork ? (
        <div
          className="audio-backdrop"
          style={{ backgroundImage: `url(${artwork})` }}
          aria-hidden="true"
        />
      ) : (
        <div
          className="audio-backdrop audio-backdrop--generated"
          style={{
            background: `radial-gradient(circle at 34% 30%, ${palette.primary}, transparent 58%), radial-gradient(circle at 68% 70%, ${palette.secondary}, transparent 54%)`,
          }}
          aria-hidden="true"
        />
      )}

      <div className="audio-aura" aria-hidden="true" />

      <div
        className={`audio-visual ${motionClass} audio-visual--${visualizer}`}
      >
        {visualizer === "circular" ? (
          <div className={`spectrum-ring ${motionClass}`} aria-hidden="true">
            {Array.from({ length: 72 }, (_, index) => {
              const height = bars[index % bars.length];
              return (
                <i
                  key={index}
                  style={
                    {
                      "--angle": `${index * 5}deg`,
                      "--bar-scale": `${0.35 + (height / 100) * 0.65}`,
                      "--bar-delay": `${(index % 11) * -0.11}s`,
                      "--bar-duration": `${0.7 + (index % 5) * 0.12}s`,
                    } as CSSProperties
                  }
                />
              );
            })}
          </div>
        ) : null}

        <div className="cover-orbit cover-orbit--outer" aria-hidden="true" />
        <div className="cover-orbit cover-orbit--inner" aria-hidden="true" />

        <div
          className="audio-cover"
          style={{
            background: `linear-gradient(145deg, ${palette.primary}, ${palette.secondary} 54%, ${palette.tertiary})`,
          }}
        >
          {artwork ? (
            <img src={artwork} alt="" draggable={false} />
          ) : (
            <div className="generated-cover">
              <div className="cover-rings" aria-hidden="true" />
              <span className="cover-spine" aria-hidden="true" />
              <span className="cover-monogram">{monogram}</span>
              <span className="cover-label">
                <span>VANTA</span>
                <span>{track.extension.toUpperCase()}</span>
              </span>
            </div>
          )}
          <span className="cover-sheen" aria-hidden="true" />
        </div>
      </div>

      {visualizer === "bars" ? (
        <div className={`audio-eq ${motionClass}`} aria-hidden="true">
          {bars.map((height, index) => (
            <i
              key={index}
              style={
                {
                  "--bar-height": `${height}%`,
                  "--bar-delay": `${(index % 9) * -0.11}s`,
                  "--bar-duration": `${0.72 + (index % 7) * 0.09}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      {visualizer === "waveform" ? (
        <div className={`audio-wave ${motionClass}`} aria-hidden="true">
          {bars.map((height, index) => (
            <i
              key={index}
              style={
                {
                  "--bar-height": `${height}%`,
                  "--bar-delay": `${(index % 9) * -0.09}s`,
                  "--bar-duration": `${0.62 + (index % 6) * 0.11}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      <div className="audio-caption">
        <span>NOW PLAYING</span>
        <span className="audio-caption-line" />
        <span>{formatTime(track.duration ?? 0)}</span>
      </div>
    </div>
  );
}

export function PlayerStage({
  mediaRef,
  track,
  artwork,
  palette,
}: {
  mediaRef: RefObject<HTMLVideoElement | null>;
  track: Track | null;
  artwork: string | null;
  palette: Palette;
}) {
  const { togglePlay, retry } = usePlayerControls();
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isBuffering = usePlayerStore((state) => state.isBuffering);
  const error = usePlayerStore((state) => state.error);
  const visualizer = usePlayerStore((state) => state.visualizer);
  const subtitleUrl = useSubtitle(track);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element || !subtitleUrl) {
      return;
    }

    const showSubtitles = () => {
      const trackList = element.textTracks;
      for (let index = 0; index < trackList.length; index += 1) {
        trackList[index].mode = "showing";
      }
    };

    showSubtitles();
    element.addEventListener("loadedmetadata", showSubtitles);

    return () => {
      element.removeEventListener("loadedmetadata", showSubtitles);
    };
  }, [subtitleUrl, mediaRef]);

  const stageStyle = {
    "--stage-primary": palette.primary,
    "--stage-secondary": palette.secondary,
    "--stage-primary-rgb": palette.primaryRgb,
    "--stage-secondary-rgb": palette.secondaryRgb,
  } as CSSProperties;

  const handleStageClick = (event: MouseEvent<HTMLElement>) => {
    if (!track || error || track.kind === "image") {
      return;
    }

    if (event.target instanceof Element && event.target.closest("button")) {
      return;
    }

    togglePlay();
  };

  const showVideo = track?.kind === "video";
  const showImage = track?.kind === "image";

  return (
    <section
      className={`stage-frame ${!track ? "stage-frame--empty" : ""} ${
        track?.kind === "audio" ? "stage-frame--audio" : ""
      } ${showVideo ? "stage-frame--video" : ""} ${
        showImage ? "stage-frame--image" : ""
      }`}
      style={stageStyle}
      onClick={handleStageClick}
    >
      <video
        ref={mediaRef}
        className={`media-element ${showVideo ? "is-visible" : ""}`}
        playsInline
        preload="auto"
        crossOrigin="anonymous"
      >
        {subtitleUrl ? (
          <track
            kind="subtitles"
            src={subtitleUrl}
            srcLang="en"
            label="Subtitles"
            default
          />
        ) : null}
      </video>

      {track ? (
        <>
          <div className="stage-topline">
            <div className="stage-chip">
              <span className="stage-chip-dot" />
              <span>
                {track.kind === "video"
                  ? "Video"
                  : track.kind === "image"
                    ? "Image"
                    : "Audio"}
              </span>
              <span className="stage-chip-separator" />
              <span>{track.extension.toUpperCase()}</span>
            </div>
            <span className="stage-local">LOCAL FILE</span>
          </div>

          {track.kind === "audio" ? (
            <AudioVisual
              track={track}
              artwork={artwork}
              palette={palette}
              isPlaying={isPlaying}
              visualizer={visualizer}
            />
          ) : null}

          {showImage ? <ImageViewer track={track} /> : null}

          {showVideo && !isPlaying && !isBuffering && !error ? (
            <button
              type="button"
              className="stage-play-overlay"
              aria-label="Play"
              onClick={togglePlay}
            >
              <Play size={27} fill="currentColor" strokeWidth={1.5} />
            </button>
          ) : null}

          {isBuffering && !error ? (
            <div className="stage-buffering" role="status">
              <LoaderCircle size={15} className="spin" />
              <span>Buffering</span>
            </div>
          ) : null}

          {error ? (
            <div
              className="stage-error-wrap"
              role="alert"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="stage-error-card">
                <div className="stage-error-icon">
                  <CircleAlert size={24} />
                </div>
                <span className="eyebrow">PLAYBACK INTERRUPTED</span>
                <h2>That file hit a snag.</h2>
                <p>{error}</p>
                <button type="button" className="secondary-button" onClick={retry}>
                  <RotateCcw size={15} />
                  Try again
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyStage />
      )}
    </section>
  );
}
