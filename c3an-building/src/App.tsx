import { useEffect, useState } from "react";
import EvaluationPage from "./pages/EvaluationPage";
import PlanningPage from "./pages/PlanningPage";
import WorkflowBuilderPage from "./pages/WorkflowBuilderPage";

export default function App() {
  const getRoute = () => {
    const hash = window.location.hash.replace("#", "");
    if (hash.startsWith("/planning")) return "planning";
    if (hash.startsWith("/evaluation") || hash.startsWith("/evals") || hash.startsWith("/metrics")) {
      return "evaluation";
    }
    return "workflow";
  };

  const [route, setRoute] = useState(() => getRoute());

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

  return <WorkflowBuilderPage />;
}
