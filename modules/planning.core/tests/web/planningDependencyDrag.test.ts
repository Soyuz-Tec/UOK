import { describe, expect, it } from "vitest";

import { dependencyLinkPayload } from "../../web/src/planningDependencyDrag";
import type { PlanningSchedule } from "../../web/src/types";

const schedule = {
  project: { id: "project-1", name: "Plan", status: "active", start: "2026-08-01", end: "2026-08-31", target_finish: "2026-08-31", calculated_finish: "2026-08-31", revision: 1 },
  tasks: [],
  dependencies: [{ id: "dep-1", project_id: "project-1", predecessor_task_id: "task-1", successor_task_id: "task-2", dependency_type: "finish_to_start", lag_days: 0 }],
  resources: [],
  assignments: [],
  links: [],
  baselines: [],
  validation: { ok: true, violations: [] },
} satisfies PlanningSchedule;

describe("planning dependency drag model", () => {
  it("creates a server-validation payload for a new finish-to-start link", () => {
    expect(dependencyLinkPayload(schedule, "task-2", "task-3")).toEqual({
      predecessor_task_id: "task-2",
      successor_task_id: "task-3",
      dependency_type: "finish_to_start",
      lag_days: 0,
    });
  });

  it("rejects self-links and duplicate links before calling the API", () => {
    expect(dependencyLinkPayload(schedule, "task-1", "task-1")).toBeNull();
    expect(dependencyLinkPayload(schedule, "task-1", "task-2")).toBeNull();
  });
});
