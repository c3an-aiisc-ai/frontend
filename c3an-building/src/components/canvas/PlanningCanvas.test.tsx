import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { PlanningBlock } from "../../shared/types/planning";
import type { Connection, PlanningWorkflowSnapshot } from "../../shared/types";
import PlanningCanvas from "./PlanningCanvas";

function setWindowSize(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
    writable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
    writable: true,
  });
}

function mockRect(element: Element, rect: Partial<DOMRect>) {
  const { left = 0, top = 0, width = 32, height = 32 } = rect;
  const right = rect.right ?? left + width;
  const bottom = rect.bottom ?? top + height;
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        x: left,
        y: top,
        left,
        top,
        right,
        bottom,
        width,
        height,
        toJSON: () => ({}),
      }) as DOMRect,
  });
}

function workflowSnapshot(agentName: string, toolName: string): PlanningWorkflowSnapshot {
  const connections: Connection[] = [
    {
      id: `conn-${agentName}`,
      from: { type: "tool", id: `tool-${agentName}`, port: 0 },
      to: { type: "block", id: `block-${agentName}`, inputIndex: 1000 },
    },
  ];

  return {
    blocks: [
      {
        id: `block-${agentName}`,
        x: 120,
        y: 120,
        name: agentName,
        description: `${agentName} description`,
        inputCount: 1,
        outputCount: 1,
        inputRequired: [true],
        outputRequired: [true],
      },
    ],
    tools: [
      {
        id: `tool-${agentName}`,
        x: 140,
        y: 300,
        name: toolName,
        tagline: "Tool",
        gradient: "from-sky-50 via-white to-cyan-100",
        ring: "ring-sky-200",
        accent: "bg-sky-600",
        inputCount: 1,
        outputCount: 1,
        inputRequired: [false],
        outputRequired: [false],
      },
    ],
    connections,
    evals: [],
    notes: [],
    uploads: [],
    outputs: [],
  };
}

function buildPlan(id: string, name: string, workflow: PlanningWorkflowSnapshot): PlanningBlock {
  return {
    id,
    x: 80,
    y: 80,
    name,
    query: `${name} query`,
    triples: [],
    task_id: id,
    sub_tasks: [{ sub_task_id: id, name }],
    workflow,
  };
}

