import { useEffect, useState } from "react";
import "./App.css";
import EvaluationPage from "./pages/EvaluationPage";
import PlanningPage from "./pages/PlanningPage";
import WorkflowEditorPage from "./pages/WorkflowEditorPage";

type Route = "planning" | "evaluation" | "editor";

const getRoute = (): Route => {
  const hash = window.location.hash.replace("#", "");
  if (hash.startsWith("/planning")) return "planning";
  if (hash.startsWith("/evaluation") || hash.startsWith("/evals") || hash.startsWith("/metrics")) {
    return "evaluation";
  }
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

  return <WorkflowEditorPage />;
}
