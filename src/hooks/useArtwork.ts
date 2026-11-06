import { useEffect, useState } from "react";
import { readArtwork, toAssetUrl } from "../lib/media";
import type { Track } from "../types";

export function useArtwork(track: Track | null): string | null {
  const [artwork, setArtwork] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (track?.kind === "image") {
      setArtwork(toAssetUrl(track.path));
      return;
    }

    if (!track || track.kind !== "audio" || !track.hasArtwork) {
      setArtwork(null);
      return;
    }

    setArtwork(null);
    void readArtwork(track.path)
      .then((image) => {
        if (!cancelled) {
          setArtwork(image);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setArtwork(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [track?.path, track?.kind, track?.hasArtwork]);

  return artwork;
}
