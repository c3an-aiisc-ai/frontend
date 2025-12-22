// =============================================================================
// Canvas Configuration
// =============================================================================
// Settings for the workflow canvas, including zoom, grid, and layout.
// =============================================================================

export const canvasConfig = {
  // Zoom settings
  zoom: {
    initial: 1,
    min: 0.1,
    max: 3,
    step: 0.02,
  },

  // Grid/background settings
  grid: {
    spacing: 24,
    extent: 60000,
    majorMultiplier: 4, // Major grid lines every 4 minor lines
  },

  // Theme palettes for background
  themes: {
    light: {
      dot: "rgba(15, 23, 42, 0.08)",
      grid: "rgba(15, 23, 42, 0.12)",
      base: "#f8fafc",
    },
    dark: {
      dot: "rgba(241, 245, 249, 0.14)",
      grid: "rgba(148, 163, 184, 0.24)",
      base: "#0f172a",
    },
  },

  // Plan layout settings (for auto-positioning plan blocks)
  planLayout: {
    startX: 260,
    startY: 200,
    gapX: 380,
    gapY: 300,
    columnCount: 2,
  },

  // Agent view hydration layout
  agentLayout: {
    startX: 200,
    startY: 200,
    gapX: 320,
    gapY: 200,
  },

  // Connection path settings
  connection: {
    offsetXFactor: 0.45,
    offsetXMin: 40,
    offsetYFactor: 0.25,
    offsetYMax: 160,
  },

  // Clipboard paste offset
  paste: {
    offset: 24,
  },
} as const;

// Type exports
export type CanvasConfig = typeof canvasConfig;
export type ThemePalette = typeof canvasConfig.themes.light;
