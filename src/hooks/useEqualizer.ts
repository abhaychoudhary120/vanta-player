import { useEffect, useRef, type RefObject } from "react";
import { EQ_FREQUENCIES } from "../lib/equalizer";
import { usePlayerStore } from "../store/usePlayerStore";

interface EqualizerGraph {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  filters: BiquadFilterNode[];
}

function createGraph(element: HTMLVideoElement): EqualizerGraph | null {
  const AudioContextConstructor: typeof AudioContext | undefined =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  const context = new AudioContextConstructor();

  try {
    const source = context.createMediaElementSource(element);
    const filters = EQ_FREQUENCIES.map((frequency) => {
      const filter = context.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = frequency;
      filter.Q.value = 1.1;
      filter.gain.value = 0;
      return filter;
    });

    filters.forEach((filter, index) => {
      if (index > 0) {
        filters[index - 1].connect(filter);
      }
    });
    filters[filters.length - 1].connect(context.destination);

    return { context, source, filters };
  } catch (error) {
    void context.close().catch(() => undefined);
    throw error;
  }
}

export function useEqualizer(mediaRef: RefObject<HTMLVideoElement | null>) {
  const eqEnabled = usePlayerStore((state) => state.eqEnabled);
  const eqGains = usePlayerStore((state) => state.eqGains);
  const currentId = usePlayerStore((state) => state.currentId);
  const trackKind = usePlayerStore(
    (state) =>
      state.tracks.find((track) => track.id === state.currentId)?.kind ?? null,
  );
  const graphRef = useRef<EqualizerGraph | null>(null);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element || !currentId || !trackKind || trackKind === "image") {
      return;
    }
    if (!element.getAttribute("src")) {
      return;
    }

    const existing = graphRef.current;

    if (!eqEnabled) {
      if (!existing) {
        return;
      }

      try {
        existing.source.disconnect();
      } catch {
        // Already disconnected.
      }
      existing.source.connect(existing.context.destination);
      void existing.context.resume().catch(() => undefined);
      return;
    }

    if (!existing) {
      try {
        graphRef.current = createGraph(element);
      } catch {
        graphRef.current = null;
      }

      if (!graphRef.current) {
        const state = usePlayerStore.getState();
        state.setEqEnabled(false);
        state.notify("The equalizer could not start on this system.", "error");
        return;
      }
    }

    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    try {
      graph.source.disconnect();
    } catch {
      // Already disconnected.
    }
    graph.source.connect(graph.filters[0]);

    const gains = usePlayerStore.getState().eqGains;
    graph.filters.forEach((filter, index) => {
      filter.gain.value = gains[index] ?? 0;
    });

    void graph.context.resume().catch(() => undefined);
    const resume = () => {
      void graph.context.resume().catch(() => undefined);
    };
    element.addEventListener("play", resume);

    return () => {
      element.removeEventListener("play", resume);
    };
  }, [eqEnabled, currentId, trackKind, mediaRef]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    graph.filters.forEach((filter, index) => {
      filter.gain.value = eqGains[index] ?? 0;
    });
  }, [eqGains]);
}
