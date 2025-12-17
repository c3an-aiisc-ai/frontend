import type { PointerEventHandler } from "react";
import type { AnchorPoint, Connection, LinkSource, LinkTarget, LinkingState } from "../../types/workflow";

type Props = {
  connections: Connection[];
  linking: LinkingState | null;
  selectedConnectionId: string | null;
  getOutputAnchor: (source: LinkSource) => AnchorPoint | null;
  getInputAnchor: (target: LinkTarget) => AnchorPoint | null;
  buildConnectionPath: (start: AnchorPoint, end: AnchorPoint) => string;
  onConnectionPointerDown: (conn: Connection) => PointerEventHandler<SVGPathElement>;
};

export default function ConnectionsLayer({
  connections,
  linking,
  selectedConnectionId,
  getOutputAnchor,
  getInputAnchor,
  buildConnectionPath,
  onConnectionPointerDown,
}: Props) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      overflow="visible"
    >
      <defs>
        <marker
          id="arrowhead-default"
          viewBox="0 0 12 12"
          markerWidth="12"
          markerHeight="12"
          refX="6"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,2 L12,6 L0,10 z" fill="#38bdf8" />
        </marker>
        <marker
          id="arrowhead-preview"
          viewBox="0 0 12 12"
          markerWidth="12"
          markerHeight="12"
          refX="6"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,2 L12,6 L0,10 z" fill="#3b82f6" />
        </marker>
      </defs>
      {connections.map((conn) => {
        const start = getOutputAnchor(conn.from);
        const end = getInputAnchor(conn.to);
        if (!start || !end) return null;
        const d = buildConnectionPath(start, end);
        const isSelected = selectedConnectionId === conn.id;
        const isToolWire = conn.from.type === "tool" || conn.to.type === "tool";
        return (
          <g key={conn.id}>
            <path
              d={d}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={isSelected ? 3 : 2}
              strokeLinecap="round"
              markerEnd={isToolWire ? undefined : "url(#arrowhead-default)"}
              style={{
                pointerEvents: "visibleStroke",
                cursor: "pointer",
              }}
              onPointerDown={onConnectionPointerDown(conn)}
            />
          </g>
        );
      })}

      {linking && (() => {
        const start =
          linking.origin === "output"
            ? getOutputAnchor(linking.from)
            : getInputAnchor(linking.target);
        if (!start) return null;
        const end = linking.current;
        const d = buildConnectionPath(start, end);
        const isToolWire =
          linking.origin === "output"
            ? linking.from.type === "tool"
            : linking.target.type === "tool";
        return (
          <g>
            <path
              d={d}
              fill="none"
              stroke="#3b82f6"
              strokeDasharray="6 6"
              strokeWidth={2}
              strokeLinecap="round"
              markerEnd={isToolWire ? undefined : "url(#arrowhead-preview)"}
            />
          </g>
        );
      })()}
    </svg>
  );
}
