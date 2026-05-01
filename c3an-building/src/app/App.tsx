import { useEffect, useState } from "react";
import "./App.css";
import AppFooter from "./AppFooter";
import HomePage from "../features/home/HomePage";
import AgentGenPage from "../features/agent-gen/AgentGenPage";
import EvaluationPage from "../features/evaluation/EvaluationPage";
import PlanningPage from "../features/planning/PlanningPage";
import WorkflowEditorPage from "../features/workflow/WorkflowEditorPage";
import LoginPage from "../features/auth/LoginPage";
import SmartPilotDemoPage from "../features/smartpilot-demo/SmartPilotDemoPage";
import SmartPilotWorkflowPage from "../features/smartpilot-demo/SmartPilotWorkflowPage";
import { rememberPreviousRoute, resolveRoute, type RouteKey } from "../config";
import type { Theme } from "../shared/types";
import GlobalNavMenu from "../components/ui/tool_bar/GlobalNavMenu";

const THEME_STORAGE_KEY = "c3an-theme";

const getRoute = (): RouteKey => {
  return resolveRoute(window.location.hash);
};

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // ignore storage read failures
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export default function App() {
  const [route, setRoute] = useState<RouteKey>(() => getRoute());
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    const handleChange = (event?: HashChangeEvent) => {
      if (event) {
        rememberPreviousRoute(new URL(event.oldURL).hash, new URL(event.newURL).hash);
      }
      setRoute(getRoute());
    };
    window.addEventListener("hashchange", handleChange);
    return () => window.removeEventListener("hashchange", handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage write failures
    }
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  let page = <WorkflowEditorPage theme={theme} />;
  if (route === "home") {
    page = <HomePage theme={theme} onThemeChange={setTheme} />;
  } else if (route === "planning") {
    page = <PlanningPage theme={theme} />;
  } else if (route === "evaluation") {
    page = <EvaluationPage theme={theme} />;
  } else if (route === "agentgen") {
    page = <AgentGenPage theme={theme} />;
  } else if (route === "login") {
    page = <LoginPage />;
  } else if (route === "smartpilotDemo") {
    page = <SmartPilotDemoPage theme={theme} />;
  } else if (route === "smartpilotWorkflow") {
    page = <SmartPilotWorkflowPage theme={theme} />;
  }

  return (
    <div className={`flex h-full min-h-screen flex-col relative ${theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      <GlobalNavMenu theme={theme} currentRoute={route} />
      <div className="min-h-0 flex-1">{page}</div>
      <AppFooter theme={theme} />
    </div>
  );
}
