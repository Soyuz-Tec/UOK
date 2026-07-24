import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization/UokLocalization";
import { DependencyLines } from "../../web/src/PlanningDependencyLines";
import type { PlanningDependencyChain } from "../../web/src/planningDependencyChain";
import type { PlanningDependency, PlanningSchedule, PlanningTask } from "../../web/src/types";

afterEach(cleanup);

describe("Planning dependency lines", () => {
  it("renders typed ports, arrowheads, lag labels, and selected-chain semantics", () => {
    const { container } = render(
      <svg>
        <DependencyLines
          schedule={schedule}
          tasks={tasks}
          rowLayoutByTask={rows}
          chartStart={new Date("2026-01-01T00:00:00")}
          scale="day"
          cellWidth={20}
          headerHeight={54}
          dependencyChain={chain}
          timelineWidth={480}
        />
      </svg>,
    );

    expect(screen.getByRole("img", { name: "Finish to start Dependency from Source to Target; No lag" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Start to start Dependency from Source to Target; Lag 2 days; Selected dependency chain" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Finish to finish Dependency from Source to Target; Lead 1 day" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Start to finish Dependency from Source to Target; No lag" })).toBeTruthy();
    expect(container.querySelectorAll("marker")).toHaveLength(2);
    expect(container.querySelectorAll(".planning-owned-dependency-line[marker-end]")).toHaveLength(4);
    expect(Array.from(container.querySelectorAll(".planning-owned-dependency-label text"), (node) => node.textContent).sort()).toEqual(["FF -1d", "FS", "SF", "SS +2d"]);

    const selected = container.querySelector('[data-dependency-id="dep-ss"]');
    expect(container.querySelector('[data-dependency-id="dep-fs"]')?.getAttribute("class")).toContain("quiet-default");
    expect(selected?.getAttribute("class")).toContain("selected-chain");
    expect(selected?.querySelector(".planning-owned-dependency-line")?.getAttribute("class")).toContain("chain-highlight");
    expect(selected?.getAttribute("data-source-port")).toBe("start");
    expect(selected?.getAttribute("data-target-port")).toBe("start");
  });

  it("localizes the complete accessible description in Arabic", () => {
    render(
      <UokLocalizationProvider locale="ar">
        <svg>
          <DependencyLines
            schedule={{ ...schedule, dependencies: [dependencies[1]] }}
            tasks={tasks}
            rowLayoutByTask={rows}
            chartStart={new Date("2026-01-01T00:00:00")}
            scale="day"
            cellWidth={20}
            headerHeight={54}
            dependencyChain={chain}
            timelineWidth={480}
          />
        </svg>
      </UokLocalizationProvider>,
    );

    expect(screen.getByRole("img", { name: "من البدء إلى البدء تبعية من Source إلى Target; تأخير ٢ أيام; سلسلة التبعية المحددة" })).toBeTruthy();
  });
});

const tasks: PlanningTask[] = [
  task("source", "Source", "2026-01-02", "2026-01-04"),
  task("target", "Target", "2026-01-08", "2026-01-10"),
];

const dependencies: PlanningDependency[] = [
  dependency("dep-fs", "finish_to_start", 0),
  dependency("dep-ss", "start_to_start", 2),
  dependency("dep-ff", "finish_to_finish", -1),
  dependency("dep-sf", "start_to_finish", 0),
];

const schedule: PlanningSchedule = {
  project: { id: "project-1", name: "Delivery", status: "active", start: "2026-01-01", end: "2026-01-31", target_finish: "2026-01-31", calculated_finish: "2026-01-31", revision: 1 },
  tasks,
  dependencies,
  resources: [],
  assignments: [],
  links: [],
  baselines: [],
  validation: { ok: true, violations: [] },
};

const rows = new Map([
  ["source", { taskId: "source", top: 0, height: 40 }],
  ["target", { taskId: "target", top: 40, height: 40 }],
]);

const chain: PlanningDependencyChain = {
  taskKinds: new Map(),
  dependencyIds: new Set(["dep-ss"]),
};

function task(id: string, title: string, start: string, end: string): PlanningTask {
  return {
    id,
    project_id: "project-1",
    version: 1,
    parent_task_id: null,
    wbs: id,
    title,
    task_type: "task",
    status: "planned",
    start,
    end,
    duration_days: 3,
    progress: 0,
    sort_order: 1,
    critical: false,
  };
}

function dependency(id: string, dependency_type: PlanningDependency["dependency_type"], lag_days: number): PlanningDependency {
  return { id, project_id: "project-1", predecessor_task_id: "source", successor_task_id: "target", dependency_type, lag_days };
}
