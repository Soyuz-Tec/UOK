import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization";
import { PlanningTaskEditor } from "../../web/src/PlanningTaskEditor";
import type { PlanningSchedule } from "../../web/src/types";

afterEach(cleanup);

describe("PlanningTaskEditor", () => {
  it("confirms task deletion and discloses subtree relationship impact", async () => {
    const onDeleteTask = vi.fn().mockResolvedValue(undefined);
    const focusTarget = document.createElement("button");
    document.body.append(focusTarget);
    render(<PlanningTaskEditor
      schedule={schedule}
      selectedTask={schedule.tasks[0]}
      newTaskType="task"
      busy=""
      onSaveTask={vi.fn()}
      onSaveTaskDates={vi.fn()}
      onCreateTask={vi.fn()}
      onDeleteTask={onDeleteTask}
      onDeleteTaskComplete={() => focusTarget.focus()}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Delete task" }));
    expect(onDeleteTask).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog", { name: "Delete task Delivery task" });
    expect(within(dialog).getByText(/Child tasks are also deleted/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete task" }));

    await waitFor(() => expect(onDeleteTask).toHaveBeenCalledWith("task-1"));
    expect(focusTarget).toHaveFocus();
    focusTarget.remove();
  });

  it("localizes governed task deletion in Arabic", () => {
    render(
      <UokLocalizationProvider locale="ar">
        <PlanningTaskEditor
          schedule={schedule}
          selectedTask={schedule.tasks[0]}
          newTaskType="task"
          busy=""
          onSaveTask={vi.fn()}
          onSaveTaskDates={vi.fn()}
          onCreateTask={vi.fn()}
          onDeleteTask={vi.fn()}
        />
      </UokLocalizationProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "حذف المهمة" }));
    expect(screen.getByRole("alertdialog", { name: "حذف المهمة Delivery task" })).toBeInTheDocument();
  });
});

const schedule: PlanningSchedule = {
  project: {
    id: "project-1", name: "Plan", status: "active", start: "2026-08-01", end: "2026-08-30",
    target_finish: "2026-08-30", calculated_finish: "2026-08-30", revision: 1,
  },
  tasks: [{
    id: "task-1", project_id: "project-1", version: 1, parent_task_id: null, wbs: "1", title: "Delivery task",
    task_type: "task", status: "planned", start: "2026-08-01", end: "2026-08-02", duration_days: 2,
    progress: 0, sort_order: 1, critical: false,
  }],
  dependencies: [], resources: [], assignments: [], links: [], baselines: [],
  validation: { ok: true, violations: [] },
};
