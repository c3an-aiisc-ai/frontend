import type { CSSProperties } from "react";
import type { Transform } from "../hooks/zoom";

type Props = {
  transform?: Transform;
  // base dot spacing, this is supposed to change with the zoom for a cool effect
  spacing?: number;
  dotColor?: string;
  className?: string;
  style?: CSSProperties;
};

export default function Background({
  transform = { x: 0, y: 0, zoom: 1 },
  spacing = 24,
  dotColor = "rgba(15, 23, 42, 0.08)",
  className = "",
  style,
}: Props) {
  // compute the pattern width/height scaled by zoom with canvas
  const baseSpacing = Math.max(10, spacing * (1 / transform.zoom));
  const majorSpacing = baseSpacing * 4;
  // render a very large grid so dragging far in any direction never shows empty space
  const gridExtent = 60000;
  // use one id so we keep svg low
  const patternId = "editor-dot-grid";

  // movement smoothing and alignment
  // something about making the canvas move opposite the direction of movement, like a top down movie approach
  const tx = -transform.x / transform.zoom;
  const ty = -transform.y / transform.zoom;

  const rectStyle: CSSProperties = {
    transform: `translate(${tx}px, ${ty}px) scale(${transform.zoom})`,
    transformOrigin: "0 0",
    transition: "none",
    willChange: "transform",
    // pointer events so none of canvas interactions pass through
    pointerEvents: "none",
  };

  const wrapperStyle: CSSProperties = {
    position: "absolute",
    inset: "0",
    overflow: "hidden",
    ...style,
  };

  const svgClass = "absolute inset-0 w-full h-full";
  return (
    <div className={`editor-bg ${className}`.trim()} style={wrapperStyle} aria-hidden>
      {/* soft gradient backdrop*/}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 32% 24%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 38%), radial-gradient(circle at 72% 68%, rgba(148,163,184,0.16) 0%, rgba(148,163,184,0) 45%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 70%)",
          pointerEvents: "none",
        }}
      />

      {/* dotted grid svg */}
      <svg
        className={svgClass}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id={patternId}
            x="0"
            y="0"
            width={majorSpacing}
            height={majorSpacing}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`
                M ${baseSpacing} 0 L ${baseSpacing} ${majorSpacing}
                M ${baseSpacing * 2} 0 L ${baseSpacing * 2} ${majorSpacing}
                M ${baseSpacing * 3} 0 L ${baseSpacing * 3} ${majorSpacing}
                M 0 ${baseSpacing} L ${majorSpacing} ${baseSpacing}
                M 0 ${baseSpacing * 2} L ${majorSpacing} ${baseSpacing * 2}
                M 0 ${baseSpacing * 3} L ${majorSpacing} ${baseSpacing * 3}
              `}
              stroke={dotColor}
              strokeWidth="0.6"
              strokeLinecap="square"
              opacity={0.6}
            />
            <path
              d={`M 0 0 L 0 ${majorSpacing} M ${majorSpacing} 0 L ${majorSpacing} ${majorSpacing} M 0 0 L ${majorSpacing} 0 M 0 ${majorSpacing} L ${majorSpacing} ${majorSpacing}`}
              stroke="rgba(15, 23, 42, 0.12)"
              strokeWidth="1"
              strokeLinecap="square"
            />
          </pattern>
        </defs>

        <g style={rectStyle}>
          <rect
            x={-gridExtent / 2}
            y={-gridExtent / 2}
            width={gridExtent}
            height={gridExtent}
            fill={`url(#${patternId})`}
          />
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 40% 30%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 40%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