describe("PlanningCanvas subplan agents panel", () => {
  beforeEach(() => {
    setWindowSize(1280, 900);
  });

  it("toggles the selected subplan panel from the icon button", async () => {
    const plan = buildPlan("plan-alpha", "Plan Alpha", workflowSnapshot("Alpha Agent", "Alpha Tool"));

    render(<PlanningCanvas onEnterWorkflow={() => {}} plans={[plan]} />);

    const trigger = screen.getByRole("button", { name: /view agents for plan alpha/i });
    mockRect(trigger, { left: 180, top: 120 });

    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: /plan alpha/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveStyle({ width: "420px" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger);

    expect(screen.queryByRole("dialog", { name: /plan alpha/i })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("switches panels and keeps agents/tools scoped to the selected subplan", async () => {
    const alphaPlan = buildPlan("plan-alpha", "Plan Alpha", workflowSnapshot("Alpha Agent", "Alpha Tool"));
    const betaPlan = {
      ...buildPlan("plan-beta", "Plan Beta", workflowSnapshot("Beta Agent", "Beta Tool")),
      x: 420,
      y: 80,
    };

    render(<PlanningCanvas onEnterWorkflow={() => {}} plans={[alphaPlan, betaPlan]} />);

    const alphaTrigger = screen.getByRole("button", { name: /view agents for plan alpha/i });
    const betaTrigger = screen.getByRole("button", { name: /view agents for plan beta/i });
    mockRect(alphaTrigger, { left: 160, top: 120 });
    mockRect(betaTrigger, { left: 520, top: 120 });

    fireEvent.click(alphaTrigger);

    const alphaDialog = await screen.findByRole("dialog", { name: /plan alpha/i });
    expect(within(alphaDialog).getByText("Alpha Agent")).toBeInTheDocument();
    expect(within(alphaDialog).getByText("Alpha Tool")).toBeInTheDocument();
    expect(within(alphaDialog).queryByText("Beta Agent")).not.toBeInTheDocument();
    expect(within(alphaDialog).queryByText("Beta Tool")).not.toBeInTheDocument();

    fireEvent.click(betaTrigger);

    const betaDialog = await screen.findByRole("dialog", { name: /plan beta/i });
    expect(screen.queryByRole("dialog", { name: /plan alpha/i })).not.toBeInTheDocument();
    expect(within(betaDialog).getByText("Beta Agent")).toBeInTheDocument();
    expect(within(betaDialog).getByText("Beta Tool")).toBeInTheDocument();
    expect(within(betaDialog).queryByText("Alpha Agent")).not.toBeInTheDocument();
    expect(within(betaDialog).queryByText("Alpha Tool")).not.toBeInTheDocument();
  });

  it("falls back to bottom placement on narrow screens", async () => {
    setWindowSize(480, 900);
    const plan = buildPlan("plan-alpha", "Plan Alpha", workflowSnapshot("Alpha Agent", "Alpha Tool"));

    render(<PlanningCanvas onEnterWorkflow={() => {}} plans={[plan]} />);

    const trigger = screen.getByRole("button", { name: /view agents for plan alpha/i });
    mockRect(trigger, { left: 396, top: 120, width: 32, height: 32 });

    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: /plan alpha/i });
    expect(dialog).toHaveAttribute("data-placement", "bottom");
  });

  it("fits the visible subplans into view on open", async () => {
    const alphaPlan = buildPlan("plan-alpha", "Plan Alpha", workflowSnapshot("Alpha Agent", "Alpha Tool"));
    const betaPlan = {
      ...buildPlan("plan-beta", "Plan Beta", workflowSnapshot("Beta Agent", "Beta Tool")),
      x: 1320,
      y: 520,
    };

    render(<PlanningCanvas onEnterWorkflow={() => {}} plans={[alphaPlan, betaPlan]} />);

    const worldLayer = await screen.findByTestId("plan-world-layer");
    await waitFor(() => {
      expect(worldLayer.getAttribute("style")).toMatch(/scale\(0\.[0-9]+\)/);
    });
  });

  it("can be moved around after opening", async () => {
    const plan = buildPlan("plan-alpha", "Plan Alpha", workflowSnapshot("Alpha Agent", "Alpha Tool"));

    render(<PlanningCanvas onEnterWorkflow={() => {}} plans={[plan]} />);

    const trigger = screen.getByRole("button", { name: /view agents for plan alpha/i });
    mockRect(trigger, { left: 180, top: 120 });

    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: /plan alpha/i });
    const handle = dialog.querySelector("[data-drag-handle]");
    expect(handle).not.toBeNull();

    fireEvent.pointerDown(handle as Element, { clientX: 240, clientY: 140 });
    fireEvent.pointerMove(window, { clientX: 300, clientY: 210 });
    fireEvent.pointerUp(window);

    expect(dialog).toHaveStyle({ left: "436px", top: "118px" });
  });

  it("keeps a fixed anchored position when the trigger rect changes after opening", async () => {
    const plan = buildPlan("plan-alpha", "Plan Alpha", workflowSnapshot("Alpha Agent", "Alpha Tool"));

    const { rerender } = render(<PlanningCanvas onEnterWorkflow={() => {}} plans={[plan]} />);

    const trigger = screen.getByRole("button", { name: /view agents for plan alpha/i });
    mockRect(trigger, { left: 180, top: 220 });

    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: /plan alpha/i });
    expect(dialog).toHaveStyle({ left: "376px", top: "148px" });

    mockRect(trigger, { left: 420, top: 420 });
    rerender(<PlanningCanvas onEnterWorkflow={() => {}} plans={[plan]} />);

    expect(dialog).toHaveStyle({ left: "376px", top: "148px" });
  });
});
