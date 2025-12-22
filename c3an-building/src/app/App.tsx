import { useEffect, useState } from "react";
import "./App.css";
import AgentGenPage from "../features/agent-gen/AgentGenPage";
import EvaluationPage from "../features/evaluation/EvaluationPage";
import PlanningPage from "../features/planning/PlanningPage";
import WorkflowEditorPage from "../features/workflow/WorkflowEditorPage";
import { resolveRoute, type RouteKey } from "../config";

const getRoute = (): RouteKey => {
  return resolveRoute(window.location.hash);
};

export default function App() {
  const [route, setRoute] = useState<Route>(() => getRoute());

  useEffect(() => {
    const handleChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", handleChange);
    return () => window.removeEventListener("hashchange", handleChange);
  }, []);

  if (route === "planning") {
    return <PlanningPage />;
  }
  if (route === "evaluation") {
    return <EvaluationPage />;
  }
  if (route === "agentgen") {
    return <AgentGenPage />;
  }

  return <WorkflowEditorPage />;
}
