import { useEffect, useRef, type RefObject } from "react";
import { EQ_FREQUENCIES } from "../lib/equalizer";
import {
  resolveSpatialSettings,
  type SpatialMode,
} from "../lib/spatial";
import { usePlayerStore } from "../store/usePlayerStore";

const GRAPH_SAMPLE_RATE = 48000;

interface AudioGraph {
  element: HTMLVideoElement;
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  filters: BiquadFilterNode[];
  bassShelf: BiquadFilterNode;
  airShelf: BiquadFilterNode;
  sideWidth: GainNode;
  compressor: DynamicsCompressorNode;
  dryGain: GainNode;
  wetGain: GainNode;
  makeup: GainNode;
  limiter: DynamicsCompressorNode;
  inputAnalyser: AnalyserNode;
  outputAnalyser: AnalyserNode;
  failed: boolean;
  direct: boolean;
}

type CachedMediaElement = HTMLVideoElement & {
  __vantaAudioGraph?: AudioGraph;
};

function getCachedGraph(element: HTMLVideoElement): AudioGraph | null {
  return (element as CachedMediaElement).__vantaAudioGraph ?? null;
}

function cacheGraph(element: HTMLVideoElement, graph: AudioGraph) {
  (element as CachedMediaElement).__vantaAudioGraph = graph;
}

function smooth(param: AudioParam, value: number, context: AudioContext) {
  // Replace any in-flight automation so dragging a slider does not queue
  // hundreds of overlapping ramps on the audio thread.
  param.cancelScheduledValues(context.currentTime);
  param.setTargetAtTime(value, context.currentTime, 0.035);
}

function createImpulseResponse(context: AudioContext): AudioBuffer {
  const seconds = 0.85;
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const impulse = context.createBuffer(2, length, context.sampleRate);

  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    let smoothed = 0;

    for (let index = 0; index < length; index += 1) {
      const progress = index / length;
      const noise = Math.random() * 2 - 1;
      smoothed = smoothed * 0.62 + noise * 0.38;
      const fadeIn = Math.min(1, index / (context.sampleRate * 0.012));

      data[index] =
        smoothed * Math.pow(1 - progress, 2.8) * fadeIn * 0.9;
    }
  }

  return impulse;
}

function createAnalyser(context: AudioContext): AnalyserNode {
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.2;
  return analyser;
}

function analyserLevel(analyser: AnalyserNode): number {
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);

  let sum = 0;
  for (let index = 0; index < data.length; index += 1) {
    sum += data[index] * data[index];
  }

  return Math.sqrt(sum / data.length);
}

function disconnectMainRoute(graph: AudioGraph) {
  for (const target of [graph.filters[0], graph.context.destination]) {
    try {
      graph.source.disconnect(target);
    } catch {
      // The source was not connected to this destination.
    }
  }
}

function routeDirect(graph: AudioGraph) {
  disconnectMainRoute(graph);
  try {
    graph.source.connect(graph.context.destination);
    graph.direct = true;
  } catch {
    // Keep the current route if the browser refuses the connection.
  }

  if (graph.context.state !== "running") {
    void graph.context.resume().catch(() => undefined);
  }
}

function routeThroughGraph(graph: AudioGraph) {
  if (graph.failed) {
    routeDirect(graph);
    return;
  }

  // Never send audio into a suspended context. Playback stays audible on the
  // direct route until the browser lets the context run, then statechange
  // promotes it back to the processed route.
  if (graph.context.state !== "running") {
    routeDirect(graph);
    void graph.context.resume().catch(() => undefined);
    return;
  }

  disconnectMainRoute(graph);
  try {
    graph.source.connect(graph.filters[0]);
    graph.direct = false;
  } catch {
    routeDirect(graph);
  }
}

