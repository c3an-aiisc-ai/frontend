// =============================================================================
// Configuration Index
// =============================================================================
// Central export for all configuration files.
// Import from this file to access any config in the application.
// =============================================================================

export { appConfig } from "./app.config";
export type { AppConfig, StorageKeys } from "./app.config";

export { canvasConfig } from "./canvas.config";
export type { CanvasConfig, ThemePalette } from "./canvas.config";

export {
  routesConfig,
  navigationPaths,
  hrefForRoute,
  navigateTo,
  rememberPreviousRoute,
  hasTrackedPreviousRoute,
  normalizeHashPath,
  resolveRoute,
} from "./routes.config";
export type { RouteKey, RouteDefinition, NavigationPaths } from "./routes.config";

export { panelConfig, categoryStyles } from "./ui.config";
export type { PanelConfig, PanelTab } from "./ui.config";
