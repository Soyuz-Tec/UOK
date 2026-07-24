import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization";
import { PlanningFlowBoard } from "../../web/src/PlanningFlowBoard";
import { planningSchedule } from "./planningFlowBoardFixtures";

afterEach(cleanup);

describe("PlanningFlowBoard", () => {
  it("renders governed lanes with direct card opening and no visible Open or Move footer", () => {
    const onTaskOpen = vi.fn();
    renderBoard({ onTaskOpen });

    expect(screen.getByRole("region", { name: "Planning flow board" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Planned, 2 tasks" })).toHaveAttribute("data-planning-status", "planned");
    expect(screen.getByRole("region", { name: "In progress, 1 task" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Blocked, 0 tasks" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Complete, 0 tasks" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Move task/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Open", { selector: "button" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open task Define scope" }));
    expect(onTaskOpen).toHaveBeenCalledWith("scope");
  });

  it("drags a task only to a server-permitted stage", async () => {
    const onTaskUpdate = vi.fn().mockResolvedValue(true);
    renderBoard({ onTaskUpdate });
    const card = screen.getByRole("article", { name: "Task 1 Define scope" });
    const destination = screen.getByRole("region", { name: "In progress, 1 task" });
    const dataTransfer = dragDataTransfer();

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragEnter(destination, { dataTransfer });
    fireEvent.dragOver(destination, { dataTransfer });
    expect(destination).toHaveAttribute("data-flow-drop-state", "allowed");
    fireEvent.drop(destination, { dataTransfer });

    expect(onTaskUpdate).toHaveBeenCalledTimes(1);
    expect(onTaskUpdate).toHaveBeenCalledWith("scope", { status: "in_progress" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Define scope moved to In progress."));
    await waitFor(() => expect(screen.getByRole("button", { name: "Open task Define scope" })).toHaveFocus());
  });

  it("cancels an obsolete focus fallback when the same card starts another drag", async () => {
    let resolveMove!: (accepted: boolean) => void;
    const onTaskUpdate = vi.fn(() => new Promise<boolean>((resolve) => { resolveMove = resolve; }));
    renderBoard({ onTaskUpdate });
    const card = screen.getByRole("article", { name: "Task 1 Define scope" });
    const destination = screen.getByRole("region", { name: "In progress, 1 task" });
    const dataTransfer = dragDataTransfer();

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.drop(destination, { dataTransfer });
    await waitFor(() => expect(onTaskUpdate).toHaveBeenCalledTimes(1));
    await act(async () => resolveMove(true));
    fireEvent.dragStart(card, { dataTransfer });
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 130)));

    expect(screen.getByRole("button", { name: "Open task Define scope" })).not.toHaveFocus();
    fireEvent.dragEnd(card, { dataTransfer });
  });

  it("does not steal deliberate edit focus when dragend is omitted", async () => {
    let resolveMove!: (accepted: boolean) => void;
    const onTaskUpdate = vi.fn(() => new Promise<boolean>((resolve) => { resolveMove = resolve; }));
    renderBoard({ onTaskUpdate });
    const card = screen.getByRole("article", { name: "Task 1 Define scope" });
    const destination = screen.getByRole("region", { name: "In progress, 1 task" });
    const dataTransfer = dragDataTransfer();

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.drop(destination, { dataTransfer });
    await waitFor(() => expect(onTaskUpdate).toHaveBeenCalledTimes(1));
    await act(async () => resolveMove(true));
    fireEvent.click(within(card).getByRole("button", { name: "Edit Task title for Define scope" }));
    const input = within(card).getByRole("textbox", { name: "Task title for Define scope" });
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 130)));

    expect(input).toHaveFocus();
  });

  it("rejects a self-stage and external drag without a mutation", () => {
    const onTaskUpdate = vi.fn().mockResolvedValue(true);
    renderBoard({ onTaskUpdate });
    const source = screen.getByRole("region", { name: "Planned, 2 tasks" });
    const card = screen.getByRole("article", { name: "Task 1 Define scope" });
    const dataTransfer = dragDataTransfer();

    fireEvent.drop(source, { dataTransfer });
    expect(onTaskUpdate).not.toHaveBeenCalled();
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragEnter(source, { dataTransfer });
    fireEvent.dragOver(source, { dataTransfer });
    expect(source).toHaveAttribute("data-flow-drop-state", "invalid");
    fireEvent.drop(source, { dataTransfer });
    fireEvent.dragEnd(card, { dataTransfer });
    expect(onTaskUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Define scope cannot move to Planned.");
  });

  it("does not advertise drag or More actions when the server publishes no destination", () => {
    const schedule = planningSchedule();
    schedule.task_flow = {
      ...schedule.task_flow!,
      statuses: schedule.task_flow!.statuses.map((status) => status.status === "planned"
        ? { ...status, allowed_transitions: [] }
        : status),
    };
    renderBoard({ schedule });
    const card = screen.getByRole("article", { name: "Task 1 Define scope" });

    expect(card).toHaveAttribute("draggable", "false");
    expect(within(card).queryByRole("button", { name: "More actions for Define scope" })).not.toBeInTheDocument();
  });

  it("keeps review-only cards inspectable while removing all mutation affordances", () => {
    const schedule = planningSchedule();
    schedule.tasks[0] = { ...schedule.tasks[0], title: "Scope نطاق", wbs: "WBS-١" };
    const onTaskOpen = vi.fn();
    render(
      <UokLocalizationProvider locale="ar">
        <PlanningFlowBoard busy={false} readOnly schedule={schedule} onTaskOpen={onTaskOpen} onTaskUpdate={vi.fn()} />
      </UokLocalizationProvider>,
    );

    const card = screen.getByRole("article", { name: "المهمة WBS-١ Scope نطاق" });
    expect(card).toHaveAttribute("draggable", "false");
    expect(within(card).queryByRole("button", { name: /تحرير/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /مزيد من الإجراءات/ })).not.toBeInTheDocument();
    expect(screen.getByText("Scope نطاق")).toHaveAttribute("dir", "auto");
    expect(screen.getByText("WBS-١")).toHaveAttribute("dir", "auto");
    fireEvent.click(screen.getByText("Scope نطاق"));
    expect(onTaskOpen).toHaveBeenCalledWith("scope");
    expect(screen.getByRole("button", { name: "فتح المهمة Scope نطاق" })).toHaveFocus();
  });

  it("exposes an actionable alert when the server flow contract is unavailable", () => {
    renderBoard({ schedule: { ...planningSchedule(), task_flow: undefined } });
    expect(screen.getByRole("alert")).toHaveTextContent("Task flow is unavailable. Refresh the validated schedule.");
  });
});

export function renderBoard(overrides: Partial<Parameters<typeof PlanningFlowBoard>[0]> = {}) {
  return render(board(overrides));
}

export function board(props: Partial<Parameters<typeof PlanningFlowBoard>[0]> = {}) {
  return (
    <PlanningFlowBoard
      busy={false}
      readOnly={false}
      schedule={planningSchedule()}
      onTaskOpen={vi.fn()}
      onTaskUpdate={vi.fn().mockResolvedValue(true)}
      {...props}
    />
  );
}

function dragDataTransfer() {
  return {
    dropEffect: "none",
    effectAllowed: "uninitialized",
    setData: vi.fn(),
    getData: vi.fn(),
  } as unknown as DataTransfer;
}
