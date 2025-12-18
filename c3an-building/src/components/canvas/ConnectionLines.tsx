// =============================================================================
// Connection Lines Component - SVG connection paths
// =============================================================================

import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  AnchorPoint,
  Connection,
  LinkingState,
  Selection,
} from "../../types";

function buildConnectionPath(start: AnchorPoint, end: AnchorPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy);
  const curve = Math.max(40, Math.min(200, dist * 0.35));

  const startDir = start.dir ?? "right";
  const endDir = end.dir ?? "left";

  const c1x = start.x + (startDir === "right" ? curve : startDir === "left" ? -curve : 0);
  const c1y = start.y + (startDir === "down" ? curve : startDir === "up" ? -curve : 0);
  const c2x = end.x + (endDir === "left" ? curve : endDir === "right" ? -curve : 0);
  const c2y = end.y + (endDir === "up" ? curve : endDir === "down" ? -curve : 0);

  return `M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`;
}

type Props = {
  connections: Connection[];
  linking: LinkingState;
  selected: Selection;
  getOutputAnchor: (endpoint: Connection["from"]) => AnchorPoint | null | undefined;
  getInputAnchor: (target: Connection["to"]) => AnchorPoint | null | undefined;
  onConnectionPointerDown: (
    conn: Connection,
  ) => (e: ReactPointerEvent<SVGPathElement>) => void;
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

      {connections.map((conn) => {
        const start = getOutputAnchor(conn.from);
        const end = getInputAnchor(conn.to);
        if (!start || !end) return null;
        const d = buildConnectionPath(start, end);
        const isSelected = selected?.type === "connection" && selected.id === conn.id;

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
