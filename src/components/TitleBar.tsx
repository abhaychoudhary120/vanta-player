import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, ListVideo, Minus, Plus, Square, X } from "lucide-react";
import { usePlayerControls } from "../contexts/PlayerControlsContext";
import { usePlayerStore } from "../store/usePlayerStore";
import { BrandMark } from "./BrandMark";
import { IconButton } from "./ui/IconButton";

export function TitleBar() {
  const { openFiles } = usePlayerControls();
  const sidebarOpen = usePlayerStore((state) => state.sidebarOpen);
  const toggleSidebar = usePlayerStore((state) => state.toggleSidebar);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let syncTimer: number | undefined;

    const syncMaximized = async () => {
      try {
        const value = await appWindow.isMaximized();
        if (!disposed) {
          setIsMaximized(value);
        }
      } catch {
        // Window state is cosmetic; failures should not block the UI.
      }
    };

    void syncMaximized();

    void appWindow
      .onResized(() => {
        if (syncTimer) {
          window.clearTimeout(syncTimer);
        }
        syncTimer = window.setTimeout(() => {
          void syncMaximized();
        }, 100);
      })
      .then((cleanup) => {
        if (disposed) {
          cleanup();
        } else {
          unlisten = cleanup;
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      if (syncTimer) {
        window.clearTimeout(syncTimer);
      }
      unlisten?.();
    };
  }, []);

  return (
    <header className="titlebar" data-tauri-drag-region="deep">
      <div className="titlebar-brand">
        <BrandMark className="brand-mark" />
        <div className="brand-copy">
          <span className="brand-name">VANTA</span>
          <span className="brand-subtitle">PLAYER</span>
        </div>
      </div>

      <div className="titlebar-status">
        <span className="status-dot" />
        <span>Local playback</span>
      </div>

      <div className="titlebar-actions">
        <button
          type="button"
          className="open-button"
          onClick={() => void openFiles()}
          title="Open media (Ctrl+O)"
        >
          <Plus size={15} strokeWidth={2.2} />
          <span>Open media</span>
          <kbd>Ctrl O</kbd>
        </button>

        <IconButton
          label={sidebarOpen ? "Hide queue" : "Show queue"}
          active={sidebarOpen}
          onClick={toggleSidebar}
          className="titlebar-queue-button"
        >
          <ListVideo size={17} />
        </IconButton>

        <div className="window-controls">
          <button
            type="button"
            className="window-control"
            aria-label="Minimize"
            title="Minimize"
            onClick={() => void getCurrentWindow().minimize()}
          >
            <Minus size={15} />
          </button>
          <button
            type="button"
            className="window-control"
            aria-label={isMaximized ? "Restore" : "Maximize"}
            title={isMaximized ? "Restore" : "Maximize"}
            onClick={() => void getCurrentWindow().toggleMaximize()}
          >
            {isMaximized ? <Copy size={13} /> : <Square size={12} />}
          </button>
          <button
            type="button"
            className="window-control window-control--close"
            aria-label="Close VANTA"
            title="Close"
            onClick={() => void getCurrentWindow().close()}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
