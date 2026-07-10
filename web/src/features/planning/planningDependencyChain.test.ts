import { describe, expect, it } from "vitest";

import { selectedDependencyChain, taskDependencyChainClass } from "./planningDependencyChain";
import type { PlanningSchedule, PlanningTask } from "./types";

describe("planning dependency chain", () => {
  it("classifies selected task predecessors, successors, and direct links", () => {
    const chain = selectedDependencyChain(schedule(), "b");
    expect(taskDependencyChainClass(chain, "a")).toBe("chain-predecessor");
    expect(taskDependencyChainClass(chain, "c")).toBe("chain-successor");
    expect(taskDependencyChainClass(chain, "d")).toBe("chain-successor");
    expect(taskDependencyChainClass(chain, "b")).toBe("");
    expect(Array.from(chain.dependencyIds).sort()).toEqual(["a-b", "b-c", "c-d"]);
  });

  it("marks a task related when it is reached from both directions", () => {
    const value = schedule();
    value.dependencies.push({ id: "c-a", project_id: "project-1", predecessor_task_id: "c", successor_task_id: "a", dependency_type: "finish_to_start", lag_days: 0 });
    const chain = selectedDependencyChain(value, "b");
    expect(taskDependencyChainClass(chain, "a")).toBe("chain-related");
    expect(taskDependencyChainClass(chain, "c")).toBe("chain-related");
  });
});

function schedule(): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Project", status: "active", start: "2026-08-01", end: "2026-08-12", target_finish: "2026-08-12", calculated_finish: "2026-08-12", revision: 1 },
    tasks: ["a", "b", "c", "d"].map(task),
    dependencies: [
      { id: "a-b", project_id: "project-1", predecessor_task_id: "a", successor_task_id: "b", dependency_type: "finish_to_start", lag_days: 0 },
      { id: "b-c", project_id: "project-1", predecessor_task_id: "b", successor_task_id: "c", dependency_type: "finish_to_start", lag_days: 0 },
      { id: "c-d", project_id: "project-1", predecessor_task_id: "c", successor_task_id: "d", dependency_type: "finish_to_start", lag_days: 0 },
    ],
    resources: [],
    assignments: [],
    links: [],
    baselines: [],
    calendar: { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: [] },
    validation: { ok: true, violations: [] },
  };
}

function task(id: string): PlanningTask {
  return {
    id,
    project_id: "project-1",
    version: 1,
    title: `Task ${id}`,
    task_type: "task",
    status: "planned",
    start: "2026-08-01",
    end: "2026-08-02",
    duration_days: 2,
    progress: 0,
    sort_order: 1,
    critical: false,
  };
}
