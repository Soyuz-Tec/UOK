import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanningPortfolioView } from "./PlanningPortfolioView";
import type { PlanningPortfolioResponse } from "./portfolioTypes";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Planning portfolio", () => {
  it("shows explainable health, applies bounded filters, and opens a project", async () => {
    const onOpenProject = vi.fn();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(portfolio));
    render(<PlanningPortfolioView token="token" onOpenProject={onOpenProject} />);

    expect(await screen.findByRole("table", { name: "Multi-project delivery portfolio" })).toBeTruthy();
    expect(screen.getByText("Blocked")).toBeTruthy();
    expect(screen.getByText(/6 queries/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search projects"), { target: { value: "Alpha" } });
    fireEvent.change(screen.getByLabelText("Project status"), { target: { value: "active" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1][0])).toContain("query=Alpha&status=active&limit=50&offset=0");
    fireEvent.click(screen.getByRole("button", { name: "Open project Alpha delivery" }));
    expect(onOpenProject).toHaveBeenCalledWith("project-1");
  });
});

function response(body: PlanningPortfolioResponse) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

const portfolio: PlanningPortfolioResponse = {
  total: 1, limit: 50, offset: 0, query: "", status: "",
  projects: [{
    id: "project-1", name: "Alpha delivery", status: "active", start: "2026-08-01", end: "2026-08-31", timezone: "UTC", revision: 4, updated_at: "2026-08-01T00:00:00Z",
    metrics: { task_count: 8, completed_task_count: 2, in_progress_task_count: 3, blocked_task_count: 1, milestone_count: 2, dependency_count: 7, completion_percent: 25 },
    attention: { health: "blocked", overdue_task_count: 1, gate_blocker_count: 1, unavailable_blocking_link_count: 0, project_overdue: false, issue_count: 3 },
  }],
  summary: { visible_project_count: 1, total_project_count: 1, task_count: 8, completed_task_count: 2, blocked_task_count: 1, overdue_task_count: 1, gate_blocker_count: 1, at_risk_project_count: 1, status_counts: { active: 1 }, range_start: "2026-08-01", range_end: "2026-08-31" },
  diagnostics: { strategy: "bounded_aggregate_v1", query_count: 6, elapsed_ms: 12.4 },
};
