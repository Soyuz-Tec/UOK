import { describe, expect, it } from "vitest";

import { planningKeyboardCommand } from "../../web/src/planningKeyboardModel";
import type { PlanningTask } from "../../web/src/types";

const tasks = [
  task("summary", "Summary", "summary"),
  task("task-1", "First task"),
  task("task-2", "Second task"),
];

describe("planning keyboard model", () => {
  it("moves selection by row with arrow, home, and end keys", () => {
    expect(command("ArrowDown", tasks[1])).toEqual({ kind: "select", taskId: "task-2" });
    expect(command("ArrowUp", tasks[1])).toEqual({ kind: "select", taskId: "summary" });
    expect(command("Home", tasks[2])).toEqual({ kind: "select", taskId: "summary" });
    expect(command("End", tasks[0])).toEqual({ kind: "select", taskId: "task-2" });
  });

  it("maps common shortcuts to server-routed task actions", () => {
    expect(command("d", tasks[1], { ctrlKey: true })).toEqual({ kind: "task-action", action: "duplicate" });
    expect(command("Enter", tasks[1], { ctrlKey: true })).toEqual({ kind: "task-action", action: "mark-complete" });
    expect(command("b", tasks[1], { metaKey: true })).toEqual({ kind: "task-action", action: "mark-blocked" });
    expect(command("n", tasks[0], { ctrlKey: true, shiftKey: true })).toEqual({ kind: "task-action", action: "add-child" });
  });

  it("opens menus and toggles summaries from keyboard commands", () => {
    expect(command("F10", tasks[1], { shiftKey: true })).toEqual({ kind: "open-menu" });
    expect(command("Enter", tasks[0])).toEqual({ kind: "toggle-summary" });
    expect(command("Enter", tasks[1])).toEqual({ kind: "select", taskId: "task-1" });
  });
});

function command(key: string, row: PlanningTask, overrides: Partial<KeyboardEvent> = {}) {
  return planningKeyboardCommand({ ctrlKey: false, key, metaKey: false, shiftKey: false, ...overrides }, row, tasks);
}

function task(id: string, title: string, taskType: PlanningTask["task_type"] = "task"): PlanningTask {
  return {
    id,
    project_id: "project-1",
    version: 1,
    title,
    task_type: taskType,
    status: "planned",
    start: "2026-08-03",
    end: "2026-08-05",
    duration_days: 3,
    progress: 0,
    sort_order: 1,
    critical: false,
  };
}
