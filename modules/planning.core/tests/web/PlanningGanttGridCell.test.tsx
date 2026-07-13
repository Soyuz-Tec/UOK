import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UokLocalizationProvider, useUokLocalization } from "@uok/shared/localization/UokLocalization";
import { PlanningGanttGridCell } from "../../web/src/PlanningGanttGridCell";
import { assignedResourceNames, gridColumns } from "../../web/src/planningGanttModel";
import type { PlanningSchedule, PlanningTask, PlanningTaskParticipant } from "../../web/src/types";

afterEach(cleanup);

describe("Planning Gantt task identity cell", () => {
  it("keeps hierarchy and disclosure beside the task identity with logical RTL-safe indentation", () => {
    const onSummaryToggle = vi.fn();
    const { container } = render(
      <div dir="rtl">
        <PlanningGanttGridCell
          assignedByTask={assignedResourceNames(schedule)}
          column={column("task")}
          pinnedOffsets={new Map([["task", 0]])}
          readOnly
          summaryExpanded
          task={summary}
          taskDepth={2}
          onSummaryToggle={onSummaryToggle}
          onTaskEdit={vi.fn()}
        />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: `Collapse ${summary.title}` }));
    expect(onSummaryToggle).toHaveBeenCalledWith(summary.id);
    const identity = container.querySelector(".planning-owned-task-identity") as HTMLElement;
    expect(identity.style.getPropertyValue("--planning-task-depth")).toBe("2");
    expect(identity.closest("[dir=rtl]")).toBeTruthy();
    const fullTitle = container.querySelector(".planning-owned-grid-cell-value");
    expect(fullTitle?.textContent).toBe(summary.title);
    expect(fullTitle?.getAttribute("title")).toBe(summary.title);
  });

  it("does not leave the summary disclosure detached in the WBS cell", () => {
    render(
      <PlanningGanttGridCell
        assignedByTask={assignedResourceNames(schedule)}
        column={column("wbs")}
        pinnedOffsets={new Map([["wbs", 0]])}
        readOnly
        summaryExpanded
        task={summary}
        taskDepth={0}
        onSummaryToggle={vi.fn()}
        onTaskEdit={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: `Collapse ${summary.title}` })).toBeNull();
    expect(screen.getByRole("cell").textContent).toBe("1");
  });

  it("provides Arabic Logic field labels for the RTL grid", () => {
    render(<UokLocalizationProvider locale="ar"><LogicLabels /></UokLocalizationProvider>);
    expect(screen.getByText("المالك | المهام السابقة | المهام اللاحقة | السماح الكلي | الجاهزية")).toBeTruthy();
  });

  it("renders actor-safe owner fallbacks, float, and readiness values in Arabic", () => {
    const facts = assignedResourceNames(schedule);
    render(
      <UokLocalizationProvider locale="ar">
        <div role="row">
          {["owner", "totalFloat", "readiness"].map((id) => (
            <PlanningGanttGridCell
              key={id}
              assignedByTask={facts}
              column={gridColumns("logic").find((item) => item.id === id)!}
              pinnedOffsets={new Map()}
              readOnly
              summaryExpanded
              task={summary}
              taskDepth={0}
              onSummaryToggle={vi.fn()}
              onTaskEdit={vi.fn()}
            />
          ))}
        </div>
      </UokLocalizationProvider>,
    );

    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("المالك غير متاح; Legacy Owner (غير متاح); مالك مقيّد; لم يُحدد المالك");
    expect(cells[0]).not.toHaveTextContent("Hidden identity");
    expect(cells[1]).toHaveTextContent("-٢ي");
    expect(cells[2]).toHaveTextContent("محظورة (٢)");
  });
});

function LogicLabels() {
  const { t } = useUokLocalization();
  return <span>{["owner", "predecessors", "successors", "totalFloat", "readiness"].map((id) => t(`planning.column.${id}`)).join(" | ")}</span>;
}

const summary: PlanningTask = {
  id: "summary", project_id: "project-1", version: 1, parent_task_id: null, wbs: "1",
  title: "A summary task title long enough to require visual truncation without losing its accessible value",
  task_type: "summary", status: "planned", start: "2026-08-01", end: "2026-08-31",
  duration_days: 31, progress: 0, sort_order: 1, critical: false, total_slack_days: -2,
  readiness: { ready: false, required_count: 3, blocking_count: 2, blocking_requirement_ids: ["gate-1", "gate-2"] },
};

const schedule: PlanningSchedule = {
  project: { id: "project-1", name: "Hierarchy", status: "active", start: "2026-08-01", end: "2026-08-31", target_finish: "2026-08-31", calculated_finish: "2026-08-31", revision: 1 },
  tasks: [summary], dependencies: [], resources: [], assignments: [],
  participants: [
    participant("ready", ""),
    participant("unavailable", "Legacy Owner"),
    participant("denied", "Hidden identity"),
    participant("missing", "Hidden identity"),
  ],
  links: [], baselines: [], validation: { ok: true, violations: [] },
};

function column(id: "task" | "wbs") {
  return gridColumns("core").find((item) => item.id === id)!;
}

function participant(status: PlanningTaskParticipant["resolution"]["status"], displayLabel: string): PlanningTaskParticipant {
  return {
    id: `participant-${status}`, project_id: "project-1", task_id: "summary", role: "owner", source_module: "contacts.core",
    party: { id: status === "denied" ? null : `party-${status}`, resolver: "contacts.party", resolver_version: "1" },
    resolution: { status, display_label: displayLabel, status_summary: "Actor-safe status.", checked_at: "2026-08-01T00:00:00Z", open_path: status === "ready" ? "/?view=contacts&party_id=ready" : null },
    created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
  };
}
