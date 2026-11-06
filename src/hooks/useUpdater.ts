import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "current"
  | "available"
  | "downloading"
  | "installing"
  | "error";

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  version?: string;
  notes?: string;
  date?: string;
  error?: string;
  progress: number;
}

const initialState: UpdateState = {
  status: "idle",
  currentVersion: "",
  progress: 0,
};

function toMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Unable to reach the update server.";
}

export function useUpdater() {
  const [state, setState] = useState<UpdateState>(initialState);
  const updateRef = useRef<Update | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void getVersion()
      .then((version) => {
        if (!cancelled) {
          setState((current) => ({ ...current, currentVersion: version }));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    setState((current) => ({
      ...current,
      status: "checking",
      version: undefined,
      notes: undefined,
      date: undefined,
      error: undefined,
      progress: 0,
    }));

    try {
      if (updateRef.current) {
        await updateRef.current.close();
        updateRef.current = null;
      }

      const update = await check({ timeout: 30000 });

      if (update) {
        updateRef.current = update;
        setState((current) => ({
          ...current,
          status: "available",
          version: update.version,
          notes: update.body,
          date: update.date,
        }));
      } else {
        setState((current) => ({ ...current, status: "current" }));
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "error",
        error: toMessage(error),
      }));
    } finally {
      busyRef.current = false;
    }
  }, []);

  const installUpdate = useCallback(async () => {
    const update = updateRef.current;

    if (!update || busyRef.current) {
      return;
    }

    busyRef.current = true;
    let downloaded = 0;
    let total = 0;

    setState((current) => ({
      ...current,
      status: "downloading",
      progress: 0,
      error: undefined,
    }));

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          return;
        }

        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          const progress =
            total > 0
              ? Math.min(100, Math.round((downloaded / total) * 100))
              : 0;

          setState((current) => ({ ...current, progress }));
          return;
        }

        setState((current) => ({
          ...current,
          status: "installing",
          progress: 100,
        }));
      });

      setState((current) => ({
        ...current,
        status: "installing",
        progress: 100,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "error",
        error: toMessage(error),
      }));
    } finally {
      busyRef.current = false;
    }
  }, []);

  return {
    ...state,
    checkForUpdates,
    installUpdate,
  };
}
