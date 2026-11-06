import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  Film,
  GripVertical,
  Image as ImageIcon,
  ListMusic,
  Music2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { usePlayerControls } from "../contexts/PlayerControlsContext";
import { formatTime } from "../lib/format";
import { getPalette } from "../lib/palette";
import { usePlayerStore } from "../store/usePlayerStore";
import type { Track } from "../types";

function formatQueueTotal(seconds: number): string {
  if (seconds <= 0) {
    return "—";
  }

  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} hr${minutes > 0 ? ` ${minutes} min` : ""}`;
  }

  return `${totalMinutes} min`;
}

interface QueueItemProps {
  track: Track;
  index: number;
  active: boolean;
  currentDuration: number;
  dragging: boolean;
  dropTarget: boolean;
  dropAfter: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onGripPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    id: string,
  ) => void;
  onGripPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onGripPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onGripPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}

function QueueItem({
  track,
  index,
  active,
  currentDuration,
  dragging,
  dropTarget,
  dropAfter,
  onSelect,
  onRemove,
  onMove,
  onGripPointerDown,
  onGripPointerMove,
  onGripPointerUp,
  onGripPointerCancel,
}: QueueItemProps) {
  const palette = getPalette(track.path);
  const duration = active && currentDuration > 0 ? currentDuration : track.duration;
  const kindLabel =
    track.kind === "video"
      ? "Video"
      : track.kind === "image"
        ? "Image"
        : "Audio";
  const detail =
    [track.artist, track.album].filter(Boolean).join(" · ") ||
    `${kindLabel} · ${track.extension.toUpperCase()}`;
  const KindIcon =
    track.kind === "video" ? Film : track.kind === "image" ? ImageIcon : Music2;

  return (
    <div
      className={`queue-item ${active ? "is-active" : ""} ${
        dragging ? "is-dragging" : ""
      } ${dropTarget ? "is-drop-target" : ""} ${
        dropTarget && dropAfter ? "is-drop-after" : ""
      }`}
      data-active={active}
      data-track-id={track.id}
    >
      <button
        type="button"
        className="queue-grip"
        aria-label={`Reorder ${track.title}. Use arrow keys or drag.`}
        title="Drag or use arrow keys to reorder"
        onPointerDown={(event) => onGripPointerDown(event, track.id)}
        onPointerMove={onGripPointerMove}
        onPointerUp={onGripPointerUp}
        onPointerCancel={onGripPointerCancel}
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            onMove(track.id, -1);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            onMove(track.id, 1);
          }
        }}
      >
        <GripVertical size={13} />
      </button>

      <button
        type="button"
        className="queue-select"
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect(track.id)}
        title={`${track.title} — ${detail}`}
      >
        <span
          className="queue-art"
          style={{
            background: `linear-gradient(140deg, ${palette.primary}, ${palette.secondary} 58%, ${palette.tertiary})`,
          }}
          aria-hidden="true"
        >
          <KindIcon size={14} />
          {active ? (
            <span className="queue-eq">
              <i />
              <i />
              <i />
            </span>
          ) : null}
        </span>

        <span className="queue-copy">
          <span className="queue-title">{track.title}</span>
          <span className="queue-meta">{detail}</span>
        </span>

        <span className="queue-duration">
          {duration !== null && duration > 0 ? formatTime(duration) : `#${index + 1}`}
        </span>
      </button>

      <button
        type="button"
        className="queue-remove"
        aria-label={`Remove ${track.title}`}
        title="Remove from queue"
        draggable={false}
        onClick={() => onRemove(track.id)}
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function PlaylistPanel({ open }: { open: boolean }) {
  const { openFiles } = usePlayerControls();
  const tracks = usePlayerStore((state) => state.tracks);
  const currentId = usePlayerStore((state) => state.currentId);
  const currentDuration = usePlayerStore((state) => state.duration);
  const selectTrack = usePlayerStore((state) => state.selectTrack);
  const removeTrack = usePlayerStore((state) => state.removeTrack);
  const reorderTrack = usePlayerStore((state) => state.reorderTrack);
  const clearQueue = usePlayerStore((state) => state.clearQueue);
  const notify = usePlayerStore((state) => state.notify);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropAfter, setDropAfter] = useState(false);
  const [dropAtEnd, setDropAtEnd] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    hasTarget: boolean;
    targetId: string | null;
    placeAfter: boolean;
  } | null>(null);

  const totalDuration = tracks.reduce(
    (total, track) => total + (track.duration ?? 0),
    0,
  );

  useEffect(() => {
    const activeRow = listRef.current?.querySelector('[data-active="true"]');
    activeRow?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentId]);

  const handleGripPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    id: string,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      hasTarget: false,
      targetId: null,
      placeAfter: false,
    };
  };

  const clearDropTarget = (session: NonNullable<typeof dragRef.current>) => {
    session.hasTarget = false;
    session.targetId = null;
    session.placeAfter = false;
    setDropTargetId(null);
    setDropAfter(false);
    setDropAtEnd(false);
  };

  const handleGripPointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    const session = dragRef.current;
    if (!session || event.pointerId !== session.pointerId) {
      return;
    }

    if (!session.active) {
      const distance = Math.hypot(
        event.clientX - session.startX,
        event.clientY - session.startY,
      );

      if (distance < 5) {
        return;
      }

      session.active = true;
      setDraggedId(session.id);
    }

    const list = listRef.current;
    if (list) {
      const bounds = list.getBoundingClientRect();

      if (event.clientY < bounds.top + 26) {
        list.scrollTop -= 12;
      } else if (event.clientY > bounds.bottom - 26) {
        list.scrollTop += 12;
      }
    }

    const hit = document.elementFromPoint(event.clientX, event.clientY);
    if (!(hit instanceof Element)) {
      clearDropTarget(session);
      return;
    }

    const row = hit.closest<HTMLElement>("[data-track-id]");

    if (row && list?.contains(row)) {
      const targetId = row.dataset.trackId;

      if (!targetId || targetId === session.id) {
        clearDropTarget(session);
        return;
      }

      const bounds = row.getBoundingClientRect();
      const placeAfter = event.clientY > bounds.top + bounds.height / 2;

      session.hasTarget = true;
      session.targetId = targetId;
      session.placeAfter = placeAfter;
      setDropAtEnd(false);
      setDropTargetId(targetId);
      setDropAfter(placeAfter);
      return;
    }

    if (hit.closest(".queue-drop-end")) {
      session.hasTarget = true;
      session.targetId = null;
      session.placeAfter = false;
      setDropAtEnd(true);
      setDropTargetId(null);
      setDropAfter(false);
      return;
    }

    clearDropTarget(session);
  };

  const finishGripDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    commit: boolean,
  ) => {
    const session = dragRef.current;
    if (!session || event.pointerId !== session.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;
    setDraggedId(null);
    setDropTargetId(null);
    setDropAfter(false);
    setDropAtEnd(false);

    if (!commit || !session.active || !session.hasTarget) {
      return;
    }

    if (!session.targetId) {
      reorderTrack(session.id, null);
      return;
    }

    const targetIndex = tracks.findIndex(
      (track) => track.id === session.targetId,
    );
    if (targetIndex === -1) {
      return;
    }

    const startIndex = targetIndex + (session.placeAfter ? 1 : 0);
    let beforeId: string | null = null;

    for (let index = startIndex; index < tracks.length; index += 1) {
      if (tracks[index].id !== session.id) {
        beforeId = tracks[index].id;
        break;
      }
    }

    reorderTrack(session.id, beforeId);
  };

  const handleGripPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    finishGripDrag(event, true);
  };

  const handleGripPointerCancel = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    finishGripDrag(event, false);
  };

  const moveTrack = (id: string, direction: -1 | 1) => {
    const index = tracks.findIndex((track) => track.id === id);
    const targetIndex = index + direction;

    if (index === -1 || targetIndex < 0 || targetIndex >= tracks.length) {
      return;
    }

    const beforeId =
      direction > 0
        ? (tracks[targetIndex + 1]?.id ?? null)
        : tracks[targetIndex].id;
    reorderTrack(id, beforeId);
  };

  const handleClear = async () => {
    try {
      const confirmed = await ask("Remove every track from the queue?", {
        title: "Clear queue",
        kind: "warning",
        okLabel: "Clear queue",
        cancelLabel: "Keep tracks",
      });

      if (confirmed) {
        clearQueue();
      }
    } catch {
      notify("The queue could not be cleared.", "error");
    }
  };

  return (
    <aside
      className={`playlist-panel ${open ? "is-open" : ""}`}
      aria-label="Playback queue"
      aria-hidden={!open}
    >
      <div className="queue-header">
        <div className="queue-heading">
          <span className="eyebrow">UP NEXT</span>
          <h2>
            Queue <span className="queue-count">{tracks.length}</span>
          </h2>
        </div>

        <div className="queue-header-actions">
          {tracks.length > 0 ? (
            <button
              type="button"
              className="queue-action queue-action--muted"
              aria-label="Clear queue"
              title="Clear queue"
              onClick={() => void handleClear()}
            >
              <Trash2 size={15} />
            </button>
          ) : null}
          <button
            type="button"
            className="queue-action"
            aria-label="Add media to queue"
            title="Add media"
            onClick={() => void openFiles()}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {tracks.length > 0 ? (
        <div className="queue-stats">
          <span>
            {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
          </span>
          <span className="queue-stat-dot" />
          <span>{formatQueueTotal(totalDuration)}</span>
        </div>
      ) : null}

      <div className="queue-list" ref={listRef}>
        {tracks.length === 0 ? (
          <div className="queue-empty">
            <div className="queue-empty-icon">
              <ListMusic size={26} />
            </div>
            <h3>Your queue is waiting.</h3>
            <p>Add a few files and keep the atmosphere going.</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void openFiles()}
            >
              <Plus size={15} />
              Add media
            </button>
          </div>
        ) : (
          tracks.map((track, index) => (
            <QueueItem
              key={track.id}
              track={track}
              index={index}
              active={track.id === currentId}
              currentDuration={currentDuration}
              dragging={track.id === draggedId}
              dropTarget={track.id === dropTargetId}
              dropAfter={dropAfter}
              onSelect={selectTrack}
              onRemove={removeTrack}
              onMove={moveTrack}
              onGripPointerDown={handleGripPointerDown}
              onGripPointerMove={handleGripPointerMove}
              onGripPointerUp={handleGripPointerUp}
              onGripPointerCancel={handleGripPointerCancel}
            />
          ))
        )}
      </div>

      {draggedId ? (
        <div className={`queue-drop-end ${dropAtEnd ? "is-ready" : ""}`}>
          Move to the end of the queue
        </div>
      ) : (
        <div className="queue-footer">
          <GripVertical size={12} />
          <span>Drag the handle or use arrow keys</span>
        </div>
      )}
    </aside>
  );
}
