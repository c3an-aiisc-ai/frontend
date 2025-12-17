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
  onChangeToolChoice: (value: string) => void;
  onAddTool: (blockId: string, toolName: string) => void;
  onCloseBlock: () => void;
  onCloseTool: () => void;
  getBlockMode: (block: AgentBlock) => string | null;
  toggleInputRequired: (blockId: string, index: number) => void;
  toggleOutputRequired: (blockId: string, index: number) => void;
  toggleToolInputRequired: (toolId: string, index: number) => void;
  toggleToolOutputRequired: (toolId: string, index: number) => void;
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
  onChangeToolChoice,
  onAddTool,
  onCloseBlock,
  onCloseTool,
  getBlockMode,
  toggleInputRequired,
  toggleOutputRequired,
  toggleToolInputRequired,
  toggleToolOutputRequired,
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
          connections={connections}
          toolPalette={toolPalette}
          modalToolChoice={modalToolChoice}
          onChangeToolChoice={onChangeToolChoice}
          onAddTool={onAddTool}
          onClose={onCloseBlock}
          getBlockMode={getBlockMode}
          toggleInputRequired={toggleInputRequired}
          toggleOutputRequired={toggleOutputRequired}
        />
      )}

      {modalToolId && activeTool && (
        <ToolDetailsModal
          tool={activeTool}
          connections={connections}
          onClose={onCloseTool}
          toggleToolInputRequired={toggleToolInputRequired}
          toggleToolOutputRequired={toggleToolOutputRequired}
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
