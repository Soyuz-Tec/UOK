import { describe, expect, it } from "vitest";

import { assignedResourceNames, gridColumns, gridValue } from "../../web/src/planningGanttModel";
import { planningColumnVisibilityOptions } from "../../web/src/planningTimelineModel";
import type { PlanningSchedule, PlanningTask, PlanningTaskParticipant } from "../../web/src/types";

describe("planning Gantt Logic fields", () => {
  it("derives professional logic facts from the actor-visible validated schedule", () => {
    const facts = assignedResourceNames(schedule());

    expect(facts.get("delivery")).toBe("Planner");
    expect(gridValue("owner", delivery, facts)).toBe("Amina Owner; Legacy Owner (unavailable); Restricted owner; Missing owner");
    expect(gridValue("owner", delivery, facts)).not.toContain("Hidden identity");
    expect(gridValue("predecessors", delivery, facts)).toBe(
      "1.1 · Define a deliberately long implementation scope label · FS +2d; 1.2 · Approve scope · SS -1d",
    );
    expect(gridValue("successors", delivery, facts)).toBe("1.4 · Release milestone · FF");
    expect(gridValue("totalFloat", delivery, facts)).toBe("-2d");
    expect(gridValue("readiness", delivery, facts)).toBe("Blocked (2)");
    expect(gridValue("readiness", scope, facts)).toBe("Not assessed");
    expect(gridValue("readiness", approval, facts)).toBe("No gates");
    expect(gridValue("readiness", release, facts)).toBe("Ready");
  });

  it("localizes actor-safe owner fallbacks, float units, and every readiness state", () => {
    const facts = assignedResourceNames(schedule());

    expect(gridValue("owner", delivery, facts, arabicLocalization)).toBe("Amina Owner; Legacy Owner (غير متاح); مالك مقيّد; لم يُحدد المالك");
    expect(gridValue("owner", delivery, facts, arabicLocalization)).not.toContain("Hidden identity");
    expect(gridValue("totalFloat", delivery, facts, arabicLocalization)).toBe("-٢ي");
    expect(gridValue("readiness", delivery, facts, arabicLocalization)).toBe("محظورة (٢)");
    expect(gridValue("readiness", scope, facts, arabicLocalization)).toBe("لم تُقيّم");
    expect(gridValue("readiness", approval, facts, arabicLocalization)).toBe("لا توجد بوابات");
    expect(gridValue("readiness", release, facts, arabicLocalization)).toBe("جاهزة");
  });

  it("keeps Core unchanged and exposes Logic as an optional field preset", () => {
    expect(gridColumns("core").map((column) => column.id)).toEqual(["wbs", "task", "start", "end"]);
    expect(gridColumns("logic").map((column) => column.id)).toEqual([
      "wbs", "task", "owner", "predecessors", "successors", "totalFloat", "readiness",
    ]);
    expect(planningColumnVisibilityOptions("logic").map((column) => column.id)).toEqual([
      "wbs", "task", "owner", "predecessors", "successors", "totalFloat", "readiness",
    ]);
  });
});

const scope = task("scope", "1.1", "Define a deliberately long implementation scope label");
const approval: PlanningTask = {
  ...task("approval", "1.2", "Approve scope"),
  readiness: { ready: true, required_count: 0, blocking_count: 0, blocking_requirement_ids: [] },
};
const delivery: PlanningTask = {
  ...task("delivery", "1.3", "Deliver validated schedule"),
  total_slack_days: -2,
  readiness: { ready: false, required_count: 3, blocking_count: 2, blocking_requirement_ids: ["gate-1", "gate-2"] },
};
const release: PlanningTask = {
  ...task("release", "1.4", "Release milestone"),
  readiness: { ready: true, required_count: 1, blocking_count: 0, blocking_requirement_ids: [] },
};

const arabicMessages: Record<string, string> = {
  "planning.owner.unavailable": "المالك غير متاح",
  "planning.owner.state.unavailable": "غير متاح",
  "planning.owner.restricted": "مالك مقيّد",
  "planning.owner.missing": "لم يُحدد المالك",
  "planning.readiness.notAssessed": "لم تُقيّم",
  "planning.readiness.ready": "جاهزة",
  "planning.readiness.noGates": "لا توجد بوابات",
  "planning.readiness.blocked": "محظورة ({count})",
  "planning.duration.dayShort": "ي",
};
const arabicLocalization = {
  t: (key: string, fallback?: string) => arabicMessages[key] || fallback || key,
  formatNumber: (value: number) => new Intl.NumberFormat("ar-u-nu-arab").format(value),
};

function schedule(): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Logic", status: "active", start: "2026-08-01", end: "2026-08-31", target_finish: "2026-08-31", calculated_finish: "2026-08-31", revision: 4 },
    tasks: [scope, approval, delivery, release],
    dependencies: [
      dependency("scope", "delivery", "finish_to_start", 2),
      dependency("approval", "delivery", "start_to_start", -1),
      dependency("delivery", "release", "finish_to_finish", 0),
    ],
    resources: [{ id: "resource-1", project_id: "project-1", name: "Planner", role: "Scheduling", resource_type: "human", capacity_value: 1, capacity_unit: "fte", canonical_target_kind: null, canonical_target_id: null, canonical_resolution: null, effective_start: null, effective_end: null, calendar: null }],
    assignments: [{ id: "assignment-1", task_id: "delivery", resource_id: "resource-1", allocation_percent: 100 }],
    participants: [
      participant("ready", "Amina Owner"),
      participant("unavailable", "Legacy Owner"),
      participant("denied", "Hidden identity"),
      participant("missing", "Hidden identity"),
    ],
    links: [], baselines: [], validation: { ok: true, violations: [] },
  };
}

function task(id: string, wbs: string, title: string): PlanningTask {
  return { id, project_id: "project-1", version: 1, wbs, title, task_type: "task", status: "planned", start: "2026-08-01", end: "2026-08-02", duration_days: 2, progress: 0, sort_order: 1, critical: false };
}

function dependency(predecessorTaskId: string, successorTaskId: string, dependencyType: PlanningSchedule["dependencies"][number]["dependency_type"], lagDays: number) {
  return { id: `${predecessorTaskId}-${successorTaskId}`, project_id: "project-1", predecessor_task_id: predecessorTaskId, successor_task_id: successorTaskId, dependency_type: dependencyType, lag_days: lagDays };
}

function participant(status: PlanningTaskParticipant["resolution"]["status"], displayLabel: string): PlanningTaskParticipant {
  return {
    id: `participant-${status}`, project_id: "project-1", task_id: "delivery", role: "owner", source_module: "contacts.core",
    party: { id: status === "denied" ? null : `party-${status}`, resolver: "contacts.party", resolver_version: "1" },
    resolution: { status, display_label: displayLabel, status_summary: "Safe server summary.", checked_at: "2026-08-01T00:00:00Z", open_path: status === "ready" ? "/?view=contacts&party_id=ready" : null },
    created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
  };
}
