// =============================================================================
// Routes Configuration
// =============================================================================

export type RouteKey =
  | "home"
  | "planning"
  | "evaluation"
  | "agentgen"
  | "editor"
  | "login"
  | "smartpilotDemo"
  | "smartpilotWorkflow";

export type RouteDefinition = {
  key: RouteKey;
  path: string;
  aliases: string[];
  label: string;
};

export type WorkspaceRouteKey = Exclude<RouteKey, "home" | "login" | "smartpilotDemo" | "smartpilotWorkflow">;

export const routesConfig: Record<RouteKey, RouteDefinition> = {
  home: {
    key: "home",
    path: "/homepage",
    aliases: ["/homepage", "/home", "/"],
    label: "Home",
  },
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
    label: "Evaluations",
  },
  agentgen: {
    key: "agentgen",
    path: "/agentgen",
    aliases: ["/agentgen"],
    label: "AgentGen",
  },
  editor: {
    key: "editor",
    path: "/workflow",
    aliases: ["/workflow", "/editor"],
    label: "Workflow Builder",
  },
  login: {
    key: "login",
    path: "/login",
    aliases: ["/login"],
    label: "Login",
  },
  smartpilotDemo: {
    key: "smartpilotDemo",
    path: "/smartpilot-demo",
    aliases: ["/smartpilot-demo", "/demo"],
    label: "SmartPilot Demo",
  },
  smartpilotWorkflow: {
    key: "smartpilotWorkflow",
    path: "/smartpilot-workflow",
    aliases: ["/smartpilot-workflow", "/smartpilot-demo/workflow"],
    label: "SmartPilot Workflow",
  },
} as const;

export const workspaceTabRoutes = [
  "editor",
  "planning",
  "evaluation",
  "agentgen",
] as const satisfies readonly WorkspaceRouteKey[];

export const navigationPaths = {
  home: "#/homepage",
  editor: "#/workflow",
  planning: "#/planning",
  evaluation: "#/evaluation",
  agentgen: "#/agentgen",
  login: "#/login",
  smartpilotDemo: "#/smartpilot-demo",
  smartpilotWorkflow: "#/smartpilot-workflow",
} as const;

const PREVIOUS_ROUTE_STORAGE_KEY = "c3an_previous_route";

export function normalizeHashPath(hash: string): string {
  const trimmed = hash.replace(/^#/, "").trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function hrefForRoute(route: RouteKey): string {
  return navigationPaths[route];
}

export function navigateTo(route: RouteKey): void {
  if (typeof window === "undefined") return;
  const nextHash = hrefForRoute(route);
  if (window.location.hash === nextHash) return;
  window.location.hash = nextHash;
}

export function rememberPreviousRoute(previousHash: string, nextHash: string): void {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") return;
  const previousPath = normalizeHashPath(previousHash);
  const nextPath = normalizeHashPath(nextHash);
  if (!previousPath || previousPath === nextPath) return;
  sessionStorage.setItem(PREVIOUS_ROUTE_STORAGE_KEY, previousPath);
}

export function hasTrackedPreviousRoute(currentHash: string): boolean {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") return false;
  const previousPath = sessionStorage.getItem(PREVIOUS_ROUTE_STORAGE_KEY);
  if (!previousPath) return false;
  return normalizeHashPath(previousPath) !== normalizeHashPath(currentHash);
}

export function resolveRoute(hash: string): RouteKey {
  const path = normalizeHashPath(hash).toLowerCase();

  for (const route of Object.values(routesConfig)) {
    if (route.aliases.some((alias) => alias.toLowerCase() === path)) {
      return route.key;
    }
  }

  return "home";
}

export type NavigationPaths = typeof navigationPaths;
