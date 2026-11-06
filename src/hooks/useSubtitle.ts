import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Track } from "../types";

export function useSubtitle(track: Track | null): string | null {
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
  const videoPath = track?.kind === "video" ? track.path : null;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setSubtitleUrl(null);

    if (!videoPath) {
      return;
    }

    void invoke<string | null>("read_subtitle", { videoPath })
      .then((content) => {
        if (cancelled || !content) {
          return;
        }

        objectUrl = URL.createObjectURL(
          new Blob([content], { type: "text/vtt" }),
        );
        setSubtitleUrl(objectUrl);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [videoPath]);

  return subtitleUrl;
}
