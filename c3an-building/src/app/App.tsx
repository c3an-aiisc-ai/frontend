import { useEffect, useState } from "react";
import "./App.css";
import AppFooter from "./AppFooter";
import HomePage from "../features/home/HomePage";
import AgentGenPage from "../features/agent-gen/AgentGenPage";
import EvaluationPage from "../features/evaluation/EvaluationPage";
import PlanningPage from "../features/planning/PlanningPage";
import WorkflowEditorPage from "../features/workflow/WorkflowEditorPage";
import { rememberPreviousRoute, resolveRoute, type RouteKey } from "../config";

const getRoute = (): RouteKey => {
  return resolveRoute(window.location.hash);
};

export default function App() {
  const [route, setRoute] = useState<RouteKey>(() => getRoute());

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

  let page = <WorkflowEditorPage />;
  if (route === "home") {
    page = <HomePage />;
  } else if (route === "planning") {
    page = <PlanningPage />;
  } else if (route === "evaluation") {
    page = <EvaluationPage />;
  } else if (route === "agentgen") {
    page = <AgentGenPage />;
  }

  return (
    <div className="flex h-full min-h-screen flex-col">
      <div className="min-h-0 flex-1">{page}</div>
      <AppFooter />
    </div>
  );
}
