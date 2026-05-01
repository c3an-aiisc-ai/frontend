import { describe, expect, it } from "vitest";
import { resolveSmartPilotAgents } from "./smartPilotDemoRegistry";

describe("resolveSmartPilotAgents", () => {
  it("maps SmartPilot capabilities to existing registry entries", () => {
    const agents = resolveSmartPilotAgents();

    expect(agents.map((agent) => agent.key)).toEqual(["predictx", "foresight", "infoguide"]);
    expect(agents.every((agent) => agent.agent)).toBe(true);
    expect(agents.find((agent) => agent.key === "predictx")?.agent?.id).toBe("predictx-agent");
    expect(agents.find((agent) => agent.key === "foresight")?.agent?.id).toBe("foresight-agent");
    expect(agents.find((agent) => agent.key === "infoguide")?.agent?.id).toBe("qa-agent");
  });
});
