import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { UokLocalizationProvider } from "@uok/shared/localization/UokLocalization";
import { PlanningScheduleHealth } from "../../web/src/PlanningScheduleHealth";
import type { PlanningSchedule } from "../../web/src/types";

afterEach(cleanup);

describe("PlanningScheduleHealth", () => {
  it("summarizes validated finish, path, readiness, capacity, baseline, and review facts", async () => {
    render(<PlanningScheduleHealth schedule={attentionSchedule} reviewMode reviewModeLocked={false} />);

    const trigger = screen.getByRole("button", { name: "Open schedule health: Needs attention" });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Schedule health" });
    expect(within(dialog).getByText("Needs attention")).toBeInTheDocument();
    expect(metric(dialog, "Calculated / target finish")).toHaveTextContent("Aug 15, 2026 / Aug 12, 2026");
    expect(metric(dialog, "Calculated / target finish")).toHaveTextContent("3 days late");
    expect(metric(dialog, "Critical path")).toHaveTextContent("1 critical task");
    expect(metric(dialog, "Readiness")).toHaveTextContent("2 blockers");
    expect(metric(dialog, "Resource capacity")).toHaveTextContent("2 overloaded points");
    expect(metric(dialog, "Baseline variance")).toHaveTextContent("1 late · 0 early · 0 aligned");
    expect(metric(dialog, "Working state")).toHaveTextContent("Review mode");
    expect(dialog).toHaveTextContent("Python remains scheduling authority");

    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("labels missing optional evidence without inventing health facts", () => {
    render(<PlanningScheduleHealth schedule={partialSchedule} reviewMode={false} reviewModeLocked />);
    fireEvent.click(screen.getByRole("button", { name: "Open schedule health: Partial evidence" }));

    const dialog = screen.getByRole("dialog", { name: "Schedule health" });
    expect(metric(dialog, "Calculated / target finish")).toHaveTextContent("Variance not calculated");
    expect(metric(dialog, "Readiness")).toHaveTextContent("Not reported");
    expect(metric(dialog, "Resource capacity")).toHaveTextContent("No resources");
    expect(metric(dialog, "Baseline variance")).toHaveTextContent("No baseline");
    expect(metric(dialog, "Working state")).toHaveTextContent("Server review-only");
  });

  it("uses the shared Arabic vocabulary for the compact health surface", () => {
    render(<UokLocalizationProvider locale="ar"><PlanningScheduleHealth schedule={partialSchedule} reviewMode={false} reviewModeLocked /></UokLocalizationProvider>);
    fireEvent.click(screen.getByRole("button", { name: "فتح صحة الجدول: أدلة جزئية" }));

    const dialog = screen.getByRole("dialog", { name: "صحة الجدول" });
    expect(metric(dialog, "سعة الموارد")).toHaveTextContent("لا توجد موارد");
    expect(metric(dialog, "حالة العمل")).toHaveTextContent("مراجعة فقط حسب الخادم");
  });
});

function metric(dialog: HTMLElement, label: string) {
  const term = within(dialog).getByText(label);
  return term.closest("div") as HTMLElement;
}

const attentionSchedule: PlanningSchedule = {
  project: { id: "project-1", name: "Pilot", status: "active", start: "2026-08-01", end: "2026-08-20", target_finish: "2026-08-12", calculated_finish: "2026-08-15", revision: 7, updated_at: "2026-08-10T12:00:00Z" },
  capabilities: { read: true, edit: true, baseline_create: true, level: true, link: true, gate_approve: true, admin: true, analyze: true, analysis_approve: true, review_only: false },
  tasks: [{
    id: "task-1", project_id: "project-1", version: 2, title: "Build", task_type: "task", status: "in_progress",
    start: "2026-08-01", end: "2026-08-15", duration_days: 11, progress: 50, sort_order: 1, critical: true,
    baseline_start: "2026-08-01", baseline_end: "2026-08-12", end_variance_days: 3,
  }],
  dependencies: [],
  resources: [{ id: "resource-1", project_id: "project-1", name: "Team", role: "Delivery", resource_type: "team", capacity_value: 1, capacity_unit: "fte", canonical_target_kind: null, canonical_target_id: null, canonical_resolution: null, effective_start: null, effective_end: null, calendar: null }],
  assignments: [], links: [],
  baselines: [{ id: "baseline-1", project_id: "project-1", name: "Approved", schema_version: 2, completeness: "complete", created_at: "2026-08-01T00:00:00Z", integrity: { status: "verified", verified: true, missing_facts: [], message: "Verified" } }],
  readiness: { ready: false, required_count: 2, blocking_count: 2, blocking_requirement_ids: ["gate-1", "gate-2"], task_blocker_count: 1 },
  calculation: {
    engine_version: "uok-cpm-2", project_start: "2026-08-01", calculated_finish: "2026-08-15", target_finish: "2026-08-12", target_variance_days: 3,
    independent_validation: { ok: true, violations: [] },
    resource_capacity: { engine_version: "uok-resource-capacity-2", default_capacity_percent: 100, load_points: [], overallocated_count: 2, independent_validation: { ok: true, violations: [] } },
  },
  validation: { ok: true, violations: [] },
};

const partialSchedule: PlanningSchedule = {
  project: { id: "project-2", name: "Draft", status: "draft", start: "2026-09-01", end: "2026-09-15", target_finish: "2026-09-15", calculated_finish: "2026-09-15", revision: 1 },
  capabilities: { read: true, edit: false, baseline_create: false, level: false, link: false, gate_approve: false, admin: false, analyze: false, analysis_approve: false, review_only: true },
  tasks: [], dependencies: [], resources: [], assignments: [], links: [], baselines: [],
  validation: { ok: true, violations: [] },
};
