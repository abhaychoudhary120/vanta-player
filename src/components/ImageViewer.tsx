import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { usePlayerControls } from "../contexts/PlayerControlsContext";
import { clamp } from "../lib/format";
import { toAssetUrl } from "../lib/media";
import { usePlayerStore } from "../store/usePlayerStore";
import type { Track } from "../types";
import { IconButton } from "./ui/IconButton";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const SLIDESHOW_INTERVAL_MS = 5000;

const ZOOM_OUT_STEP = 0.8;
const ZOOM_IN_STEP = 1.25;

function nextZoom(value: number, factor: number): number {
  return clamp(Math.round(value * factor * 1000) / 1000, MIN_ZOOM, MAX_ZOOM);
}

export function ImageViewer({ track }: { track: Track }) {
  const { toggleFullscreen, isFullscreen } = usePlayerControls();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [slideshow, setSlideshow] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setFailed(false);
    setReloadKey(0);
  }, [track.id]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      setZoom((value) => nextZoom(value, factor));
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    if (!slideshow) {
      return;
    }

    const timer = window.setInterval(() => {
      const state = usePlayerStore.getState();
      const images = state.tracks.filter((item) => item.kind === "image");

      if (images.length < 2) {
        return;
      }

      const currentIndex = images.findIndex(
        (image) => image.id === state.currentId,
      );
      const next = images[(currentIndex + 1) % images.length];

      if (next) {
        state.selectTrack(next.id, false);
      }
    }, SLIDESHOW_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [slideshow]);

  const adjustZoom = useCallback((factor: number) => {
    setZoom((value) => {
      const next = nextZoom(value, factor);
      if (next <= 1) {
        setOffset({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  }, []);

  const rotate = useCallback((degrees: number) => {
    setRotation((value) => (value + degrees + 360) % 360);
    setOffset({ x: 0, y: 0 });
  }, []);

  const handleDoubleClick = () => {
    if (zoom > 1) {
      resetView();
    } else {
      setZoom(2);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || zoom <= 1) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    setOffset({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    });
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) {
      return;
    }

    dragRef.current = null;
    setDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const imageStyle = {
    transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${zoom})`,
  } as CSSProperties;

  return (
    <div className="image-stage" onClick={(event) => event.stopPropagation()}>
      <div
        ref={viewportRef}
        className={`image-viewport ${dragging ? "is-dragging" : ""} ${
          zoom > 1 ? "is-zoomed" : ""
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDoubleClick={handleDoubleClick}
      >
        {failed ? (
          <div className="image-error" role="alert">
            <div className="image-error-icon">
              <ImageIcon size={26} />
            </div>
            <p>That image could not be displayed.</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setFailed(false);
                setReloadKey((value) => value + 1);
              }}
            >
              <RotateCcw size={15} />
              Try again
            </button>
          </div>
        ) : (
          <img
            key={`${track.id}-${reloadKey}`}
            className="image-plane"
            src={toAssetUrl(track.path)}
            alt={track.title}
            draggable={false}
            style={imageStyle}
            onError={() => setFailed(true)}
          />
        )}
      </div>

      {!failed ? (
        <div
          className="image-toolbar"
          role="toolbar"
          aria-label="Image viewer controls"
        >
          <IconButton
            label="Zoom out"
            className="image-tool"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => adjustZoom(ZOOM_OUT_STEP)}
          >
            <ZoomOut size={16} />
          </IconButton>
          <button
            type="button"
            className="image-zoom-label"
            title="Reset view"
            onClick={resetView}
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconButton
            label="Zoom in"
            className="image-tool"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => adjustZoom(ZOOM_IN_STEP)}
          >
            <ZoomIn size={16} />
          </IconButton>

          <span className="image-tool-divider" aria-hidden="true" />

          <IconButton
            label="Rotate left"
            className="image-tool"
            onClick={() => rotate(-90)}
          >
            <RotateCcw size={16} />
          </IconButton>
          <IconButton
            label="Rotate right"
            className="image-tool"
            onClick={() => rotate(90)}
          >
            <RotateCw size={16} />
          </IconButton>

          <span className="image-tool-divider" aria-hidden="true" />

          <IconButton
            label={slideshow ? "Stop slideshow" : "Start slideshow"}
            className="image-tool"
            active={slideshow}
            onClick={() => setSlideshow((value) => !value)}
          >
            {slideshow ? <Pause size={16} /> : <Play size={16} />}
          </IconButton>
          <IconButton
            label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="image-tool"
            active={isFullscreen}
            onClick={() => void toggleFullscreen()}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </IconButton>
        </div>
      ) : null}

      {slideshow && !failed ? (
        <div className="image-slideshow-badge">
          <span className="image-slideshow-pulse" aria-hidden="true" />
          Slideshow · 5s
        </div>
      ) : null}
    </div>
  );
}
