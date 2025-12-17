import { useEffect, useRef, useState } from "react";
import type { LinkSource, LinkingState } from "../types/workflow";

export type HoveredInput = { type: "block" | "tool" | "output"; id: string; inputIndex?: number } | null;

export function useLinkingState() {
  const [linking, setLinking] = useState<LinkingState | null>(null);
  const [hoveredInput, setHoveredInput] = useState<HoveredInput>(null);
  const [hoveredOutput, setHoveredOutput] = useState<LinkSource | null>(null);
  const linkingRef = useRef(false);

  useEffect(() => {
    linkingRef.current = Boolean(linking);
  }, [linking]);

  return {
    linking,
    setLinking,
    hoveredInput,
    setHoveredInput,
    hoveredOutput,
    setHoveredOutput,
    linkingRef,
  };
}