function createGraph(element: HTMLVideoElement): AudioGraph | null {
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

  let context: AudioContext;

  try {
    // A fixed 48 kHz graph keeps the DSP load predictable and avoids opening
    // the device at extreme rates such as 192 kHz.
    context = new AudioContextConstructor({
      latencyHint: "interactive",
      sampleRate: GRAPH_SAMPLE_RATE,
    });
  } catch {
    // Some drivers refuse an explicit rate. Fall back to the device default
    // rather than leaving playback without audio.
    context = new AudioContextConstructor({ latencyHint: "interactive" });
  }

  let filters: BiquadFilterNode[];
  let bassShelf: BiquadFilterNode;
  let airShelf: BiquadFilterNode;
  let sideWidth: GainNode;
  let compressor: DynamicsCompressorNode;
  let dryGain: GainNode;
  let wetGain: GainNode;
  let makeup: GainNode;
  let limiter: DynamicsCompressorNode;
  let inputAnalyser: AnalyserNode;
  let outputAnalyser: AnalyserNode;
  let source: MediaElementAudioSourceNode;

  try {
    filters = EQ_FREQUENCIES.map((frequency) => {
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

    // Force everything into a clean stereo image before the spatial stage.
    const stereoIn = context.createGain();
    stereoIn.channelCount = 2;
    stereoIn.channelCountMode = "explicit";
    stereoIn.channelInterpretation = "speakers";

    bassShelf = context.createBiquadFilter();
    bassShelf.type = "lowshelf";
    bassShelf.frequency.value = 88;
    bassShelf.gain.value = 0;

    airShelf = context.createBiquadFilter();
    airShelf.type = "highshelf";
    airShelf.frequency.value = 11500;
    airShelf.gain.value = 0;

    // Mid/side stereo widener. At width 1 it reconstructs the input exactly.
    const splitter = context.createChannelSplitter(2);
    const midLeft = context.createGain();
    const midRight = context.createGain();
    const sideLeft = context.createGain();
    const sideRight = context.createGain();
    const mid = context.createGain();
    const side = context.createGain();
    sideWidth = context.createGain();
    const sideInvert = context.createGain();
    const merger = context.createChannelMerger(2);

    midLeft.gain.value = 0.5;
    midRight.gain.value = 0.5;
    sideLeft.gain.value = 0.5;
    sideRight.gain.value = -0.5;
    sideWidth.gain.value = 1;
    sideInvert.gain.value = -1;

    splitter.connect(midLeft, 0);
    splitter.connect(midRight, 1);
    midLeft.connect(mid);
    midRight.connect(mid);
    splitter.connect(sideLeft, 0);
    splitter.connect(sideRight, 1);
    sideLeft.connect(side);
    sideRight.connect(side);
    side.connect(sideWidth);
    mid.connect(merger, 0, 0);
    mid.connect(merger, 0, 1);
    sideWidth.connect(merger, 0, 0);
    sideWidth.connect(sideInvert);
    sideInvert.connect(merger, 0, 1);

    compressor = context.createDynamicsCompressor();
    compressor.threshold.value = 0;
    compressor.knee.value = 12;
    compressor.ratio.value = 1;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.22;

    dryGain = context.createGain();
    dryGain.gain.value = 1;

    // A short, dark room impulse adds depth without smearing the mix.
    const reverbHighpass = context.createBiquadFilter();
    reverbHighpass.type = "highpass";
    reverbHighpass.frequency.value = 240;
    reverbHighpass.Q.value = 0.7;

    const reverbDelay = context.createDelay(0.1);
    reverbDelay.delayTime.value = 0.018;

    const convolver = context.createConvolver();
    convolver.normalize = true;
    convolver.buffer = createImpulseResponse(context);

    wetGain = context.createGain();
    wetGain.gain.value = 0;

    const bus = context.createGain();
    makeup = context.createGain();
    makeup.gain.value = 1;

    limiter = context.createDynamicsCompressor();
    limiter.threshold.value = 0;
    limiter.knee.value = 0;
    limiter.ratio.value = 1;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;

    inputAnalyser = createAnalyser(context);
    outputAnalyser = createAnalyser(context);

    filters[filters.length - 1].connect(stereoIn);
    stereoIn.connect(bassShelf);
    bassShelf.connect(airShelf);
    airShelf.connect(splitter);
    merger.connect(compressor);
    compressor.connect(dryGain);
    dryGain.connect(bus);
    compressor.connect(reverbHighpass);
    reverbHighpass.connect(reverbDelay);
    reverbDelay.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(bus);
    bus.connect(makeup);
    makeup.connect(limiter);
    limiter.connect(context.destination);
    limiter.connect(outputAnalyser);
  } catch (error) {
    // Nothing has been bound to the media element yet, so closing the context
    // cannot interrupt playback.
    void context.close().catch(() => undefined);
    throw error;
  }

  try {
    source = context.createMediaElementSource(element);
  } catch (error) {
    // The element was not captured, so it keeps playing through its native
    // output and closing the context is safe.
    void context.close().catch(() => undefined);
    throw error;
  }

  const graph: AudioGraph = {
    element,
    context,
    source,
    filters,
    bassShelf,
    airShelf,
    sideWidth,
    compressor,
    dryGain,
    wetGain,
    makeup,
    limiter,
    inputAnalyser,
    outputAnalyser,
    failed: false,
    direct: false,
  };

  try {
    // The input analyser is a leaf node used by the silence watchdog, so it
    // never adds gain to the audible path.
    source.connect(inputAnalyser);
    source.connect(filters[0]);
    cacheGraph(element, graph);
    return graph;
  } catch {
    graph.failed = true;
    routeDirect(graph);
    cacheGraph(element, graph);
    throw new Error("Audio enhancement could not be connected.");
  }
}

function applyEqualizer(graph: AudioGraph, gains: number[]) {
  graph.filters.forEach((filter, index) => {
    smooth(filter.gain, gains[index] ?? 0, graph.context);
  });
}

function applySpatial(
  graph: AudioGraph,
  enabled: boolean,
  intensity: number,
  mode: SpatialMode,
) {
  const settings = resolveSpatialSettings(enabled, intensity, mode);

  smooth(graph.bassShelf.gain, settings.bass, graph.context);
  smooth(graph.airShelf.gain, settings.air, graph.context);
  smooth(graph.sideWidth.gain, settings.width, graph.context);
  smooth(graph.wetGain.gain, settings.reverb, graph.context);
  smooth(
    graph.dryGain.gain,
    enabled ? 1 - settings.reverb * 0.28 : 1,
    graph.context,
  );
  smooth(graph.compressor.threshold, settings.threshold, graph.context);
  smooth(graph.compressor.ratio, settings.ratio, graph.context);
  smooth(graph.makeup.gain, settings.makeup, graph.context);
  smooth(graph.limiter.threshold, enabled ? -1.5 : 0, graph.context);
  smooth(graph.limiter.ratio, enabled ? 20 : 1, graph.context);
}

export function useEqualizer(mediaRef: RefObject<HTMLVideoElement | null>) {
  const eqEnabled = usePlayerStore((state) => state.eqEnabled);
  const eqGains = usePlayerStore((state) => state.eqGains);
  const spatialEnabled = usePlayerStore((state) => state.spatialEnabled);
  const spatialIntensity = usePlayerStore((state) => state.spatialIntensity);
  const spatialMode = usePlayerStore((state) => state.spatialMode);
  const currentId = usePlayerStore((state) => state.currentId);
  const trackKind = usePlayerStore(
    (state) =>
      state.tracks.find((track) => track.id === state.currentId)?.kind ?? null,
  );
  const graphRef = useRef<AudioGraph | null>(null);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element || !currentId || !trackKind || trackKind === "image") {
      return;
    }
    if (!element.getAttribute("src")) {
      return;
    }

    // Reuse the graph cached on the element itself. This survives component
    // remounts and dev hot reloads, and guarantees a media element only ever
    // gets one MediaElementAudioSourceNode.
    let graph = getCachedGraph(element);
    if (!graph && graphRef.current?.element === element) {
      graph = graphRef.current;
    }
    graphRef.current = graph;

    const needsGraph = eqEnabled || spatialEnabled;

    if (!graph && !needsGraph) {
      return;
    }

    if (!graph) {
      try {
        graph = createGraph(element);
      } catch {
        graph = getCachedGraph(element);
      }

      graphRef.current = graph;

      if (!graph) {
        const state = usePlayerStore.getState();
        state.setEqEnabled(false);
        state.setSpatialEnabled(false);
        state.notify(
          "Audio enhancement could not start on this system.",
          "error",
        );
        return;
      }
    }

    if (graph.failed) {
      routeDirect(graph);

      if (needsGraph) {
        const state = usePlayerStore.getState();
        state.setEqEnabled(false);
        state.setSpatialEnabled(false);
        state.notify(
          "Audio enhancement could not start on this system.",
          "error",
        );
      }
    } else if (needsGraph) {
      routeThroughGraph(graph);

      applyEqualizer(graph, usePlayerStore.getState().eqGains);
      const state = usePlayerStore.getState();
      applySpatial(
        graph,
        state.spatialEnabled,
        state.spatialIntensity,
        state.spatialMode,
      );
    } else {
      routeDirect(graph);
    }

    const resume = () => {
      if (graph?.context.state === "running") {
        return;
      }
      void graph?.context.resume().catch(() => undefined);
    };

    const handleStateChange = () => {
      if (!graph) {
        return;
      }

      if (graph.context.state !== "running") {
        void graph.context.resume().catch(() => undefined);
        return;
      }

      const current = usePlayerStore.getState();
      if (!current.eqEnabled && !current.spatialEnabled) {
        routeDirect(graph);
        return;
      }

      routeThroughGraph(graph);
      applyEqualizer(graph, current.eqGains);
      applySpatial(
        graph,
        current.spatialEnabled,
        current.spatialIntensity,
        current.spatialMode,
      );
    };

    graph.context.addEventListener("statechange", handleStateChange);
    element.addEventListener("play", resume);
    document.addEventListener("pointerdown", resume);
    document.addEventListener("keydown", resume);
    resume();

    return () => {
      graph?.context.removeEventListener("statechange", handleStateChange);
      element.removeEventListener("play", resume);
      document.removeEventListener("pointerdown", resume);
      document.removeEventListener("keydown", resume);
    };
  }, [eqEnabled, spatialEnabled, currentId, trackKind, mediaRef]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || graph.failed) {
      return;
    }

    applyEqualizer(graph, eqGains);
  }, [eqGains]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || graph.failed) {
      return;
    }

    applySpatial(graph, spatialEnabled, spatialIntensity, spatialMode);
  }, [spatialEnabled, spatialIntensity, spatialMode]);

  // Safety net: if the processed route ever becomes silent while the source is
  // producing sound, bypass it so playback can never get stuck without audio.
  useEffect(() => {
    if (!eqEnabled && !spatialEnabled) {
      return;
    }

    let silentChecks = 0;
    const timer = window.setInterval(() => {
      const element = mediaRef.current;
      const graph = element
        ? getCachedGraph(element) ??
          (graphRef.current?.element === element ? graphRef.current : null)
        : null;

      if (
        !element ||
        !graph ||
        graph.failed ||
        graph.direct ||
        element.paused ||
        element.muted ||
        element.volume === 0
      ) {
        silentChecks = 0;
        return;
      }

      if (graph.context.state !== "running") {
        void graph.context.resume().catch(() => undefined);
        silentChecks = 0;
        return;
      }

      const inputLevel = analyserLevel(graph.inputAnalyser);
      const outputLevel = analyserLevel(graph.outputAnalyser);

      // Digital silence is the failure this guards against. A very small
      // threshold avoids false positives from a heavily cut equalizer.
      if (inputLevel > 0.004 && outputLevel < 0.000001) {
        silentChecks += 1;

        if (silentChecks >= 3) {
          silentChecks = 0;
          routeDirect(graph);
          const state = usePlayerStore.getState();
          state.setEqEnabled(false);
          state.setSpatialEnabled(false);
          state.notify(
            "Audio processing stopped on this output, so playback was restored.",
            "error",
          );
        }
      } else {
        silentChecks = 0;
      }
    }, 1200);

    return () => {
      window.clearInterval(timer);
    };
  }, [eqEnabled, spatialEnabled, mediaRef]);
}
