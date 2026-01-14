import type { CSSProperties } from "react";
import type { Transform } from "../hooks/zoom";
import { canvasConfig } from "../config";

type Props = {
  transform?: Transform;
  spacing?: number;
  dotColor?: string;
  theme?: "light" | "dark";
  preset?: "grid" | "aurora" | "blueprint";
  className?: string;
  style?: CSSProperties;
};

export default function Background({
  transform = { x: 0, y: 0, zoom: 1 },
  spacing = canvasConfig.grid.spacing,
  dotColor,
  theme = "dark",
  className = "",
  style,
}: Props) {
  const palettes = canvasConfig.themes;

  const palette = palettes[theme] ?? palettes.dark;
  const resolvedDotColor = dotColor ?? palette.dot;
  const baseSpacing = Math.max(10, spacing * (1 / transform.zoom));
  const majorSpacing = baseSpacing * canvasConfig.grid.majorMultiplier;
  const gridExtent = canvasConfig.grid.extent;
  const patternId = "editor-dot-grid";

  const tx = -transform.x / transform.zoom;
  const ty = -transform.y / transform.zoom;

  const rectStyle: CSSProperties = {
    transform: `translate(${tx}px, ${ty}px) scale(${transform.zoom})`,
    transformOrigin: "0 0",
    transition: "none",
    willChange: "transform",
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
      {/* solid backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: palette.base,
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
              stroke={resolvedDotColor}
              strokeWidth="0.6"
              strokeLinecap="square"
              opacity={0.6}
            />
            <path
              d={`M 0 0 L 0 ${majorSpacing} M ${majorSpacing} 0 L ${majorSpacing} ${majorSpacing} M 0 0 L ${majorSpacing} 0 M 0 ${majorSpacing} L ${majorSpacing} ${majorSpacing}`}
              stroke={palette.grid}
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
    </div>
  );
}
