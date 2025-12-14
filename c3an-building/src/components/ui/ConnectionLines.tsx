// =============================================================================
// Connection Lines Component - SVG connection paths
// =============================================================================

import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  Connection,
  AnchorPoint,
  Selection,
  LinkingState,
} from "../../types";
import { buildConnectionPath } from "../../utils";

type Props = {
  connections: Connection[];
  linking: LinkingState;
  selected: Selection;
  getOutputAnchor: (endpoint: Connection["from"]) => AnchorPoint | null | undefined;
  getInputAnchor: (target: Connection["to"]) => AnchorPoint | null | undefined;
  onConnectionPointerDown: (conn: Connection) => (e: ReactPointerEvent<SVGPathElement>) => void;
};

export default function ConnectionLines({
  connections,
  linking,
  selected,
  getOutputAnchor,
  getInputAnchor,
  onConnectionPointerDown,
}: Props) {
  const glow = "drop-shadow(0 0 4px rgba(56,189,248,0.35))";

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      overflow="visible"
    >
      <defs>
        {/* Arrow markers */}
        <marker
          id="arrowhead-default"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#38bdf8" />
        </marker>
        <marker
          id="arrowhead-preview"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
        </marker>
      </defs>

      {/* Existing connections */}
      {connections.map((conn) => {
        const start = getOutputAnchor(conn.from);
        const end = getInputAnchor(conn.to);
        if (!start || !end) return null;
        const d = buildConnectionPath(start, end);
        const isSelected =
          selected?.type === "connection" && selected.id === conn.id;
        return (
          <g key={conn.id}>
            <path
              d={d}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={isSelected ? 3 : 2}
              strokeLinecap="round"
              markerEnd="url(#arrowhead-default)"
              style={{
                pointerEvents: "visibleStroke",
                cursor: "pointer",
                filter: glow,
              }}
              onPointerDown={onConnectionPointerDown(conn)}
            />
          </g>
        );
      })}

      {/* Preview connection while linking */}
      {linking &&
        (() => {
          const start =
            linking.origin === "output"
              ? getOutputAnchor(linking.from)
              : getInputAnchor(linking.target);
          if (!start) return null;
          const end = linking.current;
          const d = buildConnectionPath(start, end);
          return (
            <g>
              <path
                d={d}
                fill="none"
                stroke="#3b82f6"
                strokeDasharray="6 6"
                strokeWidth={2}
                strokeLinecap="round"
                markerEnd="url(#arrowhead-preview)"
                style={{ filter: glow }}
              />
            </g>
          );
        })()}
    </svg>
  );
}
