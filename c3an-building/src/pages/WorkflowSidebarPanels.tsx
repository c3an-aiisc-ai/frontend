import type { DragEvent } from "react";
import BlocksPanel from "../components/panels/BlocksPanel";
import SettingsPanel from "../components/panels/SettingsPanel";
import ToolsPanel from "../components/panels/ToolsPanel";
import type { PanelKey, ThemeMode, ToolPreset } from "../types/workflow";

type Props = {
  activePanel: PanelKey | null;
  theme: ThemeMode;
  agentJsonInput: string;
  agentParseError: string | null;
  onAgentJsonChange: (value: string) => void;
  onGenerateAgents: () => void;
  onBlockDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onUploadDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onOutputDragStart: (event: DragEvent<HTMLDivElement>) => void;
  toolPalette: ToolPreset[];
  onToolDragStart: (toolName: string) => (event: DragEvent<HTMLDivElement>) => void;
  onSelectTheme: (mode: ThemeMode) => void;
  onClearSelection: () => void;
};

export default function WorkflowSidebarPanels({
  activePanel,
  theme,
  agentJsonInput,
  agentParseError,
  onAgentJsonChange,
  onGenerateAgents,
  onBlockDragStart,
  onUploadDragStart,
  onOutputDragStart,
  toolPalette,
  onToolDragStart,
  onSelectTheme,
  onClearSelection,
}: Props) {
  return (
    <>
      {activePanel === "blocks" && (
        <BlocksPanel
          agentJsonInput={agentJsonInput}
          agentParseError={agentParseError}
          onAgentJsonChange={onAgentJsonChange}
          onGenerateAgents={onGenerateAgents}
          onBlockDragStart={onBlockDragStart}
          onUploadDragStart={onUploadDragStart}
          onOutputDragStart={onOutputDragStart}
        />
      )}
      {activePanel === "tools" && <ToolsPanel toolPalette={toolPalette} onToolDragStart={onToolDragStart} />}
      {activePanel === "settings" && (
        <SettingsPanel theme={theme} onSelectTheme={onSelectTheme} onClearSelection={onClearSelection} />
      )}
    </>
  );
}
