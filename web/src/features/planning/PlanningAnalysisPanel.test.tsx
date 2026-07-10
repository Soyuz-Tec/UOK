import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlanningAnalysisPanel } from "./PlanningAnalysisPanel";
import { listPlanningWhatIfSnapshots, loadPlanningWhatIfSnapshot } from "./planningAnalysisApi";
import type { PlanningSchedule } from "./types";

vi.mock("./planningAnalysisApi", () => ({
  listPlanningWhatIfSnapshots: vi.fn(),
  loadPlanningWhatIfSnapshot: vi.fn(),
}));

const metadata = {
  id: "snapshot-1",
  project_id: "project-1",
  name: "Earlier delivery",
  schema_version: 1 as const,
  checksum: "a".repeat(64),
  source_revision: 4,
  created_by_user_id: "user-1",
  correlation_id: "command-1",
  created_at: "2026-07-10T00:00:00Z",
  integrity: { status: "verified", verified: true, algorithm: "sha256" as const, message: "verified" },
};

const schedule = {
  project: { id: "project-1", name: "Plan", status: "active", start: "2026-08-01", end: "2026-08-31", revision: 4 },
  tasks: [{ id: "task-1", project_id: "project-1", version: 1, title: "Build", task_type: "task", status: "planned", start: "2026-08-03", end: "2026-08-05", duration_days: 3, progress: 0, sort_order: 1, critical: true }],
  dependencies: [], resources: [], assignments: [], links: [], baselines: [],
  validation: { ok: true, violations: [], warnings: [] },
} as unknown as PlanningSchedule;

describe("PlanningAnalysisPanel", () => {
  beforeEach(() => {
    vi.mocked(listPlanningWhatIfSnapshots).mockResolvedValue([metadata]);
    vi.mocked(loadPlanningWhatIfSnapshot).mockResolvedValue({
      ...metadata,
      snapshot: {
        schema_version: 1,
        source: { project_id: "project-1", revision: 4, captured_at: metadata.created_at },
        proposal: { name: metadata.name, temporary: true, task_changes: [{ task_id: "task-1", start: "2026-08-04" }] },
        approved: {},
        preview: { tasks: [], calculation: {}, validation: { ok: true, violations: [], independent_issue_count: 0 } },
      },
    });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows verified immutable snapshots and submits a temporary preview", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<PlanningAnalysisPanel token="token" schedule={schedule} busy="" readOnly={false} canAnalyze onCreate={onCreate} />);

    await screen.findByText("revision 4 · verified");
    await screen.findByText("Preview constraints valid");
    fireEvent.change(screen.getByLabelText("Preview start"), { target: { value: "2026-08-04" } });
    fireEvent.click(screen.getByRole("button", { name: "Capture preview" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({
      name: "What-if schedule",
      task_changes: [{ task_id: "task-1", start: "2026-08-04", end: "2026-08-05" }],
    }));
  });

  it("fails closed without server analysis authority", async () => {
    render(<PlanningAnalysisPanel token="token" schedule={schedule} busy="" readOnly={false} canAnalyze={false} onCreate={vi.fn()} />);
    await screen.findByText("Server analysis capability is required to create snapshots.");
    expect((screen.getByRole("button", { name: "Capture preview" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
