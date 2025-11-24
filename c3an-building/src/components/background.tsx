import type { CSSProperties } from "react";
import type { Transform } from "../hooks/zoom";

type Props = {
  transform?: Transform;
  // base dot spacing, this is supposed to change with the zoom for a cool effect
  spacing?: number;
  dotColor?: string;
  preset?: "grid" | "aurora" | "blueprint";
  theme?: "light" | "dark";
  className?: string;
  style?: CSSProperties;
};

export default function Background({
  transform = { x: 0, y: 0, zoom: 1 },
  spacing = 24,
  dotColor,
  preset = "grid",
  theme = "light",
  className = "",
  style,
}: Props) {
  const palettes = {
    grid: {
      light: {
        dot: "rgba(15, 23, 42, 0.08)",
        grid: "rgba(15, 23, 42, 0.12)",
        base: "linear-gradient(180deg, #f8fafc 0%, #eef2f7 70%)",
        splash:
          "radial-gradient(circle at 32% 24%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 38%), radial-gradient(circle at 72% 68%, rgba(148,163,184,0.16) 0%, rgba(148,163,184,0) 45%)",
        glow: "radial-gradient(circle at 40% 30%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 40%)",
      },
      dark: {
        dot: "rgba(241, 245, 249, 0.14)",
        grid: "rgba(148, 163, 184, 0.24)",
        base: "linear-gradient(180deg, #0f172a 0%, #0b1224 70%)",
        splash:
          "radial-gradient(circle at 32% 24%, rgba(120, 141, 168, 0.3) 0%, rgba(120,141,168,0) 40%), radial-gradient(circle at 72% 68%, rgba(56, 189, 248, 0.14) 0%, rgba(56,189,248,0) 55%)",
        glow: "radial-gradient(circle at 45% 30%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 38%)",
      },
    },
    aurora: {
      light: {
        dot: "rgba(24, 24, 36, 0.08)",
        grid: "rgba(59, 130, 246, 0.16)",
        base: "linear-gradient(120deg, #fdf2f8 0%, #e0f2fe 45%, #ecfeff 100%)",
        splash:
          "radial-gradient(circle at 20% 25%, rgba(236, 72, 153, 0.14) 0%, rgba(236,72,153,0) 45%), radial-gradient(circle at 80% 70%, rgba(6, 182, 212, 0.2) 0%, rgba(6,182,212,0) 50%)",
        glow: "radial-gradient(circle at 60% 30%, rgba(37, 99, 235, 0.12) 0%, rgba(37,99,235,0) 48%)",
      },
      dark: {
        dot: "rgba(226, 232, 240, 0.12)",
        grid: "rgba(94, 234, 212, 0.26)",
        base: "linear-gradient(130deg, #0b1224 0%, #111827 40%, #0f172a 100%)",
        splash:
          "radial-gradient(circle at 22% 28%, rgba(94, 234, 212, 0.2) 0%, rgba(94,234,212,0) 45%), radial-gradient(circle at 78% 68%, rgba(129, 140, 248, 0.24) 0%, rgba(129,140,248,0) 52%)",
        glow: "radial-gradient(circle at 60% 40%, rgba(56, 189, 248, 0.16) 0%, rgba(56,189,248,0) 50%)",
      },
    },
    blueprint: {
      light: {
        dot: "rgba(15, 23, 42, 0.1)",
        grid: "rgba(30, 64, 175, 0.35)",
        base: "linear-gradient(180deg, #e0f2fe 0%, #bfdbfe 80%)",
        splash:
          "radial-gradient(circle at 35% 22%, rgba(59, 130, 246, 0.15) 0%, rgba(59,130,246,0) 42%), radial-gradient(circle at 70% 68%, rgba(14, 165, 233, 0.18) 0%, rgba(14,165,233,0) 50%)",
        glow: "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 46%)",
      },
      dark: {
        dot: "rgba(226, 232, 240, 0.18)",
        grid: "rgba(125, 211, 252, 0.4)",
        base: "linear-gradient(180deg, #0b1530 0%, #0b1224 85%)",
        splash:
          "radial-gradient(circle at 40% 26%, rgba(59, 130, 246, 0.28) 0%, rgba(59,130,246,0) 40%), radial-gradient(circle at 75% 72%, rgba(14, 165, 233, 0.3) 0%, rgba(14,165,233,0) 55%)",
        glow: "radial-gradient(circle at 48% 36%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 50%)",
      },
    },
  } as const;

  const palette = palettes[preset]?.[theme] ?? palettes.grid.light;
  const resolvedDotColor = dotColor ?? palette.dot;
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
          background: `${palette.splash}, ${palette.base}`,
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

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: palette.glow,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
