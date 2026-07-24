import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanningFlowBoard } from "../../web/src/PlanningFlowBoard";
import { planningSchedule } from "./planningFlowBoardFixtures";

afterEach(cleanup);

describe("PlanningFlowBoard card interactions", () => {
  it("edits the heading in place without opening the Inspector", async () => {
    const onTaskOpen = vi.fn();
    const onTaskUpdate = vi.fn().mockResolvedValue(true);
    renderBoard({ onTaskOpen, onTaskUpdate });
    const card = screen.getByRole("article", { name: "Task 1 Define scope" });

    fireEvent.click(within(card).getByRole("button", { name: "Edit Task title for Define scope" }));
    const input = within(card).getByRole("textbox", { name: "Task title for Define scope" });
    fireEvent.change(input, { target: { value: "Define validated scope" } });
    fireEvent.click(within(card).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onTaskUpdate).toHaveBeenCalledWith("scope", { title: "Define validated scope" }));
    expect(onTaskOpen).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Task title updated to Define validated scope.");
    await waitFor(() => expect(within(card).getByRole("button", { name: "Edit Task title for Define scope" })).toHaveFocus());
  });

  it("keeps the inline editor open for validation and stale mutation failures", async () => {
    const onTaskUpdate = vi.fn().mockResolvedValue(false);
    renderBoard({ onTaskUpdate });
    const card = screen.getByRole("article", { name: "Task 1 Define scope" });
    fireEvent.click(within(card).getByRole("button", { name: "Edit Task title for Define scope" }));
    const input = within(card).getByRole("textbox", { name: "Task title for Define scope" });

    fireEvent.change(input, { target: { value: "x" } });
    fireEvent.click(within(card).getByRole("button", { name: "Save" }));
    expect(onTaskUpdate).not.toHaveBeenCalled();
    expect(within(card).getByText("Enter a task title with at least 2 characters.")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Rejected title" } });
    fireEvent.click(within(card).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onTaskUpdate).toHaveBeenCalledWith("scope", { title: "Rejected title" }));
    expect(await within(card).findByRole("textbox", { name: "Task title for Define scope" })).toHaveValue("Rejected title");
    expect(within(card).getByText("Task title was not updated. Review the Planning notice.")).toBeInTheDocument();
    expect(screen.getByRole("status")).not.toHaveTextContent("Task title updated");
  });

  it("offers permitted move stages in More actions as the non-drag fallback", async () => {
    const onTaskUpdate = vi.fn().mockResolvedValue(true);
    renderBoard({ onTaskUpdate });
    const card = screen.getByRole("article", { name: "Task 1 Define scope" });

    fireEvent.click(within(card).getByRole("button", { name: "More actions for Define scope" }));
    const menu = screen.getByRole("dialog", { name: "More actions for Define scope" });
    expect(within(menu).getByRole("button", { name: "Move to In progress" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Move to Blocked" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Move to Complete" })).toBeInTheDocument();
    expect(within(menu).queryByRole("button", { name: "Move to Planned" })).not.toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("button", { name: "Move to Blocked" }));

    await waitFor(() => expect(onTaskUpdate).toHaveBeenCalledWith("scope", { status: "blocked" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Open task Define scope" })).toHaveFocus());
  });

  it("does not announce false success after a stale move reloads the authoritative lane", async () => {
    const schedule = planningSchedule();
    let resolveMove!: (applied: boolean) => void;
    const onTaskUpdate = vi.fn(() => new Promise<boolean>((resolve) => { resolveMove = resolve; }));
    const view = renderBoard({ schedule, onTaskUpdate });
    const card = screen.getByRole("article", { name: "Task 1 Define scope" });

    fireEvent.click(within(card).getByRole("button", { name: "More actions for Define scope" }));
    const menu = screen.getByRole("dialog", { name: "More actions for Define scope" });
    fireEvent.click(within(menu).getByRole("button", { name: "Move to In progress" }));
    await waitFor(() => expect(screen.getByRole("article", { name: "Task 1 Define scope" })).toHaveAttribute("aria-busy", "true"));
    const remotelyMoved = {
      ...schedule,
      tasks: schedule.tasks.map((task) => task.id === "scope" ? { ...task, status: "in_progress" as const } : task),
    };
    view.rerender(board({ schedule: remotelyMoved, onTaskUpdate }));
    await act(async () => resolveMove(false));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Task move was not applied."));
    expect(screen.getByRole("status")).not.toHaveTextContent("moved to In progress");
    await waitFor(() => expect(screen.getByRole("button", { name: "Open task Define scope" })).toHaveFocus());
  });
});

function renderBoard(overrides: Partial<Parameters<typeof PlanningFlowBoard>[0]> = {}) {
  return render(board(overrides));
}

function board(props: Partial<Parameters<typeof PlanningFlowBoard>[0]> = {}) {
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
