import {
  hrefForRoute,
  routesConfig,
  workspaceTabRoutes,
  type RouteKey,
} from "../../config";

type Props = {
  currentRoute: RouteKey;
  tone?: "light" | "dark";
  orientation?: "row" | "column";
  className?: string;
  onItemClick?: () => void;
};

export default function WorkspaceTabs({
  currentRoute,
  tone = "light",
  orientation = "row",
  className,
  onItemClick,
}: Props) {
  const navRoutes = ["home", ...workspaceTabRoutes] as const;
  const containerClass =
    orientation === "column" ? "workspace-tabs workspace-tabs-column" : "workspace-tabs workspace-tabs-row";
  const tabClass = orientation === "column" ? "workspace-tab workspace-tab-column" : "workspace-tab";
  const toneClass = tone === "dark" ? "workspace-tab-dark" : "workspace-tab-light";
  const activeClass = tone === "dark" ? "workspace-tab-active-dark" : "workspace-tab-active-light";

  return (
    <nav
      aria-label="Workspace navigation"
      className={[containerClass, className].filter(Boolean).join(" ")}
    >
      {navRoutes.map((route) => {
        const isActive = route === currentRoute;
        return (
          <a
            key={route}
            href={hrefForRoute(route)}
            onClick={onItemClick}
            aria-current={isActive ? "page" : undefined}
            className={[tabClass, toneClass, isActive ? activeClass : ""].filter(Boolean).join(" ")}
          >
            {routesConfig[route].label}
          </a>
        );
      })}
    </nav>
  );
}
