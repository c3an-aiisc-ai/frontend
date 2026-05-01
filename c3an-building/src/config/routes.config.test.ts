import { describe, expect, it } from "vitest";
import { hrefForRoute, navigationPaths, resolveRoute } from "./routes.config";

describe("routesConfig", () => {
  it("resolves the SmartPilot demo route and alias", () => {
    expect(hrefForRoute("smartpilotDemo")).toBe("#/smartpilot-demo");
    expect(resolveRoute("#/smartpilot-demo")).toBe("smartpilotDemo");
    expect(resolveRoute("#/demo")).toBe("smartpilotDemo");
  });

  it("resolves the SmartPilot workflow route separately from the regular builder", () => {
    expect(hrefForRoute("editor")).toBe("#/workflow");
    expect(hrefForRoute("smartpilotWorkflow")).toBe("#/smartpilot-workflow");
    expect(resolveRoute("#/workflow")).toBe("editor");
    expect(resolveRoute("#/smartpilot-workflow")).toBe("smartpilotWorkflow");
    expect(resolveRoute("#/smartpilot-demo/workflow")).toBe("smartpilotWorkflow");
  });

  it("does not expose the removed Flask Bridge route", () => {
    expect("bridge" in navigationPaths).toBe(false);
    expect(resolveRoute("#/bridge")).toBe("home");
  });
});
