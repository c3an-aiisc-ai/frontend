import { useEffect } from "react";
import type { MutableRefObject } from "react";
import type { ImportPayload } from "./useWorkflowImportExport";

type Params = {
  applyImportedWorkspace: (payload: ImportPayload) => void;
  persistWorkspace: () => void;
  nextBlockIdRef: MutableRefObject<number>;
  nextToolIdRef: MutableRefObject<number>;
  nextUploadIdRef: MutableRefObject<number>;
  nextOutputIdRef: MutableRefObject<number>;
  nextConnectionIdRef: MutableRefObject<number>;
  nextIdRef: MutableRefObject<number>;
};

export function useWorkflowPersistence({
  applyImportedWorkspace,
  persistWorkspace,
  nextBlockIdRef,
  nextToolIdRef,
  nextUploadIdRef,
  nextOutputIdRef,
  nextConnectionIdRef,
  nextIdRef,
}: Params) {
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = localStorage.getItem("c3an-workspace");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      applyImportedWorkspace({
        notes: parsed.notes ?? [],
        blocks: parsed.blocks ?? [],
        tools: parsed.tools ?? [],
        uploads: parsed.uploads ?? [],
        outputs: parsed.outputs ?? [],
        connections: parsed.connections ?? [],
        evals: parsed.evals ?? [],
        theme: parsed.theme,
        agentSpecTemplate: parsed.agentSpecTemplate ?? null,
      });
      nextBlockIdRef.current = parsed.nextBlockId ?? nextBlockIdRef.current;
      nextToolIdRef.current = parsed.nextToolId ?? nextToolIdRef.current;
      nextUploadIdRef.current = parsed.nextUploadId ?? nextUploadIdRef.current;
      nextOutputIdRef.current = parsed.nextOutputId ?? nextOutputIdRef.current;
      nextConnectionIdRef.current = parsed.nextConnectionId ?? nextConnectionIdRef.current;
      nextIdRef.current = parsed.nextNoteId ?? nextIdRef.current;
    } catch {
      // ignore bad saves
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    persistWorkspace();
  }, [persistWorkspace]);
}
