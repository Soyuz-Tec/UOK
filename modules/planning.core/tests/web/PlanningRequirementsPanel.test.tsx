import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanningRequirementsPanel } from "../../web/src/PlanningRequirementsPanel";
import type { PlanningSchedule, PlanningTask, PlanningTaskRequirement } from "../../web/src/types";

afterEach(cleanup);

describe("Planning task gates", () => {
  it("creates linked evidence gates and records controlled decisions", () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onAdvance = vi.fn().mockResolvedValue(undefined);
    const onSetLink = vi.fn().mockResolvedValue(undefined);
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<PlanningRequirementsPanel schedule={schedule([requirement("under_review")])} selectedTask={task} busy="" readOnly={false} canApprove onCreate={onCreate} onAdvance={onAdvance} onSetLink={onSetLink} onDecide={onDecide} />);

    expect(screen.getByText("Not ready · 1 required blocker(s).")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Requirement type"), { target: { value: "evidence" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Signed release evidence" } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-08-05" } });
    fireEvent.change(screen.getByLabelText("Linked source"), { target: { value: "link-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Add gate" }));
    expect(onCreate).toHaveBeenCalledWith("task-1", {
      requirement_type: "evidence",
      title: "Signed release evidence",
      required: true,
      target_link_id: "link-1",
      due: "2026-08-05",
    });

    fireEvent.change(screen.getByLabelText("Source for Signed evidence"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Update source" }));
    expect(onSetLink).toHaveBeenCalledWith("task-1", "requirement-1", { target_link_id: null });

    fireEvent.change(screen.getByLabelText("Decision reason"), { target: { value: "Artifact verified" } });
    fireEvent.click(screen.getByRole("button", { name: "Satisfy" }));
    expect(onDecide).toHaveBeenCalledWith("task-1", "requirement-1", { decision: "satisfy", reason: "Artifact verified" });
  });

  it("advances workflow while denying decisions without approval permission", () => {
    const onAdvance = vi.fn().mockResolvedValue(undefined);
    render(<PlanningRequirementsPanel schedule={schedule([requirement("submitted")])} selectedTask={task} busy="" readOnly={false} canApprove={false} onCreate={vi.fn()} onAdvance={onAdvance} onSetLink={vi.fn()} onDecide={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    expect(onAdvance).toHaveBeenCalledWith("task-1", "requirement-1", { action: "start_review" });

    cleanup();
    render(<PlanningRequirementsPanel schedule={schedule([requirement("under_review")])} selectedTask={task} busy="" readOnly={false} canApprove={false} onCreate={vi.fn()} onAdvance={vi.fn()} onSetLink={vi.fn()} onDecide={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Decision reason"), { target: { value: "No authority" } });
    expect((screen.getByRole("button", { name: "Satisfy" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Gate approval permission is required for a decision.")).toBeTruthy();
  });
});

const task: PlanningTask = {
  id: "task-1", project_id: "project-1", version: 4, title: "Controlled task", task_type: "task",
  status: "planned", start: "2026-08-03", end: "2026-08-05", duration_days: 3, progress: 0, sort_order: 1,
  critical: false, readiness: { ready: false, required_count: 1, blocking_count: 1, blocking_requirement_ids: ["requirement-1"] },
};

function schedule(requirements: PlanningTaskRequirement[]): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Gates", status: "active", start: "2026-08-03", end: "2026-08-28", target_finish: "2026-08-28", calculated_finish: "2026-08-28", revision: 4 },
    tasks: [task], dependencies: [], resources: [], assignments: [], baselines: [], participants: [], requirements,
    links: [{
      id: "link-1", project_id: "project-1", task_id: "task-1", scope_type: "task", relationship: "proves", blocking: false,
      target: { kind: "evidence", id: "artifact-1", resolver: "reports.artifact", resolver_version: "1" },
      resolution: { status: "ready", display_label: "release.json", status_summary: "Report artifact is generated.", checked_at: "2026-08-03T00:00:00Z", open_path: "/api/reports/artifacts/artifact-1" },
      created_at: "2026-08-03T00:00:00Z", updated_at: "2026-08-03T00:00:00Z",
    }],
    readiness: { ready: false, required_count: 1, blocking_count: 1, blocking_requirement_ids: ["requirement-1"], task_blocker_count: 1 },
    validation: { ok: true, violations: [] },
  };
}

function requirement(state: PlanningTaskRequirement["state"]): PlanningTaskRequirement {
  return {
    id: "requirement-1", project_id: "project-1", task_id: "task-1", requirement_type: "evidence",
    title: "Signed evidence", state, required: true, blocking: state !== "satisfied", target_link_id: "link-1",
    target_link_state: "ready", due: "2026-08-05", decision_reason: null, decided_by_actor_id: null,
    decided_at: null, created_at: "2026-08-03T00:00:00Z", updated_at: "2026-08-03T00:00:00Z",
  };
}
