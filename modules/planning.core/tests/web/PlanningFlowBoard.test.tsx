import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization";
import { PlanningFlowBoard } from "../../web/src/PlanningFlowBoard";
import { planningSchedule } from "./planningFlowBoardFixtures";

afterEach(cleanup);

describe("PlanningFlowBoard", () => {
  it("renders all governed lanes and moves through the published status policy", async () => {
    const schedule = planningSchedule();
    const onTaskOpen = vi.fn();
    const onTaskStatusChange = vi.fn().mockResolvedValue(true);
    renderBoard({ schedule, onTaskOpen, onTaskStatusChange });

    expect(screen.getByRole("region", { name: "Planning flow board" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Planned, 2 tasks" })).toHaveAttribute("data-planning-status", "planned");
    expect(screen.getByRole("region", { name: "In progress, 1 task" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Blocked, 0 tasks" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Complete, 0 tasks" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("visually-hidden");
    expect(screen.getByText("Move task Define scope")).toHaveClass("visually-hidden");

    fireEvent.click(screen.getByRole("button", { name: "Open task Define scope" }));
    expect(onTaskOpen).toHaveBeenCalledWith("scope");

    fireEvent.change(screen.getByRole("combobox", { name: "Move task Define scope" }), { target: { value: "in_progress" } });
    expect(onTaskStatusChange).toHaveBeenCalledWith("scope", "in_progress");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Define scope moved to In progress."));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Move task Define scope" })).toHaveFocus());
  });

  it("does not announce success when a stale command reloads an identical remote move", async () => {
    const schedule = planningSchedule();
    let resolveMove!: (applied: boolean) => void;
    const onTaskStatusChange = vi.fn(() => new Promise<boolean>((resolve) => { resolveMove = resolve; }));
    const view = renderBoard({ schedule, onTaskStatusChange });

    fireEvent.change(screen.getByRole("combobox", { name: "Move task Define scope" }), { target: { value: "in_progress" } });
    expect(screen.getByRole("combobox", { name: "Move task Define scope" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Move task Define scope" })).toHaveAttribute("aria-busy", "true");
    const remotelyMoved = { ...schedule, tasks: schedule.tasks.map((task) => task.id === "scope" ? { ...task, status: "in_progress" as const } : task) };
    view.rerender(board({ schedule: remotelyMoved, onTaskStatusChange }));
    resolveMove(false);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Task move was not applied."));
    expect(screen.getByRole("status")).not.toHaveTextContent("moved to In progress");
  });

  it("restores focus to the destination control after an authoritative lane reparent", async () => {
    const schedule = planningSchedule();
    let resolveMove!: (applied: boolean) => void;
    const onTaskStatusChange = vi.fn(() => new Promise<boolean>((resolve) => { resolveMove = resolve; }));
    const view = renderBoard({ schedule, onTaskStatusChange });

    const sourceControl = screen.getByRole("combobox", { name: "Move task Define scope" });
    sourceControl.focus();
    fireEvent.change(sourceControl, { target: { value: "in_progress" } });
    const movedSchedule = {
      ...schedule,
      tasks: schedule.tasks.map((task) => task.id === "scope" ? { ...task, status: "in_progress" as const } : task),
    };
    view.rerender(board({ schedule: movedSchedule, onTaskStatusChange }));
    resolveMove(true);

    await waitFor(() => expect(screen.getByRole("region", { name: "In progress, 2 tasks" })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Move task Define scope" })).toHaveFocus());
  });

  it("disables moves, isolates mixed-direction text, and localizes governed controls", () => {
    const schedule = planningSchedule();
    schedule.tasks[0] = { ...schedule.tasks[0], title: "Scope نطاق", wbs: "WBS-١" };
    render(
      <UokLocalizationProvider locale="ar">
        <PlanningFlowBoard busy={false} readOnly schedule={schedule} onTaskOpen={vi.fn()} onTaskStatusChange={vi.fn()} />
      </UokLocalizationProvider>,
    );

    expect(screen.getByRole("region", { name: "لوحة تدفق التخطيط" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "مخططة, ٢ مهام" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "نقل المهمة Scope نطاق" })).toBeDisabled();
    expect(screen.getByText("Scope نطاق")).toHaveAttribute("dir", "auto");
    expect(screen.getByText("WBS-١")).toHaveAttribute("dir", "auto");
  });

  it("exposes an actionable alert when the server flow contract is unavailable", () => {
    const schedule = { ...planningSchedule(), task_flow: undefined };
    renderBoard({ schedule });

    expect(screen.getByRole("alert")).toHaveTextContent("Task flow is unavailable. Refresh the validated schedule.");
  });
});

function renderBoard(overrides: Partial<Parameters<typeof PlanningFlowBoard>[0]> = {}) {
  const schedule = planningSchedule();
  return render(board({ schedule, onTaskOpen: vi.fn(), onTaskStatusChange: vi.fn().mockResolvedValue(true), ...overrides }));
}

function board(props: Partial<Parameters<typeof PlanningFlowBoard>[0]>) {
  const schedule = planningSchedule();
  return (
    <PlanningFlowBoard
      busy={false}
      readOnly={false}
      schedule={schedule}
      onTaskOpen={vi.fn()}
      onTaskStatusChange={vi.fn().mockResolvedValue(true)}
      {...props}
    />
  );
}
