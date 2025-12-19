import BlockDetailsModal from "../components/modals/BlockDetailsModal";
import EvalsModal from "../components/modals/EvalsModal";
import ToolDetailsModal from "../components/modals/ToolDetailsModal";
import type {
  AgentBlock,
  Connection,
  EvalOption,
  ToolNode,
  ToolPreset,
} from "../types/workflow";

type Props = {
  modalBlockId: string | null;
  modalToolId: string | null;
  showEvalsModal: boolean;
  blocks: AgentBlock[];
  tools: ToolNode[];
  connections: Connection[];
  toolPalette: ToolPreset[];
  modalToolChoice: string;
  onToolChoiceChange: (value: string) => void;
  onAddTool: (blockId: string, toolName: string) => void;
  onCloseBlock: () => void;
  onCloseTool: () => void;
  getBlockMode: (block: AgentBlock) => string | null;
  onToggleInputRequired: (blockId: string, index: number) => void;
  onToggleOutputRequired: (blockId: string, index: number) => void;
  onToggleToolInputRequired: (toolId: string, index: number) => void;
  onToggleToolOutputRequired: (toolId: string, index: number) => void;
  evalOptions: EvalOption[];
  selectedEvals: string[];
  onToggleEval: (evalId: string) => void;
  onClearEvals: () => void;
  onCloseEvals: () => void;
};

export default function WorkflowModals({
  modalBlockId,
  modalToolId,
  showEvalsModal,
  blocks,
  tools,
  connections,
  toolPalette,
  modalToolChoice,
  onToolChoiceChange,
  onAddTool,
  onCloseBlock,
  onCloseTool,
  getBlockMode,
  onToggleInputRequired,
  onToggleOutputRequired,
  onToggleToolInputRequired,
  onToggleToolOutputRequired,
  evalOptions,
  selectedEvals,
  onToggleEval,
  onClearEvals,
  onCloseEvals,
}: Props) {
  const activeBlock = modalBlockId ? blocks.find((block) => block.id === modalBlockId) : null;
  const activeTool = modalToolId ? tools.find((tool) => tool.id === modalToolId) : null;

  return (
    <>
      {modalBlockId && activeBlock && (
        <BlockDetailsModal
          block={activeBlock}
          toolPalette={toolPalette}
          modalToolChoice={modalToolChoice}
          onToolChoiceChange={onToolChoiceChange}
          onAddTool={onAddTool}
          onClose={onCloseBlock}
          getBlockMode={getBlockMode}
          onToggleInputRequired={onToggleInputRequired}
          onToggleOutputRequired={onToggleOutputRequired}
        />
      )}

      {modalToolId && activeTool && (
        <ToolDetailsModal
          tool={activeTool}
          connections={connections}
          onClose={onCloseTool}
          onToggleInputRequired={onToggleToolInputRequired}
          onToggleOutputRequired={onToggleToolOutputRequired}
        />
      )}

      {showEvalsModal && (
        <EvalsModal
          evalOptions={evalOptions}
          selectedEvals={selectedEvals}
          onToggleEval={onToggleEval}
          onClearAll={onClearEvals}
          onClose={onCloseEvals}
        />
      )}
    </>
  );
}
