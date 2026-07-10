import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlanningAnalysisPanel } from "./PlanningAnalysisPanel";
import { listPlanningRecommendations, listPlanningRiskAnalyses, listPlanningWhatIfSnapshots, loadPlanningWhatIfSnapshot } from "./planningAnalysisApi";
import type { PlanningSchedule } from "./types";

vi.mock("./planningAnalysisApi", () => ({
  listPlanningWhatIfSnapshots: vi.fn(),
  loadPlanningWhatIfSnapshot: vi.fn(),
  listPlanningRiskAnalyses: vi.fn(),
  listPlanningRecommendations: vi.fn(),
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

const lifecycleProps = {
  canApprove: true,
  onRunOptimization: vi.fn(),
  onDecideRecommendation: vi.fn(),
  onApplyRecommendation: vi.fn(),
  onRollbackRecommendation: vi.fn(),
};

describe("PlanningAnalysisPanel", () => {
  beforeEach(() => {
    vi.mocked(listPlanningWhatIfSnapshots).mockResolvedValue([metadata]);
    vi.mocked(listPlanningRiskAnalyses).mockResolvedValue([]);
    vi.mocked(listPlanningRecommendations).mockResolvedValue([]);
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
    render(<PlanningAnalysisPanel {...lifecycleProps} token="token" schedule={schedule} busy="" readOnly={false} canAnalyze onCreate={onCreate} onRunRisk={vi.fn()} />);

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
    render(<PlanningAnalysisPanel {...lifecycleProps} token="token" schedule={schedule} busy="" readOnly={false} canAnalyze={false} onCreate={vi.fn()} onRunRisk={vi.fn()} />);
    await screen.findByText("Server analysis capability is required to create snapshots.");
    expect((screen.getByRole("button", { name: "Capture preview" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("submits a bounded fixed-seed triangular risk run", async () => {
    const onRunRisk = vi.fn().mockResolvedValue(undefined);
    render(<PlanningAnalysisPanel {...lifecycleProps} token="token" schedule={schedule} busy="" readOnly={false} canAnalyze onCreate={vi.fn()} onRunRisk={onRunRisk} />);
    await screen.findByText("Preview constraints valid");
    fireEvent.change(screen.getByLabelText("Random seed"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Run risk analysis" }));
    await waitFor(() => expect(onRunRisk).toHaveBeenCalledWith({
      snapshot_id: "snapshot-1",
      seed: 123,
      iterations: 500,
      task_risks: [{ task_id: "task-1", distribution: "triangular", minimum_days: 2, most_likely_days: 3, maximum_days: 5 }],
      correlations: [],
    }));
  });

  it("keeps optimization advisory until an authorized explicit approval", async () => {
    vi.mocked(listPlanningRecommendations).mockResolvedValue([{
      id: "recommendation-1", project_id: "project-1", analysis_run_id: "optimization-1",
      key: "compress:task-1:1d", rank: 1, status: "proposed", title: "Compress Build by one working day", source_revision: 4,
      explanation: { why: "Critical task", impact: "Finish improves by one day.", side_effects: ["Owner confirmation required."], assumptions: ["Calendar unchanged."] },
      proposal: { task_changes: [{ task_id: "task-1", before: { start: "2026-08-03", end: "2026-08-05", duration_days: 3 }, after: { start: "2026-08-03", end: "2026-08-04", duration_days: 2 } }] },
      preview: { calculated_finish: "2026-08-04", target_variance_days: -1, validation: { ok: true, violations: [] } },
      decision: { reason: null, user_id: null, at: null }, application: { user_id: null, at: null, revision: null }, rollback: { user_id: null, at: null, revision: null },
    }]);
    const onRunOptimization = vi.fn().mockResolvedValue(undefined);
    const onDecideRecommendation = vi.fn().mockResolvedValue(undefined);
    render(<PlanningAnalysisPanel {...lifecycleProps} onRunOptimization={onRunOptimization} onDecideRecommendation={onDecideRecommendation} token="token" schedule={schedule} busy="" readOnly={false} canAnalyze onCreate={vi.fn()} onRunRisk={vi.fn()} />);
    await screen.findByText("#1 Compress Build by one working day");
    fireEvent.click(screen.getByRole("button", { name: "Analyze and recommend" }));
    await waitFor(() => expect(onRunOptimization).toHaveBeenCalledWith({ snapshot_id: "snapshot-1", objective: "minimize_project_finish", timeout_ms: 500, max_candidates: 50 }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(onDecideRecommendation).toHaveBeenCalledWith("recommendation-1", "approve", "Reviewed with the delivery owner"));
  });
});
