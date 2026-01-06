import { useEffect, useState } from "react";
import "./App.css";
import AgentGenPage from "../features/agent-gen/AgentGenPage";
import EvaluationPage from "../features/evaluation/EvaluationPage";
import PlanningPage from "../features/planning/PlanningPage";
import WorkflowEditorPage from "../features/workflow/WorkflowEditorPage";

type Route = "planning" | "evaluation" | "agentgen" | "editor";

const getRoute = (): Route => {
  const hash = window.location.hash.replace("#", "");
  if (hash.startsWith("/planning")) return "planning";
  if (hash.startsWith("/evaluation") || hash.startsWith("/evals") || hash.startsWith("/metrics")) {
    return "evaluation";
  }
  if (hash.startsWith("/agentgen")) return "agentgen";
  return "editor";
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
