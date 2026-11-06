import { useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
  Settings2,
  X,
} from "lucide-react";
import { useUpdater } from "../hooks/useUpdater";
import {
  EQ_FREQUENCIES,
  EQ_MAX_GAIN,
  EQ_MIN_GAIN,
  EQ_PRESET_LABELS,
  EQ_PRESET_ORDER,
  formatFrequency,
  type NamedEqualizerPreset,
} from "../lib/equalizer";
import { formatRate } from "../lib/format";
import {
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE,
  usePlayerStore,
} from "../store/usePlayerStore";
import type { VisualizerMode } from "../types";

const VISUALIZER_OPTIONS: { value: VisualizerMode; label: string }[] = [
  { value: "bars", label: "Bars" },
  { value: "waveform", label: "Waveform" },
  { value: "circular", label: "Circular" },
];

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`settings-switch ${checked ? "is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-switch-thumb" />
    </button>
  );
}

export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const rate = usePlayerStore((state) => state.rate);
  const setRate = usePlayerStore((state) => state.setRate);
  const preservesPitch = usePlayerStore((state) => state.preservesPitch);
  const setPreservesPitch = usePlayerStore(
    (state) => state.setPreservesPitch,
  );
  const hardwareAcceleration = usePlayerStore(
    (state) => state.hardwareAcceleration,
  );
  const setHardwareAcceleration = usePlayerStore(
    (state) => state.setHardwareAcceleration,
  );
  const visualizer = usePlayerStore((state) => state.visualizer);
  const setVisualizer = usePlayerStore((state) => state.setVisualizer);
  const eqEnabled = usePlayerStore((state) => state.eqEnabled);
  const setEqEnabled = usePlayerStore((state) => state.setEqEnabled);
  const eqGains = usePlayerStore((state) => state.eqGains);
  const eqPreset = usePlayerStore((state) => state.eqPreset);
  const setEqGain = usePlayerStore((state) => state.setEqGain);
  const setEqPreset = usePlayerStore((state) => state.setEqPreset);
  const resetEqualizer = usePlayerStore((state) => state.resetEqualizer);
  const {
    status: updateStatus,
    currentVersion,
    version: availableVersion,
    notes: updateNotes,
    date: updateDate,
    error: updateError,
    progress: updateProgress,
    checkForUpdates,
    installUpdate,
  } = useUpdater();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onClose();
    };

    document.addEventListener("keydown", handleEscape, true);

    return () => {
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const speedPercent =
    ((rate - MIN_PLAYBACK_RATE) / (MAX_PLAYBACK_RATE - MIN_PLAYBACK_RATE)) * 100;

  const applyPreset = (preset: NamedEqualizerPreset) => {
    if (!eqEnabled) {
      setEqEnabled(true);
    }
    setEqPreset(preset);
  };

  const updateBusy =
    updateStatus === "checking" ||
    updateStatus === "downloading" ||
    updateStatus === "installing";

  const parsedReleaseDate = updateDate ? new Date(updateDate) : null;
  const releaseDateLabel =
    parsedReleaseDate && !Number.isNaN(parsedReleaseDate.getTime())
      ? parsedReleaseDate.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : undefined;

  const updateTitle = (() => {
    switch (updateStatus) {
      case "checking":
        return "Checking for updates";
      case "current":
        return "You're up to date";
      case "available":
        return `Version ${availableVersion ?? "new"} is available`;
      case "downloading":
        return `Downloading ${availableVersion ?? "update"}`;
      case "installing":
        return "Installing update";
      case "error":
        return "Update check failed";
      default:
        return "Stay up to date";
    }
  })();

  const updateMessage = (() => {
    switch (updateStatus) {
      case "checking":
        return "Contacting GitHub Releases.";
      case "current":
        return `VANTA ${currentVersion || "is current"} is up to date.`;
      case "available":
        return releaseDateLabel
          ? `Released ${releaseDateLabel}.`
          : "A signed update is ready to install.";
      case "downloading":
        return `${updateProgress}% downloaded.`;
      case "installing":
        return "VANTA will close while the installer runs.";
      case "error":
        return updateError ?? "Unable to reach the update server.";
      default:
        return currentVersion
          ? `Current version ${currentVersion}.`
          : "Check GitHub Releases for the latest signed build.";
    }
  })();

  const updateButtonLabel = (() => {
    switch (updateStatus) {
      case "checking":
        return "Checking...";
      case "downloading":
        return `${updateProgress}%`;
      case "installing":
        return "Installing...";
      case "available":
        return "Download & install";
      default:
        return "Check for updates";
    }
  })();

  return createPortal(
    <div
      className="settings-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onKeyDown={(event) => {
          if (event.key !== "Escape") {
            event.stopPropagation();
          }
        }}
      >
        <header className="settings-header">
          <div className="settings-heading">
            <span className="eyebrow">
              <Settings2 size={12} />
              ADVANCED CONTROLS
            </span>
            <h2 id="settings-title">Settings</h2>
            <p>Tune playback, motion and sound to your setup.</p>
          </div>
          <button
            type="button"
            className="settings-close"
            aria-label="Close settings"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="settings-body">
          <section className="settings-section">
            <div className="settings-section-head">
              <h3>Playback</h3>
              <span>Fine-grained speed control</span>
            </div>

            <div className="settings-field">
              <div className="settings-field-label">
                <span>Speed</span>
                <strong>{formatRate(rate)}</strong>
              </div>
              <input
                type="range"
                className="mini-range settings-range"
                min={MIN_PLAYBACK_RATE}
                max={MAX_PLAYBACK_RATE}
                step={0.05}
                value={rate}
                aria-label="Playback speed"
                style={
                  {
                    "--range-value": `${speedPercent}%`,
                  } as CSSProperties
                }
                onChange={(event) => setRate(Number(event.currentTarget.value))}
              />
              <div className="settings-scale">
                <span>0.25×</span>
                <button type="button" onClick={() => setRate(1)}>
                  Reset to 1×
                </button>
                <span>3×</span>
              </div>
            </div>

            <div className="settings-row">
              <div>
                <strong>Keep pitch</strong>
                <span>Preserve vocals and instruments at any speed.</span>
              </div>
              <ToggleSwitch
                checked={preservesPitch}
                onChange={setPreservesPitch}
                label="Keep pitch"
              />
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <h3>Performance</h3>
              <span>Built for integrated graphics</span>
            </div>

            <div className="settings-row settings-row--top">
              <div>
                <strong>Hardware acceleration</strong>
                <span>
                  Turn off to use a lighter rendering path on Intel HD and
                  other low-end GPUs.
                </span>
              </div>
              <ToggleSwitch
                checked={hardwareAcceleration}
                onChange={setHardwareAcceleration}
                label="Hardware acceleration"
              />
            </div>

            <div className="settings-row settings-row--top">
              <div>
                <strong>Visualizer</strong>
                <span>Choose how the stage reacts to your music.</span>
              </div>
            </div>

            <div
              className="segmented-control"
              role="radiogroup"
              aria-label="Visualizer mode"
            >
              {VISUALIZER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={visualizer === option.value}
                  className={visualizer === option.value ? "is-active" : ""}
                  onClick={() => setVisualizer(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section settings-section--wide">
            <div className="settings-section-head settings-section-head--row">
              <div>
                <h3>Equalizer</h3>
                <span>10 bands · ±12 dB</span>
              </div>
              <div className="settings-head-actions">
                <button
                  type="button"
                  className="settings-reset"
                  onClick={resetEqualizer}
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
                <ToggleSwitch
                  checked={eqEnabled}
                  onChange={setEqEnabled}
                  label="Enable equalizer"
                />
              </div>
            </div>

            <div className="eq-presets" role="group" aria-label="Presets">
              {EQ_PRESET_ORDER.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`eq-preset ${
                    eqPreset === preset ? "is-active" : ""
                  }`}
                  onClick={() => applyPreset(preset)}
                >
                  {EQ_PRESET_LABELS[preset]}
                </button>
              ))}
            </div>

            <div className="eq-bands">
              {EQ_FREQUENCIES.map((frequency, index) => {
                const gain = eqGains[index] ?? 0;
                const percent = ((gain - EQ_MIN_GAIN) / (EQ_MAX_GAIN - EQ_MIN_GAIN)) * 100;

                return (
                  <label key={frequency} className="eq-band">
                    <span className="eq-band-frequency">
                      {formatFrequency(frequency)}
                    </span>
                    <input
                      type="range"
                      className="mini-range eq-range"
                      min={EQ_MIN_GAIN}
                      max={EQ_MAX_GAIN}
                      step={1}
                      value={gain}
                      aria-label={`${frequency} hertz gain`}
                      style={
                        {
                          "--range-value": `${percent}%`,
                        } as CSSProperties
                      }
                      onChange={(event) => {
                        if (!eqEnabled) {
                          setEqEnabled(true);
                        }
                        setEqGain(index, Number(event.currentTarget.value));
                      }}
                    />
                    <span className="eq-band-value">
                      {gain > 0 ? `+${gain}` : gain}
                    </span>
                  </label>
                );
              })}
            </div>

            <p className="settings-note">
              {eqEnabled
                ? "The equalizer is active. Adjust any band or pick a preset."
                : "Adjusting a band or picking a preset turns the equalizer on."}
            </p>
          </section>

          <section className="settings-section settings-section--wide">
            <div className="settings-section-head settings-section-head--row">
              <div>
                <h3>Updates</h3>
                <span>Signed builds from GitHub Releases</span>
              </div>
              <span className="settings-version">
                {currentVersion ? `v${currentVersion}` : "VANTA"}
              </span>
            </div>

            <div className="update-card">
              <div className="update-copy" aria-live="polite">
                <strong>{updateTitle}</strong>
                <span>{updateMessage}</span>
                {updateStatus === "available" && updateNotes ? (
                  <p className="update-notes">{updateNotes}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="update-button"
                onClick={() => {
                  if (updateStatus === "available") {
                    void installUpdate();
                  } else {
                    void checkForUpdates();
                  }
                }}
                disabled={updateBusy}
                aria-busy={updateBusy}
              >
                {updateBusy ? (
                  <Loader2 size={14} className="update-spinner" />
                ) : updateStatus === "available" ? (
                  <Download size={14} />
                ) : (
                  <RefreshCw size={14} />
                )}
                <span>{updateButtonLabel}</span>
              </button>
            </div>

            {updateStatus === "downloading" || updateStatus === "installing" ? (
              <div
                className="update-progress"
                role="progressbar"
                aria-label="Update download progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={updateProgress}
              >
                <span style={{ width: `${updateProgress}%` }} />
              </div>
            ) : null}

            <p className="settings-note">
              Updates are signed and verified before installation. Windows
              closes VANTA to finish installing.
            </p>
          </section>
        </div>
      </section>
    </div>,
    document.body,
  );
}
