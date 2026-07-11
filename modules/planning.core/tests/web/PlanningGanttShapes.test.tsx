import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization/UokLocalization";
import { ProjectBoundaryMarkers, TaskShape, TaskTimelineMarkers } from "../../web/src/PlanningGanttShapes";
import type { PlanningProject, PlanningTask } from "../../web/src/types";

afterEach(cleanup);

describe("Planning Gantt project boundary markers", () => {
  it("deduplicates coincident finish markers while preserving every accessible meaning", () => {
    const { container } = render(<svg><ProjectBoundaryMarkers project={project} chartStart={new Date("2026-08-01T00:00:00")} scale="day" cellWidth={24} height={400} /></svg>);

    expect(container.querySelectorAll(".planning-owned-boundary-marker")).toHaveLength(2);
    const finish = screen.getByRole("img", { name: "Compatibility horizon: 2026-08-31; Target finish: 2026-08-31; Calculated finish: 2026-08-31" });
    expect(finish.getAttribute("class")).toContain("end target calculated");
  });

  it("provides localized accessible labels", () => {
    render(<UokLocalizationProvider locale="ar"><svg><ProjectBoundaryMarkers project={project} chartStart={new Date("2026-08-01T00:00:00")} scale="day" cellWidth={24} height={400} /></svg></UokLocalizationProvider>);
    expect(screen.getByRole("img", { name: "أفق التوافق: 2026-08-31; الانتهاء المستهدف: 2026-08-31; الانتهاء المحسوب: 2026-08-31" })).toBeTruthy();
  });

  it("uses the compatibility horizon for absent or invalid legacy finish values without emitting NaN SVG attributes", () => {
    const legacyProject = {
      ...project,
      target_finish: undefined,
      calculated_finish: "not-a-date",
    } as unknown as PlanningProject;

    const { container } = render(<svg><ProjectBoundaryMarkers project={legacyProject} chartStart={new Date("2026-08-01T00:00:00")} scale="day" cellWidth={24} height={400} /></svg>);

    expect(container.innerHTML).not.toContain("NaN");
    expect(container.querySelectorAll(".planning-owned-boundary-marker")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "Compatibility horizon: 2026-08-31; Target finish: 2026-08-31; Calculated finish: 2026-08-31" })).toBeTruthy();
  });
});

