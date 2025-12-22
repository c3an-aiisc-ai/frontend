// =============================================================================
// Application Configuration
// =============================================================================
// Core application settings that control behavior across the app.
// Modify these values to customize the application without changing code.
// =============================================================================

export const appConfig = {
  // Application metadata
  name: "C3AN Workflow Builder",
  version: "1.0.0",

  // Local storage keys
  storage: {
    workspace: "c3an-workspace",
    customAgents: "c3an-custom-agents",
    customPlans: "c3an-custom-plans",
    pendingPlan: "c3an-pending-plan",
  },

  // Default file names for downloads
  downloads: {
    workflowFilename: "workflow.json",
    planFilename: "plan.json",
  },

  // Node I/O constraints
  nodeIO: {
    minIO: 1,
    maxIO: 5,
    toolPortOffset: 1000,
  },
} as const;

// Type exports for type-safe access
export type AppConfig = typeof appConfig;
export type StorageKeys = typeof appConfig.storage;
