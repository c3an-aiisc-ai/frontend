// =============================================================================
// Routes Configuration
// =============================================================================
// Define application routes and their hash aliases.
// =============================================================================

export type RouteKey = "planning" | "evaluation" | "agentgen" | "editor";

export type RouteDefinition = {
  key: RouteKey;
  path: string;
  aliases: string[];
  label: string;
};

export const routesConfig: Record<RouteKey, RouteDefinition> = {
  planning: {
    key: "planning",
    path: "/planning",
    aliases: ["/planning"],
    label: "Planning",
  },
  evaluation: {
    key: "evaluation",
    path: "/evaluation",
    aliases: ["/evaluation", "/evals", "/metrics"],
    label: "Evaluation",
  },
  agentgen: {
    key: "agentgen",
    path: "/agentgen",
    aliases: ["/agentgen"],
    label: "Agent Generator",
  },
  editor: {
    key: "editor",
    path: "/workflow",
    aliases: ["/workflow", "/editor", "/"],
    label: "Workflow Editor",
  },
} as const;

// Navigation helper - hash paths for programmatic navigation
export const navigationPaths = {
  workflow: "#/workflow",
  planning: "#/planning",
  evaluation: "#/evaluation",
  agentgen: "#/agentgen",
} as const;

/**
 * Resolve a hash string to a route key
 */
export function resolveRoute(hash: string): RouteKey {
  const path = hash.replace("#", "");
  
  for (const route of Object.values(routesConfig)) {
    if (route.aliases.some((alias) => path.startsWith(alias))) {
      return route.key;
    }
  }
  
  return "editor"; // Default route
}

// Type exports
export type NavigationPaths = typeof navigationPaths;