describe("Planning Gantt task shapes", () => {
  it("renders a narrow critical task with bounded overlays and complete accessible text", () => {
    const { container } = render(
      <svg>
        <TaskShape
          task={narrowTask}
          rowTop={0}
          chartStart={new Date("2027-01-04T00:00:00")}
          scale="day"
          cellWidth={52}
          rowSize={50}
          headerHeight={54}
          timelineWidth={800}
          viewportLeft={0}
          viewportWidth={800}
          selected
          chainClass=""
          showCritical
          showBaselines
          readOnly={false}
          onSelect={() => undefined}
          onDragStart={() => undefined}
          onLinkStart={() => undefined}
          onLinkFinish={() => undefined}
        />
      </svg>,
    );

    const task = screen.getByRole("button", { name: /One-day critical task with a long title, Critical path task, 45% complete, .*end variance 0 days/ });
    expect(task.querySelector(".planning-owned-task-bar")).toBeTruthy();
    const label = task.querySelector(".planning-owned-task-label-viewport");
    const status = task.querySelector(".planning-owned-status-surface");
    const source = task.querySelector(".planning-owned-link-handle.source");
    const tooltip = task.querySelector(".planning-owned-tooltip-surface");
    const baseline = task.querySelector(".baseline-code");
    expect(label?.getAttribute("width")).toBe("40");
    expect(task.querySelector(".planning-owned-task-label")?.getAttribute("clip-path")).toMatch(/^url\(#.+-label\)$/);
    expect(task.querySelectorAll(".planning-owned-tooltip-line[clip-path]")).toHaveLength(2);
    expect(status?.getAttribute("x")).toBe("58");
    expect(source?.getAttribute("cx")).toBe("110");
    expect(task.querySelector(".planning-owned-link-handle.target")?.getAttribute("cx")).toBe("5");
    expect(tooltip?.getAttribute("x")).toBe("123");
    expect(tooltip?.getAttribute("y")).toBe("62");
    expect(baseline?.getAttribute("y")).toBe("89");
    expect(container.innerHTML).toContain("One-day critical task with a long title");
  });

  it("keeps compact baseline lanes inside the row without colliding status codes", () => {
    const { container } = render(
      <svg>
        <TaskShape
          task={narrowTask}
          rowTop={0}
          chartStart={new Date("2027-01-04T00:00:00")}
          scale="day"
          cellWidth={52}
          rowSize={42}
          headerHeight={54}
          timelineWidth={800}
          viewportLeft={0}
          viewportWidth={800}
          selected={false}
          chainClass=""
          showCritical
          showBaselines
          readOnly={false}
          onSelect={() => undefined}
          onDragStart={() => undefined}
          onLinkStart={() => undefined}
          onLinkFinish={() => undefined}
        />
      </svg>,
    );

    const baseline = container.querySelector(".baseline-bar");
    expect(baseline).toBeTruthy();
    expect(Number(baseline?.getAttribute("y")) + Number(baseline?.getAttribute("height"))).toBeLessThanOrEqual(96);
    expect(container.querySelector(".baseline-code")).toBeNull();
    expect(container.querySelector(".planning-owned-task")?.getAttribute("aria-label")).toContain("end variance 0 days");
  });

  it("starts milestone labels beyond the coarse-pointer dependency handle envelope", () => {
    const { container } = render(
      <svg>
        <TaskShape
          task={{ ...narrowTask, id: "milestone", title: "Approval milestone", task_type: "milestone", baseline_start: null, baseline_end: null }}
          rowTop={0}
          chartStart={new Date("2027-01-04T00:00:00")}
          scale="day"
          cellWidth={52}
          rowSize={50}
          headerHeight={54}
          timelineWidth={800}
          viewportLeft={0}
          viewportWidth={800}
          selected={false}
          chainClass=""
          showCritical
          showBaselines
          readOnly={false}
          onSelect={() => undefined}
          onDragStart={() => undefined}
          onLinkStart={() => undefined}
          onLinkFinish={() => undefined}
        />
      </svg>,
    );

    const labelX = Number(container.querySelector(".planning-owned-task-label-viewport")?.getAttribute("x"));
    const sourceX = Number(container.querySelector(".planning-owned-link-handle.source")?.getAttribute("cx"));
    expect(labelX).toBeGreaterThanOrEqual(sourceX + 10);
  });
});

describe("Planning Gantt timeline markers", () => {
  it("aggregates coincident pills and clamps the aggregate inside the timeline", () => {
    const { container } = render(
      <svg>
        <TaskTimelineMarkers
          markers={[
            { id: "deadline-1", taskId: "task-1", date: "2027-01-10", code: "DUE", kind: "deadline", label: "Deadline: One" },
            { id: "milestone-1", taskId: "task-2", date: "2027-01-10", code: "MS", kind: "milestone", label: "Milestone: Two" },
          ]}
          chartStart={new Date("2027-01-01T00:00:00")}
          scale="day"
          cellWidth={10}
          height={200}
          timelineWidth={100}
        />
      </svg>,
    );

    expect(screen.getByRole("img", { name: "Deadline: One; Milestone: Two" })).toBeTruthy();
    expect(container.querySelectorAll(".planning-owned-task-marker-surface")).toHaveLength(1);
    expect(container.querySelectorAll(".planning-owned-task-marker line")).toHaveLength(2);
    expect(container.querySelector(".planning-owned-task-marker-surface")?.getAttribute("x")).toBe("62");
    expect(container.querySelector(".planning-owned-task-marker text")?.textContent).toBe("+2");
  });
});

const project: PlanningProject = {
  id: "project-1",
  name: "Delivery",
  status: "active",
  start: "2026-08-01",
  end: "2026-08-31",
  target_finish: "2026-08-31",
  calculated_finish: "2026-08-31",
  revision: 1,
};

const narrowTask: PlanningTask = {
  id: "task-narrow",
  project_id: "project-1",
  version: 1,
  parent_task_id: null,
  wbs: "1",
  title: "One-day critical task with a long title",
  task_type: "task",
  status: "in_progress",
  start: "2027-01-04",
  end: "2027-01-04",
  duration_days: 1,
  progress: 45,
  sort_order: 1,
  critical: true,
  total_slack_days: 0,
  baseline_start: "2027-01-04",
  baseline_end: "2027-01-04",
  start_variance_days: 0,
  end_variance_days: 0,
};
