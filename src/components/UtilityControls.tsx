import { useState } from "react";
import { Maximize2, Minimize2, Settings2 } from "lucide-react";
import { usePlayerControls } from "../contexts/PlayerControlsContext";
import { IconButton } from "./ui/IconButton";
import { RateMenu } from "./RateMenu";
import { SettingsModal } from "./SettingsModal";
import { VolumeControl } from "./VolumeControl";

export function UtilityControls() {
  const { toggleFullscreen, isFullscreen } = usePlayerControls();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="utility-controls">
      <VolumeControl />
      <RateMenu />
      <IconButton
        label="Advanced settings"
        active={settingsOpen}
        onClick={() => setSettingsOpen(true)}
        className="utility-button"
      >
        <Settings2 size={18} />
      </IconButton>
      <IconButton
        label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        active={isFullscreen}
        onClick={() => void toggleFullscreen()}
        className="utility-button"
      >
        {isFullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
      </IconButton>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
